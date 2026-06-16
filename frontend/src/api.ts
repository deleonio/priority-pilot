import type { paths } from 'client';
import createClient from 'openapi-fetch';

// Im Dev-Betrieb leitet der Vite-Proxy (siehe vite.config.ts) die API-Pfade an
// http://localhost:3000 weiter, daher als Basis-URL standardmäßig same-origin ('').
// Über VITE_API_BASE_URL lässt sich die API-URL bei Bedarf (z. B. für Builds) überschreiben.
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

// Typisierter Fetch-Client direkt aus dem OpenAPI-Vertrag (kein generierter Java-Client mehr).
export const api = createClient<paths>({ baseUrl });
