# Spec #2723 — Hilfe und Abmelden in ein Avatar-Popover-Menü verschieben

## Ziel

Die Toolbar „Kopf-Aktionen" enthält nur noch die vier Navigations-Aktionen („Zum Dashboard",
„Suche", „Neuen Task anlegen", „Einstellungen"). „Hilfe" und „Abmelden" wandern in ein Popover,
das sich per Klick auf einen Avatar-Trigger rechts im Header öffnet (KoliBri-First: der Trigger ist
ein `KolPopoverButton`, der den `KolAvatar` trägt — Muster `TaskTree.tsx` #361).

## Voraussetzungen

- Eingeloggter Nutzer, Dashboard sichtbar (Auth-Gate `Root.tsx`).
- Toolbar „Kopf-Aktionen" (`KolToolbar _label="Kopf-Aktionen"`) existiert auf allen Viewports.

## Verhalten

1. **Trigger:** Am rechten Header-Rand (`.app-header__user`) sitzt ein Button-Trigger mit
   zugänglichem Namen „Benutzermenü" (neuer i18n-Key in `navigation.json` de+en; der Avatar selbst
   ist rein darstellend und trägt keinen zugänglichen Namen). Der Trigger zeigt den
   Öffnungszustand über `aria-expanded`.
2. **Öffnen:** Klick oder Enter/Leertaste auf den Trigger öffnet ein Popover mit den Menüpunkten
   „Hilfe" und „Abmelden" (Reihenfolge: erst „Hilfe", dann „Abmelden" — Tab-Reihenfolge identisch).
3. **Schließen:** Escape schließt das Popover und gibt den Fokus an den Trigger zurück; Klick
   außerhalb schließt ebenfalls (beides liefert `KolPopoverButton`, Fokus-Rückkehr nach #361-Muster).
4. **Aktionen unverändert:** „Hilfe" navigiert zur Hilfe-Ansicht (`/hilfe`); „Abmelden" löst
   unverändert `POST /auth/logout` aus und leitet auf `/login` um. Fehlerfall: Alert sichtbar, das
   Popover bleibt offen (kein stiller Close), der Abmelden-Button ist nach dem Fehlschlag wieder
   bedienbar und der Trigger erneut bedienbar.
5. **Toolbar-Vertrag:** Innerhalb der Toolbar „Kopf-Aktionen" existieren „Hilfe"/„Abmelden" nicht
   mehr (Count 0); die vier verbleibenden Buttons bleiben sichtbar und bedienbar. Die Toolbar ist
   damit messbar schlanker (vier statt sechs Items, kein horizontales Scrollen bei 375 px).
6. **Mobile-first (375 px):** Der Avatar-Trigger bleibt erreichbar und misst mindestens 44×44 px
   (Touch-Target, mobile-ui-rules).

## UX-Anforderungen (KI-UX-Block, in den Tests eingeklagt)

- Zugänglicher Name am Trigger (`aria-haspopup`/`aria-expanded` liefert `KolPopoverButton`).
- Escape mit Fokus-Rückkehr auf den Trigger; logische Tab-Reihenfolge „Hilfe" → „Abmelden".
- Bei Logout-Fehler Popover offen lassen (Abmelden-Button deaktiviert statt Popover schließen).
- Beschriftungen „Hilfe"/„Abmelden" unverändert aus der Toolbar übernommen.

## Test-Mapping

| AK  | Test                                                                                                                                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AK1 | `frontend/e2e/avatar-menu.spec.ts` — Popover öffnet, Einträge da                                                                                                                                |
| AK2 | `frontend/e2e/avatar-menu.spec.ts` — Toolbar-Count 0, vier Buttons                                                                                                                              |
| AK3 | `frontend/e2e/avatar-menu.spec.ts` — Item-Anzahl 4, kein Overflow                                                                                                                               |
| AK4 | `logout.spec.ts`, `silent-login.spec.ts`, `issue-2229-launch-banner.spec.ts`, `header-toolbar.spec.ts` (Popover öffnen vor dem Klick; `headerAction`-Helper öffnet das Menü für Hilfe/Abmelden) |
| AK5 | `frontend/e2e/avatar-menu.spec.ts` — Enter/Escape/Fokus/Klick außerhalb                                                                                                                         |
| AK6 | `frontend/e2e/avatar-menu.spec.ts` — 375 px, Trigger ≥ 44×44 px                                                                                                                                 |
