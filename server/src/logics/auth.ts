import bcrypt from 'bcryptjs';
import { isAdminEmail } from './adminEmails.js';
import type { UserRole } from '../models/user.js';

// bcrypt-Cost-Faktor: 12 ist der aktuell empfohlene Mindestwert (OWASP) und
// balanciert Angriffskosten gegen Login-Latenz. AK 6 fordert cost ≥ 12.
const BCRYPT_COST = 12;

/**
 * Erzeugt einen bcrypt-Hash für ein Klartext-Passwort (Salt automatisch inline).
 * Der Hash beginnt mit `$2b$` und trägt den Cost-Faktor im Präfix.
 */
export const hashPassword = async (password: string): Promise<string> => {
	return bcrypt.hash(password, BCRYPT_COST);
};

/**
 * Prüft ein Klartext-Passwort gegen einen bcrypt-Hash.
 * Gibt `true` bei Übereinstimmung, sonst `false`.
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
	return bcrypt.compare(password, hash);
};

/**
 * Ermittelt die effektive Rolle eines Users für Register/Login/OAuth (Rollensystem admin/member).
 * `'admin'`, sobald die E-Mail in `ADMIN_EMAILS` gelistet ist — sonst bleibt die bestehende Rolle
 * erhalten (`currentRole`) bzw. `'member'` für neue Konten. Bewusst nur Beförderung, nie
 * automatische Rückstufung (siehe logics/adminEmails.ts).
 */
export const resolveRole = (email: string, currentRole?: UserRole): UserRole => {
	if (isAdminEmail(email)) {
		return 'admin';
	}
	return currentRole ?? 'member';
};
