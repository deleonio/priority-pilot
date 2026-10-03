/** Cent-Betrag aus `GET /plans` (#1494) als Euro-String mit Komma, z. B. 799 → "7,99 €". */
export const formatEuro = (cents: number): string => `${(cents / 100).toFixed(2).replace('.', ',')} €`;

/** Zahlungsstatus als Anzeigetext (#2086) — dasselbe Wörterbuch in Eigentümer- und Admin-Sicht (KI-UX). */
export const paymentStatusLabel = (status: string): string => (status === 'refunded' ? 'Erstattet' : 'Bezahlt');
