<!--
dev.to-Feldbericht (1–2-Seiter) — Fokus-Thema: „Rückmeldungen ohne Druck“ (die vier Streak-Regeln)
Genre: Entwickler-Feldbericht, erste Person, praktisch — allgemeine Muster mit kurzen Skizzen,
keine Repo-Auszüge (Dateinamen und Pfade bleiben draußen; Zahlen stammen aus dem Produkt, Snippets
sind als „sketch“ markiert und im Text als Skizzen erkennbar).
Bilder: images/ (echte App-Screenshots, deutschsprachige UI mit Übersetzungshilfe).
Schwesterartikel: medium.md (deutsch, Methode) und webdev.md (englisch, web.dev).
-->

# My streak can't take anything away — four rules, one timezone trap

Streaks have a reputation: the chain breaks, the counter resets, the app becomes the thing you
avoid. I ship one anyway. Balamentum counts calendar days with at least one completed task —
under four rules that make the counter a pure collector. Same trigger as every guilt mechanic;
a different outcome by construction, because nothing in the loop subtracts.

![The streak card: current run, best mark, counting rule disclosed](images/screenshot-streak-card.png)

_Demo data, German UI: „1 Tag in Folge erledigt, 1 Tag Bestmarke“ — current run and best mark
differ only once a gap happened. The disclosure link (“So zählt der Streak”, "how the streak is
counted") is part of the card._

## Rule 1: today still has hours left

The obvious implementation breaks the chain whenever today has no completion yet. That punishes
people for the time of day. My version keeps the visible chain standing while it reaches
yesterday.

```ts
// sketch: the current chain ignores an unfinished today
const current = chainEndingAt(isDayOver ? today : yesterday);
```

## Rule 2: the best mark is a record, not a balance

The longest chain ever achieved stays achieved. It never shrinks, it never expires.

```ts
const best = Math.max(previousBest, current); // records only grow
```

## Rule 3: a late completion rescues the day it was due

If a task is completed after its deadline — a day later, ten days later, doesn't matter — the
day it _was due_ still counts as active. I feed both timestamps, completion and deadline, into
the day set. Being human deletes no progress.

The trap I nearly stepped in lives one level deeper: what counts as "a day"? The server lives in
UTC; the user lives in Berlin. A completion at 23:30 Berlin time lands on 21:30–22:30 UTC,
depending on daylight saving — either way, the UTC date is not the date the user experienced.
Counting days server-side puts a hidden midnight into every German's evening, so the day
boundary is computed per user timezone, not per server:

```ts
// sketch: a calendar day is a user-local fact — so is isDayOver
const current = chainEndingAt(isDayOver(userTimezone) ? yesterday : today);
```

One honesty footnote: when no valid timezone arrives, the implementation falls back to server
time instead of guessing. The fallback is documented; the rule above is the normal path.

## Rule 4: the counting rule is written in the UI

A disclosure next to the counter explains exactly how it's counted. This is the most important
rule of the four: a counter with secret rules feels like an opponent that punishes on its own
authority. A counter with open rules is a tool — you can argue with a tool, you can only fear an
opponent.

One honest limit: my rules protect the count against the calendar, not against the trash can.
Delete a completion and its day drops out of the set — the count follows what stands. That's
intended, and it belongs in the article.

## Around the counter

Two neighbors share the dashboard and the same design rule. The balance figure pulses at
1.5–2.6 seconds, and the beat is tied to the fill level — the fuller the heart, the calmer the
pulse. Declinable, complete as a still picture when
motion is off. And every care text passes one review question — _does it care, or does it just
log?_ — including the empty case, where the card admits it has nothing to offer:

![Care hint with the always-present crisis line](images/screenshot-care-hint.png)

_„Gerade gibt es keinen Vorschlag für dich. Mach in deinem Tempo weiter.“ — "There's no
suggestion for you right now. Continue at your pace."_

The math stays honest by separation: the per-pillar display keeps the unclamped ratio, so
overshoot stays visible; the aggregate refuses to reward it. Pushing past a target changes
nothing about your balance — overwork is not a strategy the number understands. And when
everything is done, the dashboard says so quietly:

![Tag geschafft: the end-of-day note](images/screenshot-tag-geschafft.png)

_A note, not a siren._

## What I can and can't claim

I can't show you retention numbers yet — the feature is young. What I can show is the
construction: nothing in the loop subtracts, every rule is disclosed, and the day boundary is a
user-local fact. Whether that keeps people opening the app is a question for data I don't have;
that it never turns progress into a debt is a question the design answers.

Try it at [balamentum.modevel.de](https://balamentum.modevel.de) (web + Android). The German
companion article on Medium covers the method, and the web.dev piece condenses the practices for
the web platform.

If you're building a counter of your own: what does yours subtract? I'd like to hear the edge
cases I haven't hit yet — the timezone trap came from a reviewer, the next one might come from
this post.
