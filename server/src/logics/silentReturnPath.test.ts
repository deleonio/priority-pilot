import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeReturnPath } from './silentReturnPath.js';

/**
 * Rote Spec-Tests für #1231 (Spec docs/spec/issue-1231.md, AK4) — Return-Path-Durchreichung
 * für den stillen Google-Login.
 *
 * Der Erfolgs-Callback (`/auth/google/callback` → Redirect auf den Return-Path statt fix `/`)
 * ist HTTP-seitig nicht testbar (echter Google-Token-Austausch). Einklagbar ist die reine
 * Logik: Der Silent-Einstieg nimmt `?returnTo=` auf, und der Callback leitet nur auf
 * Pfade um, die innerhalb der App liegen — Open-Redirect über `//host`, `https://…` oder
 * Backslash-Tricks (`/\host` — der URL-Parser normalisiert `\` zu `/`) muss `null` liefern.
 * `null` bedeutet „kein Return-Path" → Callback-Redirect bleibt bei `/`.
 */
describe('sanitizeReturnPath (#1231, AK4)', () => {
	it('kein Return-Path (undefined, leer, Non-String) → null', () => {
		assert.equal(sanitizeReturnPath(undefined), null);
		assert.equal(sanitizeReturnPath(null), null);
		assert.equal(sanitizeReturnPath(''), null);
		assert.equal(sanitizeReturnPath(42), null);
		assert.equal(sanitizeReturnPath({}), null);
	});

	it('interne Pfade werden unverändert durchgereicht', () => {
		assert.equal(sanitizeReturnPath('/aufgaben'), '/aufgaben');
		assert.equal(sanitizeReturnPath('/settings/general'), '/settings/general');
		assert.equal(sanitizeReturnPath('/tasks?view=done&x=1'), '/tasks?view=done&x=1');
	});

	it('Pfade ohne führenden Slash → null (keine relative Umleitung)', () => {
		assert.equal(sanitizeReturnPath('aufgaben'), null);
		assert.equal(sanitizeReturnPath('login'), null);
	});

	it('Open-Redirect-Versuche → null (AK4 darf keine fremde URL als Ziel zulassen)', () => {
		assert.equal(sanitizeReturnPath('https://evil.example'), null);
		assert.equal(sanitizeReturnPath('http://evil.example/pha'), null);
		assert.equal(sanitizeReturnPath('//evil.example'), null);
		// Backslash-Trick: Browser-URL-Parser normalisiert '\' zu '/' — '/\evil' würde zu '//evil'.
		assert.equal(sanitizeReturnPath('/\\evil.example'), null);
		assert.equal(sanitizeReturnPath('javascript:alert(1)'), null);
	});
});
