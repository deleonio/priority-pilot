import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

/** Rechtsseiten der öffentlichen Website (#1891, #1892) — öffnen in neuem Tab, damit die Haken erhalten bleiben. */
const LEGAL_LINKS = { terms: '/nutzungsbedingungen/', privacy: '/datenschutz/' } as const;

/**
 * Zustimmungsschritt nach dem Login (#1901): zwei Haken für Nutzungsbedingungen und
 * Datenschutzerklärung, „Weiter“ erst bei beiden, danach `POST /auth/terms`. Wie `LoginPage` aus
 * rohen Elementen im `.login-page`-Rahmen: der Schritt steht vor der App und teilt deren Optik.
 * Wer nicht zustimmen will, meldet sich ab.
 */
export const ConsentStep = ({ onAccepted }: { onAccepted: () => void }) => {
	const { t } = useTranslation('messages');
	const [terms, setTerms] = useState(false);
	const [privacy, setPrivacy] = useState(false);
	const [saving, setSaving] = useState(false);
	const [failed, setFailed] = useState(false);
	const headingRef = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		headingRef.current?.focus();
	}, []);

	const complete = terms && privacy;

	const save = (): void => {
		setSaving(true);
		setFailed(false);
		api
			.acceptTerms()
			.then(onAccepted)
			.catch(() => {
				setFailed(true);
				setSaving(false);
			});
	};

	const logout = (): void => {
		// Wie der Logout in `App.tsx`: kein stiller Re-Login direkt danach.
		void api
			.logout()
			.catch(() => undefined)
			.finally(() => {
				sessionStorage.setItem('pp_just_logged_out', '1');
				window.location.href = `${import.meta.env.BASE_URL}login`;
			});
	};

	const item = (checked: boolean, onChange: (value: boolean) => void, label: string, href: string, link: string) => (
		<div className="consent-step__item">
			<label className="consent-step__check">
				<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
				{label}
			</label>
			<a className="consent-step__link" href={href} target="_blank" rel="noopener noreferrer">
				{link}
				<span className="visually-hidden"> {t('consent.newTab')}</span>
			</a>
		</div>
	);

	return (
		<div className="login-page">
			<div className="login-page__inner">
				<div className="login-page__card">
					<h1 ref={headingRef} tabIndex={-1} className="login-page__title">
						{t('consent.title')}
					</h1>
					<p className="login-page__sub">{t('consent.intro')}</p>
					<fieldset className="consent-step__group">
						<legend className="visually-hidden">{t('consent.legend')}</legend>
						{item(terms, setTerms, t('consent.acceptTerms'), LEGAL_LINKS.terms, t('consent.termsLink'))}
						{item(privacy, setPrivacy, t('consent.acceptPrivacy'), LEGAL_LINKS.privacy, t('consent.privacyLink'))}
					</fieldset>
					{failed && (
						<div role="alert" className="login-page__alert">
							{t('consent.error')}
						</div>
					)}
					<button
						type="button"
						className="login-page__btn login-page__btn--primary"
						disabled={!complete || saving}
						aria-describedby={complete ? undefined : 'consent-step-hint'}
						onClick={save}
					>
						{t('consent.continue')}
					</button>
					{!complete && (
						<p id="consent-step-hint" className="consent-step__hint">
							{t('consent.hint')}
						</p>
					)}
				</div>
				<button type="button" className="login-page__back consent-step__logout" onClick={logout}>
					{t('consent.logout')}
				</button>
			</div>
		</div>
	);
};
