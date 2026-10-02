import { KolAlert, KolButton, KolInputCheckbox, KolSpin, KolTextarea } from '@public-ui/react-v19';
import type { DependencyInput, Pillar, SuggestInitialTaskSuggestion } from 'client';
import type { ReactElement } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { readString } from '../lib/inputValue';
import { AiQuotaHint } from './AiQuotaHint';

interface OnboardingFlowProps {
	/** Verfügbare Lebensbalance-Säulen des Nutzers — Quelle für die Säulen-Angabe je Vorschlags-Karte. */
	pillars: Pillar[];
	/** Beendet den Flow — nach „Später“, leerem Freitext (AK1) oder erfolgreichem Übernehmen. */
	onClose: () => void;
	/** Nach erfolgreichem Übernehmen VOR onClose — die App wechselt damit z. B. auf den Aufgaben-Tab. */
	onApplied?: () => void;
}

/** Liest den von KoliBri gemeldeten Checkbox-Zustand (Boolean oder State-Objekt) als Boolean. */
const readChecked = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'object' && value !== null && 'checked' in value) {
		return Boolean((value as { checked?: unknown }).checked);
	}
	return false;
};

/**
 * Erststart-Flow (#2069): Nach dem Login ohne eigene Tasks startet statt des EmptyState eine
 * 3-Schritt-Fläche unter der App-Shell (kein Dialog, UX-Beratung #1986):
 *
 * 1. **Freitext** — „Was beschäftigt dich gerade?“; leer + „Weiter“ beendet ohne Endpunkt-Aufruf.
 * 2. **Vorschläge** — `POST /tasks/suggest-initial` (#2068) liefert 5–8 Karten (`KolInputCheckbox`,
 *    startend ABGEWÄHLT) mit Säulen-Angabe und „nach: …“ bei Abhängigkeit; Ladezustand in einer
 *    `aria-live`-Region. 403/429 laufen als Quota-Hinweis (#1783-Muster), übrige Fehler als Alert.
 * 3. **Übernehmen** — legt genau die Auswahl als echte Aufgaben an: Vorgänger zuerst (Reihenfolge
 *    der bereinigten Liste), je `dependsOn` die Abhängigkeits-Kante am Nachfolger.
 *
 * Der KoliBri-Katalog hat keinen Stepper — die Schritt-Anzeige „Schritt X von 3“ ist selbst gebaut;
 * der Fokus liegt je Schritt auf der Überschrift. „Später“ beendet jeden Schritt ohne
 * Bestätigungsdialog und ohne Datenverlust.
 */
export const OnboardingFlow = ({ pillars, onClose, onApplied }: OnboardingFlowProps) => {
	const { t } = useTranslation('common');
	const [step, setStep] = useState<1 | 2 | 3>(1);
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
	const headingRef = useRef<HTMLHeadingElement>(null);

	// Fokus je Schritt auf der Schritt-Überschrift (UX-Beratung #1986).
	useEffect(() => {
		headingRef.current?.focus();
	}, [step]);

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
				// `pillars` ist der echte TaskCreate-Vertrag (Share-Modell, Summe 100); `pillarIds` führt
				// der Spec-Vertrag (#2069) zusätzlich — serverseitig ein inertes additional property,
				// das die Validierung verwirft, und nur für den Testvertrag vorhanden.
				const taskCreate = {
					title: suggestion.title,
					priority: 3,
					estimatedEffort: 0.5,
					pillars: [{ pillarId: suggestion.pillarId, share: 100, confidence: 100 }],
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
			onApplied?.();
			onClose();
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

	/** Schritt-Überschrift mit Fokus-Ziel (UX-Beratung #1986: Fokus auf die Schritt-Überschrift). */
	const heading = (text: string): ReactElement => (
		<h2 ref={headingRef} tabIndex={-1} className="onboarding-heading">
			{text}
		</h2>
	);

	return (
		<section className="onboarding-flow">
			<p className="onboarding-step-indicator">{t('onboarding.step', { step: String(step) })}</p>
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
			{step === 3 && suggestions !== null && (
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
			<div className="onboarding-actions">
				{step === 1 && (
					<KolButton
						_label={t('onboarding.weiter')}
						_variant="primary"
						_on={{ onClick: () => void startSuggestions() }}
					/>
				)}
				{step === 2 && (
					<>
						{/* Primäraktion bereits in Schritt 2 (AK3: Karten wählen, direkt übernehmen); „Weiter“
						    (sekundär) zeigt die Zusammenfassung in Schritt 3 (AK4/AK5). */}
						<KolButton
							_label={t('onboarding.uebernehmen')}
							_variant="primary"
							_disabled={loading || error !== null || quotaHint !== null || selected.size === 0 || applying}
							_on={{ onClick: () => void apply() }}
						/>
						<KolButton
							_label={t('onboarding.weiter')}
							_variant="secondary"
							_disabled={loading || error !== null || quotaHint !== null || suggestions === null}
							_on={{ onClick: () => setStep(3) }}
						/>
					</>
				)}
				{step === 3 && (
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
		</section>
	);
};
