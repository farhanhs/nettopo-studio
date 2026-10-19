import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { extractValidatedZip, locateArtifactRoot, sha256, verifyExtractedArtifact } from "./harness.mjs";

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) values[argv[index].replace(/^--/, "")] = argv[index + 1];
  return values;
}

export async function preparePackageEvidence({ zipPath, evidenceRoot }) {
  assert.equal(fs.existsSync(evidenceRoot), false, "QA evidence root must not pre-exist");
  fs.mkdirSync(evidenceRoot, { recursive: false });
  const extractionRoot = path.join(evidenceRoot, "extracted");
  const zipBytes = fs.readFileSync(zipPath);
  const entries = await extractValidatedZip(zipPath, extractionRoot);
  const artifactRoot = locateArtifactRoot(extractionRoot);
  const verified = verifyExtractedArtifact(artifactRoot);
  const evidence = {
    zipSha256: sha256(zipBytes),
    zipSize: zipBytes.length,
    entryCount: entries.length,
    artifactRoot: path.relative(evidenceRoot, artifactRoot).replaceAll("\\", "/"),
    manifest: verified.manifest,
    payloadCount: verified.payloadFiles.length,
    result: "PACKAGE_PREFLIGHT_PASS",
    productAcceptance: "NOT_RUN",
  };
  fs.writeFileSync(path.join(evidenceRoot, "package-preflight.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await preparePackageEvidence({ zipPath: path.resolve(args.zip), evidenceRoot: path.resolve(args.evidence) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
