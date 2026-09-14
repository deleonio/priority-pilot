/**
 * Eigentümer-Filter für Queries (Issue #207, AK5). Bei gesetzter `userId` wird auf den
 * eingeloggten Nutzer eingeschränkt; im Pass-Through-Modus (`undefined`) bleibt der Filter leer,
 * sodass reine CRUD-Setups ohne Login unverändert alle Ressourcen sehen (Abwärtskompatibilität).
 */
export const ownerScope = (userId: number | undefined): { userId?: number } => (userId !== undefined ? { userId } : {});
