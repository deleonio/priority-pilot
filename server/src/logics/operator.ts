/**
 * Betreiberangaben für Rechnungs-PDFs (#1955) — Server-Spiegel von `frontend/src/lib/operator.ts`
 * (einzig Quelle dort: Impressum). Werte bewusst dupliziert statt geteilt: Frontend und Server sind
 * getrennte Builds; die Abgleich-Pflicht steht im Kopf von `invoicePdf.ts`.
 *
 * Bewusste Abweichung vom Spiegel: Rechtsform-Zusatz sowie Steuer- und Vertreterangabe erscheinen
 * nur auf der Rechnung (Vorlagen-Look, Pflichtangabe § 14 UStG), nicht im Impressum.
 */
export const OPERATOR = {
	name: 'Martin Oppitz Development',
	legalForm: 'Einzelunternehmen',
	address: ['Am Silberblick 32', '98716 Elgersburg'],
	email: 'balamentum@modevel.de',
	taxNumber: '154/254/02959',
	ustId: 'DE 268 950 317',
	representative: 'Martin Oppitz',
};
