# Betriebsarten: Cloud und Local

Priority Pilot kann in zwei Betriebsarten genutzt werden:

1. **Cloud-Betrieb** (cloudbasiert auf einem dedizierten Server) — für Produktion
2. **Local-Betrieb** (lokal auf dem eigenen Rechner) — für Entwicklung und Selbsthosting

Dieses Dokument beschreibt beide Modi und den Übergangspfad zwischen ihnen.

---

## 1. Cloud-Betrieb (Produktion)

Im Cloud-Betrieb läuft Priority Pilot auf einem dedizierten Linux-Server und wird automatisch via GitHub Actions deployt.

### 1.1 Architektur

```
Browser → HTTPS → Caddy (TLS) → Frontend (statische SPA)
                            ↓
                            Backend (Node.js + Express + SQLite) unter PM2
                            ↓
                        Datenbank (data/database.sqlite)
```

### 1.2 Deployment & Infrastruktur

Die vollständige Einrichtung und Betrieb-Dokumentation:

- **[deployment.md](deployment.md)** — Konzept & Ablauf (rsync + PM2, Rollback)
- **[server-setup.md](server-setup.md)** — Schritt-für-Schritt Server-Einrichtung
- **[caddy-setup.md](caddy-setup.md)** — Caddy Reverse-Proxy Konfiguration
- **[llm-providers.md](llm-providers.md)** — LLM-Kaskade einrichten (Mistral + OpenRouter)

**Zusammenfassung der Cloud-Infrastruktur:**

| Komponente     | Zweck                            |
| -------------- | -------------------------------- |
| GitHub Actions | Build + Deploy (Merge auf main)  |
| rsync          | Spiegelt dist/ auf den Server    |
| PM2            | Prozess-Manager für das Backend  |
| Caddy          | TLS-Terminierung + Reverse-Proxy |
| SQLite         | Persistente Datenbank in data/   |

**Umgebungsvariablen** (`.env` im App-Verzeichnis):

```bash
NODE_ENV=production
DATABASE_STORAGE=/var/www/gh-deploy/priority-pilot/data/database.sqlite
DB_SEED=false
MISTRAL_API_KEY=...             # Mindestens einer erforderlich
OPENROUTER_API_KEY=...          # Optional für Verfeinerungs-Stufe
```

### 1.3 Monitoring

| Metrik             | Prüfung                      |
| ------------------ | ---------------------------- |
| Backend-Status     | `pm2 status priority-pilot`  |
| Logs               | `pm2 logs priority-pilot`    |
| API-Erreichbarkeit | `curl https://<domain>/next` |
| TLS-Zertifikat     | Caddy erneuert automatisch   |

---

## 2. Local-Betrieb (Entwicklung / Selbsthosting)

Im Local-Betrieb läuft Priority Pilot auf dem eigenen Rechner. Dies ist der Standard für die Entwicklung und kann auch für dauerhaftes Selbsthosting genutzt werden.

### 2.1 Voraussetzungen

- **Node.js** >= 26 (siehe `.nvmrc`)
- **pnpm** 11 (siehe `packageManager`)
- **Git** (für Clone)

### 2.2 Einrichtung

```bash
# Repository klonen
git clone https://github.com/<your-org>/priority-pilot.git
cd priority-pilot

# Abhängigkeiten installieren
pnpm install

# Entwicklungsserver starten (Frontend + Backend parallel)
pnpm dev
```

**Dev-Server läuft auf:**

- Frontend: `http://localhost:5173` (Vite)
- Backend: `http://localhost:3000` (Express)

### 2.3 Konfiguration

Für den Local-Betrieb kann eine `.env`-Datei im Projekt-Root erstellt werden (optional, Default-Werte gelten):

```bash
# Port des Backends (Default: 3000)
PORT=3000

# Datenbank-Speicherort (Default: ./database.sqlite)
DATABASE_STORAGE=./database.sqlite

# Demo-Daten beim Start seeden (Default: true)
DB_SEED=true

# DB bei jedem Start leeren (Vorsicht!)
# DB_RESET=true

# LLM-Provider (optional)
MISTRAL_API_KEY=...
OPENROUTER_API_KEY=...
```

### 2.4 Produktion im Local-Betrieb

Für dauerhaften Local-Betrieb:

```bash
# Build für Produktion
pnpm build

# Server starten (statt pnpm dev)
NODE_ENV=production node server/dist/index.js
```

Empfehlung: Einen Prozess-Manager wie **PM2** nutzen:

```bash
pm2 start server/dist/index.js --name priority-pilot-local
pm2 save
pm2 startup  # Für Autostart nach Reboot
```

---

## 3. Übergangspfad: Cloud → Local

Migration von Cloud-Betrieb zu Local-Betrieb (z.B. für Offline-Fähigkeit, Daten-Souveränität oder Kostensenkung).

### 3.1 Daten-Migration

**Datenbank exportieren (auf dem Cloud-Server):**

```bash
# Konsistentes SQLite-Backup
sqlite3 /var/www/gh-deploy/priority-pilot/data/database.sqlite \
  ".backup '/tmp/backup.sqlite'"

# Download (vom lokalen Rechner)
scp gh-deploy@<cloud-host>:/tmp/backup.sqlite ./database.sqlite
```

**Datenbank importieren (lokal):**

```bash
# Backup in das lokale Verzeichnis kopieren
cp backup.sqlite database.sqlite
# Priority Pilot local starten — nutzt automatisch database.sqlite
```

### 3.2 Konfigurations-Änderungen

1. **Umgebungsvariablen übertragen:**
   - Cloud `.env` → Local `.env` (anpassen, z.B. Pfade)
   - Besonders: `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`

2. **Frontend API-BaseURL anpassen:**
   - Cloud: `VITE_API_BASE_URL=/api/v1` (Caddy-Proxy)
   - Local: In `frontend/vite.config.ts` den Proxy eintragen oder Default nutzen

### 3.3 Rollback (Local → Cloud)

Falls Rückkehr zum Cloud-Betrieb gewünscht:

1. Lokale Datenbank auf Cloud-Server hochladen:

   ```bash
   scp database.sqlite gh-deploy@<cloud-host>:/var/www/gh-deploy/priority-pilot/data/database.sqlite.new
   ssh gh-deploy@<cloud-host> "pm2 stop priority-pilot && \
     mv /var/www/gh-deploy/priority-pilot/data/database.sqlite /var/www/gh-deploy/priority-pilot/data/database.sqlite.old && \
     mv /var/www/gh-deploy/priority-pilot/data/database.sqlite.new /var/www/gh-deploy/priority-pilot/data/database.sqlite && \
     pm2 start priority-pilot"
   ```

2. Deployment via Merge auf `main` (automatisch)

---

## 4. Request-Volumen & Kapazität (Aufbauphase)

Während der Aufbauphase sind folgende Limits und Hinweise zu beachten.

### 4.1 Aktuelle Limits

| Ressource          | Limit                               | Begründung                                        |
| ------------------ | ----------------------------------- | ------------------------------------------------- |
| SQLite-DB          | Größe begrenzt durch Festplatte     | SQLite eignet sich für kleine bis mittlere Lasten |
| LLM-Anfragen       | Provider-Quota (Mistral/OpenRouter) | Je nach gewähltem Provider-Plan                   |
| gleichzeitige User | 1 (Single-User)                     | Die App ist für Einzelnutzer konzipiert           |

**Hinweis:** Priority Pilot ist eine **Single-User-Anwendung**. Es gibt kein Multi-User/Multi-Tenancy-Feature. Die Kapazitätsgrenzen richten sich nach der Nutzung durch eine Person.

### 4.2 Monitoring-Punkte

| Metrik       | Wie prüfen                | Warn-Schwelle   |
| ------------ | ------------------------- | --------------- |
| DB-Größe     | `ls -lh database.sqlite`  | > 100 MB        |
| LLM-Quota    | Provider-Dashboard        | 80 % des Limits |
| Backend-Logs | `pm2 logs` / `journalctl` | Fehler > 0      |

### 4.3 Eskalationspfad

Bei Kapazitätsproblemen:

1. **LLM-Quota erreicht:**
   - Provider-Plan erhöhen oder
   - Lokalen LLM (z.B. Ollama) einbinden (zukünftiges Feature)

2. **DB-Größe wächst:**
   - Alte Aufgaben archivieren / aufräumen
   - Bei > 500 MB: Migration zu PostgreSQL/MySQL in Betracht ziehen

3. **Performance-Probleme:**
   - Indexe prüfen (`server/src/database.ts`)
   - Aufgaben bereinigen (alte erledigte Tasks)

---

## 5. Checkliste: Betriebsart wählen

| Kriterium                | Cloud                         | Local                     |
| ------------------------ | ----------------------------- | ------------------------- |
| Wartungsaufwand          | Gering (automatisches Deploy) | Höher (manuelle Updates)  |
| Zugriff von überall      | ✅                            | ❌ (nur im lokalen Netz)  |
| Kosten                   | Server-Kosten                 | Keine zusätzlichen Kosten |
| Daten-Souveränität       | Auf Server                    | Vollständig lokal         |
| Notwendige Infrastruktur | Linux-Server                  | Nur Node.js + pnpm        |

---

## 6. Weiterführende Dokumentation

- **[deployment.md](deployment.md)** — Deployment-Konzept & Ablauf
- **[server-setup.md](server-setup.md)** — Server-Einrichtung Schritt für Schritt
- **[caddy-setup.md](caddy-setup.md)** — Caddy Reverse-Proxy Konfiguration
- **[llm-providers.md](llm-providers.md)** — LLM-Provider einrichten
- **[user-guide.md](user-guide.md)** — Nutzerhandbuch für Endanwender
- **[README.md](../README.md)** — Projektübersicht & Quick Start
