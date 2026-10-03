import { KolAlert, KolButton, KolInputCheckbox, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { DependencyInput, Pillar, SuggestInitialTaskSuggestion } from 'client';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readChecked, readString } from '../lib/inputValue';
import { suggestionsToContributions } from '../lib/pillar';
import { AiQuotaHint } from './AiQuotaHint';
import { EXAMPLE_TASKS } from './EmptyState';
import { PillarWeightsForm } from './PillarWeightsForm';

interface OnboardingFlowProps {
	/** Verfügbare Lebensbalance-Säulen des Nutzers — Quelle für die Säulen-Angabe je Vorschlags-Karte. */
	pillars: Pillar[];
	/** Beendet den Flow — nach „Später“, leerem Freitext (AK1) oder erfolgreichem Übernehmen. */
	onClose: () => void;
	/** Nach erfolgreichem Übernehmen VOR onClose — die App wechselt damit z. B. auf den Aufgaben-Tab. */
	onApplied?: () => void;
	/** Nach erfolgreichem Speichern der Startgewichtung — die App lädt die Säulen neu (#2070). */
	onWeightsSaved?: () => void;
	/** Sichtbarkeits-Spiegel des verdeckt gemounteten Flows (#2110 AK3): nur bei `true` fokussiert die Schritt-Überschrift. */
	active?: boolean;
}

/**
 * Erststart-Flow (#2069): Nach dem Login ohne eigene Tasks startet statt des EmptyState eine
 * 3-Schritt-Fläche unter der App-Shell (kein Dialog, UX-Beratung #1986):
 *
 * 1. **Freitext** — „Was beschäftigt dich gerade?“; leer + „Weiter“ beendet ohne Endpunkt-Aufruf.
 * 2. **Vorschläge** — `POST /tasks/suggest-initial` (#2068) liefert 5–8 Karten (`KolInputCheckbox`,
 *    startend ABGEWÄHLT) mit Säulen-Angabe und „nach: …“ bei Abhängigkeit; Ladezustand in einer
 *    `aria-live`-Region. 403/429 laufen als Quota-Hinweis (#1783-Muster), übrige Fehler als Alert.
 * 3. **Startgewichtung** (#2070) — das eingebettete `PillarWeightsForm` (Settings-Muster, ohne
 *    Abbrechen); „Speichern" schließt den Schritt ab, ohne ihn ist der Flow nicht abschließbar.
 * 4. **Übernehmen** — legt genau die Auswahl als echte Aufgaben an: Vorgänger zuerst (Reihenfolge
 *    der bereinigten Liste), je `dependsOn` die Abhängigkeits-Kante am Nachfolger.
 *
 * Nach dem Übernehmen zeigt der Flow die Abschluss-Karte (#2070 AK2): die nächste Aufgabe als
 * eine Primäraktion, direkt abhakbar, daneben der Balance-Hinweis; „Fertig" beendet den Flow.
 *
 * Der KoliBri-Katalog hat keinen Stepper — die Schritt-Anzeige „Schritt X von N“ ist selbst gebaut;
 * der Fokus liegt je Schritt auf der Überschrift. „Später“ beendet jeden Schritt ohne
 * Bestätigungsdialog und ohne Datenverlust.
 */
/** Gesamtzahl der Flow-Schritte (#2070): Freitext, Vorschläge, Startgewichtung, Übernehmen. */
const TOTAL_STEPS = 4;

export const OnboardingFlow = ({ pillars, onClose, onApplied, onWeightsSaved, active = true }: OnboardingFlowProps) => {
	const { t } = useTranslation('common');
	const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
	const [goal, setGoal] = useState('');
	const [loading, setLoading] = useState(false);
	const [suggestions, setSuggestions] = useState<SuggestInitialTaskSuggestion[] | null>(null);
	const [selected, setSelected] = useState<Set<number>>(new Set());
	const [error, setError] = useState<string | null>(null);
	// #1783-Muster: Drossel/Paket-Ablehnung als freundlicher Hinweis statt Fehler-Ton.
	const [quotaHint, setQuotaHint] = useState<string | null>(null);
	const [applying, setApplying] = useState(false);
	const [applyError, setApplyError] = useState<string | null>(null);
	// Bereits erzeugte Task-IDs je Vorschlags-Index — Grundlage des Retry-Schutzes bei Teilfehler.
	const [createdIds, setCreatedIds] = useState<Record<number, number>>({});
	// #2070: Nach dem Übernehmen zeigt der Flow die Abschluss-Karte („Fertig" beendet ihn) —
	// onClose feuert erst dann, damit die Karte die nächste Aufgabe direkt abhakbar hält.
	const [finished, setFinished] = useState(false);
	// Lokal abgehakte Aufgaben der Abschluss-Karte — optimistisch gesetzt, bei Fehler zurückgerollt.
	const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
	// AK2-Fallback: Ohne eigene Auswahl hakt die Abschluss-Karte die erste Beispielaufgabe rein lokal ab.
	const [exampleDone, setExampleDone] = useState(false);
	const headingRef = useRef<HTMLHeadingElement>(null);

	// Fokus je Schritt auf der Schritt-Überschrift (UX-Beratung #1986) — auch auf der Abschluss-Karte.
	// `active` in den Deps (#2110 AK3): beim Wiedereinstieg bleibt `step` gleich — nur der
	// Sichtbarkeitswechsel feuert den Effekt erneut; im verdeckten Zustand wird nicht fokussiert.
	useEffect(() => {
		if (!active) return;
		headingRef.current?.focus();
	}, [active, step, finished]);

	const pillarName = (pillarId: number): string => pillars.find((pillar) => pillar.id === pillarId)?.name ?? '';

	const startSuggestions = async (): Promise<void> => {
		// AK1: Leeres Feld ruft den Endpunkt nicht auf — der Flow endet ohne Fehlermeldung
		// (Interim bis Teil 3; siehe offene Frage im Analyse-Block).
		if (goal.trim() === '') {
			onClose();
			return;
		}
		setError(null);
		setQuotaHint(null);
		setLoading(true);
		setStep(2);
		try {
			setSuggestions(await api.suggestInitialTasks({ text: goal }));
		} catch (reason) {
			const apiError = await toApiError(reason);
			// 403 plan_required / 429 ai_throttled: freundlicher Quota-Hinweis statt Fehler (Spec).
			if (apiError.throttled === true || apiError.status === 403) {
				setQuotaHint(apiError.message);
			} else {
				setError(apiError.message);
			}
		} finally {
			setLoading(false);
		}
	};

	// Auswahl kaskadiert (PO-Entscheidung Kreuzverhör #2081): Wer einen Nachfolger wählt, wählt
	// seine Vorgänger-Kette mit; wer einen Vorgänger abwählt, wählt die abhängigen Nachfolger
	// mit ab — so bleibt die Karten-Zusage „nach: …“ anlegbar (Ketten wie Zyklen bleiben durch
	// die Suggester-Bereinigung #2068 theoretisch möglich, daher Fixpunkt-Schleife + Zyklus-Guard).
	const toggle = (index: number, value: boolean): void => {
		setSelected((prev) => {
			if (suggestions === null) return prev;
			const next = new Set(prev);
			if (value) {
				const seen = new Set<number>();
				let cursor: number | undefined = index;
				while (cursor !== undefined && !seen.has(cursor)) {
					seen.add(cursor);
					next.add(cursor);
					cursor = suggestions[cursor]?.dependsOn;
				}
			} else {
				next.delete(index);
				let changed = true;
				while (changed) {
					changed = false;
					suggestions.forEach((suggestion, i) => {
						if (next.has(i) && suggestion.dependsOn !== undefined && !next.has(suggestion.dependsOn)) {
							next.delete(i);
							changed = true;
						}
					});
				}
			}
			return next;
		});
	};

	/**
	 * Legt die ausgewählten Vorschläge als echte Aufgaben an — Vorgänger zuerst, dann je `dependsOn`
	 * die Kante am Nachfolger (`POST /tasks/{id}/dependencies`, `dependingTaskId` = Vorgänger).
	 * Bei Teilfehler bleiben die erzeugten IDs je Vorschlags-Index im Zustand (PO-Entscheidung
	 * Kreuzverhör #2081): ein Retry legt nur die fehlenden an und spannt die Kanten mit den
	 * gemerkten IDs (der Server aktualisiert vorhandene Kanten idempotent, `tasks.ts`).
	 */
	const apply = async (): Promise<void> => {
		if (suggestions === null || applying) return;
		setApplying(true);
		setApplyError(null);
		const ids: Record<number, number> = { ...createdIds };
		try {
			const ordered = [...selected].sort((a, b) => a - b);
			for (const index of ordered) {
				if (ids[index] !== undefined) continue;
				const suggestion = suggestions[index];
				// `pillars` ist der echte TaskCreate-Vertrag (#2077): gültige Vollverteilung über ALLE
				// Säulen (jeder Anteil 5–80, Summe 100) — die Vorschlags-Säule mit confidence 100, die
				// übrigen auf Mindestanteil (`suggestionsToContributions` wie im TaskForm). `pillarIds`
				// führt der Spec-Vertrag (#2069) zusätzlich — serverseitig ein inertes additional property,
				// das die Validierung verwirft, und nur für den Testvertrag vorhanden.
				const taskCreate = {
					title: suggestion.title,
					priority: 3,
					estimatedEffort: 0.5,
					pillars: suggestionsToContributions([{ pillarId: suggestion.pillarId, confidence: 100 }], pillars),
					pillarIds: [suggestion.pillarId],
				};
				const created = await api.createTask({ taskCreate });
				const createdId = created?.id;
				if (typeof createdId === 'number') {
					ids[index] = createdId;
					setCreatedIds((prev) => ({ ...prev, [index]: createdId }));
				}
			}
			for (const index of ordered) {
				const dependsOn = suggestions[index].dependsOn;
				const successor = ids[index];
				const predecessor = dependsOn === undefined ? undefined : ids[dependsOn];
				if (typeof successor === 'number' && typeof predecessor === 'number') {
					// Der Flow-Vertrag (#2069) kennt keine Gewichtung — nur `dependingTaskId` (Spec gefroren,
					// e2e deep-equality). `weight` ist im generierten Client-Typ Pflichtfeld, serverseitig
					// aber optional mit Default (tasks.ts) — daher der enge Cast statt Default-Gewicht.
					await api.addDependency({
						id: successor,
						dependencyInput: { dependingTaskId: predecessor } as DependencyInput,
					});
				}
			}
			// #2070: Die Abschluss-Karte bleibt im Flow offen — „Fertig" löst onApplied + onClose aus.
			setFinished(true);
		} catch (reason) {
			const apiError = await toApiError(reason);
			// Der Fehler-Alert nennt, wie viele Aufgaben schon angelegt sind — der Retry vervollständigt.
			const done = Object.keys(ids).length;
			setApplyError(
				done > 0 ? `${t('onboarding.partialInfo', { count: String(done) })} ${apiError.message}` : apiError.message,
			);
		} finally {
			setApplying(false);
		}
	};

	// Abhaken in der Abschluss-Karte (#2070 AK2): echte Aufgaben bekommen ihren Status serverseitig
	// gesetzt; der Haken erscheint optimistisch und rollt bei Fehler zurück. Ohne ID (Test-Mock)
	// bleibt der Haken rein lokal.
	const toggleDone = (id: number | undefined, value: boolean): void => {
		setDoneIds((prev) => {
			const next = new Set(prev);
			if (id === undefined) return next;
			if (value) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
		if (id !== undefined) {
			void api.updateTask({ id, taskUpdate: { status: value ? 'Done' : 'Open' } }).catch(() => {
				setDoneIds((prev) => {
					const next = new Set(prev);
					next.delete(id);
					return next;
				});
			});
		}
	};

	// Die gewählten Aufgaben (Reihenfolge der Auswahl) sind die Abhak-Zeilen der Abschluss-Karte.
	const appliedTasks = (suggestions ?? [])
		.map((suggestion, index) => ({ index, id: createdIds[index], title: suggestion.title }))
		.filter((entry) => selected.has(entry.index) || entry.id !== undefined);

	// Balance-Hinweis (#2070 AK2): die stärkste Säule als Fließtext mit Bezugsgröße (Anteil).
	const strongest = pillars.reduce<Pillar | null>(
		(best, pillar) => (best === null || pillar.weight > best.weight ? pillar : best),
		null,
	);

	/** Schritt-Überschrift mit Fokus-Ziel (UX-Beratung #1986: Fokus auf die Schritt-Überschrift). */
	const heading = (text: string): ReactElement => (
		<h2 ref={headingRef} tabIndex={-1} className="onboarding-heading">
			{text}
		</h2>
	);

	return (
		<section className="onboarding-flow">
			{!finished && (
				<p className="onboarding-step-indicator">
					{t('onboarding.step', { step: String(step), total: String(TOTAL_STEPS) })}
				</p>
			)}
			{step === 1 && (
				<>
					{heading(t('onboarding.heading1'))}
					<KolTextarea
						_label={t('onboarding.goalLabel')}
						_rows={4}
						_maxLength={2000}
						_value={goal}
						_on={{
							onInput: (_event, value) => {
								setGoal(readString(value));
							},
						}}
					/>
				</>
			)}
			{step === 2 && (
				<>
					{heading(t('onboarding.heading2'))}
					{/* aria-live: Ladezustand und Ergebnis werden ohne Fokuswechsel angesagt (WCAG 4.1.3). */}
					<div aria-live="polite" className="onboarding-cards">
						{loading && <KolSpin _show _variant="cycle" _label={t('onboarding.loading')} />}
						{!loading && error !== null && (
							<KolAlert _type="error" _label={t('onboarding.suggestError')}>
								{error}
							</KolAlert>
						)}
						{!loading && error === null && <AiQuotaHint message={quotaHint} />}
						{!loading &&
							error === null &&
							suggestions !== null &&
							suggestions.map((suggestion, index) => {
								const hint = [
									t('onboarding.saule', { name: pillarName(suggestion.pillarId) }),
									suggestion.dependsOn === undefined
										? null
										: t('onboarding.nach', { title: suggestions[suggestion.dependsOn]?.title ?? '' }),
								]
									.filter((part) => part !== null)
									.join(' · ');
								return (
									<KolInputCheckbox
										key={index}
										_label={suggestion.title}
										_hint={hint}
										_on={{
											onInput: (_event, value) => {
												toggle(index, readChecked(value));
											},
										}}
									/>
								);
							})}
					</div>
				</>
			)}
			{step === 3 && (
				<>
					{heading(t('onboarding.headingWeights'))}
					{/* #2070: Die fertige Gewichts-Logik (Settings-Muster) eingebettet — ohne Modal-Rahmen
					    und ohne Abbrechen; „Speichern" schließt den Schritt ab (#1574-Gate bleibt). */}
					<PillarWeightsForm
						pillars={pillars}
						onSaved={() => {
							onWeightsSaved?.();
							setStep(4);
						}}
					/>
				</>
			)}
			{step === 4 && suggestions !== null && (
				<>
					{heading(t('onboarding.heading3'))}
					{applyError !== null && (
						<KolAlert _type="error" _label={t('onboarding.applyError')}>
							{applyError}
						</KolAlert>
					)}
					<p>
						{t('onboarding.selectedCount', {
							selected: String(selected.size),
							total: String(suggestions.length),
						})}
					</p>
				</>
			)}
			{finished && (
				<>
					{heading(t('onboarding.finishHeading'))}
					{/* Abschluss-Karte (#2070 AK2): die nächste Aufgabe als eine Primäraktion, direkt
					    abhakbar; daneben der Balance-Hinweis als Text (stärkste Säule mit Anteil). */}
					<div className="onboarding-cards">
						{appliedTasks.length === 0 ? (
							/* AK2-Fallback: Ohne eigene Auswahl bleibt die Karte nicht leer — die erste
							   Beispielaufgabe ist rein lokal abhakbar (kein Server-Call, Review #2087). */
							<KolInputCheckbox
								_label={t(EXAMPLE_TASKS[0])}
								_checked={exampleDone}
								_on={{
									onInput: (_event, value) => {
										setExampleDone(readChecked(value));
									},
								}}
							/>
						) : (
							appliedTasks.map((entry) => (
								<KolInputCheckbox
									key={entry.id ?? entry.index}
									_label={entry.title}
									_checked={doneIds.has(entry.id ?? -1)}
									_on={{
										onInput: (_event, value) => {
											toggleDone(entry.id, readChecked(value));
										},
									}}
								/>
							))
						)}
					</div>
					{strongest !== null && (
						<p className="onboarding-balance">
							{t('onboarding.balanceHint', { name: strongest.name, share: String(strongest.weight) })}
						</p>
					)}
					<div className="onboarding-actions">
						<KolButton
							_label={t('onboarding.fertig')}
							_variant="primary"
							_on={{
								onClick: () => {
									onApplied?.();
									onClose();
								},
							}}
						/>
					</div>
				</>
			)}
			{!finished && (
				<div className="onboarding-actions">
					{step === 1 && (
						<KolButton
							_label={t('onboarding.weiter')}
							_variant="primary"
							_on={{ onClick: () => void startSuggestions() }}
						/>
					)}
					{/* #2070: Ohne Gewichtung nicht abschließbar (AK1) — Schritt 2 führt nur weiter, Schritt 3
					    speichert die Startgewichtung, erst Schritt 4 übernimmt. */}
					{step === 2 && (
						<KolButton
							_label={t('onboarding.weiter')}
							_variant="primary"
							_disabled={loading || error !== null || quotaHint !== null || suggestions === null}
							_on={{ onClick: () => setStep(3) }}
						/>
					)}
					{step === 4 && (
						<KolButton
							_label={t('onboarding.uebernehmen')}
							_variant="primary"
							_disabled={applying}
							_on={{ onClick: () => void apply() }}
						/>
					)}
					<KolButton
						_label={t('onboarding.spaeter')}
						_variant="secondary"
						_disabled={applying}
						_on={{ onClick: onClose }}
					/>
				</div>
			)}
		</section>
	);
};
