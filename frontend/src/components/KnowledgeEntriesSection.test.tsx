import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Rote Spec-Tests für #1936 AK7 (Spec docs/spec/issue-1936.md) — Einstellungen → Tab „KI“,
 * Abschnitt „Wissens-Einträge": Pro-Nutzer legen Einträge an, bearbeiten und löschen sie; Free/Plus
 * sehen statt der Liste den `PlanHint`.
 *
 * Muster: `PlaceFavoritesSection.test.tsx` (Proxy-Mock für `../api`, KoliBri auf native Elemente
 * reduziert, `Modal` als `div`). Rot, bis `KnowledgeEntriesSection.tsx` existiert (Datei fehlt heute).
 */

vi.mock('@public-ui/react-v19', () => ({
	KolButton: ({
		_label,
		_on,
		_disabled,
		children,
		...rest
	}: {
		_label?: string;
		_on?: { onClick?: () => void };
		_disabled?: boolean;
		children?: React.ReactNode;
	}) => (
		<button type="button" disabled={_disabled} onClick={() => _on?.onClick?.()} {...(rest as Record<string, unknown>)}>
			{_label}
			{children}
		</button>
	),
	KolInputText: ({
		_label,
		_value,
		_on,
		...rest
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (_e: unknown, v: string) => void; onChange?: (_e: unknown, v: string) => void };
	}) => (
		<input
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => {
				_on?.onInput?.(e.nativeEvent, e.target.value);
				_on?.onChange?.(e.nativeEvent, e.target.value);
			}}
			{...(rest as Record<string, unknown>)}
		/>
	),
	KolSpin: ({ _label }: { _label?: string }) => <span role="status">{_label ?? 'wird geladen'}</span>,
	KolAlert: ({ _label, children }: { _label?: string; children?: React.ReactNode }) => (
		<div role="alert">
			{_label}
			{children}
		</div>
	),
	KolPopoverButton: ({ children, ...rest }: { children?: React.ReactNode }) => (
		<div data-testid={(rest as Record<string, string>)['data-testid']}>{children}</div>
	),
	KolBadge: ({ _label }: { _label?: string }) => <span>{_label}</span>,
}));

vi.mock('./Modal', () => ({
	Modal: ({ title, children }: { title?: string; children?: React.ReactNode }) => (
		<div data-testid="modal" aria-label={title}>
			{children}
		</div>
	),
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useInRouterContext: () => true }));

const apiMocks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../api', () => ({
	api: new Proxy({}, { get: (_target, prop: string) => (apiMocks[prop] ??= vi.fn().mockResolvedValue(undefined)) }),
}));

import { KnowledgeEntriesSection } from './KnowledgeEntriesSection';
import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';

const ENTRY = { id: 1, text: 'Ich trainiere dienstags im Verein.' };

const renderSection = (allowed: boolean) => {
	const entitlements = { knowledge_entries: { allowed, requiredPlan: 'pro' } } as unknown as EntitlementMap;
	return render(
		<PlanProvider value={{ plan: allowed ? 'pro' : 'free', entitlements }}>
			<KnowledgeEntriesSection />
		</PlanProvider>,
	);
};

const flush = async () => {
	await act(async () => {
		await Promise.resolve();
	});
};

beforeEach(() => {
	for (const key of Object.keys(apiMocks)) delete apiMocks[key];
});
afterEach(cleanup);

describe('KnowledgeEntriesSection (#1936 AK7)', () => {
	it('Pro: zeigt die geladenen Einträge', async () => {
		apiMocks.listKnowledgeEntries = vi.fn().mockResolvedValue([ENTRY]);
		renderSection(true);
		await flush();

		expect(screen.getByTestId('knowledge-entry-row').textContent).toContain(ENTRY.text);
	});

	it('Pro: Anlegen ruft api.createKnowledgeEntry und zeigt den neuen Eintrag ohne Neuladen', async () => {
		apiMocks.listKnowledgeEntries = vi.fn().mockResolvedValue([]);
		apiMocks.createKnowledgeEntry = vi.fn().mockResolvedValue({ id: 2, text: 'Ich arbeite remote.' });
		renderSection(true);
		await flush();

		fireEvent.change(screen.getByLabelText(/eintrag/i), { target: { value: 'Ich arbeite remote.' } });
		fireEvent.click(screen.getByRole('button', { name: /anlegen|hinzufügen/i }));
		await flush();

		expect(apiMocks.createKnowledgeEntry).toHaveBeenCalledWith(
			expect.objectContaining({ text: 'Ich arbeite remote.' }),
		);
		expect(screen.getByTestId('knowledge-entry-row').textContent).toContain('Ich arbeite remote.');
	});

	it('Pro: Bearbeiten ruft api.updateKnowledgeEntry und zeigt den geänderten Text', async () => {
		apiMocks.listKnowledgeEntries = vi.fn().mockResolvedValue([ENTRY]);
		apiMocks.updateKnowledgeEntry = vi.fn().mockResolvedValue({ id: 1, text: 'Ich trainiere mittwochs.' });
		renderSection(true);
		await flush();

		const row = screen.getByTestId('knowledge-entry-row');
		fireEvent.click(within(row).getByRole('button', { name: /bearbeiten/i }));
		fireEvent.change(within(row).getByLabelText(/eintrag/i), { target: { value: 'Ich trainiere mittwochs.' } });
		fireEvent.click(within(row).getByRole('button', { name: /speichern/i }));
		await flush();

		expect(apiMocks.updateKnowledgeEntry).toHaveBeenCalledWith(
			1,
			expect.objectContaining({ text: 'Ich trainiere mittwochs.' }),
		);
		expect(screen.getByTestId('knowledge-entry-row').textContent).toContain('Ich trainiere mittwochs.');
	});

	it('Pro: Löschen läuft über den Bestätigungsdialog; der Eintrag verschwindet danach', async () => {
		apiMocks.listKnowledgeEntries = vi.fn().mockResolvedValue([ENTRY]);
		apiMocks.deleteKnowledgeEntry = vi.fn().mockResolvedValue(undefined);
		renderSection(true);
		await flush();

		fireEvent.click(screen.getByRole('button', { name: /löschen/i }));
		expect(apiMocks.deleteKnowledgeEntry).not.toHaveBeenCalled();
		const dialog = screen.getByTestId('modal');
		fireEvent.click(within(dialog).getByRole('button', { name: /endgültig löschen/i }));
		await flush();

		expect(apiMocks.deleteKnowledgeEntry).toHaveBeenCalledWith(1);
		expect(screen.queryByTestId('knowledge-entry-row')).toBeNull();
	});

	it('Free/Plus: statt der Liste der PlanHint, kein Laden, kein Anlegefeld', async () => {
		apiMocks.listKnowledgeEntries = vi.fn().mockResolvedValue([ENTRY]);
		renderSection(false);
		await flush();

		expect(screen.getByTestId('plan-badge-knowledge_entries')).toBeTruthy();
		expect(screen.queryByTestId('knowledge-entry-row')).toBeNull();
		expect(screen.queryByLabelText(/eintrag/i)).toBeNull();
		expect(apiMocks.listKnowledgeEntries).not.toHaveBeenCalled();
	});
});
