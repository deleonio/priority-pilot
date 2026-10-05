import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const DISMISS_KEY = 'launch-banner-dismissed';

/**
 * Einladungs-Banner der Einführungsphase (#2229): schmaler Streifen im Seitenfluss mit Link zum
 * Feedback-Formular. `enabled` kommt vom Server-Schalter (`launchBanner` aus `GET /auth/me`);
 * das Schließen merkt sich der Browser pro Gerät (Muster `InstallPrompt.tsx`). Titel und Text
 * stehen im Slot (Light DOM) statt in `_label`, Schließen ist ein eigener `KolButton` statt
 * `_hasCloser` — nur so sind beide testbar und als 44px-Fläche messbar (Muster `PushToast.tsx`).
 */
export const LaunchBanner = ({ enabled, onFeedback }: { enabled: boolean; onFeedback: () => void }) => {
	const { t } = useTranslation('common');
	// Synchron im Initializer lesen, sonst blitzt der Banner nach dem Reload kurz auf.
	const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) !== null);

	if (!enabled || dismissed) {
		return null;
	}

	return (
		<div className="launch-banner" data-testid="launch-banner">
			<KolAlert _type="info" _label={t('launchBanner.title')}>
				<strong>{t('launchBanner.title')}</strong>
				<p>{t('launchBanner.text')}</p>
				<div className="launch-banner__actions">
					<KolButton
						_label={t('launchBanner.feedback')}
						_variant="secondary"
						_on={{ onClick: onFeedback }}
						data-testid="launch-banner-feedback"
					/>
					<KolButton
						_label={t('launchBanner.dismiss')}
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
			</KolAlert>
		</div>
	);
};
