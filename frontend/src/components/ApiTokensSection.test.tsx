import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiTokensSection } from './ApiTokensSection';
import type { EntitlementMap } from '../lib/planOffers';
import { PlanProvider } from '../lib/usePlan';

/**
 * Rote Spec-Tests für #1356 AK8 (Spec docs/spec/issue-1356.md) — Rechte-Umschalter je Token.
 *
 * Muster: der Zugriff-Teil in SettingsPage.test.tsx (#1352) — echte KoliBri-Custom-Elements
 * (kein @public-ui-Mock), Klicks per `dispatchEvent(new Event('click', {bubbles: true}))`, weil
 * `ButtonAction` (ApiTokensSection.tsx) den composed Klick am umgebenden Span abfängt.
 *
 * Rot, bis die Zeile einen Umschalter zeigt und `api.updateApiToken` existiert — heute rendert
 * `ApiTokensSection` weder Stufen-Text noch Umschalter (Selektoren finden nichts).
 */

const apiMocks: Record<string, ReturnType<typeof vi.fn>> = {};
vi.mock('../api', () => ({
	api: new Proxy(
		{},
		{
			get: (_target, prop: string) => (apiMocks[prop] ??= vi.fn().mockResolvedValue(undefined)),
		},
	),
}));

const readToken = {
	id: 1,
	name: 'CLI',
	scope: 'read',
	createdAt: new Date('2026-01-01T00:00:00Z').toISOString(),
	lastUsedAt: null,
	expiresAt: new Date('2027-01-01T00:00:00Z').toISOString(),
};

/** Bereits abgelaufener Token (#1357 AK7) — Datum liegt vor dem festen `vi.setSystemTime`. */
const expiredToken = {
	...readToken,
	id: 2,
	name: 'Abgelaufen',
	expiresAt: new Date('2025-12-01T00:00:00Z').toISOString(),
};

beforeEach(() => {
	delete apiMocks.listApiTokens;
	delete apiMocks.createApiToken;
	delete apiMocks.deleteApiToken;
	delete apiMocks.updateApiToken;
});

afterEach(cleanup);

describe('ApiTokensSection – #1356 AK8: Rechte-Umschalter je Token', () => {
	it('zeigt „Nur lesend" für einen Token mit scope read', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row, 'Token-Zeile muss gerendert sein').not.toBeNull();
		expect(row?.textContent).toContain('Nur lesend');
		expect(row?.textContent).not.toContain('Lesen und Schreiben');
	});

	it('Umschalten sendet den PATCH mit readwrite und zeigt danach „Lesen und Schreiben"', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		apiMocks.updateApiToken = vi.fn().mockResolvedValue({ ...readToken, scope: 'readwrite' });
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');
		expect(toggle, 'Umschalter für die Token-Rechtestufe fehlt').not.toBeNull();

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
			await Promise.resolve();
		});

		expect(apiMocks.updateApiToken).toHaveBeenCalledWith({ id: readToken.id, scope: 'readwrite' });

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row?.textContent).toContain('Lesen und Schreiben');
	});

	it('bei fehlgeschlagenem PATCH bleibt die Stufe sichtbar unverändert und eine Fehlermeldung erscheint', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		apiMocks.updateApiToken = vi.fn().mockRejectedValue(new Error('Netzwerkfehler'));
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');
		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
			await Promise.resolve();
		});

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row?.textContent, 'Wert bleibt unverändert sichtbar (read)').toContain('Nur lesend');
		expect(container.querySelector('kol-alert[_type="error"]'), 'Fehlermeldung fehlt').not.toBeNull();
	});

	// #1358: Ohne diesen Hinweis war nirgends erklärt, warum ein Token, das vor der Rechtestufe
	// vergeben wurde, seit dem Update jeden schreibenden MCP-Aufruf ablehnt.
	it('#1358: erklärt über der Liste, dass ein Token standardmäßig nur liest', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const hint = container.querySelector('.api-tokens__scope-hint');
		expect(hint, 'Hinweis zur Standard-Rechtestufe fehlt').not.toBeNull();
		expect(hint?.textContent).toContain('liest standardmäßig nur');
		expect(hint?.textContent).toContain('task_create');
	});
});

/**
 * Rote Spec-Tests für #1357 (Spec docs/spec/issue-1357.md) — Pflicht-Ablaufdatum.
 *
 * AK6: „Token erzeugen" ist ohne gewählte Laufzeit wirkungslos (kein POST); nach Auswahl legt der
 * Klick den Token mit der gewählten Laufzeit an.
 * AK7: die Zeile zeigt das Ablaufdatum (TT.MM.JJJJ) und kennzeichnet einen bereits abgelaufenen
 * Token als Text „abgelaufen".
 *
 * Rot, bis `ApiTokensSection` eine Laufzeit-Auswahl rendert und `api.createApiToken` sie mitschickt
 * — heute existiert dafür kein Element (Selektor `api-token-duration-select` findet nichts) und die
 * Zeile zeigt weder Ablaufdatum noch „abgelaufen".
 */
describe('ApiTokensSection – #1357: Pflicht-Ablaufdatum', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-01T00:00:00Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it('AK6: Klick auf „Token erzeugen" ohne gewählte Laufzeit ruft api.createApiToken nicht auf', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const createButton = container.querySelector('kol-button[_label="Token erzeugen"]');
		expect(createButton, 'Button „Token erzeugen" fehlt').not.toBeNull();

		await act(async () => {
			createButton?.dispatchEvent(new Event('click', { bubbles: true }));
			await Promise.resolve();
		});

		expect(apiMocks.createApiToken).toBeUndefined();
	});

	it('AK6: nach Auswahl einer Laufzeit legt der Klick den Token mit dieser Laufzeit an', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([]);
		apiMocks.createApiToken = vi.fn().mockResolvedValue({ ...readToken, token: 'pp_neu' });
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const select = container.querySelector('[data-testid="api-token-duration-select"]');
		expect(select, 'Laufzeit-Auswahl fehlt').not.toBeNull();

		await act(async () => {
			(select as unknown as { _on: { onChange: (e: unknown, v: string) => void } })._on.onChange(
				{ target: select },
				'365',
			);
			await Promise.resolve();
		});

		const createButton = container.querySelector('kol-button[_label="Token erzeugen"]');
		await act(async () => {
			createButton?.dispatchEvent(new Event('click', { bubbles: true }));
			await Promise.resolve();
		});

		expect(apiMocks.createApiToken).toHaveBeenCalledWith(expect.objectContaining({ expiresInDays: 365 }));
	});

	it('AK7: die Token-Zeile zeigt das Ablaufdatum im Format TT.MM.JJJJ', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row, 'Token-Zeile muss gerendert sein').not.toBeNull();
		expect(row?.textContent).toContain('01.01.2027');
	});

	it('AK7: ein abgelaufener Token ist in der Liste als Text „abgelaufen" gekennzeichnet', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([expiredToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const row = container.querySelector('[data-testid="api-token-row"]');
		expect(row, 'Token-Zeile muss gerendert sein').not.toBeNull();
		expect(row?.textContent).toContain('abgelaufen');
	});
});

describe('ApiTokensSection – #1417 AK8: Hinweisblock nennt auch den api-key-Header', () => {
	it('zeigt sowohl "Authorization: Bearer <Token>" als auch "api-key: <Token>"', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const hint = container.querySelector('.api-tokens__mcp-url');
		expect(hint, 'Hinweisblock muss gerendert sein').not.toBeNull();
		expect(hint?.textContent).toContain('Authorization: Bearer <Token>');
		expect(hint?.textContent).toContain('api-key: <Token>');
	});
});

// ── #1526: Access-Token-Gating ohne Paket-Badge (löst #1484 AK3/AK4/AK5 an dieser Zeile ab) ────

/**
 * Test-Pflege #1526 AK6 (Spec docs/spec/issue-1526.md): die vorige Describe „Paket-Badge an der
 * ScopeToggle-Zeile (#1484 AK3/AK4/AK5)" erwartete `[data-testid="plan-badge-mcp_readwrite"]` in
 * beiden Entitlement-Zuständen — AK6 verlangt genau das Gegenteil (kein Badge mehr an dieser
 * Stelle, die Paket-Erklärung wandert in den Alert unter dem Regler). Diese Describe ersetzt sie
 * vollständig statt sie anzupassen, weil auch die (i)-Schalter/Event-Erwartung aus #1484 AK5 mit
 * dem Badge zusammen entfällt.
 */
describe('ApiTokensSection — #1526 AK4/AK5/AK6: Rechte-Regler ohne mcp_readwrite gesperrt, kein Badge mehr', () => {
	const renderWithReadwrite = async (allowed: boolean) => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const entitlements: EntitlementMap = {
			mcp_readwrite: { allowed, requiredPlan: 'ultimate' } as EntitlementMap['mcp_readwrite'],
		};
		const result = render(
			<PlanProvider value={{ plan: allowed ? 'ultimate' : 'max', entitlements }}>
				<ApiTokensSection />
			</PlanProvider>,
		);
		await act(async () => {
			await Promise.resolve();
		});
		return result;
	};

	it('AK6: kein plan-badge-mcp_readwrite mehr im Panel, weder gesperrt noch freigeschaltet', async () => {
		const { container: lockedContainer } = await renderWithReadwrite(false);
		expect(lockedContainer.querySelector('[data-testid="plan-badge-mcp_readwrite"]')).toBeNull();
		cleanup();

		const { container: unlockedContainer } = await renderWithReadwrite(true);
		expect(unlockedContainer.querySelector('[data-testid="plan-badge-mcp_readwrite"]')).toBeNull();
	});

	it('AK4: ohne mcp_readwrite ist der Rechte-Regler deaktiviert, ein Alert nennt „Ultimate", PATCH bleibt aus', async () => {
		const { container } = await renderWithReadwrite(false);

		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');
		expect(toggle, 'Rechte-Regler fehlt').not.toBeNull();
		expect((toggle as unknown as { _disabled?: boolean })._disabled, 'Regler muss _disabled sein').toBe(true);

		const alertText = Array.from(container.querySelectorAll('kol-alert[_type="info"]'))
			.map((el) => el.textContent ?? '')
			.join(' ');
		expect(alertText, 'Alert muss „Ultimate" nennen').toContain('Ultimate');

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
			await Promise.resolve();
		});
		expect(apiMocks.updateApiToken).toBeUndefined();
	});

	it('AK5: mit mcp_readwrite ist der Rechte-Regler bedienbar, kein Ultimate-Alert, PATCH wird gerufen', async () => {
		apiMocks.updateApiToken = vi.fn().mockResolvedValue({ ...readToken, scope: 'readwrite' });
		const { container } = await renderWithReadwrite(true);

		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');
		expect(toggle, 'Rechte-Regler fehlt').not.toBeNull();
		expect((toggle as unknown as { _disabled?: boolean })._disabled, 'Regler darf nicht _disabled sein').not.toBe(true);

		const alertText = Array.from(container.querySelectorAll('kol-alert[_type="info"]'))
			.map((el) => el.textContent ?? '')
			.join(' ');
		expect(alertText, 'kein Ultimate-Alert bei Freigabe').not.toContain('Ultimate');

		await act(async () => {
			(toggle as unknown as { _on: { onChange: (e: unknown, v: boolean) => void } })._on.onChange(
				{ target: toggle },
				true,
			);
			await Promise.resolve();
		});
		expect(apiMocks.updateApiToken).toHaveBeenCalledWith({ id: readToken.id, scope: 'readwrite' });
	});
});

/**
 * Rote Spec-Tests für #1526 AK2/AK3 (Spec docs/spec/issue-1526.md) — Erzeugen-Formular ohne
 * `mcp_read` gesperrt.
 */
describe('ApiTokensSection — #1526 AK2/AK3: Erzeugen-Formular ohne mcp_read gesperrt', () => {
	const renderWithRead = async (allowed: boolean) => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([]);
		const entitlements: EntitlementMap = {
			mcp_read: { allowed, requiredPlan: 'max' } as EntitlementMap['mcp_read'],
		};
		const result = render(
			<PlanProvider value={{ plan: allowed ? 'max' : 'free', entitlements }}>
				<ApiTokensSection />
			</PlanProvider>,
		);
		await act(async () => {
			await Promise.resolve();
		});
		return result;
	};

	it('AK2: ohne mcp_read sind Name, Laufzeit und „Token erzeugen" deaktiviert, ein Alert nennt „Max"', async () => {
		const { container } = await renderWithRead(false);

		const nameInput = container.querySelector('kol-input-text');
		const durationSelect = container.querySelector('[data-testid="api-token-duration-select"]');
		const createButton = container.querySelector('kol-button[_label="Token erzeugen"]');
		expect((nameInput as unknown as { _disabled?: boolean } | null)?._disabled).toBe(true);
		expect((durationSelect as unknown as { _disabled?: boolean } | null)?._disabled).toBe(true);
		expect((createButton as unknown as { _disabled?: boolean } | null)?._disabled).toBe(true);

		const alertText = Array.from(container.querySelectorAll('kol-alert[_type="info"]'))
			.map((el) => el.textContent ?? '')
			.join(' ');
		expect(alertText, 'Alert muss „Max" nennen').toContain('Max');
	});

	it('AK3: mit mcp_read sind Name, Laufzeit und „Token erzeugen" bedienbar, kein Max-Alert', async () => {
		const { container } = await renderWithRead(true);

		const nameInput = container.querySelector('kol-input-text');
		const durationSelect = container.querySelector('[data-testid="api-token-duration-select"]');
		const createButton = container.querySelector('kol-button[_label="Token erzeugen"]');
		expect((nameInput as unknown as { _disabled?: boolean } | null)?._disabled).not.toBe(true);
		expect((durationSelect as unknown as { _disabled?: boolean } | null)?._disabled).not.toBe(true);
		expect((createButton as unknown as { _disabled?: boolean } | null)?._disabled).toBe(false);

		const alertText = Array.from(container.querySelectorAll('kol-alert[_type="info"]'))
			.map((el) => el.textContent ?? '')
			.join(' ');
		expect(alertText, 'kein Max-Alert bei Freigabe').not.toContain('Max');
	});
});

/**
 * Rote Spec-Tests für #1526 AK7 (Spec docs/spec/issue-1526.md) — ohne geladenes Entitlement
 * (`undefined`, kein `PlanProvider`-Wert) sperrt die neue Gating-Logik nichts zusätzlich.
 */
describe('ApiTokensSection — #1526 AK7: kein Sperren vor der ersten Entitlement-Antwort', () => {
	it('ohne PlanProvider-Wert bleiben Formular und Regler unverändert bedienbar, kein Alert', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		const nameInput = container.querySelector('kol-input-text');
		const durationSelect = container.querySelector('[data-testid="api-token-duration-select"]');
		const createButton = container.querySelector('kol-button[_label="Token erzeugen"]');
		const toggle = container.querySelector('[data-testid="api-token-row"] [data-testid="api-token-scope-toggle"]');

		expect((nameInput as unknown as { _disabled?: boolean } | null)?._disabled).not.toBe(true);
		expect((durationSelect as unknown as { _disabled?: boolean } | null)?._disabled).not.toBe(true);
		expect((createButton as unknown as { _disabled?: boolean } | null)?._disabled).toBe(false);
		expect((toggle as unknown as { _disabled?: boolean } | null)?._disabled).not.toBe(true);

		expect(container.querySelector('kol-alert[_type="info"]')).toBeNull();
	});
});

/**
 * Rote Spec-Tests für #1646 AK1–AK3 (Spec docs/spec/issue-1646.md) — Fehler und Leer-Zustand
 * dürfen in der Karte „Vergebene Tokens" nie gleichzeitig erscheinen.
 */
describe('ApiTokensSection — #1646: Fehler und Leer-Zustand nie gleichzeitig', () => {
	it('AK1: Ladefehler zeigt die Fehlermeldung, nicht „Noch kein Token vergeben."', async () => {
		apiMocks.listApiTokens = vi.fn().mockRejectedValue(new Error('boom'));
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain('Die Token-Liste konnte nicht geladen werden.');
		expect(container.textContent).not.toContain('Noch kein Token vergeben.');
	});

	it('AK2: leere Liste zeigt Leer-Zustand ohne Fehlermeldung', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).toContain('Noch kein Token vergeben.');
		expect(container.textContent).not.toContain('Die Token-Liste konnte nicht geladen werden.');
	});

	it('AK2: gefüllte Liste zeigt die Token-Zeile, weder Leer-Zeile noch Fehlermeldung', async () => {
		apiMocks.listApiTokens = vi.fn().mockResolvedValue([readToken]);
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		expect(container.querySelector('[data-testid="api-token-row"]')).not.toBeNull();
		expect(container.textContent).not.toContain('Noch kein Token vergeben.');
		expect(container.textContent).not.toContain('Die Token-Liste konnte nicht geladen werden.');
	});

	it('AK3: während des Ladens erscheint weder Leer-Zustand noch Fehlermeldung', async () => {
		apiMocks.listApiTokens = vi.fn(() => new Promise(() => {}));
		const { container } = render(<ApiTokensSection />);

		await act(async () => {
			await Promise.resolve();
		});

		expect(container.textContent).not.toContain('Noch kein Token vergeben.');
		expect(container.textContent).not.toContain('Die Token-Liste konnte nicht geladen werden.');
	});
});
