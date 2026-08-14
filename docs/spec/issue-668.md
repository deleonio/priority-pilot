# Scanner: Fokus-Tab-Heuristik erkennt Abdeckung durch getrennte Tests/Helper nicht (Issue 668)

**Stand:** 2026-08-14  
**Test-Ebene:** Manuelles Test-Protokoll (`.github/scripts/` unterliegen Carve-Out - ADR #567)

## Ziel

Die Heuristik `.github/scripts/analyze-test-suite.ts` (Zeile 614-616, `detectBehaviorGaps`) so schärfen, dass Tab-Abdeckung erkannt wird, die in getrennten Test-Blöcken oder Helper-Funktionen lebt, um False Positives zu vermeiden.

## Vorbedingung

- Scanner-Script `.github/scripts/analyze-test-suite.ts` existiert
- Test-Datei `frontend/e2e/delete-dialog-focus.spec.ts` hat Tab-Abdeckung in getrennten Blöcken (AK4, AK8, AK9) und Helpern (`assertTabFreedomInOpenDeleteDialog`)

## Schritte

### Test 1: Lokaler Scanner-Lauf nach Heuristik-Anpassung

**Akzeptanzkriterium:** AK1 - "delete-dialog-focus.spec.ts wird nicht mehr mit 'Fokus-Vertrag ohne Tab-Freiheit' geflaggt"

**Vorgehensweise:**

```bash
# Scanner lokal laufen lassen
pnpm dlx tsx .github/scripts/analyze-test-suite.ts

# Oder nach Heuristik-Anpassung
pnpm dlx tsx .github/scripts/analyze-test-suite.ts | grep -A5 "delete-dialog-focus.spec.ts"
```

**Erwartetes Ergebnis:**

- [ ] Keine Critical-Findings "Fokus-Vertrag ohne Tab-Freiheit" für `delete-dialog-focus.spec.ts`
- [ ] Scanner erkennt Tab-Abdeckung in getrennten Blöcken (AK4/AK8/AK9)
- [ ] Scanner erkennt Tab-Abdeckung in Helpern (`assertTabFreedomInOpenDeleteDialog`)

---

### Test 2: Verifikation dass Scanner scharf bleibt

**Akzeptanzkriterium:** AK2 - "Ein Konstrukt ohne jegliche Tab-Abdeckung wird weiterhin als Critical gemeldet"

**Vorgehensweise:**

```bash
# Test-Datei erstellen OHNE Tab-Abdeckung
cat > /tmp/test-no-tab-coverage.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('Focus-Contract-No-Tab', () => {
  test('AK1: Initial focus on delete button', async ({ page }) => {
    await page.goto('/tasks');
    const deleteButton = page.locator('[data-testid="task-delete-button"]');
    await deleteButton.click();

    // Fokus-Assert OHNE Tab
    const confirmButton = page.locator('[data-testid="confirm-delete-button"]');
    await expect(confirmButton).toBeFocused();
  });
});
EOF

# Scanner auf diese Test-Datei laufen lassen
pnpm dlx tsx .github/scripts/analyze-test-suite.ts /tmp/test-no-tab-coverage.spec.ts
```

**Erwartetes Ergebnis:**

- [ ] Scanner meldet "Fokus-Vertrag ohne Tab-Freiheit" als Critical
- [ ] Heuristik bleibt scharf - echte Lücken werden erkannt

---

### Test 3: Negative Validierung (Boundary)

**Ziel:** Sicherstellen dass Heuristik nicht über-korrigiert

**Vorgehensweise:**

```bash
# Test-Datei mit gemischten Szenarien
cat > /tmp/test-mixed-tab-coverage.spec.ts << 'EOF'
import { test, expect } from '@playwright/test';

test.describe('Mixed-Tab-Coverage', () => {
  // Block 1: Fokus-Assert MIT Tab-Abdeckung
  test('AK1: Focus with Tab test', async ({ page }) => {
    await page.goto('/tasks');
    const deleteButton = page.locator('[data-testid="task-delete-button"]');
    await deleteButton.click();

    const confirmButton = page.locator('[data-testid="confirm-delete-button"]');
    await expect(confirmButton).toBeFocused();

    // Tab-Test im selben Block
    await page.keyboard.press('Tab');
    const cancelButton = page.locator('[data-testid="cancel-delete-button"]');
    await expect(cancelButton).toBeFocused();
  });

  // Block 2: Fokus-Assert OHNE Tab (aber Datei-weite Abdeckung durch Block 1)
  test('AK2: Focus only (Tab coverage in AK1)', async ({ page }) => {
    await page.goto('/tasks');
    const editButton = page.locator('[data-testid="task-edit-button"]');
    await editButton.click();

    const saveButton = page.locator('[data-testid="save-button"]');
    await expect(saveButton).toBeFocused();
  });
});
EOF

# Scanner laufen lassen
pnpm dlx tsx .github/scripts/analyze-test-suite.ts /tmp/test-mixed-tab-coverage.spec.ts
```

**Erwartetes Ergebnis:**

- [ ] Scanner erkennt Datei-weite Tab-Abdeckung (durch AK1)
- [ ] AK2 wird nicht als "Fokus-Vertrag ohne Tab-Freiheit" gemeldet
- [ ] Heuristik prüft auf Datei-Ebene, nicht nur pro Block

---

## Spezifikations-basierte Validierung

### Heuristik-Kriterien (manuell zu prüfen nach Implementierung)

**Muss-Eigenschaften:**

- [ ] `hasTab`-Prüfung arbeitet auf **Datei-Ebene** (nur pro Block ist fehlerhaft)
- [ ] Helper-Bodies werden auflöst oder Helper-Namen matchen `\\bTab\\b`
- [ ] Bestehende Tab-Abdeckung in `delete-dialog-focus.spec.ts` wird erkannt
- [ ] Scanner bleibt bei echten Lücken scharf (keine False Negatives)

**Validierungsmethode:** Lokaler `pnpm dlx tsx .github/scripts/analyze-test-suite.ts` Lauf + Ergebnis-Inspektion

---

## Root Cause Analyse (aus Issue 668)

**Fehler in aktueller Heuristik (Zeile 614-616):**

```ts
const hasTab = /\bTab\b|keyboard\.press\(\s*['\"]Tab['\"]/.test(b.bodyText);
```

**Zwei Lücken:**

1. **Getrennte Blöcke:** AK1/AK2/AK3 prüfen Initialfokus; Tab-Freiheit lebt in AK4/AK8/AK9. Heuristik sieht pro Block nur "Fokus-Assert ohne Tab"
2. **Helper-Delegation:** AK8 drückt Tab über Helper `assertTabFreedomInOpenDeleteDialog` - `keyboard.press('Tab')` steht im Helper-Body, nicht im Block-Body. Helper-Name "TabSäule" matcht `\\bTab\\b` nicht (kein Word-Boundary).

**Mögliche Lösungen (Entscheidung liegt bei Implementierung):**

- `hasTab` auf **Datei-Ebene** prüfen: Wenn andere Blöcke derselben Datei Tab drücken, gilt Abdeckung als vorhanden (schwächst strenge, aber ausreichend gegen diesen False-Positive-Typ)
- Alternativ: Tab-Prüfung **pro describe-Gruppe** oder Helper-Bodies auflösen

---

## Hinweis zur Carve-Out-Entscheidung

`.github/scripts/analyze-test-suite.ts` ist kein Anwendungscode im Sinne von `server/src/**`, `frontend/src/**` oder `frontend/e2e/**`. Es fällt unter den NICHT-ANWENDUNGSCODE-CARVE_OUT (ADR #567):

- Scanner-Scripts sind Infrastruktur-Tooling
- String-Match auf Scanner-Code ist ein reiner Change-Detector
- Führt zu keinen echten Fehlern (der Scanner funktioniert trotzdem)

**Lösung:** Manuelles Test-Protokoll statt automatisierter roter Tests. Die Validierung erfolgt über:

1. Lokalen Scanner-Lauf: `pnpm dlx tsx .github/scripts/analyze-test-suite.ts`
2. `workflow_dispatch` des Test-Optimization-Workflows
3. Inspektion der Critical-Findings im Report

Dies entspricht den Akzeptanzkriterien aus Issue 668.
