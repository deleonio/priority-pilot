# Fixup-Notizen PR #1030 (Issue #1028)

## Erledigt
- LAUF KOMPLETT (2026-08-25): Beide Review-Findings aus Review 5021294638 gefixt, als d1f97d13 gepusht, beide Inline-Threads (PRRT_kwDONloM186cJvlI/PRRT_kwDONloM186cJvlM) resolved, Sammelkommentar 5413389544 auf „fixup erbracht" fortgeschrieben.
- F1 gefixt: frontend/e2e/issue-1028-alert-host-padding-radius.spec.ts — scrollWidth-Block ersetzt durch `alertBox!.x + alertBox!.width ≤ page.viewportSize()!.width` mit Begründungskommentar (overflow-x-hidden-Clip, Memory 2026-08-24 „E2E/Horizontal-Overflow").
- F2 gefixt: frontend/src/app.css — Kommentar über `kol-alert`-Block (~Zeile 1805): „Radius wirkt auf Host-Fläche" ersetzt durch „sichtbare Fläche und Rundung bleiben KoliBri-intern (Shadow-DOM, black-box nicht am Host messbar, siehe Spec Abgrenzung)".
- Git-Identität aus `git log -1` gesetzt (Memory 2026-08-25) — Commit d1f97d13 sauber durchgelaufen.

## Relevante Stellen
- Commit d1f97d13 (fix(review)) — Fixup-Commit auf feat/issue-1028-alert-host-padding-radius, vor a466fe4d gepusht.
- Sammelkommentar 5413389544 (Marker `<!-- ai-review -->`) — Status „fixup erbracht", F1/F2 mit SHA in Behobene-Tabelle.
- CI-Run 32872504867 — verify + e2e (4 Shards) für d1f97d13 liefen beim Beenden noch pending.

## Annahmen
- E2E-Viewport-Check (F1-Ersatz) bleibt grün: Container-Check (≤ Container-Rechte +1px) war auf a466fe4d grün, Container liegt im Viewport — neuer Check höchstens gleich streng. Bestätigt sich (oder nicht) im e2e-Run 32872504867.
- Redis-Rot in `pnpm test` ist environmentbedingt (Sandbox ohne Redis; CI hat redis:8-Service) — Memory 2026-08-25, Test meldet selbst „CI stellt Redis als Service bereit".

## Verworfen
- scrollWidth-Assertion einfach streichen: Review bot streichen ODER ersetzen; Ersatz gewählt (härtet gegen Clip-Fälle, Card-Padding schluckt Überlauf).
- Redis-Test „reparieren": bekanntes Sandbox-Defizit, nicht vom Fixup verursacht — dokumentiert im Sammelkommentar statt gebastelt.

## Offen
- CI-Ergebnis für d1f97d13 (Run 32872504867) beim Beenden noch pending — nächste Runde: `gh pr checks 1030` prüfen; bei Rot Log lesen.

## Nächster Schritt
- Falls weitere Runde: CI von d1f97d13 verifizieren; falls grün → nichts mehr zu tun (Re-Review/Merge entscheidet der Mensch). Bei neuem Review: gegen Fixup-Diff d1f97d13 verifizieren.

## Fallstricke
- Threads auflösen: Mutation heißt `resolveReviewThread(input:{threadId})` — hat funktioniert; die hereingereichten fake-IDs waren echte Thread-IDs PRRT_kwDONloM186cJvlI/-M.
- pnpm test in Sandbox OHNE Redis bleibt rot (server session.test.ts, t.skip-ohne-return setzt Exit 1) — nicht als Fixup-Regressions fehldeuten; Gegenindikator im Testoutput: „# Kein Redis erreichbar".
