/**
 * Rote Spec-Tests für Issue #549
 *
 * "Testkonzept erstellen"
 *
 * Akzeptanzkriterien (aus Issue-Body / KI-Analyse):
 * AC1: Testkonzept ist als Markdown-Dokument unter `docs/testing.md` abgelegt.
 * AC2: Dokumentiert die Frameworks: Vitest für Unit-Tests, Playwright für E2E.
 * AC3: Führt die Core-Logik-Module als Unit-Test-Pflicht: value.ts, tree.ts, find.ts, cycle.ts.
 * AC4: Beschreibt den Test-Scope (Core-Logik + API-Layer + UI-Helfer) und die E2E-Happy-Paths
 *      (Aufgabe anlegen/bearbeiten/löschen, Abhängigkeit hinzufügen/entfernen); zudem die
 *      bewusste Ausnahme (Gitter-Workflows werden nicht getestet).
 * AC5: Nennt das Coverage-Ziel von mindestens 66 %.
 * AC6: Beschreibt die CI-Einbindung der Tests inkl. Coverage-Report.
 *
 * Dedup-Hinweis: Die zugehörigen TESTS (nicht das Konzept-Dokument) existieren bereits
 * umfangreich und werden hier NICHT dupliziert — server/src/logics/{value,tree,find,cycle}.test.ts
 * (AK3), server/src/express/*.test.ts + frontend/src/lib/*.test.ts (Scope C) sowie
 * frontend/e2e/crud.spec.ts + dependency-editor.spec.ts (E2E-Happy-Paths). Dieses Spec prüft
 * ausschließlich, dass das Konzept-Dokument `docs/testing.md` diese bestehende Suite konsistent
 * beschreibt. Die Tests sind rot, bis das Dokument angelegt ist.
 *
 * Die Tests prüfen ausschließlich Dateiinhalt — kein Produktivcode, keine Laufzeitlogik.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(process.cwd(), '..');
const DOC = 'docs/testing.md';

async function readDoc(): Promise<string> {
	return readFile(resolve(ROOT, DOC), 'utf-8');
}

describe('AC1 — Testkonzept als Markdown-Dokument unter docs/testing.md', () => {
	it('legt ein Markdown-Dokument docs/testing.md an', async () => {
		const content = await readDoc();
		assert.ok(content.trim().length > 0, `${DOC} darf nicht leer sein`);
		// Markdown-Struktur: mindestens eine Überschrift
		assert.match(content, /^#{1,6}\s+\S/m, `${DOC} muss mindestens eine Markdown-Überschrift enthalten`);
	});
});

describe('AC2 — Frameworks dokumentiert (Vitest für Unit, Playwright für E2E)', () => {
	it('nennt Vitest als Unit-Test-Framework', async () => {
		const content = await readDoc();
		assert.ok(
			/vitest/i.test(content),
			`${DOC} muss Vitest als Unit-Test-Framework nennen (native TS/ESM-Unterstützung, integriertes Mocking/Coverage).`,
		);
	});

	it('nennt Playwright als E2E-Framework', async () => {
		const content = await readDoc();
		assert.ok(
			/playwright/i.test(content),
			`${DOC} muss Playwright als E2E-Framework für die Happy-Path-Use-Cases nennen.`,
		);
	});
});

describe('AC3 — Core-Logik-Module als Unit-Test-Pflicht', () => {
	it('führt value.ts, tree.ts, find.ts und cycle.ts als zu testende Core-Logik auf', async () => {
		const content = await readDoc();
		for (const mod of ['value', 'tree', 'find', 'cycle']) {
			assert.ok(
				new RegExp(`\\b${mod}\\.ts\\b`).test(content),
				`${DOC} muss das Core-Logik-Modul "${mod}.ts" als Unit-Test-Pflicht aufführen (Berechnungen/Sortierlogik/Geschäftslogik).`,
			);
		}
	});
});

describe('AC4 — Test-Scope, E2E-Happy-Paths und bewusste Ausnahme', () => {
	it('beschreibt den Test-Scope (Core-Logik + API-Layer + UI-Helfer)', async () => {
		const content = await readDoc();
		assert.ok(/api/i.test(content), `${DOC} muss den API-Layer als Test-Scope nennen (Scope C).`);
		assert.ok(
			/ui|helfer|helper|frontend/i.test(content),
			`${DOC} muss UI-Helfer / Frontend-Logik als Test-Scope nennen (Scope C).`,
		);
	});

	it('nennt die E2E-Happy-Paths: Aufgabe anlegen/bearbeiten/löschen und Abhängigkeit hinzufügen/entfernen', async () => {
		const content = await readDoc();
		assert.ok(/anleg/i.test(content), `${DOC} muss den Happy-Path "Aufgabe anlegen" nennen.`);
		assert.ok(/bearbeit|ändern|aender/i.test(content), `${DOC} muss den Happy-Path "Aufgabe bearbeiten" nennen.`);
		assert.ok(/lösch|loesch/i.test(content), `${DOC} muss den Happy-Path "Aufgabe löschen" nennen.`);
		assert.ok(
			/abhängigkeit|abhaengigkeit|vorgänger|vorgaenger|dependency/i.test(content),
			`${DOC} muss die Abhängigkeit (hinzufügen/entfernen) als Happy-Path nennen.`,
		);
	});

	it('dokumentiert die bewusste Ausnahme: Gitter-Workflows werden nicht explizit getestet', async () => {
		const content = await readDoc();
		assert.ok(
			/gitter|workflow/i.test(content),
			`${DOC} muss die Ausnahme dokumentieren, dass Gitter-/GitHub-Workflows nicht explizit getestet werden.`,
		);
	});
});

describe('AC5 — Coverage-Ziel mindestens 66 %', () => {
	it('nennt ein Coverage-Ziel von mindestens 66 %', async () => {
		const content = await readDoc();
		assert.ok(
			/6\s*6\s*%|66\s*%|zwei[\s-]*drittel|2\s*\/\s*3/i.test(content),
			`${DOC} muss das Coverage-Ziel von mindestens 66 % (2/3) nennen.`,
		);
	});
});

describe('AC6 — CI-Einbindung inkl. Coverage-Report', () => {
	it('beschreibt, dass Tests grün in der CI-Pipeline laufen und ein Coverage-Report erstellt wird', async () => {
		const content = await readDoc();
		assert.ok(/ci|pipeline/i.test(content), `${DOC} muss die CI-Pipeline-Einbindung der Tests beschreiben.`);
		assert.ok(
			/coverage-?report|abdeckungs-?report|coverage[\s-]*report/i.test(content),
			`${DOC} muss erwähnen, dass ein Coverage-Report erstellt/ausgewertet wird.`,
		);
	});
});
