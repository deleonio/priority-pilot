/**
 * Impressum-Tab der Hilfe-Seite: statische Pflichtangaben nach § 5 DDG (früher § 5 TMG).
 * Optionale Felder (aktuell `ustId`, `contentResponsible`) bleiben bei leerem Wert ungerendert.
 */

import { Trans, useTranslation } from 'react-i18next';
import { legalLanguage, legalPath, OPERATOR } from '../lib/operator';
import { getPublicOrigin } from '../lib/siteOrigin';

/** E-Mail-Adresse aus den Operator-Angaben, als mailto-Link gerendert. */
const OperatorEmail = () => <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;

/**
 * Nutzungsbedingungen und Datenschutz liegen auf der Website an der Wurzel, die App unter `/app/`
 * (ADR 0015) — daher `origin` statt `BASE_URL` (#1891).
 */
const LegalLinks = () => {
	const { t, i18n } = useTranslation('messages');
	const language = legalLanguage(i18n.resolvedLanguage ?? i18n.language);
	const links = [
		{ path: legalPath('terms', language), label: t('legal.terms') },
		{ path: legalPath('privacy', language), label: t('legal.privacy') },
	];
	return (
		<>
			<h3>{t('legal.heading')}</h3>
			<p id="legal-links-hint">{t('legal.newTab')}</p>
			<ul className="help-legal-links">
				{links.map(({ path, label }) => (
					<li key={path}>
						<a
							href={`${getPublicOrigin()}${path}`}
							target="_blank"
							rel="noopener noreferrer"
							hrefLang={language}
							aria-describedby="legal-links-hint"
						>
							{label}
						</a>
					</li>
				))}
			</ul>
		</>
	);
};

export const Impress = () => {
	const { t } = useTranslation('onboarding');
	return (
		<div>
			<h2>{t('impress.title')}</h2>

			<h3>{t('impress.legalBasis')}</h3>
			<p>
				{OPERATOR.name}
				<br />
				{OPERATOR.address.map((line) => (
					<span key={line}>
						{line}
						<br />
					</span>
				))}
			</p>

			<h3>{t('impress.contact')}</h3>
			<p>
				{t('impress.email')}: <OperatorEmail />
			</p>

			<h3>{t('impress.representative')}</h3>
			<p>{OPERATOR.representative}</p>

			{OPERATOR.ustId !== '' && (
				<>
					<h3>{t('impress.vatIdTitle')}</h3>
					<p>{t('impress.vatId', { id: OPERATOR.ustId })}</p>
				</>
			)}

			{OPERATOR.contentResponsible !== '' && (
				<>
					<h3>{t('impress.responsible')}</h3>
					<p>{OPERATOR.contentResponsible}</p>
				</>
			)}

			<h3>{t('impress.odrTitle')}</h3>
			<p>
				<Trans
					t={t}
					i18nKey="impress.odrText"
					components={{
						link: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" />,
					}}
				/>
			</p>

			<h3>{t('impress.consumerTitle')}</h3>
			<p>{t('impress.consumerText')}</p>

			<LegalLinks />
		</div>
	);
};
