# Issue 660: Betriebsarten dokumentieren

## Ziel

Betriebsarten für priority-pilot dokumentieren: cloudbasierter Betrieb (jetzt) und lokaler Betrieb (später).

## Vorbedingungen

- Issue #658 ist merge (Vorgänger-Issue)
- Repository enthält funktionierende CI/CD-Pipelines

## Spezifikation

### 1. Cloud-Betrieb dokumentiert

**Ziel**: Vollständige Dokumentation des cloudbasierten Betriebs

**Anforderungen**:

- Deployment-Anleitung für Cloud-Infrastruktur
- Umgebungsvariablen dokumentiert (API-Keys, Datenbank-Verbindungen, Konfiguration)
- Ressourcen-Beschreibung (Rechenleistung, Speicher, Netzwerk)
- Monitoring- und Logging-Konzept

**Ergebnis**: Neuer Abschnitt in README.md oder eigene Datei unter docs/ mit Cloud-Betriebshandbuch

### 2. Local-Betrieb skizziert

**Ziel**: Grundlegende Dokumentation für lokale Entwicklung

**Anforderungen**:

- Lokale Voraussetzungen (Node.js-Version, Datenbank, Abhängigkeiten)
- Start-Script für lokale Entwicklung
- Dev-Setup für Frontend und Backend

**Ergebnis**: Abschnitt "Local Development" in der Doku

### 3. Übergangspfad definiert

**Ziel**: Klare Migration von Cloud zu Local

**Anforderungen**:

- Daten-Migration (Datenbank-Export/-Import)
- Konfigurations-Änderungen (Umgebungsvariablen anpassen)
- Rollback-Strategie (Local → Cloud zurück)

**Ergebnis**: Abschnitt "Migration: Cloud → Local"

### 4. Request-Volumen-Hinweis

**Ziel**: Kapazitätsgrenzen während Aufbauphase dokumentieren

**Anforderungen**:

- Aktuelle Limits (Requests pro Sekunde/Tag)
- Monitoring-Punkte (Wann werden Limits erreicht?)
- Eskalationspfad (Wen kontaktieren bei Kapazitätsproblemen?)

**Ergebnis**: Abschnitt "Capacity Planning" mit konkreten Zahlen

## Teststrategie

DOKU-NOTIZ: Gemäß ADR 0001 werden für dieses rein dokumentarische Issue keine automatisierten Tests geschrieben. Stattdessen werden die Akzeptanzkriterien im PR-Body manuell verifiziert durch:

- Existenz der Doku-Dateien
- Sichtprüfung der Inhalte
- Link-Validierung

## Abhängigkeiten

- Issue #658 muss merge sein (Vorgänger)
- Bestehende CI/CD-Infrastruktur beachten
