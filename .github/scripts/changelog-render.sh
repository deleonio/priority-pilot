#!/usr/bin/env bash
# Erzeugt CHANGELOG.md im Repo-Root aus den bestehenden GitHub-Releases (#1372).
#
# WARUM: Jedes Release trägt bereits einen von GitHub aus .github/release.yml generierten
# Body (`gh release create --generate-notes`, deploy.yml) — je Kategorie ein `### <Titel>`-
# Abschnitt mit `*`-Bullets. deploy.yml erzeugt aber bei JEDEM Merge ein eigenes Release
# (Patch-Bump), cron.daily-version.yml setzt zusätzlich einmal täglich einen Minor-Bump
# obendrauf. Ein Block pro Release würde also fast nur Ein-Zeiler-Blöcke erzeugen statt
# eines vollständigen Blocks pro Minor-Version. Dieses Skript gruppiert deshalb ALLE
# Releases mit gleicher Minor-Version (MAJOR.MINOR aus dem Tag) zu EINEM Versionsabschnitt
# und führt deren Kategorie-Bullets zusammen (chronologisch aufsteigend, älteste zuerst).
# Kategorien darin werden nach .github/release.yml sortiert (keine zweite Kategorieliste —
# anders als frontend/src/lib/changelog.ts, das dieselben Bodys je Kategorie über ALLE
# Versionen aggregiert statt gruppiert nach Minor-Version). Der komplette Datei-Inhalt wird
# bei jedem Lauf neu erzeugt (idempotent: ohne neue Releases bleibt die Datei byte-identisch).
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

# Releases (bereits neueste zuerst von der API) zu Gruppen je MAJOR.MINOR zusammenfassen.
# `reduce` statt `group_by`, damit die Gruppen-Reihenfolge der Release-Reihenfolge folgt
# (neueste Minor-Version zuerst) statt alphabetisch sortiert zu werden ("0.10" vor "0.2"
# waere sonst falsch). Innerhalb einer Gruppe bleiben die Releases ebenfalls neueste zuerst.
GROUPS_JSON="$(printf '%s' "$RELEASES_JSON" | jq -c '
  (reduce .[] as $r (
    {order: [], groups: {}};
    ($r.tag_name | ltrimstr("v") | split(".") | .[0:2] | join(".")) as $m
    | if (.groups | has($m)) then
        .groups[$m] += [$r]
      else
        (.order += [$m]) | .groups[$m] = [$r]
      end
  )) as $acc
  | $acc.order | map({minor: ., releases: $acc.groups[.]})
')"

GROUP_COUNT="$(printf '%s' "$GROUPS_JSON" | jq 'length')"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

{
  echo "# Changelog"
  echo
  echo "_Diese Datei wird automatisch aus den GitHub-Releases generiert — nicht von Hand bearbeiten. Ein Abschnitt fasst alle Releases derselben Minor-Version zusammen; neue Einträge entstehen über die \`release:*\`-Labels des PR-Documenters, s. CONTRIBUTING.md._"
} > "$WORK/out.md"

for g in $(seq 0 $((GROUP_COUNT - 1))); do
  GROUP="$(printf '%s' "$GROUPS_JSON" | jq -c ".[$g]")"
  MINOR="$(printf '%s' "$GROUP" | jq -r '.minor')"
  # Innerhalb der Gruppe chronologisch aufsteigend (älteste zuerst) fuer die Bullet-
  # Reihenfolge; die Gruppe selbst bleibt in der äusseren Schleife neueste-zuerst.
  RELEASES_ASC="$(printf '%s' "$GROUP" | jq -c '.releases | reverse')"
  RELEASE_COUNT="$(printf '%s' "$RELEASES_ASC" | jq 'length')"
  NEWEST_TAG="$(printf '%s' "$RELEASES_ASC" | jq -r '.[-1].tag_name')"
  OLDEST_TAG="$(printf '%s' "$RELEASES_ASC" | jq -r '.[0].tag_name')"
  DATE="$(printf '%s' "$RELEASES_ASC" | jq -r '.[-1].published_at // .[-1].created_at // ""' | cut -dT -f1)"

  {
    echo
    echo "## v${MINOR} - ${DATE}"
  } >> "$WORK/out.md"

  if [ "$RELEASE_COUNT" -gt 1 ]; then
    {
      echo
      echo "_Enthält ${OLDEST_TAG} – ${NEWEST_TAG}._"
    } >> "$WORK/out.md"
  fi

  # Alle Release-Bodies der Gruppe (chronologisch aufsteigend) in eine Datei je Release
  # schreiben, damit die AWK-Extraktion unten unverändert pro Release laufen kann.
  : > "$WORK/group_bullets.txt"
  HAS_ANY="false"
  for CAT in "${CATEGORIES[@]}"; do
    : > "$WORK/cat_bullets.txt"
    for r in $(seq 0 $((RELEASE_COUNT - 1))); do
      BODY="$(printf '%s' "$RELEASES_ASC" | jq -r ".[$r].body // \"\"")"
      printf '%s\n' "$BODY" > "$WORK/body.txt"
      # Zerlegt den Body in `###`-Abschnitte; nur Bullet-Zeilen (`- `/`* `) des passenden
      # Abschnitts zählen. Der führende `<!-- Release notes generated … -->`-Kommentar und
      # die abschließende `**Full Changelog**:`-Zeile liegen außerhalb jedes `###`-Abschnitts
      # bzw. matchen die Bullet-Regel nicht — beide fallen damit automatisch weg (AK4).
      awk -v want="$CAT" '
        /^### / { title=$0; sub(/^### /, "", title); insec = (title == want); next }
        /^## / { insec = 0; next }
        insec && /^[-*] / { sub(/^[-*] /, "- "); print; next }
      ' "$WORK/body.txt" >> "$WORK/cat_bullets.txt"
    done
    if [ -s "$WORK/cat_bullets.txt" ]; then
      HAS_ANY="true"
      {
        echo
        echo "### ${CAT}"
        echo
        cat "$WORK/cat_bullets.txt"
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
  echo "✅ CHANGELOG.md aktualisiert: ${COUNT} Releases in ${GROUP_COUNT} Minor-Version(en)."
fi
