/**
 * Öffentliche Adresse des Servers (#2378, ADR 0021). Der Android-Build bekommt sie als
 * `VITE_SITE_URL` (aus `SITE_URL`, siehe vite.config.ts), der Website-Build lässt sie leer und
 * bleibt bei relativen Pfaden bzw. `window.location.origin`.
 */
const siteUrl = (): string => (import.meta.env.VITE_SITE_URL ?? '').trim().replace(/\/+$/, '');

/** Basis aller API-Aufrufe: `<SITE_URL>/api/v1` im Android-Build, sonst relativ `/api/v1`. */
export const getApiBase = (): string => `${siteUrl()}/api/v1`;

/** Origin für geteilte Links und Rechtstexte: `SITE_URL` im Android-Build, sonst `window.location.origin`. */
export const getPublicOrigin = (): string => siteUrl() || window.location.origin;
