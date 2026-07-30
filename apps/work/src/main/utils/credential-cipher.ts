import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const FORMAT_HEADER = Buffer.from("WCRD\x01", "binary");
const MIN_ENCRYPTED_LENGTH = FORMAT_HEADER.length + IV_LENGTH + AUTH_TAG_LENGTH + 1;

export const CREDENTIAL_KEY_FILE_NAME = "credential.key";

export class LocalCredentialCipher {
  private key?: Buffer;

  constructor(private readonly keyPath: string) {}

  encrypt(plainText: string): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    cipher.setAAD(FORMAT_HEADER);

    const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
    return Buffer.concat([FORMAT_HEADER, iv, cipher.getAuthTag(), encrypted]);
  }

  decrypt(encrypted: Buffer): string {
    if (
      encrypted.length < MIN_ENCRYPTED_LENGTH ||
      !encrypted.subarray(0, FORMAT_HEADER.length).equals(FORMAT_HEADER)
    ) {
      throw new Error("Stored credential uses an unsupported encryption format");
    }

    const ivStart = FORMAT_HEADER.length;
    const authTagStart = ivStart + IV_LENGTH;
    const encryptedDataStart = authTagStart + AUTH_TAG_LENGTH;
    const decipher = createDecipheriv(
      ALGORITHM,
      this.getKey(),
      encrypted.subarray(ivStart, authTagStart),
      { authTagLength: AUTH_TAG_LENGTH },
    );
    decipher.setAAD(FORMAT_HEADER);
    decipher.setAuthTag(encrypted.subarray(authTagStart, encryptedDataStart));

    return Buffer.concat([
      decipher.update(encrypted.subarray(encryptedDataStart)),
      decipher.final(),
    ]).toString("utf8");
  }

  private getKey(): Buffer {
    if (this.key) return this.key;

    let key: Buffer;
    try {
      key = readFileSync(this.keyPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      key = this.createKey();
    }

    if (key.length !== KEY_LENGTH) {
      throw new Error(`Credential key must be exactly ${KEY_LENGTH} bytes`);
    }

    this.key = key;
    return key;
  }

  private createKey(): Buffer {
    mkdirSync(dirname(this.keyPath), { recursive: true });
    const key = randomBytes(KEY_LENGTH);

    try {
      writeFileSync(this.keyPath, key, { flag: "wx", mode: 0o600 });
      chmodSync(this.keyPath, 0o600);
      return key;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      return readFileSync(this.keyPath);
    }
  }
}
