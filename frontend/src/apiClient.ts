import createClient from 'openapi-fetch';
import type { paths } from 'client';
import { getApiBase } from './lib/siteOrigin';

// Im Dev-Betrieb leitet der Vite-Proxy (siehe vite.config.ts) /api/v1/*-Anfragen an
// http://localhost:3000 weiter und streift das Präfix ab. In Prod übernimmt Caddy denselben
// Rewrite. Über VITE_API_BASE_URL lässt sich die Basis-URL bei Bedarf überschreiben.
export const baseUrl = import.meta.env.VITE_API_BASE_URL ?? getApiBase();

// Der eine openapi-fetch-Client der App — als eigenes Modul, damit auch Komponenten ihn direkt
// nutzen können, deren Unit-Test die api-Fassade als Ganzes mockt (#2940: die Aufgabenansicht
// ruft den Abhängigkeits-Endpunkt hierüber ab, ohne über `../api` zu gehen).
export const client = createClient<paths>({ baseUrl });
