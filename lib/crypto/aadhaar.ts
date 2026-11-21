import crypto from "crypto";

/**
 * Aadhaar Crypto Utility
 * Uses AES-256-GCM encryption with 12-byte random IV.
 * Plaintext Aadhaar is NEVER stored or logged.
 */

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.AADHAAR_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error("AADHAAR_ENCRYPTION_KEY is not configured in environment.");
  }
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `AADHAAR_ENCRYPTION_KEY must be a 32-byte key base64-encoded (got ${key.length} bytes).`
    );
  }
  return key;
}

export interface EncryptedAadhaarResult {
  /** Bytea format for PostgreSQL: \\x followed by hex of IV + AuthTag + Ciphertext */
  aadhaar_encrypted: string;
  aadhaar_last4: string;
  aadhaar_hash: string;
}

/**
 * Encrypts a 12-digit Aadhaar number and generates deterministic hash for duplicate detection.
 */
export function processAadhaarForStorage(aadhaarDigits: string): EncryptedAadhaarResult {
  const cleanAadhaar = aadhaarDigits.trim();
  if (!/^\d{12}$/.test(cleanAadhaar)) {
    throw new Error("Aadhaar must be exactly 12 numeric digits.");
  }

  const key = getEncryptionKey();

  // 1. Generate 12-byte IV for AES-GCM
  const iv = crypto.randomBytes(12);

  // 2. Encrypt with AES-256-GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(cleanAadhaar, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag(); // 16 bytes auth tag

  // Payload: IV (12) + Tag (16) + EncryptedCiphertext
  const payload = Buffer.concat([iv, tag, encrypted]);
  // Postgres bytea hex format: \\x<hexstring>
  const aadhaar_encrypted = "\\x" + payload.toString("hex");

  // 3. Extract last 4 digits
  const aadhaar_last4 = cleanAadhaar.slice(-4);

  // 4. Deterministic HMAC-SHA256 hash for duplicate check without exposing plaintext
  const aadhaar_hash = crypto
    .createHmac("sha256", key)
    .update(cleanAadhaar)
    .digest("hex");

  return {
    aadhaar_encrypted,
    aadhaar_last4,
    aadhaar_hash,
  };
}

/**
 * Decrypts Aadhaar bytea payload.
 * Used exclusively for logged Aadhaar reveal operations.
 */
export function decryptAadhaar(encryptedBytea: Buffer | string): string {
  const key = getEncryptionKey();

  let buf: Buffer;
  if (typeof encryptedBytea === "string") {
    // Strip leading '\\x' if present
    const cleanHex = encryptedBytea.startsWith("\\x")
      ? encryptedBytea.slice(2)
      : encryptedBytea;
    buf = Buffer.from(cleanHex, "hex");
  } else {
    buf = encryptedBytea;
  }

  if (buf.length < 28) {
    throw new Error("Invalid encrypted Aadhaar payload length.");
  }

  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
