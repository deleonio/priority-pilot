// Öffentliche Oberfläche des API-Vertrags für das Frontend.
//
// `schema.d.ts` wird von `openapi-typescript` aus ../openapi.yml erzeugt (kein handgeschriebener
// Code, nicht versioniert). Dieses Modul re-exportiert daraus die `paths`/`components` (für
// `openapi-fetch`) sowie bequeme Typ-Aliase. Datumsfelder sind im Vertrag als ISO-String
// typisiert; der Frontend-Client (frontend/src/api.ts) revived sie zu echten `Date`-Objekten —
// die Aliase unten spiegeln das wider.
import type { components } from './schema';

export type { components, paths } from './schema';

type Schemas = components['schemas'];

type WithDateDeadline<T> = Omit<T, 'deadline'> & { deadline?: Date | null };

export type Task = WithDateDeadline<Schemas['Task']>;
export type TaskCreate = WithDateDeadline<Schemas['TaskCreate']>;
export type TaskUpdate = WithDateDeadline<Schemas['TaskUpdate']>;
export type TaskStatus = Schemas['TaskStatus'];
export type TaskTreeNode = Schemas['TaskTreeNode'];
export type NearbyTask = Schemas['NearbyTask'];
export type GeoConfig = Schemas['GeoConfig'];
export type DependencyInput = Schemas['DependencyInput'];
export type Pillar = Schemas['Pillar'];
export type PillarCreate = Schemas['PillarCreate'];
export type PillarUpdate = Schemas['PillarUpdate'];
export type TaskPillarContribution = Schemas['TaskPillarContribution'];
export type TaskPillarContributionInput = Schemas['TaskPillarContributionInput'];
export type ChecklistItem = Schemas['ChecklistItem'];
export type PillarWeightsInput = Schemas['PillarWeightsInput'];
export type SuggestPillarsInput = Schemas['SuggestPillarsInput'];
export type PillarSuggestion = Schemas['PillarSuggestion'];
export type SuggestPillarsResult = Schemas['SuggestPillarsResult'];
export type PillarFeedbackInput = Schemas['PillarFeedbackInput'];
export type PillarFeedbackResult = Schemas['PillarFeedbackResult'];
export type ActivityAdvisorInput = Schemas['ActivityAdvisorInput'];
export type ActivityAdvice = Schemas['ActivityAdvice'];
export type ActivityAdvisorResult = Schemas['ActivityAdvisorResult'];
export type ParseTaskInput = Schemas['ParseTaskInput'];
export type ParsedTask = Schemas['ParsedTask'];
export type ApiError = Schemas['Error'];

// LLM-Provider: Custom-Provider (frei anlegbar) und fixe Built-ins (Mistral/OpenRouter,
// Key aus Server-ENV). Der Client liest nur den Status ohne Key-Werte und schreibt optional
// neue Keys/Modell — die Key-Werte selbst werden nie ausgelesen (Sicherheit).
export type LlmProvider = Schemas['LlmProvider'];
export type LlmProviderInput = Schemas['LlmProviderInput'];
export type LlmProviderUpdate = Schemas['LlmProviderUpdate'];
export type LlmModel = Schemas['LlmModel'];
export type LlmModels = Schemas['LlmModels'];
export type LlmProviderTestResult = Schemas['LlmProviderTestResult'];

// Web-Push (#355): Opt-in-Subscription-Flow der PWA.
export type PushSubscriptionInput = Schemas['PushSubscriptionInput'];
export type PushSubscriptionAck = Schemas['PushSubscriptionAck'];
export type VapidPublicKey = Schemas['VapidPublicKey'];

// Serien-Templates (#120/#142). `startDate` (im Vertrag ISO-String) wird vom Frontend-Client
// (frontend/src/api.ts) analog zur Task-`deadline` zu echten `Date`-Objekten revived.
type WithDateStartDate<T> = Omit<T, 'startDate'> & { startDate: Date };

export type SeriesRhythm = Schemas['SeriesRhythm'];
export type Series = WithDateStartDate<Schemas['Series']>;
export type SeriesCreate = WithDateStartDate<Schemas['SeriesCreate']>;
export type SeriesUpdate = Omit<Schemas['SeriesUpdate'], 'startDate'> & { startDate?: Date };
export type SeriesGenerateInput = Omit<Schemas['SeriesGenerateInput'], 'until'> & { until: Date };

// `TaskStatus` zusätzlich als Laufzeitwert (der Vertrag liefert nur einen String-Union-Typ),
// damit Aufrufer weiterhin `TaskStatus.Open` etc. nutzen können.
export const TaskStatus = {
	Open: 'Open',
	InProcess: 'In process',
	Done: 'Done',
} as const satisfies Record<'Open' | 'InProcess' | 'Done', Schemas['TaskStatus']>;

// Fehler, den der Frontend-Client bei nicht-erfolgreichen HTTP-Antworten wirft (löst die frühere
// `ResponseError`-Klasse des generierten Clients ab; `toApiError` prüft darauf via `instanceof`).
export class ResponseError extends Error {
	constructor(
		public response: Response,
		/**
		 * Geparster Fehler-Body der Response, wenn er beim Throw bereits vorlag. openapi-fetch liest
		 * den Body JEDER non-ok Response (`response.text()`), danach ist `response.clone()` unbrauchbar
		 * („Body has already been consumed") — `toApiError` nimmt deshalb zuerst dieses Feld (#948).
		 */
		public body?: unknown,
		message = `Response returned an error code (HTTP ${response.status}).`,
	) {
		super(message);
		this.name = 'ResponseError';
	}
}
