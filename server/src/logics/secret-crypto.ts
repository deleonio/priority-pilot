import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Verschlüsselung gespeicherter Zugangsdaten (#2211, CalDAV-App-Passwort): AES-256-GCM, Schlüssel
 * aus `CALDAV_ENCRYPTION_KEY` (beliebiger String, per SHA-256 auf 32 Byte abgeleitet). Die Env wird
 * bei jedem Aufruf gelesen. Format: `iv.tag.chiffrat`, je Base64.
 */

const keyOf = (): Buffer => {
	const secret = process.env.CALDAV_ENCRYPTION_KEY?.trim();
	if (!secret) throw new Error('CALDAV_ENCRYPTION_KEY fehlt.');
	return createHash('sha256').update(secret).digest();
};

export const isSecretKeyConfigured = (): boolean => !!process.env.CALDAV_ENCRYPTION_KEY?.trim();

export const encryptSecret = (plain: string): string => {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', keyOf(), iv);
	const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
};

/** Wirft bei falschem Schlüssel oder verändertem Chiffrat (GCM-Tag). */
export const decryptSecret = (encrypted: string): string => {
	const [iv, tag, data] = encrypted.split('.').map((part) => Buffer.from(part, 'base64'));
	const decipher = createDecipheriv('aes-256-gcm', keyOf(), iv);
	decipher.setAuthTag(tag);
	return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
};
