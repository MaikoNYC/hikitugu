/**
 * AES-256-GCM decryption helpers for OAuth token storage.
 * Compatible with Python backend crypto.py format:
 *   base64( IV[12 bytes] + ciphertext + GCM_tag[16 bytes] )
 */

const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  const keyBytes = base64ToBytes(raw);
  if (keyBytes.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must be ${KEY_LENGTH} bytes after base64 decode, got ${keyBytes.length}`
    );
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}

/**
 * Decrypt an AES-256-GCM encrypted token produced by Python's encrypt_token().
 *
 * The encrypted string is base64-encoded: IV (12 bytes) || ciphertext || GCM tag (16 bytes).
 * Web Crypto API expects tag appended to ciphertext, which matches Python's AESGCM output.
 */
export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();
  const raw = base64ToBytes(encrypted);
  const iv = raw.slice(0, IV_LENGTH);
  const ciphertextWithTag = raw.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertextWithTag,
  );

  return new TextDecoder().decode(plaintext);
}
