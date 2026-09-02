import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const migrationsDirectory = fileURLToPath(new URL("../../db/migrations/", import.meta.url));

export async function loadPostgresMigrationSources() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name);
  const sources = {};

  for (const filename of filenames) {
    sources[filename] = await readFile(join(migrationsDirectory, filename), "utf8");
  }

  return sources;
}
