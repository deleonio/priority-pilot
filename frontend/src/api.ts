import { Configuration, DefaultApi } from 'client';

// Im Dev-Betrieb leitet der Vite-Proxy (siehe vite.config.ts) die API-Pfade an
// http://localhost:3000 weiter, daher als Basis-URL standardmäßig same-origin ('').
// Über VITE_API_BASE_URL lässt sich die API-URL bei Bedarf (z. B. für Builds) überschreiben.
const basePath = import.meta.env.VITE_API_BASE_URL ?? '';

export const api = new DefaultApi(new Configuration({ basePath }));
