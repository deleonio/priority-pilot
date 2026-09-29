# Spec: Issue 1791 — Server: konkrete Aufgaben gegen ein Balance-Defizit vorschlagen

**Stand:** 2026-09-28 (Spec-Phase)
**Quellen:** Harness-Kommentar (KI-ANALYSE, stand=2026-09-28T08:13:54Z), `docs/fuersorge-tonalitaet.md` (#1797), `server/src/logics/careDeficit.ts` (#1790).

## Ziel

Bei einem Pflege-Defizit in einer Säule liefert der Server bis zu drei konkrete Vorschläge:
zuerst eigene offene Aufgaben mit Säulen-Beitrag zu genau dieser Säule, sonst kuratierte
Vorlagen. Abgelehnte Vorlagen bleiben 14 Tage weg. Alles gilt im Free-Paket (Epic #1780) —
kein planGuard.

## Vertrag Endpunkt

`GET /scores/care-suggestions?sprache=<code>` (neben `GET /scores/balance` in
`routes/scores.ts`):

- Ohne Session → 401.
- Mit Session → 200. Body: `{ vorschlaege: CareVorschlagDto[] }`.
- Der Server wertet `bewerteCareDefizit` (importiert aus `logics/careDeficit.ts`, nicht
  kopiert) über die eigenen Säulen und Tasks aus. Je **defizitärer** Säule (`defizitaer`)
  bis zu drei Einträge, Säulen aufsteigend nach id.
- `sprache` wählt die Sprache der Vorlagen-Texte; Default `de`. Andere Query-Werte sind
  nicht blockend (Fallback `de`).

`CareVorschlagDto`:

```ts
{
  typ: 'task' | 'vorlage';
  saeuleId: number;
  saeuleName: string;
  titel: string;
  beschreibung: string | null;
  /** Beitrag zum Anlegen/Erkennen der Säulenzuordnung — bei Vorlagen immer [{ pillarId, share: 100 }]. */
  saeulenBeitraege: { pillarId: number; share: number }[];
  taskId?: number;       // nur typ 'task'
  templateKey?: string;  // nur typ 'vorlage', stabil und sprachunabhängig (z. B. 'koerper-1')
}
```

`POST /scores/care-suggestions/dismissals` mit Body `{ templateKey: string }`:

- Ohne Session → 401; mit Session → 204. Persistiert die Ablehnung pro Nutzer
  (`models/careSuggestionDismissal.ts`, Muster `pillarFeedback.ts`: userId, templateKey,
  abgelehntAm).

## Vertrag Auswahl-Logik (`logics/careSuggestions.ts`, reine Funktion)

```ts
export const CARE_ABLEHNUNG_TAGE = 14;

interface CareAufgabe { id: number; titel: string; beschreibung: string | null;
  status: string; pillars: { pillarId: number; share: number }[]; }
interface CareVorlage { key: string; saeuleId: number; texte: { titel: string; beschreibung: string } }
interface CareVorschlag { typ: 'task' | 'vorlage'; titel: string; beschreibung: string | null;
  saeulenBeitraege: { pillarId: number; share: number }[]; taskId?: number; templateKey?: string; }

waehleCareVorschlaege(
  saeule: BalanceSaeule,
  aufgaben: CareAufgabe[],
  vorlagen: CareVorlage[],
  ablehnungen: { templateKey: string; abgelehntAm: Date }[],
  jetzt: Date,
): CareVorschlag[]
```

- Eigene offene Aufgaben (`status` `'Open'` oder `'In process'`) mit Säulen-Beitrag
  (share > 0) zu genau dieser Säule zuerst; danach kuratierte Vorlagen dieser Säule
  (`saeuleId`-Filter); insgesamt maximal drei Einträge.
- Eine Ablehnung unterdrückt ihre Vorlage, solange `jetzt − abgelehntAm < 14 Tage`
  (`CARE_ABLEHNUNG_TAGE`); ab exakt 14 Tagen ist sie wieder lieferbar.
- Die Sprache ist von der Route bereits aufgelöst (Vorlagen kommen mit Texten in der
  Zielsprache); die Logik bleibt text- und DB-frei.

## Vertrag Stammdaten (`logics/careSuggestionData.ts`, Muster `models/pillarData.ts`)

```ts
export const CARE_SPRACHEN = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'] as const;
export const CARE_VORLAGEN: readonly {
	key: string;
	saeuleId: number;
	texte: Record<CareSprache, { titel: string; beschreibung: string }>;
}[];
```

- Je Säule (ids 1–5 nach `SEED_PILLARS`) mindestens fünf Vorlagen.
- Jede Vorlage in allen zehn App-Sprachen (Spiegel zu `frontend/src/i18n/locales/`),
  Titel und Beschreibung nicht leer.
- `key` ist pro Vorlage einzigartig, sprachunabhängig und damit stabiler
  Dismissal-Bezug (nicht der Titel — Sprachwechsel).
- Texte folgen dem Ton-Leitfaden (`docs/fuersorge-tonalitaet.md`).

## Ablauf („Übernehmen“ eines Vorlagen-Vorschlags)

1. Client ruft `GET /scores/care-suggestions` und zeigt Vorschläge einer Defizit-Säule.
2. „Nicht jetzt“ → `POST /scores/care-suggestions/dismissals { templateKey }`; die
   Vorlage erscheint 14 Tage lang nicht erneut.
3. „Übernehmen“ → Client sendet `POST /tasks` mit `{ title: titel,
pillars: saeulenBeitraege }` — der bestehende Endpunkt legt daraus einen Task an
   (`estimatedEffort`/`priority` bleiben Client-Freiheit, Default 3).

## Erwartetes Ergebnis je AK

- **AK1** — Existiert eine offene Aufgabe (Open/In process) mit Säulen-Beitrag zur
  Defizit-Säule, enthält die Antwort diese Aufgabe als `typ: 'task'` mit `taskId`, vor
  allen Vorlagen derselben Säule.
- **AK2** — Ohne passende offene Aufgabe enthält die Antwort kuratierte Vorlagen der
  Säule (`typ: 'vorlage'`, `templateKey`, Texte in `sprache`) — auch für das
  Free-Standardkonto (Registrierung ohne Plan).
- **AK3** — Ein Vorlagen-Vorschlag trägt `titel` + `saeulenBeitraege` so, dass
  `POST /tasks` daraus einen Task anlegt (201) und der Task den Säulen-Beitrag trägt.
- **AK4** — Abgelehnte Vorlage: 13 Tage alt → unterdrückt; 15 Tage alt → wieder
  lieferbar (Unit); frisch abgelehnt über den Endpunkt → unterdrückt (API).
- **AK5** — Je Säule ≥ 5 Vorlagen in jeder der zehn App-Sprachen (Unit auf den
  Stammdaten).
