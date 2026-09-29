# Spec #1818 — Zu langer Titel: verständliche Meldung statt „Validation len on title failed"

Limit: 65 Zeichen, gezählt nach Codepoints (wie `validator.isLength` am Server). Das native `maxlength`
bremst nur Tastatureingaben; programmatisch gesetzte Titel (Schnellerfassung, Sprach-Anhängen,
Lektorat) laufen bisher bis zum Server durch.

## Server (Task und Serie)

- Ziel: 66-Zeichen-Titel liefert `400 { message }` mit deutscher Meldung, die „zu lang" und „65" nennt
  und nie „Validation len" enthält (`POST/PATCH /tasks`, `POST/PATCH /series`).
- 65 Codepoints (auch 10 Emojis + 55 Zeichen) → 201/200. Leerer Titel → weiter 400, aber nicht „zu lang".

## TaskForm

- Vorbedingung: Titel > 65 Codepoints im Formular (z. B. aus Schnellerfassung vorbelegt).
- Schritt: Speichern. Erwartung: `setError` mit deutscher Meldung („zu lang", „65"), kein Request.
- 65 Codepoints inkl. Emoji werden nicht blockiert (Zählung `[...title].length`).
- Bestand (AK5): `_maxLength={TITLE_MAX_LENGTH}` + `_hasCounter` am Titelfeld bleiben.

## Mobile (375 px)

- Meldung erscheint im Formular-Alert, vollständig im Viewport, ohne horizontalen Überlauf.
