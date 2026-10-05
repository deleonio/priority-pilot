import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EUR_TO_USD, lookupPrice, lookupZaiPrice } from './cost-from-transcript.ts';

/**
 * Tests für model-adapter.sh + .github/models.json — die kanonische Modell-Definition
 * (05.10.) und ihre Runtime-Adapter (cc = Claude Code, pi).
 *
 * Die falsche Entscheidung ist in beide Richtungen teuer: Eine cc-Form ohne [1m] kappt
 * das Kontextfenster, eine pi-Form außerhalb des eingebauten Katalogs fällt STILL auf
 * pis Default zurück (beobachtet 04.10.: 35 Läufe auf glm-5-turbo trotz flash-Eintrag).
 * Der Katalog-Guard-Fall braucht deshalb eine mutierte Datei-Kopie
 * (MODELS_FILE_OVERRIDE) — Produktivläufe lesen immer die Eingecheckte.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'model-adapter.sh');
const models = JSON.parse(
	readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), '..', 'models.json'), 'utf8'),
) as {
	endpoints: Record<string, string>;
	models: Record<string, { provider: string; context?: number; price?: { currency: string; in: number; out: number } }>;
	tiers: Record<string, Record<string, unknown>>;
};

const ALIASES = ['fable', 'opus', 'sonnet', 'haiku'] as const;
const PROVIDERS = ['claude', 'zai', 'openrouter'] as const;

const run = (args: readonly string[], envOverride?: string) => {
	const res = spawnSync('bash', [script, ...args], {
		env: { ...process.env, MODELS_FILE_OVERRIDE: envOverride ?? '' },
		encoding: 'utf8',
	});
	return { status: res.status, stdout: res.stdout, stderr: res.stderr };
};
const kv = (out: string, key: string) => out.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1];

let tmpDir: string;
before(() => {
	tmpDir = mkdtempSync(join(tmpdir(), 'model-adapter-'));
});
after(() => rmSync(tmpDir, { recursive: true, force: true }));

describe('models.json — Struktur (kanonische Quelle)', () => {
	it('führt alle drei Provider mit den vier Tier-Aliassen', () => {
		assert.deepEqual(Object.keys(models.tiers).sort(), [...PROVIDERS].sort());
		for (const provider of PROVIDERS) {
			assert.deepEqual(Object.keys(models.tiers[provider]).sort(), [...ALIASES].sort(), `tiers.${provider}`);
		}
	});

	it('referenziert nur definierte Modelle (inkl. deklarierter pi-Ersatzmodelle)', () => {
		for (const provider of PROVIDERS) {
			for (const alias of ALIASES) {
				const tier = models.tiers[provider][alias];
				const refs =
					typeof tier === 'object' && tier !== null
						? [tier.model, (tier as { pi?: string }).pi].filter(Boolean)
						: [tier];
				for (const ref of refs) {
					assert.ok(models.models[ref as string], `${provider}.${alias} → '${ref}' fehlt in models`);
				}
			}
		}
	});

	it('verlangt für Anthropic-kompatible Endpunkte https und deklariert pi-Ersatz nur unter zai', () => {
		for (const url of Object.values(models.endpoints)) assert.match(url, /^https:\/\//);
		// pi + claude ist verboten (Abo an Claude Code gebunden): tiers.claude darf kein
		// pi-Feld tragen — der Adapter weigert sich ohnehin (Guard-Test unten).
		for (const alias of ALIASES) {
			const tier = models.tiers.claude[alias];
			assert.ok(typeof tier === 'string', `tiers.claude.${alias} muss String sein (kein pi-Ersatz)`);
		}
	});
});

describe('model-adapter.sh — resolve cc (Claude Code)', () => {
	it('hängt [1m] nur an zai-Modelle mit 1M-Kontext', () => {
		assert.equal(
			kv(run(['resolve', '--runtime', 'cc', '--provider', 'zai', '--alias', 'opus']).stdout, 'resolved'),
			'glm-5.3[1m]',
		);
		assert.equal(
			kv(run(['resolve', '--runtime', 'cc', '--provider', 'claude', '--alias', 'opus']).stdout, 'resolved'),
			'claude-opus-5-5',
		);
		assert.equal(
			kv(run(['resolve', '--runtime', 'cc', '--provider', 'openrouter', '--alias', 'haiku']).stdout, 'resolved'),
			'poolside/laguna-s-2.1:free',
		);
	});

	it('meldet substituted=false und die kanonische ID', () => {
		const r = run(['resolve', '--runtime', 'cc', '--provider', 'zai', '--alias', 'sonnet']);
		assert.equal(kv(r.stdout, 'canonical'), 'glm-5.3-flash');
		assert.equal(kv(r.stdout, 'substituted'), 'false');
	});
});

describe('model-adapter.sh — resolve pi', () => {
	it('präfixiert die Provider-Form (zai/glm-5.3)', () => {
		const r = run(['resolve', '--runtime', 'pi', '--provider', 'zai', '--alias', 'opus']);
		assert.equal(kv(r.stdout, 'resolved'), 'zai/glm-5.3');
		assert.equal(kv(r.stdout, 'substituted'), 'false');
	});

	it('ersetzt deklarierte Ersatzmodelle transparent mit Notice (sonnet/haiku unter pi)', () => {
		for (const [alias, ersatz] of [
			['sonnet', 'glm-5-turbo'],
			['haiku', 'glm-4.7'],
		] as const) {
			const r = run(['resolve', '--runtime', 'pi', '--provider', 'zai', '--alias', alias]);
			assert.equal(kv(r.stdout, 'resolved'), `zai/${ersatz}`);
			assert.equal(kv(r.stdout, 'substituted'), 'true');
			assert.match(r.stderr, new RegExp(`pi-Ersatzmodell.*${ersatz}`), 'Notice erklärt den Ersatz');
		}
	});

	it('lässt openrouter-IDs in der vendor/form-Passung offen (pi/openrouter/…)', () => {
		const r = run(['resolve', '--runtime', 'pi', '--provider', 'openrouter', '--alias', 'fable']);
		assert.equal(kv(r.stdout, 'resolved'), 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free');
	});
});

describe('model-adapter.sh — Guards (laut statt still)', () => {
	it('weist pi + claude ab — das Anthropic-Abo ist an Claude Code gebunden', () => {
		const r = run(['resolve', '--runtime', 'pi', '--provider', 'claude', '--alias', 'opus']);
		assert.notEqual(r.status, 0);
		assert.match(r.stderr, /Anthropic-Abo.*Claude Code/);
	});

	it('bricht bei pi-unbekannter Ziel-ID LAUT ab (Katalog-Guard — der glm-5.3-flash-Vorfall)', () => {
		// Mutierte Kopie: zai.opus zeigt kanonisch auf ein Modell, das pi nicht kennt.
		const mutated = JSON.parse(JSON.stringify(models));
		mutated.models['glm-5.3-flash'] = { ...mutated.models['glm-5.3-flash'] };
		mutated.tiers.zai.opus = { model: 'glm-5.3-flash' }; // kein pi-Ersatz deklariert
		const mutatedPath = join(tmpDir, 'models-guard.json');
		writeFileSync(mutatedPath, JSON.stringify(mutated), 'utf8');
		const r = run(['resolve', '--runtime', 'pi', '--provider', 'zai', '--alias', 'opus'], mutatedPath);
		assert.notEqual(r.status, 0);
		assert.match(r.stderr, /pi-Katalog-Verstoß.*STILL/);
	});

	it('weist unbekannte Aliasse und Provider ab', () => {
		assert.notEqual(run(['resolve', '--runtime', 'cc', '--provider', 'zai', '--alias', 'keks']).status, 0);
		assert.notEqual(run(['resolve', '--runtime', 'cc', '--provider', 'grok', '--alias', 'opus']).status, 0);
		assert.notEqual(run(['resolve', '--runtime', 'egal', '--provider', 'zai', '--alias', 'opus']).status, 0);
	});
});

describe('model-adapter.sh — settings-local (Claude Code)', () => {
	it('baut die settings.local.json mit Endpoint, 4 Tier-IDs und Subagent = haiku', () => {
		for (const provider of ['zai', 'openrouter']) {
			const r = run(['settings-local', '--provider', provider]);
			assert.equal(r.status, 0);
			const env = (JSON.parse(r.stdout) as { env: Record<string, string> }).env;
			assert.equal(env.ANTHROPIC_BASE_URL, models.endpoints[provider]);
			for (const key of [
				'ANTHROPIC_DEFAULT_HAIKU_MODEL',
				'ANTHROPIC_DEFAULT_SONNET_MODEL',
				'ANTHROPIC_DEFAULT_OPUS_MODEL',
				'ANTHROPIC_DEFAULT_FABLE_MODEL',
				'CLAUDE_CODE_SUBAGENT_MODEL',
			]) {
				assert.ok(env[key], `${provider}: ${key} fehlt`);
			}
			assert.equal(env.CLAUDE_CODE_SUBAGENT_MODEL, env.ANTHROPIC_DEFAULT_HAIKU_MODEL);
		}
	});

	it('weist claude ab (nativ braucht keine settings.local.json)', () => {
		assert.notEqual(run(['settings-local', '--provider', 'claude']).status, 0);
	});
});

describe('model-adapter.sh — has-pi (Matrix-Zählung)', () => {
	it('zählt gültige pi-Formen: zai/openrouter = 4 Tiers, claude = 0', () => {
		assert.equal(kv(run(['has-pi', '--provider', 'zai']).stdout, 'count'), '4');
		assert.equal(kv(run(['has-pi', '--provider', 'openrouter']).stdout, 'count'), '4');
		assert.equal(kv(run(['has-pi', '--provider', 'claude']).stdout, 'count'), '0');
	});
});

describe('Preis-Konsistenz — models.json ist die eine Preisquelle', () => {
	it('lookupPrice je Modell == models.json (EUR × fixem Kurs, USD direkt)', () => {
		for (const [id, def] of Object.entries(models.models)) {
			const price = def.price;
			if (!price) {
				assert.equal(lookupPrice(id), undefined, `${id} ohne Preis muss Fremdtarif bleiben`);
				continue;
			}
			const row = lookupPrice(id);
			const factor = price.currency === 'EUR' ? EUR_TO_USD : 1;
			assert.ok(row, `${id} sollte einen Preis haben`);
			assert.ok(Math.abs((row?.[1] ?? -1) - price.in * factor) < 1e-9, `${id} in`);
			assert.ok(Math.abs((row?.[2] ?? -1) - price.out * factor) < 1e-9, `${id} out`);
		}
	});

	it('lookupZaiPrice liefert die EUR-Notierung unverändert', () => {
		const row = lookupZaiPrice('glm-5.3[1m]');
		assert.equal(row?.[0], 'glm-5.3');
		assert.ok(Math.abs((row?.[1] ?? 0) - 3.0 * EUR_TO_USD) < 1e-9); // EUR-Notierung × fixer Kurs
	});
});

// Hook-Dokumentation: chmod für direktes Ad-hoc-Testen (spawnSync bash braucht es nicht).
void chmodSync;
