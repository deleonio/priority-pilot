import { KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LAUNCH_BANNER_DISMISS_KEY } from '../lib/launchBanner';

/**
 * Einladungs-Banner der Einführungsphase (#2229): schmaler Streifen im Seitenfluss mit Link zum
 * Feedback-Formular. `enabled` kommt vom Server-Schalter (`launchBanner` aus `GET /auth/me`);
 * schließbar (#2480) — der Schließen-Knopf setzt den localStorage-Key `pp-launch-banner-dismissed`,
 * danach bleibt der Banner über Reload und neue Tabs weg, erst ein neuer Login erscheint er wieder.
 * Kein `KolAlert` — der Banner ist eine dauerhafte Einladung, keine Meldung.
 */
export const LaunchBanner = ({ enabled, onFeedback }: { enabled: boolean; onFeedback: () => void }) => {
	const { t } = useTranslation('common');
	const [dismissed, setDismissed] = useState(() => localStorage.getItem(LAUNCH_BANNER_DISMISS_KEY) !== null);

	if (!enabled || dismissed) {
		return null;
	}

	return (
		<div className="launch-banner" role="region" aria-label={t('launchBanner.title')} data-testid="launch-banner">
			<div className="launch-banner__close">
				{/* Eigener Schließen-Knopf statt KolCard `_hasCloser`: KoliBri benennt dessen X über die
				    eigene i18n (auch im EN-Modus „Schließen“) — der zugängliche Name muss der App-Sprache
				    folgen (#2480). */}
				<KolButton
					_label={t('launchBanner.close')}
					_icons={{ left: { icon: 'fa-solid fa-xmark' } }}
					_hideLabel
					_variant="ghost"
					_on={{
						onClick: () => {
							localStorage.setItem(LAUNCH_BANNER_DISMISS_KEY, '1');
							setDismissed(true);
						},
					}}
					data-testid="launch-banner-dismiss"
				/>
			</div>
			<div className="launch-banner__body">
				<strong>{t('launchBanner.title')}</strong>
				<p className="launch-banner__text">{t('launchBanner.text')}</p>
			</div>
			<div className="launch-banner__actions">
				<KolButton
					_label={t('launchBanner.feedback')}
					_variant="secondary"
					_on={{ onClick: onFeedback }}
					data-testid="launch-banner-feedback"
				/>
			</div>
		</div>
	);
};
