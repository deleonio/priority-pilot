/**
 * Impressum-Tab der Hilfe-Seite: statische Pflichtangaben nach § 5 DDG (früher § 5 TMG).
 * Optionale Felder (aktuell `ustId`, `contentResponsible`) bleiben bei leerem Wert ungerendert.
 */

const OPERATOR = {
	/** Vollständiger Name des Diensteanbieters (natürliche Person oder Firma). */
	name: 'Martin Oppitz Development',
	/** Ladungsfähige Anschrift (Zeilen). */
	address: ['Am Silberblick 32', '98716 Elgersburg'],
	/** Erreichbarkeit: mindestens eine gültige E-Mail-Adresse. */
	email: 'balamentum@modevel.de',
	/** Bei Einzelunternehmen: Inhaber; bei Gesellschaft: gesetzliche Vertretung. */
	representative: 'Martin Oppitz (Inhaber)',
	/** Umsatzsteuer-Identifikationsnummer gemäß § 27 a UStG — nur bei Vorhandensein. */
	ustId: '',
	/** Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV — nur bei redaktionell gestalteten Inhalten nötig. */
	contentResponsible: '',
};

/** E-Mail-Adresse aus den Operator-Angaben, als mailto-Link gerendert. */
const OperatorEmail = () => <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>;

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
	</div>
);
