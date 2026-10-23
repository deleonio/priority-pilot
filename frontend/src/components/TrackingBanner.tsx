import { KolButton, KolLink } from '@public-ui/react-v19';
import { useTranslation } from 'react-i18next';
import { legalPath } from '../lib/operator';
import { getPublicOrigin } from '../lib/siteOrigin';
import { useTrackingConsent } from '../lib/tracking';

/**
 * Opt-in-Hinweis zur Reichweitenmessung (#2734), bis eine Wahl gespeichert ist; Muster und Optik des
 * Einladungs-Banners (`LaunchBanner`). Beide Knöpfe gleich gewichtet, Ablehnen ist so leicht wie
 * Zulassen. Ändern lässt sich die Wahl unter Einstellungen → Allgemein.
 */
export const TrackingBanner = () => {
	const { t, i18n } = useTranslation('common');
	const { available, consent, setConsent } = useTrackingConsent();

	if (!available || consent !== null) {
		return null;
	}

	return (
		<div
			className="launch-banner launch-banner--plain"
			role="region"
			aria-label={t('trackingBanner.title')}
			data-testid="tracking-banner"
		>
			<div className="launch-banner__body">
				<strong>{t('trackingBanner.title')}</strong>
				<p className="launch-banner__text">
					{t('trackingBanner.text')}{' '}
					<KolLink
						_label={t('trackingBanner.privacy')}
						_href={`${getPublicOrigin()}${legalPath('privacy', i18n.resolvedLanguage ?? 'de')}`}
						_target="_blank"
					/>
				</p>
			</div>
			<div className="launch-banner__actions">
				<KolButton _label={t('trackingBanner.accept')} _variant="secondary" _on={{ onClick: () => setConsent(true) }} />
				<KolButton
					_label={t('trackingBanner.decline')}
					_variant="secondary"
					_on={{ onClick: () => setConsent(false) }}
				/>
			</div>
		</div>
	);
};
