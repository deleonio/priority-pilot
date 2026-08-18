import { Router } from 'express';
import type { Response } from 'express';
import { DEFAULT_OPENROUTER_API_URL, DEFAULT_OPENROUTER_MODEL } from '../../llm/llm.js';
import type { components } from '../../api.js';

type FreeModelDto = components['schemas']['FreeModel'];
type FreeModelsDto = components['schemas']['FreeModels'];
type ErrorDto = components['schemas']['Error'];

/** Wie lange eine einmal geladene Modellliste als „aktuell" gilt, bevor OpenRouter erneut gefragt wird. */
const CACHE_TTL_MS = 5 * 60 * 1000;
/** Zeitlimit für den Upstream-Call — der Dialog soll nicht minutenlang auf OpenRouter warten. */
const UPSTREAM_TIMEOUT_MS = 8_000;

interface OpenRouterModel {
	id: string;
	name: string;
	/** Kontext-Länge, wie OpenRouter sie im Raw-Feld `context_length` liefert — fehlt bei manchen Modellen. */
	context_length?: number;
}

/**
 * Lädt die aktuelle Modellliste von OpenRouter (`GET /models` — öffentlich, kein API-Key nötig).
 * Wirft bei Netzwerkfehler, Timeout, Non-200 oder ungültigem JSON — der Aufrufer antwortet dann 502.
 */
export const fetchFreeModelsFromOpenRouter = async (): Promise<FreeModelDto[]> => {
	const baseUrl = (process.env.OPENROUTER_API_URL ?? DEFAULT_OPENROUTER_API_URL).replace(/\/+$/, '');
	const response = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
	if (!response.ok) {
		throw new Error(`OpenRouter antwortete ${response.status}.`);
	}
	const payload: unknown = await response.json();
	const data = (payload as { data?: unknown }).data;
	if (!Array.isArray(data)) {
		throw new Error('Ungültige Antwort von OpenRouter (keine Modellliste).');
	}
	return toFreeModels(
		data.filter((model): model is OpenRouterModel => {
			const candidate = model as Partial<OpenRouterModel>;
			return typeof candidate.id === 'string' && typeof candidate.name === 'string';
		}),
	);
};

/** Injizierbarer Upstream für `createFreeModelsRouter` (Tests geben hieran einen deterministischen Mock). */
export type FetchFreeModels = () => Promise<FreeModelDto[]>;

/** Modul-Level-Cache (eine Instanz pro Server-Prozess; Tests resettet ihn via `resetFreeModelsCache`). */
let cache: { models: FreeModelDto[]; expiresAt: number } | null = null;

/** Setzt den Modelllisten-Cache zurück — nur für Tests, damit jeder Fall einen definierten Kaltstart hat. */
export const resetFreeModelsCache = (): void => {
	cache = null;
};

/**
 * Ein Modell gilt als „kostenlos", wenn es OpenRouter selbst so ausweist: als Auto-Router
 * `openrouter/free` (routet automatisch auf freie Kapazität) oder als `:free`-Variante eines
 * Modells. Preise werden bewusst NICHT als Kriterium geparsed — das `:free`-Suffix ist OpenRouters
 * kanonisches Kennzeichen und robuster gegen Formatänderungen der Preis-Strings.
 */
const isFreeModel = (model: OpenRouterModel): boolean =>
	model.id === DEFAULT_OPENROUTER_MODEL || model.id.endsWith(':free');

/**
 * Leitet die Modell-Größe aus der Modell-ID ab („…-32b-instruct:free" → „32B"). OpenRouter liefert
 * für `/models` kein eigenes Feld dafür, die Größe steckt aber fast immer im ID-Slug. Der negative
 * Lookahead verhindert Fehltreffer wie „8bit"; ohne Treffer entfällt die Angabe ganz (AK3 #862).
 */
const deriveModelSize = (id: string): string | null => {
	const match = /(\d+(?:\.\d+)?)b(?![a-z0-9])/i.exec(id);
	return match === null ? null : `${match[1]}B`;
};

/**
 * Filtert die OpenRouter-Modellliste auf die kostenlosen Modelle und sortiert sie:
 * `openrouter/free` (der Anzeige-Default aus #640) zuerst, der Rest alphabetisch nach Anzeigename —
 * so steht das Default-Modell in der Auswahl immer an erster Stelle.
 */
const toFreeModels = (upstream: OpenRouterModel[]): FreeModelDto[] =>
	upstream
		.filter(isFreeModel)
		.sort((a, b) => {
			if (a.id === DEFAULT_OPENROUTER_MODEL) return -1;
			if (b.id === DEFAULT_OPENROUTER_MODEL) return 1;
			return a.name.localeCompare(b.name);
		})
		.map((model) => {
			const modelSize = deriveModelSize(model.id);
			return {
				id: model.id,
				name: model.name,
				...(model.context_length !== undefined ? { contextLength: model.context_length } : {}),
				...(modelSize !== null ? { modelSize } : {}),
			};
		});

/**
 * Router für `GET /models/free` (#742): aktuelle kostenlose OpenRouter-Modelle für die
 * Frontend-Auswahl. Der Upstream ist injizierbar (AppDeps, Muster wie `createPillarAdvisorRouter`),
 * damit Route-Tests deterministisch ohne echtes OpenRouter laufen.
 */
export const createFreeModelsRouter = (fetchFreeModels: FetchFreeModels = fetchFreeModelsFromOpenRouter): Router => {
	const router = Router();

	// Die Liste ist bewusst dynamisch (jeder Cache-Miss fragt den Upstream — nichts ist hartcodiert);
	// der TTL-Cache verhindert nur, dass jeder Dialog-Öffnungsvorgang OpenRouter hämmert.
	router.get('/models/free', async (_req, res: Response<FreeModelsDto | ErrorDto>) => {
		if (cache !== null && cache.expiresAt > Date.now()) {
			res.json({ models: cache.models });
			return;
		}
		try {
			const models = await fetchFreeModels();
			cache = { models, expiresAt: Date.now() + CACHE_TTL_MS };
			res.json({ models });
		} catch {
			// Bewusst KEINE hartcodierte Fallback-Liste: AK4 (#742) verlangt „aktuell, nicht veraltet" —
			// ein stiller Ersatzkatalog wäre unmerklich falsch. Der Client zeigt den Fehler im Dialog.
			res.status(502).json({ message: 'Die Modellliste von OpenRouter konnte nicht geladen werden.' });
		}
	});

	return router;
};
