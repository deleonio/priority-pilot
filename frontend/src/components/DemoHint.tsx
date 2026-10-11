import { KolCard } from '@public-ui/react-v19';
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
 * nur für die laufende Browser-Session (AK3). Eingebauter Closer `_hasCloser` (Autoren-
 * Entscheidung 2026-10-11): KoliBri benennt das X über die eigene i18n („Schließen“, auch im
 * EN-Modus) — die frühere App-Sprache-Anforderung ist damit laut Autor abgelöst.
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
	// KolCard statt KolAlert (#2474): der Demo-Hinweis ist Inhalt, kein Status — neutrale Card
	// nach dem missed-section-Muster, ohne Signal-/Statusfarbe; das X oben rechts liefert der
	// eingebauter Closer (_hasCloser, Grid-Area der Card).
	return (
		<KolCard
			className="demo-hint"
			role="region"
			aria-label={t('demoHint.title')}
			_label={t('demoHint.title')}
			_level={2}
			_hasCloser
			_on={{ onClose: close }}
			data-testid="demo-hint"
		>
			<p>{t('demoHint.text')}</p>
		</KolCard>
	);
};
