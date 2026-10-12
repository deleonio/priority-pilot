import { useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Landing für einen in der App angeforderten Magic Link (#2563): Der Browser verbraucht den
 * Einmal-Token nicht, sondern bietet den Rücksprung in die Android-App per Custom Scheme an — dort
 * löst der Root den Token per POST ein (#2377). Bewusst rohe Elemente im LoginPage-Look statt
 * KoliBri — dieselbe dokumentierte Ausnahme wie die LoginPage (Shadow-Typo, Test-Verträge).
 */
export const MagicLinkLanding = ({ token }: { token: string }) => {
	const { t } = useTranslation('onboarding');
	// Doppel-Tap feuert die App zweimal — nach dem ersten Tap bleibt der Link ohne Wirkung.
	const [geoeffnet, setGeoeffnet] = useState(false);

	return (
		<div className="login-page">
			<div className="login-page__inner">
				<div className="login-page__card">
					<h1 className="login-page__title">{t('login.magicLanding.title')}</h1>
					<p className="login-page__sub">{t('login.magicLanding.sub')}</p>
					<a
						href={`balamentum.app://auth/native?magic=${encodeURIComponent(token)}`}
						className="login-page__btn login-page__btn--primary"
						aria-disabled={geoeffnet || undefined}
						onClick={(event) => {
							if (geoeffnet) event.preventDefault();
							else setGeoeffnet(true);
						}}
					>
						{t('login.magicLanding.openApp')}
					</a>
					{geoeffnet && (
						<p role="status" className="login-page__status">
							{t('login.magicLanding.opened')}
						</p>
					)}
					<p className="login-page__sub">{t('login.magicLanding.hint')}</p>
				</div>
			</div>
		</div>
	);
};
