import assert from "node:assert/strict";
import test from "node:test";

import { encryptCredentialEnvelope, maskCredentialUsername } from "../db/credential-crypto.ts";

const encodedKey = Buffer.alloc(32, 7).toString("base64");

test("credential masking does not expose the original username", () => {
  assert.equal(maskCredentialUsername("admin"), "a***n");
  assert.equal(maskCredentialUsername("admin@example.com"), "a***@example.com");
  assert.equal(maskCredentialUsername(undefined), undefined);
});

test("credential encryption returns only masked and encrypted values", async () => {
  const encrypted = await encryptCredentialEnvelope({
    username: "admin",
    secret: "correct horse battery staple",
    context: "topology-1:device-1:device_admin",
  }, { encodedKey, keyVersion: "test-v1" });

  assert.equal(encrypted.usernameMasked, "a***n");
  assert.equal(encrypted.secretMasked, "********");
  assert.equal(encrypted.keyVersion, "test-v1");
  assert.doesNotMatch(encrypted.secretCiphertext, /admin|correct horse/);
  assert.equal(Buffer.from(encrypted.secretNonce, "base64").byteLength, 12);
});

test("credential encryption rejects missing and malformed keys", async () => {
  await assert.rejects(
    encryptCredentialEnvelope({ secret: "secret", context: "test" }, { encodedKey: "invalid" }),
    /valid base64|exactly 32 bytes/,
  );
  await assert.rejects(
    encryptCredentialEnvelope({ secret: "secret", context: "test" }, { encodedKey: Buffer.alloc(16).toString("base64") }),
    /exactly 32 bytes/,
  );
});
