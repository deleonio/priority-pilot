/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** Basis-URL der API. Leer = same-origin (nutzt im Dev-Betrieb den Vite-Proxy). */
	readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
