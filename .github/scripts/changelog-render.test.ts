import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Tests für changelog-render.sh — baut CHANGELOG.md aus GitHub-Releases (#1372).
 *
 * `gh` wird per PATH-Stub ersetzt (Muster harness-comment.test.ts): der Stub cat't eine
 * Fixture-Datei, unabhängig von den übergebenen Argumenten. Die Kategorien liest das Skript
 * aus dem ECHTEN `.github/release.yml` dieses Repos (keine zweite Kategorieliste) — die
 * Fixture-Bodys nutzen deshalb dessen tatsächliche Titel. Läuft über `pnpm test:scripts`.
 */

const script = join(fileURLToPath(new URL('.', import.meta.url)), 'changelog-render.sh');

let stubDir: string;
let fixturePath: string;
let outPath: string;

const run = (args: string[]): ReturnType<typeof spawnSync> =>
	spawnSync('bash', [script, '--repo', 'o/r', '--out', outPath, ...args], {
		env: { ...process.env, PATH: `${stubDir}:${process.env.PATH}`, GH_FIXTURE: fixturePath },
		encoding: 'utf8',
	});

before(() => {
	stubDir = mkdtempSync(join(tmpdir(), 'changelog-render-stub-'));
	const gh = join(stubDir, 'gh');
	writeFileSync(gh, '#!/usr/bin/env bash\ncat "$GH_FIXTURE"\n');
	chmodSync(gh, 0o755);
	fixturePath = join(stubDir, 'fixture.json');
});

after(() => rmSync(stubDir, { recursive: true, force: true }));

beforeEach(() => {
	outPath = join(stubDir, `out-${Math.random().toString(36).slice(2)}.md`);
});

const release = (tag: string, date: string, body: string, draft = false) => ({
	tag_name: tag,
	published_at: `${date}T10:00:00Z`,
	body,
	draft,
});

const FULL_CHANGELOG_LINE = (from: string, to: string) =>
	`**Full Changelog**: https://github.com/o/r/compare/${from}...${to}`;

const bodyWithCategories = (compareFrom: string, tag: string) =>
	[
		`<!-- Release notes generated using configuration in .github/release.yml at ${tag} -->`,
		'',
		"## What's Changed",
		'### 🎉 New Features',
		'* feat(frontend): add thing by @bot in https://github.com/o/r/pull/1',
		'### 🐞 Bug Fixes',
		'* fix(server): fix thing by @bot in https://github.com/o/r/pull/2',
		'',
		'',
		FULL_CHANGELOG_LINE(compareFrom, tag),
	].join('\n');

describe('changelog-render.sh — AK1/AK2 Versionsabschnitte + Kategorie-Gruppierung', () => {
	it('erzeugt je Release genau einen Abschnitt, absteigend sortiert, Kategorien in release.yml-Reihenfolge', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([
				release('v2.0.0', '2026-01-02', bodyWithCategories('v1.0.0', 'v2.0.0')),
				release('v1.0.0', '2026-01-01', bodyWithCategories('v0.9.0', 'v1.0.0')),
			]),
		);
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');

		const v2Index = out.indexOf('## v2.0 - 2026-01-02');
		const v1Index = out.indexOf('## v1.0 - 2026-01-01');
		assert.ok(v2Index >= 0 && v1Index >= 0, out);
		assert.ok(v2Index < v1Index, 'neueste Version zuerst');

		const featIndex = out.indexOf('### 🎉 New Features');
		const fixIndex = out.indexOf('### 🐞 Bug Fixes');
		assert.ok(featIndex > v2Index && featIndex < v1Index, 'Kategorie gehört zum richtigen Abschnitt');
		assert.ok(featIndex < fixIndex, 'release.yml-Reihenfolge: New Features vor Bug Fixes');
		assert.match(out, /- feat\(frontend\): add thing by @bot/);
		assert.match(out, /- fix\(server\): fix thing by @bot/);
	});

	it('lässt Kategorien ohne Einträge weg', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([release('v1.0.0', '2026-01-01', bodyWithCategories('v0.9.0', 'v1.0.0'))]),
		);
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');
		assert.doesNotMatch(out, /### 💥 Breaking Changes/);
		assert.doesNotMatch(out, /### 🚀 Improvements/);
	});
});

describe('changelog-render.sh — AK3 Release ohne kategorisierte Einträge', () => {
	it('behält den Versionsabschnitt und bekommt genau eine Hinweiszeile, keine ###-Untergruppe', () => {
		const emptyBody = [
			'<!-- Release notes generated using configuration in .github/release.yml at v1.0.0 -->',
			'',
			'',
			FULL_CHANGELOG_LINE('v0.9.0', 'v1.0.0'),
		].join('\n');
		writeFileSync(fixturePath, JSON.stringify([release('v1.0.0', '2026-01-01', emptyBody)]));
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');
		assert.match(out, /## v1\.0 - 2026-01-01/);
		assert.doesNotMatch(out, /### /);
		const hints = out.match(/_Keine für Nutzer sichtbaren Änderungen\._/g) ?? [];
		assert.equal(hints.length, 1);
	});
});

describe('changelog-render.sh — AK4 Rauschen aus den Release-Bodys', () => {
	it('entfernt den führenden HTML-Kommentar und die Full-Changelog-Zeile', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([release('v1.0.0', '2026-01-01', bodyWithCategories('v0.9.0', 'v1.0.0'))]),
		);
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');
		assert.doesNotMatch(out, /<!--/);
		assert.doesNotMatch(out, /Full Changelog/);
	});
});

describe('changelog-render.sh — AK5 Paginierung + Idempotenz', () => {
	it('sammelt Releases aus mehreren gh---paginate-Seiten', () => {
		const page1 = [release('v2.0.0', '2026-01-02', bodyWithCategories('v1.0.0', 'v2.0.0'))];
		const page2 = [release('v1.0.0', '2026-01-01', bodyWithCategories('v0.9.0', 'v1.0.0'))];
		writeFileSync(fixturePath, JSON.stringify(page1) + JSON.stringify(page2));
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');
		assert.match(out, /## v2\.0 - 2026-01-02/);
		assert.match(out, /## v1\.0 - 2026-01-01/);
	});

	it('ist idempotent: zweiter Lauf ohne neue Releases ändert die Datei nicht', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([release('v1.0.0', '2026-01-01', bodyWithCategories('v0.9.0', 'v1.0.0'))]),
		);
		const first = run([]);
		assert.equal(first.status, 0, first.stderr);
		const firstContent = readFileSync(outPath, 'utf8');
		const second = run([]);
		assert.equal(second.status, 0, second.stderr);
		const secondContent = readFileSync(outPath, 'utf8');
		assert.equal(firstContent, secondContent);
	});

	it('ignoriert Draft-Releases', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([
				release('v2.0.0', '2026-01-02', bodyWithCategories('v1.0.0', 'v2.0.0'), true),
				release('v1.0.0', '2026-01-01', bodyWithCategories('v0.9.0', 'v1.0.0')),
			]),
		);
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');
		assert.doesNotMatch(out, /v2\.0/);
		assert.match(out, /v1\.0/);
	});
});

describe('changelog-render.sh — Minor-Gruppierung', () => {
	it('fasst Releases derselben Minor-Version zu einem Abschnitt zusammen, Bullets chronologisch aufsteigend', () => {
		writeFileSync(
			fixturePath,
			JSON.stringify([
				release('v0.2.0', '2026-01-03', bodyWithCategories('v0.1.2', 'v0.2.0')),
				release('v0.1.2', '2026-01-02', bodyWithCategories('v0.1.1', 'v0.1.2')),
				release('v0.1.1', '2026-01-01', bodyWithCategories('v0.1.0', 'v0.1.1')),
			]),
		);
		const res = run([]);
		assert.equal(res.status, 0, res.stderr);
		const out = readFileSync(outPath, 'utf8');

		const v02Sections = out.match(/## v0\.2 - /g) ?? [];
		const v01Sections = out.match(/## v0\.1 - /g) ?? [];
		assert.equal(v02Sections.length, 1, out);
		assert.equal(v01Sections.length, 1, out);

		const v02Index = out.indexOf('## v0.2 - 2026-01-03');
		const v01Index = out.indexOf('## v0.1 - ');
		assert.ok(v02Index >= 0 && v02Index < v01Index, out);

		assert.match(out, /_Enthält v0\.1\.1 – v0\.1\.2\._/);
		const v01Section = out.slice(v01Index);
		const v02Section = out.slice(v02Index, v01Index);
		assert.doesNotMatch(v02Section, /_Enthält /);

		const featBulletsInV01 = v01Section.match(/- feat\(frontend\): add thing by @bot/g) ?? [];
		assert.equal(featBulletsInV01.length, 2, 'beide Releases der v0.1-Gruppe tragen zum selben Abschnitt bei');
	});
});

describe('changelog-render.sh — Argumentfehler', () => {
	it('exitet mit 2, wenn --repo fehlt', () => {
		const res = spawnSync('bash', [script], { encoding: 'utf8' });
		assert.equal(res.status, 2);
		assert.match(res.stderr, /--repo/);
	});
});
