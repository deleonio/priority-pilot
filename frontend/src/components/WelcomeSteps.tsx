import { KolButton, KolCard } from '@public-ui/react-v19';
import type { Task } from 'client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const STORAGE_KEY = 'pp-welcome-steps';
const CHANGE_EVENT = 'pp-welcome-steps-change';

type StepKey = 'task' | 'pillars' | 'suggestion';
const STEPS: readonly StepKey[] = ['task', 'pillars', 'suggestion'];

interface WelcomeState {
	/** Eingeschaltet durch den Abschluss des Onboardings; Bestandskonten haben keinen Eintrag (AK4). */
	started: boolean;
	/** Endgültig weg: geschlossen oder alle Schritte erledigt (AK3). */
	closed: boolean;
	/** Schritte, deren Bereich geöffnet wurde (`task` ist abgeleitet und steht hier nie). */
	opened: StepKey[];
}

const readState = (): WelcomeState | null => {
	try {
		return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as WelcomeState | null;
	} catch {
		return null;
	}
};

const writeState = (state: WelcomeState): void => {
	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	window.dispatchEvent(new Event(CHANGE_EVENT));
};

/** Schaltet den Einstieg ein (Abschluss des Onboarding-Flows, #2221); ein geschlossener bleibt zu. */
export const startWelcomeSteps = (): void => {
	if (readState() === null) {
		writeState({ started: true, closed: false, opened: [] });
	}
};

interface WelcomeStepsProps {
	tasks: Task[];
	onOpenPillars: () => void;
	onOpenSuggestion: () => void;
}

/**
 * Einstieg „Erste Schritte“ im Dashboard (#2221): Hinweiskarte nach dem Onboarding mit drei Schritten
 * (Aufgabe anlegen, Säulen gewichten, Vorschlag ansehen). `task` ist erledigt, sobald eine Aufgabe
 * existiert; die beiden anderen, sobald ihr Bereich geöffnet wurde. Zustand in localStorage
 * (Muster `CareHint`): ohne Marker rendert nichts, geschlossen oder alles erledigt bleibt endgültig weg.
 */
export const WelcomeSteps = ({ tasks, onOpenPillars, onOpenSuggestion }: WelcomeStepsProps) => {
	const { t } = useTranslation('common');
	const [state, setState] = useState<WelcomeState | null>(readState);

	useEffect(() => {
		const sync = (): void => setState(readState());
		window.addEventListener(CHANGE_EVENT, sync);
		return () => window.removeEventListener(CHANGE_EVENT, sync);
	}, []);

	const done = (step: StepKey): boolean =>
		step === 'task' ? tasks.length > 0 : (state?.opened.includes(step) ?? false);
	const allDone = STEPS.every(done);

	useEffect(() => {
		if (state !== null && !state.closed && allDone) {
			writeState({ ...state, closed: true });
		}
	}, [state, allDone]);

	if (state === null || !state.started || state.closed || allDone) {
		return null;
	}

	const open = (step: 'pillars' | 'suggestion', action: () => void): void => {
		writeState({ ...state, opened: [...state.opened, step] });
		action();
	};

	return (
		<div className="welcome-steps" data-testid="welcome-steps" role="region" aria-label={t('welcome.label')}>
			<KolCard _label={t('welcome.label')} _level={3}>
				<ul className="welcome-steps-list">
					<li data-step="task" data-done={String(done('task'))}>
						<span>{t('welcome.task')}</span>
						{done('task') && <span className="welcome-steps-done">{t('welcome.done')}</span>}
					</li>
					<li data-step="pillars" data-done={String(done('pillars'))}>
						<KolButton
							_label={t('welcome.pillars')}
							_variant="secondary"
							_on={{ onClick: () => open('pillars', onOpenPillars) }}
						/>
						{done('pillars') && <span className="welcome-steps-done">{t('welcome.done')}</span>}
					</li>
					<li data-step="suggestion" data-done={String(done('suggestion'))}>
						<KolButton
							_label={t('welcome.suggestion')}
							_variant="secondary"
							_on={{ onClick: () => open('suggestion', onOpenSuggestion) }}
						/>
						{done('suggestion') && <span className="welcome-steps-done">{t('welcome.done')}</span>}
					</li>
				</ul>
				<KolButton
					className="welcome-steps-close"
					_label={t('welcome.close')}
					_variant="tertiary"
					_on={{ onClick: () => writeState({ ...state, closed: true }) }}
				/>
			</KolCard>
		</div>
	);
};
