export type RecipientOption = { label: string; value: string };

/**
 * Baut die Optionsliste für die Empfänger-Auswahl (#1213): `value` ist die stringifizierte
 * User-ID (Key), `label` der filterbare Anzeigename. Das eigene Konto steht immer zuerst;
 * Mitglieder aus mehreren Gruppen erscheinen dank Dedup über die User-ID nur einmal.
 *
 * #1521 (AK1): Zusätzlich stehen die Gruppen des Nutzers als eigene Optionen am Ende der Liste.
 * Sie sind am Text-Präfix „Gruppe: " erkennbar (Teil des Accessible Name — KolSingleSelect kennt
 * keine `optgroup`) und am `value`-Präfix `group:` vom Personen-Zweig unterscheidbar.
 */
export const buildRecipientOptions = (
	own: { id: number; displayName: string },
	members: { userId: number; displayName: string }[],
	groups: { id: number; name: string }[] = [],
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
		...groups.map((group) => ({ label: `Gruppe: ${group.name}`, value: `group:${group.id}` })),
	];
};
