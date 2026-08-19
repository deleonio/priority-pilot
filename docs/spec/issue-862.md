# Spec 862: ModelSelectionDialog - Model-Größe und Kontext-Größe

## Ziel

Der ModelSelectionDialog zeigt zusätzliche Metadaten pro Modell an: Kontext-Größe (contextLength) und Model-Größe (modelSize).

## Vorbedingung

- Backend liefert `contextLength` und `modelSize` in `/models/free` (Abhängigkeit #861 erledigt)
- ModelSelectionDialog ist bereits implementiert und funktional

## Schritte

1. Nutzer öffnet ModelSelectionDialog
2. Dialog lädt Modell-Liste via `GET /models/free`
3. Für jedes Modell werden die zusätzlichen Felder angezeigt:
   - `contextLength`: Kontext-Größe (z.B. "200k", "1m")
   - `modelSize`: Model-Größe (z.B. "32B", "7B")
4. Fehlende Werte werden komplett ausgelassen (kein Platzhalter "-")

## Erwartetes Ergebnis

- AK1: Kontext-Größe wird je Modell angezeigt
- AK2: Model-Größe wird je Modell angezeigt (wenn verfügbar)
- AK3: Fehlende Werte werden graceful behandelt (keine Anzeige oder "-")
- Mobile-spezifisch: Inline-Anzeige im Button-Text, keine separate Spalte
- Formatierung: "200k", "1m", "32B", "7B" (kurz, lesbar)

## UX-Referenz

Siehe Issue-Body KI-UX-Block: Inline-Layout, Mobile-First, Screenreader-kompatibel

---

## Versionierung

- **v1.1** (2026-08-19): Nightly-Sync — Ist-Stand verifiziert, ModelSelectionDialog erweitert
- **v1.0** (Initialefassung für Issue #862)
