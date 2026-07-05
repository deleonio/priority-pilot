import { test } from './fixtures';

/**
 * PR #315 hat das Status-Select aus dem TaskForm entfernt und den #246-Guard in den binären
 * Done-Toggle in TaskTree verlagert. Die ursprünglichen AK3/AK4-Tests (Status-Dropdown im
 * Bearbeiten-Dialog) sind damit obsolet — die Guard-Funktionalität ist durch done-toggle.spec.ts
 * AK2 abgedeckt.
 */
test.describe.skip('Priority Pilot — Unteraufgaben-Done-Guard (#246) [obsolet seit #315]', () => {
	// Alle Tests wurden durch done-toggle.spec.ts AK2 ersetzt.
});
