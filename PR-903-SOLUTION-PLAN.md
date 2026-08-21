# Lösungsplan für PR #903: @axe-core/playwright Integration

## Ausgangslage

**PR #903** implementiert **Issue #902**: `@axe-core/playwright` für gezielte E2E-A11y-Tests.

### Was der PR liefert (bereits implementiert)

- ✅ `@axe-core/playwright` ^4.13.0 als devDependency in `frontend/package.json`
- ✅ Migration von `dark-mode-contrast.spec.ts`: handgerollte `measureContrast` → `AxeBuilder`
- ✅ Pattern-Doc: `public/docs/e2e-a11y-pattern.md` (AxeBuilder mit KoliBri Shadow DOM)
- ✅ Spec-Test: `e2e/issue-902.spec.ts` (4 Tests für Journeys 1-4)
- ✅ Alle Issue-902-Tests laufen grün (4/4)

### Blocker: Spec-Test Design (Finding #1)

**Problem:** `e2e/issue-902.spec.ts` nutzt `page.request.get()` für Dateien, die der Vite-Dev-Server **nicht** ausliefert:

- `/package.json` → 404 (außerhalb Web-Root)
- `/e2e/dark-mode-contrast.spec.ts` → 404
- `/e2e/issue-787.spec.ts` → 404
- Nur `/docs/e2e-a11y-pattern.md` funktioniert (liegt in `public/` → wird als `/docs/...` serviert)

**Owner-Entscheidung (deleonio, 20.08.):** _"Mach doch einfach den Test ganz."_ → **Option 1.3**: Struktur-Assertions ersatzlos entfernen, nur Laufzeitverhalten (axe-Scan) testen.

### Unrelated CI-Fehler

- `keyboard-shortcuts.spec.ts:62` flaky (Issue #243) — **nicht** Teil von PR 903
- Dokumentiert in Kommentar #5336523179
- Lokal 10/10 grün, nur CI-Sharding-Timing-Problem

---

## Lösungsplan

### Phase 1: Spec-Test bereinigen (Owner-Wunsch: Option 1.3)

**Ziel:** `e2e/issue-902.spec.ts` auf das Wesentliche reduzieren — nur AxeBuilder-Laufzeitverhalten testen.

**Änderungen an `frontend/e2e/issue-902.spec.ts`:**

1. **Journey 1 (Dependency-Check) entfernen** — `page.request.get('/package.json')` ist E2E-Anti-Pattern
2. **Journey 2 (Migration-Check) entfernen** — `page.request.get('/e2e/*.spec.ts')` prüft Repo-Struktur, nicht Laufzeit
3. **Journey 3 (Pattern-Doc HTTP-Check) entfernen** — `page.request.get('/docs/...')` bringt keinen Mehrwert; Doc ist im Browser erreichbar
4. **Journey 4 (Meta-Test) entfernen** — prüft nur Datei-Existenz/Syntax, keine A11y-Funktionalität
5. **Behalten:** Ein einziger Test, der einen **echten AxeBuilder-Scan** ausführt und grüne Violations erwartet

**Neuer minimaler Spec-Test:**

```typescript
test('AxeBuilder-Scan läuft ohne Kontrast-Verstöße auf Dashboard', async ({ page }) => {
	await page.goto('/');
	await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
	await expect(page.locator('.dashboard-next-task')).toBeVisible();

	const results = await new AxeBuilder({ page })
		.include('.dashboard-next-task')
		.include('.dashboard-suggestions')
		.withTags(['wcag2aa'])
		.analyze();

	const contrastViolations = results.violations.filter(
		(v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced',
	);
	expect(contrastViolations).toEqual([]);
});
```

**Begründung (Minimalprinzip):**

- Ein Test muss etwas **auswerten** (echter Axe-Scan), einen **Spiegel** absichern (Migration funktioniert) oder vor **stillem/teurem** Ausfall schützen
- Repo-Struktur-Checks (`package.json`, Source-Files) gehören in Unit-Tests oder Pre-Commit, nicht in E2E
- Der verbleibende Test ist der **echte Vertrag**: AxeBuilder funktioniert mit KoliBri Shadow DOM

---

### Phase 2: Unrelated Flaky-Test separat behandeln

**Nicht Teil dieses PRs**, aber für grünen CI nötig:

- Issue #243: `keyboard-shortcuts.spec.ts` flaky im CI-Sharding
- Separater Fix nötig (Timeout-Erhöhung, Warte-Strategie, oder Test-Isolierung)
- **Aktion:** Issue #243 reaktivieren / neues Issue anlegen, PR 903 davon entkoppeln

---

### Phase 3: PR abschließen

**Checkliste für Merge:**

- [ ] Spec-Test bereinigt (nur 1 AxeBuilder-Integrationstest)
- [ ] `pnpm --filter frontend test:e2e e2e/issue-902.spec.ts` → grün
- [ ] `pnpm --filter frontend test:e2e e2e/dark-mode-contrast.spec.ts` → grün
- [ ] `pnpm format` & `pnpm lint` → grün
- [ ] `ai:needs-human` Label entfernen
- [ ] `ai:needs-review` Label setzen → Review triggern
- [ ] Unrelated Flaky (Issue #243) separat dokumentieren

---

## Aufwandsschätzung

| Aufgabe                                     | Aufwand     | Risiko      |
| ------------------------------------------- | ----------- | ----------- |
| Spec-Test auf 1 Integrationstest reduzieren | ~15 Min     | Niedrig     |
| E2E lokal verifizieren                      | ~5 Min      | Niedrig     |
| PR-Labels aktualisieren                     | ~1 Min      | -           |
| **Gesamt**                                  | **~20 Min** | **Niedrig** |

---

## Entscheidungshistorie

| Datum  | Entscheidung                                 | Begründung                                                    |
| ------ | -------------------------------------------- | ------------------------------------------------------------- |
| 18.08. | PR erstellt (Bot)                            | Issue #902 umgesetzt                                          |
| 19.08. | Review: Finding #1 (Spec-Test Design)        | `page.request.get()` für nicht servierte Dateien              |
| 19.08. | Optionen 1.1-1.4 vorgestellt                 | 1.1=Unit-Tests, 1.2=fs in E2E, 1.3=Entfernen, 1.4=Akzeptieren |
| 20.08. | **Owner: "Mach doch einfach den Test ganz"** | → **Option 1.3** gewählt                                      |
| 20.08. | Unrelated Flaky dokumentiert                 | Issue #243, nicht PR 903                                      |

---

## Nächste Schritte (für menschlichen Entscheider)

1. **Diesen Plan prüfen** — entspricht er der Owner-Aussage "Test ganz machen"?
2. **Spec-Test anpassen** — Journeys 1-4 entfernen, nur AxeBuilder-Integrationstest behalten
3. **Lokal testen** — `pnpm --filter frontend test:e2e e2e/issue-902.spec.ts`
4. **Commit & Push** — auf PR-Branch (Bot-Branch) oder lokaler Fixup-Branch
5. **Labels setzen** — `ai:needs-human` entfernen, `ai:needs-review` setzen
6. **Issue #243** separat angehen (Flaky-Test)

---

## Alternative (falls Option 1.1 gewünscht: Unit-Tests)

Falls doch Struktur-Checks gewünscht sind (gegen Owner-Aussage), wäre ein Unit-Test unter `frontend/test/unit/issue-902.spec.ts` mit `fs`-Zugriff der saubere Weg. Aber: **Minimalprinzip** — der E2E-Test ohne diese Checks reicht als Vertrag.
