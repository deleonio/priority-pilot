// Modell-Router-Baustein (#149, korrekt verortet in #153) — der deterministische Vertrag hinter der
// LLM-Klassifikation. Diese Logik ist eine reine **CI-Belange** und liegt daher als CI-Artefakt im
// Composite-Action-Verzeichnis (NICHT im Server-Runtime-Paket — sonst zöge der Server-Build sie mit).
//
// Die KI-Workflows verdrahten heute `--model claude-opus-4-8` fest. Der Router schätzt stattdessen
// die Komplexität einer Aufgabe ein (ein Sonnet-Prompt liefert EIN Token `haiku|sonnet|opus`) und
// wählt das Ausführungsmodell. Dieses Modul kapselt den testbaren, deterministischen Teil:
// **Validierung + Mapping + Fallback** des Router-Outputs auf eine volle Modell-ID. Es darf bei
// keinem Output hart abbrechen (set -e-fest, Exit 0) — ungültiger Output fällt definiert auf das
// ausgewogene Default-Modell zurück.

/** Die erlaubten Komplexitäts-Tokens, die der Sonnet-Router liefern darf. */
export const ALLOWED_TOKENS = ['haiku', 'sonnet', 'opus'] as const;

/** Ein einzelnes erlaubtes Token. */
export type ModelToken = (typeof ALLOWED_TOKENS)[number];

/** Mapping vom Token auf die im Ticket fixierte volle Modell-ID. */
export const MODEL_IDS: Record<ModelToken, string> = {
	haiku: 'claude-haiku-4-5',
	sonnet: 'claude-sonnet-4-6',
	opus: 'claude-opus-4-8',
};

/** Ausgewogenes Default-Modell: das Fallback-Ziel bei leerem/ungültigem Output. */
export const DEFAULT_MODEL = MODEL_IDS.sonnet;

/** Die Entscheidung des Routers — trägt alle Felder für die Job-Summary (`::notice::`). */
export interface ModelDecision {
	/** Die gewählte volle Modell-ID (z. B. `claude-opus-4-8`). */
	model: string;
	/** Das normalisierte Token; bei Fallback das Default-Token `sonnet`. */
	token: ModelToken;
	/** True, wenn der Output ungültig war und das Default-Modell griff. */
	fallback: boolean;
	/** Nicht-leere Begründung für die Job-Summary / `::notice::`. */
	reason: string;
}

/** Prüft, ob ein normalisierter String ein erlaubtes Token ist (Type-Guard, ohne Assertion). */
const isAllowedToken = (value: string): value is ModelToken => (ALLOWED_TOKENS as readonly string[]).includes(value);

/**
 * Validiert + mappt den rohen Router-Output auf eine volle Modell-ID.
 *
 * Der Router soll GENAU ein Token liefern. Umgebender Whitespace/Newline und variable Groß-/
 * Kleinschreibung sind gültiges Soll-Verhalten und werden normalisiert. Alles andere — leerer/
 * whitespace-only/unbekannter/mehrdeutiger Output sowie `null`/`undefined` — ist ungültig und fällt
 * **ohne Throw** auf {@link DEFAULT_MODEL} zurück (`fallback=true`).
 */
export const resolveModel = (rawOutput: string | null | undefined): ModelDecision => {
	const normalized = (rawOutput ?? '').trim().toLowerCase();

	if (isAllowedToken(normalized)) {
		return {
			model: MODEL_IDS[normalized],
			token: normalized,
			fallback: false,
			reason: `Router-Token "${normalized}" → ${MODEL_IDS[normalized]}.`,
		};
	}

	return {
		model: DEFAULT_MODEL,
		token: 'sonnet',
		fallback: true,
		reason: `Ungültiger Router-Output ${JSON.stringify(rawOutput)} → Default-Modell ${DEFAULT_MODEL}.`,
	};
};
