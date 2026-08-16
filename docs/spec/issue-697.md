# Issue 697: Auth Field-Mismatch – AuthUser.name vs displayName

**Stand:** 2026-08-16  
**Issue:** #697

---

## Ziel

Korrekten User-Namen im Header nach Login anzeigen – Field-Name konsistent zwischen Interface, API und Rendering (Behoben).

---

## Vorbedingung

- User ist nicht eingeloggt
- Backend-Endpoint `/auth/me` liefert User-Daten mit `displayName`-Field

---

## Schritte

1. **Login durchführen**
   - User navigiert zur App
   - Login-Dialog erscheint (OAuth/oder andere Auth-Methode)
   - User authentifiziert sich erfolgreich

2. **API-Response empfangen**
   - Frontend erhält `/auth/me` Response
   - Response enthält `displayName`-Field mit User-Namen

3. **Header rendern**
   - `App.tsx` rendert User-Info im Header (Zeilen 521-522, 543-544)
   - User-Name wird aus `AuthUser.displayName` gelesen (nicht aus `name`)

---

## Erwartetes Ergebnis (Implementiert)

- Header zeigt den korrekten User-Namen an (nicht leer/undefined)
- `AuthUser`-Interface verwendet `displayName`-Field (konsistent mit API-Response)
- Kein TypeScript-Error oder Runtime-Mismatch zwischen Interface und API
- `frontend/src/lib/auth.ts:3` deklariert `displayName: string`
- `frontend/src/App.tsx:521-522` rendert `user.displayName`

---

## Technischer Kontext (Ist-Zustand)

**Korrekt (nach Fix):**

- `frontend/src/lib/auth.ts`: `AuthUser`-Interface deklariert `displayName`-Field (Zeile 3)
- `frontend/src/App.tsx`: rendert `user.displayName` (Zeilen 521-522, 543-544)
- API `/auth/me`: liefert `displayName` (konsistent mit Interface)
- Header zeigt korrekten User-Namen an

---

## Erwartetes Ergebnis

- Header zeigt den korrekten User-Namen an (nicht leer/undefined)
- `AuthUser`-Interface verwendet denselben Field-Namen wie API-Response (`displayName`)
- Kein TypeScript-Error oder Runtime-Mismatch zwischen Interface und API

---

## Technischer Kontext

**Aktuell (gebrochen):**

- `frontend/src/lib/auth.ts`: `AuthUser`-Interface deklariert `name`-Field
- `App.tsx`: rendert `user.name` (bleibt leer nach Login)
- API `/auth/me`: liefert `displayName` (nicht `name`)

**Erwartet (nach Fix):**

- `AuthUser`-Interface verwendet `displayName` (oder API-Response liefert `name`)
- Konsistente Field-Namen über alle Layer (API → Interface → Rendering)
- Header zeigt korrekten User-Namen

---

## Testable Ableitung

- Test: Login → Header zeigt User-Namen (nicht leer)
- Test: AuthUser-Interface matcht API-Response-Field-Name
- Optional: Type-safety Test für Interface/API-Alignment

---

## Versionierung

- **v1.0** (2026-08-16): Initialefassung für Issue #697. Auth Field-Mismatch zwischen Interface, API und Rendering.
- **v1.1** (2026-08-16): Nightly-Sync — Ist-Stand-Korrektur. Feature ist bereits behoben: AuthUser.displayName, App.tsx rendert displayName, API liefert displayName. Kein Mismatch mehr.

---

## Status

**ABGESCHLOSSEN** — Der Field-Mismatch ist behoben. Interface, API und Rendering verwenden konsistent `displayName`.
