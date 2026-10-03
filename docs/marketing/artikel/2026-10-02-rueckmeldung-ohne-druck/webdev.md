<!--
web.dev Fachartikel (1–2-Seiter) — Fokus-Thema: „Calm feedback“ (gestaltete Zustände, Texte, Bewegung, Zähler)
Genre: Fachartikel für Web-Profis — allgemeine Gestaltungs- und Plattform-Praktiken; Balamentum
läuft als Fallbeispiel (echte App-Screenshots, deutschsprachige UI mit Übersetzungshilfe). Kein
Quellcode-Walkthrough: keine Dateinamen, keine Repo-Pfade; Snippets sind allgemeine Muster.
Bilder: images/ (Screenshots + eine SVG als Diagramm, Generator im Ordner).
Schwesterartikel: medium.md (deutsch, Methode) und devto.md (englisch, dev.to-Feldbericht).
-->

# Calm feedback: four practices from a real dashboard

_By Martin Oppitz · Balamentum_

**TL;DR:** Four practices from the feedback system of Balamentum, shown in real screenshots plus
one diagram — one practice per section, followed by a checklist.

![The dashboard: balance heart, stats, care card](images/screenshot-dashboard-desktop.png)

_Demo data: 13 done, 3 open. The care card continues below the fold — the next section quotes
it in full._

## Design every state a view can land in

Every view that loads data is held to the same rule: four designed states — loading, empty,
error, success. An empty state invites action instead of showing a blank rectangle. Feedback on
input aims for under 100 ms as a general rule — at minimum a pressed state. When the structure
of incoming content is known, a skeleton beats a bare spinner. And a toast is not the only home
for an error: anything dismissible by a timer is too easy to miss.

The error state carries the rule people notice most: name what happened and what to do next,
without apologies and without bare error codes.

```html
<!-- async feedback lives in the DOM, not only in a toast -->
<p role="status" aria-live="polite">Saved</p>
```

The pattern, drawn as a diagram:

![The four designed states as a diagram](images/states-en.svg)

_Loading, empty, error, success — the diagram shows the pattern; the care card above shows the
empty state as it ships, in German UI._

## Hold every text to the care-or-log question

Every care text has to pass one review question: _does the text care, or does it just log?_ A
logging text states a number and implies a verdict; a caring text offers something for today — a
small step, a permission, or real recognition. The empty case of that suggestion feature passes
the question, and it is the card visible in full here:

![Care hint: the empty case, with the crisis line](images/screenshot-care-hint.png)

_“Gerade gibt es keinen Vorschlag für dich. Mach in deinem Tempo weiter.” — "There's no
suggestion for you right now. Continue at your pace." Even the crisis line (“In a crisis you
reach the TelefonSeelsorge, 0800 111 0 111, free of charge, around the clock”) is written to
accompany, not to warn. Words like "neglected", "missed" or "failed" don't appear anywhere in
these texts._

The same rule shapes error copy: name the cause and the next step, skip the apology. "Oops!
Something went wrong." logs a failure; "Saving failed — your changes are still here. Try again?"
helps the reader.

## Let motion carry meaning — and stay declinable

Transitions run through two duration tokens, 120 and 200 ms, with `ease-out` for what appears
and `ease-in` for what disappears. Nothing blinks or pulses forever. The deliberate exception is
ambient motion that carries meaning: the balance figure pulses with a resting heartbeat of
1.5–2.6 seconds, and the beat is tied to the fill level — the fuller the heart, the calmer the
pulse. No alarm at a skewed state, just a slightly more urgent beat.

That motion can be declined through an in-app switch and the system setting, and the fallback is
the complete, still rendering: less motion, never less content. Under
`prefers-reduced-motion: reduce`, movement drops back to opacity only.

```css
@media (prefers-reduced-motion: reduce) {
	:root {
		--motion-fast: 1ms;
		--motion-base: 1ms;
	}
}
```

## Build counters that only add

The streak beside the balance heart follows four rules: the running day doesn't count as broken,
the best mark never shrinks, late completions rescue the day they were due, and the counting
rule is disclosed in the UI. As long as completions stand, nothing in the loop subtracts —
deleting one takes its day out of the set, which is the intended behavior and part of the
honesty here.

The math around it stays honest by separation: the per-pillar display keeps the unclamped
actual-to-target ratio (overshoot stays visible), while the aggregate balance caps at 1.0 —
overdoing cannot win the widget. Success is marked quietly: a short note appears on the
dashboard when the day is done, no siren.

## Checklist

For your next dashboard, in one place:

- Four states per data view; empty invites, errors name cause plus next step.
- One review question per text: does it care, or does it just log?
- Ambient motion only where it means something — and always with a complete still fallback.
- Counters add; only the aggregate caps.

The German companion article on Medium covers the method behind these decisions; the dev.to
field report details the streak rules. The app runs at
[balamentum.modevel.de](https://balamentum.modevel.de).
