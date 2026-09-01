# Issue/PR 1156 — Review (Kreuzverhör Runde 1), Stand 2026-09-01

**ERGEBNIS: VERDICT needs-fixup (🔴 Hauptfinding).** Review ohne closing issue (`Refs #1153` ist keine Closing-Ref) → PR-Beschreibung = informelle Spec, in Kommentar Zeile 2 vermerkt. Titel via Title-Gate umbenannt in `ci(prompts): add thread-resolve command, label ban, and trim ux sources` (vorher deutsch, 86 Zeichen). Sammelkommentar `<!-- ai-review -->` neu erstellt (war keiner da → MODE Kreuzverhör). Labels NICHT angetastet.

## Erledigt
- Vollständigen Diff gelesen (nur `.github/prompts/fixup.md` +4/-1, `.github/prompts/ux.md` +1/-1 — matched PR-Body-Angaben).
- Finding #1 live verifiziert: `gh api repos/deleonio/priority-pilot/pulls/1156/threads` → **404** (Endpunkt existiert nicht); `pulls/1156/comments` → 200 (Auth ok); GraphQL-Alternative `repository.pullRequest.reviewThreads` → 200, 0 Threads. Der neue fixup.md-Befehl (fixup.md:10) ist damit broken.
- Finding #2 verifiziert: ticket-ux SKILL.md hat KEINE nummerierten Steps (nur Output/Characteristics/Tools; Quellen im Absatz „Mandatory sources") → „SKILL.md step 4" in ux.md:1 dangling; `frontend/DESIGN.md:7` ff. widerlegt PR-Behauptung „KERN existiert im Repo nirgends" (KERN aber korrekt in keiner UX-Phasen-Quelle: ux-design.md/mobile-ui-rules.md/SKILL.md nennen es nicht → Entfernung trotzdem ok, nur Begründung falsch).
- Rang 2 (Label-Bann fixup.md:19) als wortgleich zu implement.md:32 / review.md:35 / spec.md:23 / ux.md:21 bestätigt (🟢).
- Review + 2 Inline-Kommentare gepostet (fixup.md:10, ux.md:1; Comment-IDs 3900612804, 3900612890). Achtung Replay-Falle: erster Review-POST mit `-F body=@file` UND `--input -` gleichzeitig → `--input` gewann, Body landete als „placeholder", Inline-`comments[]` kamen gar nicht mit. Behoben via PUT (Body ersetzt) + einzelne `pulls/{pr}/comments` (SKILL-Alternative). Submitted COMMENT-Reviews lassen sich NICHT löschen (422 „non-pending").
- Sammelkommentar erstellt (offen: #1 🔴, #2 🟡; keine Entscheidungs-Findings; Footer „Review-Typ: Kreuzverhör").

## Relevante Stellen
- `.github/prompts/fixup.md:10` — Finding #1: REST `pulls/{pr}/threads` (existiert nicht) → ersetzen durch GraphQL-Query (Vorschlag steht im Inline-Kommentar, live getestet).
- `.github/prompts/fixup.md:19` — Label-Bann (Rang 2, korrekt, kein Finding).
- `.github/prompts/ux.md:1` — Finding #2: „(sources: SKILL.md step 4)" → „(sources: step 4)"; Quellen stehen real in ux.md PROCEDURE-Schritt 4 + SKILL-Absatz „Mandatory sources".
- `frontend/DESIGN.md:7,15,114,138,156-160` — KERN-UX-Dokumentation (widerlegt PR-Begründung Rang 3).
- `.claude/skills/ticket-ux/SKILL.md` — „Mandatory sources"-Absatz (ux-design.md, mobile-ui-rules.md), keine Steps.

## Annahmen
- „Refs #1153" ≠ closing issue → informelle Spec = PR-Beschreibung; Option-1-Umfang (a)-(d) aus #1153 Body Zeile 111-113 als Soll-Massstab genommen.
- CI auf dem PR: e2e/precheck grün zum Review-Zeitpunkt (review-Job selbst pending = dieser Lauf); kein CI-Fund nötig.

## Verworfen
- KERN-Wiederherstellung in ux.md — KERN ist in keiner der drei UX-Phasen-Quellen verankert; nur die PR-Begründung ist falsch (Teil von Finding #2), nicht die Entfernung.
- CI-rot-Fund — keine roten Checks gesehen.
- MEMORY.md-Eintrag — Rest-Review-404 wäre kein neuer Wiederholungsfehler (bereits 2026-08-20 als GraphQL-Learning drin: deletePullRequestReviewComment/addPullRequestReviewThreadReply-Feldnamen; der neue Aspekt „submitted COMMENT-Reviews sind unlöschbar, Body-PUT + Einzelkommentare retten" ist klein, aber … siehe Fallstricke — kein Eintrag, Kriterium knapp nicht erfüllt).

## Offen
- Fixup muss Finding #1 (GraphQL-Query statt REST) und #2 (step-4-Referenz + PR-Begründung) umsetzen; danach Fixup-Verifikations-Runde gegen diesen Sammelkommentar (updated 2026-09-01).

## Nächster Schritt
- Fixup-Runde: nur Delta seit Sammelkommentar-Erstellung prüfen, Findings #1/#2 abhaken.

## Fallstricke
- **gh api reviews-POST: `--input -` überschreibt sämtliche `-F`-Parameter** (Body wurde „placeholder", `comments[]` verschwanden) → IMMER alles in EIN JSON-`--input` packen ODER nur `-F` ohne `--input`. Rettung für submitted COMMENT-Reviews: `PUT …/reviews/{id}` für Body + einzelne `pulls/{pr}/comments` für Anker; Löschen geht nicht (422).
- REST hat keinen Endpoint für PR-Review-Threads (nur GraphQL) — wer `pulls/{pr}/threads` sieht, hat einen Halluzinator vor sich.
- PR-Titel-Check: deutscher Betreff + Großbuchstabe + >72 Zeichen = Title-Gate-Rename (erfolgt, alte Form „ci(prompts): Audit #1153 Option 1 — …").
