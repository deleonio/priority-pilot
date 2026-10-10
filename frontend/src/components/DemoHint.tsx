import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Session-Marker der Ausblendung (#2471): bewusst **sessionStorage**, kein localStorage (AK5) —
 * die Ausblendung überlebt den Reload, nicht aber einen neuen Login. Beim erfolgreichen
 * Prüf-Login löscht der Login-Übergang den Marker wieder (LoginPage), dann erscheint die Card.
 */
export const DEMO_HINT_DISMISSED_KEY = 'pp_demo_hint_dismissed';

/**
 * Demo-Hinweis für das Play-Prüfkonto (#2471): wegklickbare Card oben im Dashboard, nur für
 * Nutzer mit `demoHint` aus `GET /auth/me` — alle anderen sehen nichts. Die Ausblendung gilt
 * nur für die laufende Browser-Session (AK3). Bewusst eigener Close-KolButton statt
 * `_hasCloser`: KoliBris eingebautes X trägt seinen zugänglichen Namen aus der KoliBri-eigenen
 * i18n („Schließen“), auch im EN-Modus — der eigene Button folgt der App-Sprache (KI-UX).
 * Kontrast zum LaunchBanner (#2229): das ist bewusst **nicht** wegklickbar.
 */
export const DemoHint = ({ enabled }: { enabled: boolean }) => {
	const { t } = useTranslation('common');
	// Marker im Initializer lesen: der Zustand übersteht Remounts und volle Reloads (AK3).
	const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DEMO_HINT_DISMISSED_KEY) === '1');

	if (!enabled || dismissed) {
		return null;
	}
	const close = (): void => {
		sessionStorage.setItem(DEMO_HINT_DISMISSED_KEY, '1');
		setDismissed(true);
	};
	return (
		<KolAlert _type="info" _label={t('demoHint.title')} data-testid="demo-hint">
			<div className="demo-hint__row">
				<p className="demo-hint__text">{t('demoHint.text')}</p>
				<KolButton
					_label={t('demoHint.close')}
					_hideLabel
					_icons={{ left: { icon: 'kolicon-cross' } }}
					_on={{ onClick: close }}
					data-testid="demo-hint-close"
				/>
			</div>
		</KolAlert>
	);
};
