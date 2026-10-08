import i18next from '../i18n/config';

/** Cent-Betrag aus `GET /plans` (#1494) als Euro-String mit Komma, z. B. 799 → "7,99 €". */
export const formatEuro = (cents: number): string =>
	i18next.language === 'en' ? `€${(cents / 100).toFixed(2)}` : `${(cents / 100).toFixed(2).replace('.', ',')} €`;

/** Zahlungsstatus als Anzeigetext (#2086) — dasselbe Wörterbuch in Eigentümer- und Admin-Sicht (KI-UX). */
export const paymentStatusLabel = (status: string): string =>
	i18next.t(status === 'refunded' ? 'app:payment.refunded' : 'app:payment.paid');
