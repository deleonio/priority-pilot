import { KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const DISMISS_KEY = 'launch-banner-dismissed';

/**
 * Einladungs-Banner der Einführungsphase (#2229): schmaler Streifen im Seitenfluss mit Link zum
 * Feedback-Formular. `enabled` kommt vom Server-Schalter (`launchBanner` aus `GET /auth/me`);
 * das Schließen merkt sich der Browser pro Gerät (Muster `InstallPrompt.tsx`). Bewusst kein
 * `KolAlert` — der Banner ist eine dauerhafte Einladung, keine Meldung. Schließen ist ein
 * Icon-Button (`_hideLabel`, Label bleibt als aria-label erhalten, 44px-Fläche).
 */
export const LaunchBanner = ({ enabled, onFeedback }: { enabled: boolean; onFeedback: () => void }) => {
	const { t } = useTranslation('common');
	// Synchron im Initializer lesen, sonst blitzt der Banner nach dem Reload kurz auf.
	const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) !== null);

	if (!enabled || dismissed) {
		return null;
	}

	return (
		<div className="launch-banner" role="region" aria-label={t('launchBanner.title')} data-testid="launch-banner">
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
				<KolButton
					_label={t('launchBanner.dismiss')}
					_hideLabel
					_icons="fa-solid fa-xmark"
					_variant="tertiary"
					_on={{
						onClick: () => {
							localStorage.setItem(DISMISS_KEY, 'true');
							setDismissed(true);
						},
					}}
					data-testid="launch-banner-dismiss"
				/>
			</div>
		</div>
	);
};
