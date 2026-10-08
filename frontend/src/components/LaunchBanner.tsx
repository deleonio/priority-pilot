import { KolButton } from '@public-ui/react-v19';
import { useTranslation } from 'react-i18next';

/**
 * Einladungs-Banner der Einführungsphase (#2229): schmaler Streifen im Seitenfluss mit Link zum
 * Feedback-Formular. `enabled` kommt vom Server-Schalter (`launchBanner` aus `GET /auth/me`);
 * bewusst **nicht wegklickbar** — der Banner verschwindet erst, wenn der Server-Schalter
 * ausgeschaltet wird. Kein `KolAlert` — der Banner ist eine dauerhafte Einladung, keine Meldung.
 */
export const LaunchBanner = ({ enabled, onFeedback }: { enabled: boolean; onFeedback: () => void }) => {
	const { t } = useTranslation('common');

	if (!enabled) {
		return null;
	}

	return (
		<div className="launch-banner" role="region" aria-label={t('launchBanner.title')} data-testid="launch-banner">
			<div className="launch-banner__body">
				<strong className="launch-banner__title">{t('launchBanner.title')}</strong>
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
