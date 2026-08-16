# Issue 697: Auth Field-Mismatch – AuthUser.name vs displayName

**Stand:** 2026-08-16  
**Issue:** #697

---

## Ziel

Korrekten User-Namen im Header nach Login anzeigen – Field-Name konsistent zwischen Interface, API und Rendering.

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
   - `App.tsx` rendert User-Info im Header
   - User-Name wird aus `AuthUser`-Interface gelesen

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
