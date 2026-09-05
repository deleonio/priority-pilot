export type RecipientOption = { label: string; value: string };

/**
 * Baut die Optionsliste für die Empfänger-Auswahl (#1213): `value` ist die stringifizierte
 * User-ID (Key), `label` der filterbare Anzeigename. Das eigene Konto steht immer zuerst;
 * Mitglieder aus mehreren Gruppen erscheinen dank Dedup über die User-ID nur einmal.
 */
export const buildRecipientOptions = (
	own: { id: number; displayName: string },
	members: { userId: number; displayName: string }[],
): RecipientOption[] => {
	const namesById = new Map<number, string>();
	for (const member of members) {
		namesById.set(member.userId, member.displayName);
	}
	if (!namesById.has(own.id)) {
		namesById.set(own.id, own.displayName);
	}
	return [
		{ label: own.displayName, value: String(own.id) },
		...[...namesById.entries()].filter(([id]) => id !== own.id).map(([id, label]) => ({ label, value: String(id) })),
	];
};
