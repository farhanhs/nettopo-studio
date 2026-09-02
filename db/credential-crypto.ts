import { MASKED_SECRET, maskCredentialUsername } from "../app/lib/credential-masking.ts";

const textEncoder = new TextEncoder();

type EncryptCredentialInput = {
  username?: string;
  secret: string;
  context: string;
};

type EncryptionOptions = {
  encodedKey?: string;
  keyVersion?: string;
};

function decodeBase64(value: string) {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("NETTOPO_CREDENTIAL_ENCRYPTION_KEY must be valid base64.");
  }
}

function encodeBase64(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export { maskCredentialUsername };

export async function encryptCredentialEnvelope(input: EncryptCredentialInput, options: EncryptionOptions = {}) {
  const encodedKey = options.encodedKey ?? process.env.NETTOPO_CREDENTIAL_ENCRYPTION_KEY;
  if (!encodedKey) throw new Error("NETTOPO_CREDENTIAL_ENCRYPTION_KEY is required to store credentials.");
  const keyBytes = decodeBase64(encodedKey);
  if (keyBytes.byteLength !== 32) {
    throw new Error("NETTOPO_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  if (!input.secret) throw new Error("Credential secret is required.");

  const keyVersion = options.keyVersion ?? process.env.NETTOPO_CREDENTIAL_KEY_VERSION ?? "v1";
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, ["encrypt"]);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = textEncoder.encode(JSON.stringify({ username: input.username?.trim() || null, secret: input.secret }));
  const ciphertext = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv: nonce,
    additionalData: textEncoder.encode(input.context),
  }, key, plaintext);

  return {
    usernameMasked: maskCredentialUsername(input.username),
    secretMasked: MASKED_SECRET,
    secretCiphertext: encodeBase64(ciphertext),
    secretNonce: encodeBase64(nonce),
    keyVersion,
  };
}
