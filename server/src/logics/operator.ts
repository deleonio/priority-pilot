/**
 * Betreiberangaben für Rechnungs-PDFs (#1955) — Server-Spiegel von `frontend/src/lib/operator.ts`
 * (einzig Quelle dort: Impressum). Werte bewusst dupliziert statt geteilt: Frontend und Server sind
 * getrennte Builds; die Abgleich-Pflicht steht im Kopf von `invoicePdf.ts`.
 */
export const OPERATOR = {
	name: 'Martin Oppitz Development',
	address: ['Am Silberblick 32', '98716 Elgersburg'],
	email: 'balamentum@modevel.de',
	ustId: '',
};
