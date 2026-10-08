/**
 * Impressum-Tab der Hilfe-Seite: statische Pflichtangaben nach § 5 DDG (früher § 5 TMG).
 * Optionale Felder (aktuell `ustId`, `contentResponsible`) bleiben bei leerem Wert ungerendert.
 */

import { useTranslation } from 'react-i18next';
import { OPERATOR } from '../lib/operator';
import { getPublicOrigin } from '../lib/siteOrigin';

/** E-Mail-Adresse aus den Operator-Angaben, als mailto-Link gerendert. */
const OperatorEmail = () => <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;

/**
 * Nutzungsbedingungen und Datenschutz liegen auf der Website an der Wurzel, die App unter `/app/`
 * (ADR 0015) — daher `origin` statt `BASE_URL` (#1891).
 */
const LegalLinks = () => {
	const { t, i18n } = useTranslation('messages');
	const links = [
		{ path: '/nutzungsbedingungen/', label: t('legal.terms') },
		{ path: '/datenschutz/', label: t('legal.privacy') },
	];
	return (
		<>
			<h3>{t('legal.heading')}</h3>
			<p id="legal-links-hint">{t('legal.newTab')}</p>
			{(i18n.resolvedLanguage ?? i18n.language) !== 'de' && <p>{t('legal.germanOnly')}</p>}
			<ul className="help-legal-links">
				{links.map(({ path, label }) => (
					<li key={path}>
						<a
							href={`${getPublicOrigin()}${path}`}
							target="_blank"
							rel="noopener noreferrer"
							hrefLang="de"
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

export const Impress = () => (
	<div>
		<h2>Impressum</h2>

		<h3>Angaben gemäß § 5 DDG</h3>
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

		<h3>Kontakt</h3>
		<p>
			E-Mail: <OperatorEmail />
		</p>

		<h3>Vertretungsberechtigt</h3>
		<p>{OPERATOR.representative}</p>

		{OPERATOR.ustId !== '' && (
			<>
				<h3>Umsatzsteuer-Identifikationsnummer</h3>
				<p>Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG: {OPERATOR.ustId}</p>
			</>
		)}

		{OPERATOR.contentResponsible !== '' && (
			<>
				<h3>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h3>
				<p>{OPERATOR.contentResponsible}</p>
			</>
		)}

		<h3>EU-Streitschlichtung</h3>
		<p>
			Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
			<a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">
				https://ec.europa.eu/consumers/odr/
			</a>
			. Unsere E-Mail-Adresse finden Sie oben im Impressum.
		</p>

		<h3>Verbraucherstreitbeilegung</h3>
		<p>
			Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
			teilzunehmen.
		</p>

		<LegalLinks />
	</div>
);
