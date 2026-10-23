/**
 * Push-Ziele je Push-Art (#2851, docs/push-konzept.md §6): die Sender beziehen ihr `payload.url`
 * von hier, statt das Ziel als Literal zu duplizieren. Der Spiegel-Test (pushTargets.test.ts)
 * gleicht die `/#karte-…`-Anker mit den `id="karte-…"`-Anchor-Ids im Frontend ab.
 */
export const PUSH_TARGETS = {
	dueTask: { eine: (id: number) => `/tasks/${id}`, mehrere: '/#karte-deadlines' },
	dailyTopTasks: { eine: (id: number) => `/tasks/${id}`, mehrere: '/#karte-top-aufgaben' },
	carePush: '/#karte-fuersorge',
	// #2855: Lob/Willkommen zurück auf die Balance-Karte, Rückblicke auf ihre Cards, Journal auf die Route.
	appreciation: '/#karte-balance',
	welcomeBack: '/#karte-balance',
	weeklyRecap: '/#karte-wochenrueckblick',
	yearlyRecap: '/#karte-jahresrueckblick',
	welcomeSteps: '/#karte-willkommen',
	journalImpulse: '/journal',
	streakReminder: '/#karte-streak',
	monthlyRecap: '/#karte-monatsrueckblick',
	milestone: '/#karte-meilensteine',
	taskCreated: (id: number) => `/tasks/${id}`,
	taskCompleted: (id: number) => `/tasks/${id}`,
	seriesGenerated: '/serien',
	// #2852: Abo-/Rechnungs-Service-Pushes zielen auf den Pakete-Tab (Rechnungen mit Anker).
	aboInvoice: '/settings/pakete#rechnungen',
	aboStatus: '/settings/pakete',
	// #2856: Tipps-Hinweis zielt wie die Service-Pushes auf den Pakete-Tab.
	tipps: '/settings/pakete',
	// #2854: Gruppen-Pushes zielen auf den Gruppen-Tab (Einladungs-Karte bzw. Gruppe mit Anker).
	groupInvitations: '/settings/gruppen#einladungen',
	groupDetail: (id: number) => `/settings/gruppen#gruppe-${id}`,
} as const;
