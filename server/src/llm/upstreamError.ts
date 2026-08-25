/**
 * Geteilte Upstream-Fehlerdiagnose: liest aus dem Fehler-Body einer Provider-Antwort die
 * menschenlesbare Ursache. Viele Provider liefern sie als `detail` (Mistral, z. B. HTTP 402
 * „Check your subscription …“), `error.message` (OpenAI-Form) oder `message` — ohne sie bleibt
 * nur ein wertloses „HTTP 402“, und der Nutzer kann nicht unterscheiden, ob Key, Modell, Abo
 * oder Netzwerk das Problem ist. Genutzt von der Produktions-Fehlermeldung (llm.ts) und dem
 * Provider-Test (llmProviders.ts) — eine Stelle, damit beide Formate nicht driften.
 */

/** Maximale Länge der übernommenen Ursache — Meldungen bleiben einzeilig lesbar. */
const DETAIL_MAX_CHARS = 200;

/**
 * Liefert die Kurzform der Ursache aus dem Fehler-Body (gekürzt) — leerer String, wenn der
 * Body nicht lesbar oder none der bekannten Felder gesetzt ist; der Aufrufer entscheidet, ob
 * er sie in seine Meldung übernimmt.
 */
export const upstreamErrorDetail = async (response: globalThis.Response): Promise<string> => {
	try {
		const body = (await response.json()) as Record<string, unknown>;
		const raw =
			typeof body.detail === 'string'
				? body.detail
				: typeof (body.error as Record<string, unknown> | undefined)?.message === 'string'
					? String((body.error as Record<string, unknown>).message)
					: typeof body.message === 'string'
						? body.message
						: '';
		return raw.slice(0, DETAIL_MAX_CHARS);
	} catch {
		return '';
	}
};
