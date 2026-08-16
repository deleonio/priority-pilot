# Issue 696: Knip-Config Cleanup

## Ziel

Die tote Root-knip.json entfernen und verbleibende Workspace-Excludes mit Begründungen dokumentieren.

## Vorbedingung

- Repo ist Checkout mit funktionierendem pnpm
- Workspace-knip.jsons existieren (server, client, frontend)

## Schritte

### 1. Root-Config Analyse

- Aktuelle Root-knip.json prüfen und Excludes notieren
- Verify: Root-Config wird nie gelesen (knip läuft workspace-isoliert)

### 2. Workspace-Vorher-Nachher Vergleich

```bash
# Vorher: Baseline erstellen
pnpm --filter server exec knip > /tmp/knip-server-before.txt
pnpm --filter client exec knip > /tmp/knip-client-before.txt
pnpm --filter frontend exec knip > /tmp/knip-frontend-before.txt

# Root-knip.json entfernen
rm knip.json

# Nachher: Vergleich
pnpm --filter server exec knip > /tmp/knip-server-after.txt
pnpm --filter client exec knip > /tmp/knip-client-after.txt
pnpm --filter frontend exec knip > /tmp/knip-frontend-after.txt

# Diff prüfen (sollte leer sein)
diff /tmp/knip-server-before.txt /tmp/knip-server-after.txt
diff /tmp/knip-client-before.txt /tmp/knip-client-after.txt
diff /tmp/knip-frontend-before.txt /tmp/knip-frontend-after.txt
```

### 3. Excludes migrieren (falls nötig)

- Root-only Excludes in die jeweilige Workspace-knip.jsonc übernehmen
- JSONC-Format mit Inline-Kommentaren für Begründung

### 4. Validierung

```bash
pnpm lint  # sollte grün sein
pnpm format # sollte grün sein
```

## Erwartetes Ergebnis

- Root-knip.json existiert nicht mehr
- Workspace-Knip-Läufe zeigen identische Ergebnisse vor/nach
- Jedes Exclude in Workspace-knip.jsonc hat einen Kommentar
- CI-Pipelines bleiben grün
