import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { BloggerCredentials } from '@content-os/shared';

// ============================================================================
// ENCRYPTED CREDENTIAL STORAGE
// ============================================================================

/**
 * Manages encrypted storage of OAuth credentials in local file system.
 * Uses AES-256-GCM encryption with a derived key from system environment.
 */
export class CredentialManager {
  private credDir = path.join(process.env.HOME || '~', '.content-os');
  private credFile = path.join(this.credDir, 'credentials.enc');
  private keyDerivationSalt = 'content-os-v1'; // In production, use random salt

  constructor() {
    // Ensure credential directory exists
    this.ensureDir();
  }

  /**
   * Store credentials with encryption
   */
  async saveCredentials(credentials: BloggerCredentials): Promise<void> {
    try {
      await this.ensureDir();

      const plaintext = JSON.stringify(credentials);
      const { encrypted, iv, authTag } = await this.encrypt(plaintext);

      const payload = {
        version: 1,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        data: encrypted.toString('hex'),
      };

      await fs.writeFile(this.credFile, JSON.stringify(payload), {
        mode: 0o600, // Read/write for owner only
      });

      console.log('[CredentialManager] Credentials saved securely');
    } catch (error) {
      console.error('[CredentialManager] Error saving credentials:', error);
      throw error;
    }
  }

  /**
   * Load and decrypt credentials
   */
  async loadCredentials(): Promise<BloggerCredentials | null> {
    try {
      const data = await fs.readFile(this.credFile, 'utf-8');
      const payload = JSON.parse(data);

      if (payload.version !== 1) {
        throw new Error('Unsupported credential version');
      }

      const iv = Buffer.from(payload.iv, 'hex');
      const authTag = Buffer.from(payload.authTag, 'hex');
      const encrypted = Buffer.from(payload.data, 'hex');

      const plaintext = await this.decrypt(encrypted, iv, authTag);
      return JSON.parse(plaintext);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('ENOENT')
      ) {
        return null; // No credentials stored yet
      }

      console.error('[CredentialManager] Error loading credentials:', error);
      throw error;
    }
  }

  /**
   * Check if credentials exist
   */
  async hasCredentials(): Promise<boolean> {
    try {
      await fs.access(this.credFile);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials(): Promise<void> {
    try {
      await fs.unlink(this.credFile);
      console.log('[CredentialManager] Credentials cleared');
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('ENOENT')
      ) {
        throw error;
      }
    }
  }

  // ========================================================================
  // PRIVATE ENCRYPTION METHODS
  // ========================================================================

  private async encrypt(
    plaintext: string
  ): Promise<{ encrypted: Buffer; iv: Buffer; authTag: Buffer }> {
    const key = await this.deriveKey();
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(plaintext, 'utf-8');
    encrypted = Buffer.concat([
      encrypted,
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return { encrypted, iv, authTag };
  }

  private async decrypt(
    encrypted: Buffer,
    iv: Buffer,
    authTag: Buffer
  ): Promise<string> {
    const key = await this.deriveKey();

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      iv
    );
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([
      decrypted,
      decipher.final(),
    ]);

    return decrypted.toString('utf-8');
  }

  private async deriveKey(): Promise<Buffer> {
    // Derive key from environment or system info
    // In production, use a more sophisticated key derivation
    const secret =
      process.env.CONTENT_OS_SECRET ||
      'default-dev-key'; // Use env var in production!

    return crypto.scryptSync(
      secret + this.keyDerivationSalt,
      'salt',
      32
    );
  }

  private async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.credDir, {
        recursive: true,
        mode: 0o700, // rwx for owner only
      });
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.includes('EEXIST')
      ) {
        throw error;
      }
    }
  }
}
