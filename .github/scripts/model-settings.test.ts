import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für .github/model-settings.json — die EINZIGE Modell-Settings-Quelle für
 * beide Agent-Runtimes (05.10., Nachfolger von model-ids.json + pi/model-aliases.json).
 *
 * Die falsche Entscheidung ist in beide Richtungen teuer: Ein fehlender Eintrag bricht
 * den Lauf laut im Setup (gewollt), ein TYPO in einer ID scheitert erst am Provider
 * ("model not found"). Diese Struktur-Tests fangen Formfehler vor dem Lauf ab.
 *
 * Matrix: Claude Code läuft gegen alle 3 Provider (cc-Form), pi nur gegen
 * zai|openrouter (pi-Form; pi+claude ist guarded — das Anthropic-Abo ist an
 * Claude Code gebunden).
 */

const file = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'model-settings.json');
const settings = JSON.parse(readFileSync(file, 'utf8')) as {
	endpoints: Record<string, string>;
	providers: Record<string, Record<string, { cc?: string; pi?: string }>>;
};

const ALIASES = ['fable', 'opus', 'sonnet', 'haiku'];
const CC_PROVIDERS = ['claude', 'zai', 'openrouter'];
const PI_PROVIDERS = ['zai', 'openrouter'];

describe('model-settings.json — Struktur', () => {
	it('enthält genau die drei Provider und die vier Aliasse', () => {
		assert.deepEqual(Object.keys(settings.providers).sort(), ['claude', 'openrouter', 'zai']);
		for (const provider of Object.keys(settings.providers)) {
			assert.deepEqual(Object.keys(settings.providers[provider]).sort(), [...ALIASES].sort(), `Provider ${provider}`);
		}
	});

	it('trägt Anthropic-kompatible Endpunkte für zai und openrouter', () => {
		assert.match(settings.endpoints.zai, /^https:\/\//);
		assert.match(settings.endpoints.openrouter, /^https:\/\//);
	});
});

describe('model-settings.json — cc-Formen (Claude Code, alle 3 Provider)', () => {
	for (const provider of CC_PROVIDERS) {
		for (const alias of ALIASES) {
			it(`${provider}.${alias}.cc ist nicht leer`, () => {
				const entry = settings.providers[provider]?.[alias];
				assert.ok(entry, `Eintrag fehlt`);
				assert.ok(typeof entry.cc === 'string' && entry.cc.length > 0, `cc-ID fehlt`);
			});
		}
	}
});

describe('model-settings.json — pi-Formen (nur zai|openrouter)', () => {
	for (const provider of PI_PROVIDERS) {
		for (const alias of ALIASES) {
			it(`${provider}.${alias}.pi ist nicht leer`, () => {
				const entry = settings.providers[provider]?.[alias];
				assert.ok(entry, `Eintrag fehlt`);
				assert.ok(typeof entry.pi === 'string' && entry.pi.length > 0, `pi-ID fehlt`);
			});
		}
	}

	it('claude hat bewusst KEINE pi-Einträge (pi + Anthropic ist guarded)', () => {
		for (const alias of ALIASES) {
			assert.equal(settings.providers.claude[alias].pi, undefined, `claude.${alias}.pi`);
		}
	});

	it('präfixiert pi-IDs mit dem Provider (pi-models.json-Konvention)', () => {
		for (const provider of PI_PROVIDERS) {
			for (const alias of ALIASES) {
				const pi = settings.providers[provider][alias].pi ?? '';
				assert.ok(pi.startsWith(`${provider}/`), `${provider}.${alias}.pi = '${pi}' beginnt nicht mit '${provider}/'`);
			}
		}
	});
});

describe('model-settings.json — ZAI-Tier-Übersetzung (Eskalationsleiter)', () => {
	it('cc: opus/fable auf glm-5.3[1m], sonnet/haiku auf glm-5.3-flash[1m]', () => {
		assert.match(settings.providers.zai.opus.cc!, /glm-5\.3\[1m\]/);
		assert.match(settings.providers.zai.fable.cc!, /glm-5\.3\[1m\]/);
		assert.match(settings.providers.zai.sonnet.cc!, /glm-5\.3-flash\[1m\]/);
		assert.match(settings.providers.zai.haiku.cc!, /glm-5\.3-flash\[1m\]/);
	});

	it('pi: nur die drei eingebauten zai-Modelle (glm-5.3 | glm-5-turbo | glm-4.7) — alles andere fällt still auf den pi-Default zurück', () => {
		// Beobachtet 04.10.: pi-Form 'zai/glm-5.3-flash' wurde ignoriert, 35 Läufe liefen
		// weiter auf glm-5-turbo (pi-Default), ohne Fehler. Die pi-Formen dürfen daher
		// NUR IDs aus pi --list-models tragen.
		assert.equal(settings.providers.zai.opus.pi, 'zai/glm-5.3');
		assert.equal(settings.providers.zai.fable.pi, 'zai/glm-5.3');
		assert.equal(settings.providers.zai.sonnet.pi, 'zai/glm-5-turbo');
		assert.equal(settings.providers.zai.haiku.pi, 'zai/glm-4.7');
	});

	it('nutzt die 1M-Kontext-Variante nur im cc-Pfad ([1m]-Suffix ist Anthropic-kompatibel-spezifisch)', () => {
		for (const alias of ALIASES) {
			assert.ok(!settings.providers.zai[alias].pi!.includes('[1m]'), `${alias}.pi`);
			assert.ok(settings.providers.zai[alias].cc!.includes('[1m]'), `${alias}.cc`);
		}
	});
});
