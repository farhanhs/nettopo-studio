import { createHash } from "node:crypto";

const MIGRATION_FILENAME = /^(\d+)_([a-z0-9][a-z0-9_-]*)\.sql$/i;
const MIGRATION_LOCK_KEY = "nettopo-studio-schema-migrations";
const LEGACY_RAW_CRLF_COMPATIBLE_VERSIONS = new Set(["0001", "0002", "0003", "0004"]);

export function postgresMigrationChecksum(source) {
  return createHash("sha256").update(source).digest("hex");
}

function detectMigrationEolStyle(filename, source) {
  if (source.charCodeAt(0) === 0xfeff) {
    throw new Error(`PostgreSQL migration ${filename} must not start with a UTF-8 BOM.`);
  }
  if (/\r(?!\n)/.test(source)) {
    throw new Error(`PostgreSQL migration ${filename} contains unsupported bare CR line endings.`);
  }

  const hasCrLf = source.includes("\r\n");
  const withoutCrLf = source.replaceAll("\r\n", "");
  const hasBareLf = withoutCrLf.includes("\n");
  if (hasCrLf && hasBareLf) {
    throw new Error(`PostgreSQL migration ${filename} contains mixed LF and CRLF line endings.`);
  }
  if (hasCrLf) return "crlf";
  if (hasBareLf) return "lf";
  return "none";
}

export function canonicalizePostgresMigrationSource(filename, source) {
  if (typeof source !== "string" || source.trim() === "") {
    throw new Error(`PostgreSQL migration ${filename} is empty.`);
  }

  const version = filename.match(MIGRATION_FILENAME)?.[1];
  const eolStyle = detectMigrationEolStyle(filename, source);
  const canonicalSource = source.replaceAll("\r\n", "\n");
  const checksum = postgresMigrationChecksum(canonicalSource);
  const legacyRawCrLfSource = canonicalSource.replaceAll("\n", "\r\n");
  const legacyRawCrLfChecksum = postgresMigrationChecksum(legacyRawCrLfSource);
  const allowsLegacyRawCrLf = Boolean(version && LEGACY_RAW_CRLF_COMPATIBLE_VERSIONS.has(version));
  const compatibleChecksums = !allowsLegacyRawCrLf || legacyRawCrLfChecksum === checksum
    ? []
    : [{ checksum: legacyRawCrLfChecksum, reason: "legacy_raw_crlf" }];

  return {
    canonicalSource,
    checksumInput: canonicalSource,
    eolStyle,
    checksum,
    compatibleChecksums,
  };
}

export function isCompatiblePostgresMigrationChecksum(appliedChecksum, migration) {
  if (appliedChecksum === migration.checksum) return true;
  return Boolean(migration.compatibleChecksums?.some(({ checksum }) => checksum === appliedChecksum));
}

export function definePostgresMigrations(sources) {
  const migrations = Object.entries(sources)
    .map(([filename, source]) => {
      const match = filename.match(MIGRATION_FILENAME);
      if (!match) throw new Error(`Invalid PostgreSQL migration filename: ${filename}`);
      const canonical = canonicalizePostgresMigrationSource(filename, source);
      return {
        version: match[1],
        name: match[2],
        filename,
        source: canonical.canonicalSource,
        checksum: canonical.checksum,
        compatibleChecksums: canonical.compatibleChecksums,
      };
    })
    .sort((left, right) => left.filename.localeCompare(right.filename, "en", { numeric: true }));

  if (migrations.length === 0) throw new Error("No PostgreSQL migrations were provided.");

  const versions = new Set();
  for (const migration of migrations) {
    if (versions.has(migration.version)) {
      throw new Error(`Duplicate PostgreSQL migration version: ${migration.version}`);
    }
    versions.add(migration.version);
  }

  return migrations;
}

export async function runPostgresMigrations(sql, migrations) {
  const result = { applied: [], skipped: [] };

  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${MIGRATION_LOCK_KEY}))`;
    await tx`
      create table if not exists schema_migrations (
        version text primary key,
        name text not null,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `;

    const appliedRows = await tx`select version, checksum from schema_migrations order by version`;
    const appliedChecksums = new Map(appliedRows.map((row) => [row.version, row.checksum]));

    for (const migration of migrations) {
      const appliedChecksum = appliedChecksums.get(migration.version);
      if (appliedChecksum) {
        if (!isCompatiblePostgresMigrationChecksum(appliedChecksum, migration)) {
          throw new Error(
            `PostgreSQL migration ${migration.filename} was changed after it was applied. ` +
            "Create a new migration instead of editing an applied migration.",
          );
        }
        result.skipped.push(migration.filename);
        continue;
      }

      await tx.unsafe(migration.source).simple();
      await tx`
        insert into schema_migrations (version, name, checksum)
        values (${migration.version}, ${migration.name}, ${migration.checksum})
      `;
      result.applied.push(migration.filename);
    }
  });

  return result;
}
