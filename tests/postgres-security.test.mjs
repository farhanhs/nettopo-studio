import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../db/topology-postgres.ts", import.meta.url), "utf8");

test("masked credential reads never select ciphertext columns", () => {
  const readStart = source.indexOf("export async function readDeviceCredentials");
  const readEnd = source.indexOf("export async function upsertDeviceCredential");
  const readSource = source.slice(readStart, readEnd);

  assert.ok(readStart >= 0 && readEnd > readStart);
  assert.doesNotMatch(readSource, /secret_ciphertext|username_ciphertext|secret_nonce/);
  assert.match(readSource, /username_masked/);
  assert.match(readSource, /secret_masked/);
});

test("all customer, topology, and credential mutations have audit actions", () => {
  for (const action of [
    "customer.create",
    "customer.rename",
    "customer.duplicate",
    "customer.delete",
    "topology.create",
    "topology.project.save",
    "topology.rename",
    "topology.duplicate",
    "topology.delete",
    "credential.upsert",
    "credential.delete",
  ]) {
    assert.match(source, new RegExp(`action: ["']${action.replaceAll(".", "\\.")}["']`));
  }
});

test("audit metadata never includes credential plaintext or ciphertext", () => {
  const auditHelperStart = source.indexOf("type AuditEntry");
  assert.ok(auditHelperStart >= 0);
  assert.doesNotMatch(source.slice(auditHelperStart), /metadata:\s*\{[^}]*\b(secret|username|ciphertext|nonce)\b/si);
});
