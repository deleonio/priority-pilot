#!/usr/bin/env bash
# Erzeugt CHANGELOG.md im Repo-Root aus den bestehenden GitHub-Releases (#1372).
#
# WARUM: Jedes Release trägt bereits einen von GitHub aus .github/release.yml generierten
# Body (`gh release create --generate-notes`, deploy.yml) — je Kategorie ein `### <Titel>`-
# Abschnitt mit `*`-Bullets. Dieses Skript sammelt für jedes Release EINEN Versionsabschnitt,
# ordnet die Kategorien darin nach .github/release.yml (keine zweite Kategorieliste — anders
# als frontend/src/lib/changelog.ts, das dieselben Bodys je Kategorie über alle Versionen
# aggregiert statt je Version). Der komplette Datei-Inhalt wird bei jedem Lauf neu erzeugt
# (idempotent: ohne neue Releases bleibt die Datei byte-identisch).
#
# Läuft best-effort in deploy.yml NACH `gh release create` — ein Fehlschlag darf das Deploy
# nie kippen (Aufrufer fängt mit `::warning` + Exit 0 ab, siehe deploy.yml).
#
# Lokal testbar (kein Schreiben):
#   bash .github/scripts/changelog-render.sh --repo o/r --dry-run

set -uo pipefail

REPO=""
OUT=""
DRY_RUN="false"
while [ $# -gt 0 ]; do
  case "$1" in
    --repo) REPO="$2"; shift 2 ;;
    --out) OUT="$2"; shift 2 ;;
    --dry-run) DRY_RUN="true"; shift ;;
    *) shift ;;
  esac
done
[ -n "$REPO" ] || { echo "changelog-render: --repo required" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
[ -n "$OUT" ] || OUT="$REPO_ROOT/CHANGELOG.md"
RELEASE_YML="$REPO_ROOT/.github/release.yml"

if [ ! -f "$RELEASE_YML" ]; then
  echo "::warning title=release.yml fehlt::Kategorien nicht lesbar — CHANGELOG.md nicht aktualisiert."
  exit 0
fi

# Kategorie-Titel + Reihenfolge kommen ausschließlich aus release.yml (kein zweites,
# gepflegtes Duplikat der Liste im Skript).
mapfile -t CATEGORIES < <(sed -n 's/^    - title: //p' "$RELEASE_YML")
if [ "${#CATEGORIES[@]}" -eq 0 ]; then
  echo "::warning title=Keine Kategorien::.github/release.yml enthält keine Kategorie-Titel."
  exit 0
fi

# gh --paginate gibt je Seite ein eigenes JSON-Array aus, konkateniert ohne Trenner —
# erst per `jq -s 'add'` selbst zu einem flachen Array zusammenführen (Memory 2026-08-24).
RAW="$(gh api "repos/$REPO/releases" --paginate 2>/dev/null)"
if [ -z "$RAW" ]; then
  echo "::warning title=Releases nicht lesbar::gh api releases lieferte nichts — CHANGELOG.md nicht aktualisiert."
  exit 0
fi

RELEASES_JSON="$(printf '%s' "$RAW" | jq -s '[.[][] | select(.draft == false)]' 2>/dev/null)"
if [ -z "$RELEASES_JSON" ] || [ "$RELEASES_JSON" = "null" ]; then
  echo "::warning title=Releases nicht auswertbar::Antwort war kein gültiges JSON."
  exit 0
fi

COUNT="$(printf '%s' "$RELEASES_JSON" | jq 'length')"
if [ "$COUNT" -eq 0 ]; then
  echo "::warning title=Keine Releases::Repository hat keine veröffentlichten Releases."
  exit 0
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

{
  echo "# Changelog"
  echo
  echo "_Diese Datei wird automatisch aus den GitHub-Releases generiert — nicht von Hand bearbeiten. Neue Einträge entstehen über die \`release:*\`-Labels des PR-Documenters, s. CONTRIBUTING.md._"
} > "$WORK/out.md"

for i in $(seq 0 $((COUNT - 1))); do
  ITEM="$(printf '%s' "$RELEASES_JSON" | jq -c ".[$i]")"
  TAG="$(printf '%s' "$ITEM" | jq -r '.tag_name')"
  DATE="$(printf '%s' "$ITEM" | jq -r '.published_at // .created_at // ""' | cut -dT -f1)"
  BODY="$(printf '%s' "$ITEM" | jq -r '.body // ""')"
  printf '%s\n' "$BODY" > "$WORK/body.txt"

  {
    echo
    echo "## ${TAG} - ${DATE}"
  } >> "$WORK/out.md"

  HAS_ANY="false"
  for CAT in "${CATEGORIES[@]}"; do
    # Zerlegt den Body in `###`-Abschnitte; nur Bullet-Zeilen (`- `/`* `) des passenden
    # Abschnitts zählen. Der führende `<!-- Release notes generated … -->`-Kommentar und
    # die abschließende `**Full Changelog**:`-Zeile liegen außerhalb jedes `###`-Abschnitts
    # bzw. matchen die Bullet-Regel nicht — beide fallen damit automatisch weg (AK4).
    BULLETS="$(awk -v want="$CAT" '
      /^### / { title=$0; sub(/^### /, "", title); insec = (title == want); next }
      /^## / { insec = 0; next }
      insec && /^[-*] / { sub(/^[-*] /, "- "); print; next }
    ' "$WORK/body.txt")"
    if [ -n "$BULLETS" ]; then
      HAS_ANY="true"
      {
        echo
        echo "### ${CAT}"
        echo
        printf '%s\n' "$BULLETS"
      } >> "$WORK/out.md"
    fi
  done

  if [ "$HAS_ANY" = "false" ]; then
    {
      echo
      echo "_Keine für Nutzer sichtbaren Änderungen._"
    } >> "$WORK/out.md"
  fi
done
echo >> "$WORK/out.md"

if [ "$DRY_RUN" = "true" ]; then
  cat "$WORK/out.md"
else
  cp "$WORK/out.md" "$OUT"
  echo "✅ CHANGELOG.md aktualisiert: ${COUNT} Releases."
fi
