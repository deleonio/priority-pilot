# Spec #2286 — Fixup-Start trotz `ai:reviewed`

Betrifft `.github/scripts/label-transition.sh` (Option `--tolerate`). Teil 1 des Tickets (Gate/`verify`-Auswahl in `merge-pr.yml`) ist Workflow-YAML und bleibt ungetestet (ADR 0001).

## Option `--tolerate <label,...>`

- **Vorbedingung:** PR hat `ai:needs-fixup` und `ai:reviewed` (Zustand nach needs-human-Review, Mensch setzt den Trigger).
- **Schritte:** `--set-none --expect ai:needs-fixup --tolerate ai:reviewed`.
- **Erwartet (AK4):** `applied=true`; Zielbestand ohne `ai:needs-fixup` und ohne `ai:reviewed`.
- **Parker (AK5):** Steht zusätzlich `ai:needs-human` im Bestand, bleibt `applied=false`, kein PUT.
- **Abgrenzung (AK5):** Nur die genannten Labels werden vor dem `--expect`-Vergleich ausgeblendet; jedes andere Label bleibt Mismatch. Ohne `--tolerate` unverändert.
