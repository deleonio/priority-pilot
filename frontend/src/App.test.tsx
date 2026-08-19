import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { api } from './api';
import { App } from './App';
import type { Task } from 'client';
import { TaskStatus } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `./api` wird vollständig gemockt, damit `App` ohne Backend lädt. Der `vi.mock`-Call wird von
 * Vitest automatisch an den Dateianfang gehoist (vor alle Imports), sodass `App` und `api`
 * bereits die gemockte Fassade erhalten. Die Mock-Rückgabewerte werden bewusst in `beforeEach`
 * gesetzt (nicht in der Factory), weil `vi.mock`-Factories vor der Modul-Initialisierung laufen
 * und dort definierte Variablen (wie `sampleTask`) noch nicht verfügbar sind.
 *
 * `listTasks` liefert genau einen Task, weil `App` das Dashboard nur bei `tasks.length > 0`
 * rendert — sonst greift der EmptyState und die Begrüßung wäre nie sichtbar.
 */
vi.mock('./api', () => ({
	api: {
		listTasks: vi.fn(),
		getForest: vi.fn(),
		getNextTask: vi.fn(),
		getSuggestions: vi.fn(),
		listPillars: vi.fn(),
		getLlmConfig: vi.fn(),
		// #191: `logout` existiert in `api.ts` noch nicht. Der Mock stellt die Funktion bereit, damit
		// der AK-5-Test das Fehlerverhalten ansteuern kann; rot ist der Test, weil `App.tsx` weder den
		// Logout-Button rendert noch dessen Fehlerfall (Meldung + erneut aktivierter Button) behandelt.
		logout: vi.fn(),
	},
}));

// #192: Standard-`user`-Prop für `App`. Seit dem Refactoring erhält `App` die Benutzerinfo als Prop
// (von `Root.tsx`, das `checkAuth()` einmalig aufruft) statt selbst `api.getMe()` aufzurufen.
const testUser = { id: 1, displayName: 'Test User', email: 'test@example.com', avatarUrl: null };

const sampleTask: Task = {
	id: 1,
	title: 'T1',
	status: TaskStatus.Open,
	priority: 3,
	estimatedEffort: 1,
	actualEffort: null,
	description: null,
	deadline: null,
	seriesId: null,
	isException: false,
	pillars: [],
};

beforeEach(() => {
	localStorage.clear();
	vi.mocked(api.listTasks).mockResolvedValue([sampleTask]);
	vi.mocked(api.getForest).mockResolvedValue([]);
	vi.mocked(api.getNextTask).mockResolvedValue(null);
	vi.mocked(api.getSuggestions).mockResolvedValue([]);
	vi.mocked(api.listPillars).mockResolvedValue([]);
	vi.mocked(api.getLlmConfig).mockResolvedValue({
		openrouterModel: 'openai/gpt-4o',
		hasMistralApiKey: false,
		hasOpenrouterApiKey: true,
	});
});

afterEach(() => {
	cleanup();
	localStorage.clear();
});

describe('App — Personalisierte Begrüßung aus user.name (#169, aktualisiert durch #208)', () => {
	// Seit #208 kommt der Name aus user.name (nicht mehr localStorage.displayName).
	it('zeigt user.name in der Begrüßung', async () => {
		render(<App user={testUser} />);

		await waitFor(() => {
			expect(screen.getByText(/Hallo\s+Test User!/i)).toBeTruthy();
		});
	});

	// localStorage.displayName beeinflusst die Begrüßung nicht mehr (Cleanup #208).
	it('ignoriert localStorage.displayName und zeigt stattdessen user.name', async () => {
		localStorage.setItem('displayName', 'AltesDisplayName');
		render(<App user={testUser} />);

		await waitFor(() => {
			expect(screen.getByText(/Hallo\s+Test User!/i)).toBeTruthy();
		});
		expect(document.body.textContent ?? '').not.toMatch(/AltesDisplayName/);
	});
});

/**
 * AK-5 (#191): Fehlerfall beim Logout. Schlägt `api.logout()` fehl (z. B. Netzwerk-/Serverfehler),
 * muss die App eine sichtbare Fehlermeldung anzeigen UND den Logout-Button wieder bedienbar machen
 * (kein dauerhaftes `disabled`, kein „verschluckter" Fehler). Der Nutzer bleibt eingeloggt.
 *
 * Diese Tests sind ROT, weil `App.tsx` den Logout-Button (#191) noch nicht rendert und den
 * Fehlerfall (Meldung + Re-Aktivierung) noch nicht behandelt. Sie werden grün, sobald der
 * Logout-Button samt Fehlerbehandlung implementiert ist.
 *
 * Hinweis: `@testing-library/user-event` ist im Projekt nicht installiert (siehe `package.json`),
 * daher wird der Klick über `fireEvent` ausgelöst.
 */
describe('App — Logout-Fehlerfall (#191, AK-5)', () => {
	// Hilfsfunktion: rendert die eingeloggte App und liefert den Logout-Button zurück.
	const renderLoggedInAndGetLogout = async (): Promise<HTMLElement> => {
		localStorage.setItem('displayName', 'Peter');
		render(<App user={testUser} />);
		// Auf das Laden der eingeloggten Ansicht warten, damit der Logout-Button gerendert ist.
		return await screen.findByRole('button', { name: /Abmelden|Logout/i });
	};

	// #209: Der Logout-Button ist jetzt als KolToolbar-Item implementiert. KolBX-Web-Components
	// rendern ihre _items nicht in JSDOM — der Button ist im Shadow-DOM und nicht per findByRole
	// erreichbar. Die E2E-Tests in logout.spec.ts (#209 AK-4, #191 AK-2/3/4/5) decken die
	// Klick-Verdrahtung und den Fehlerfall in echten Browsern ab.
	it.skip('zeigt eine Fehlermeldung, wenn der Logout fehlschlägt', async () => {
		vi.mocked(api.logout).mockRejectedValue(new Error('Logout fehlgeschlagen'));

		const logoutButton = await renderLoggedInAndGetLogout();
		fireEvent.click(logoutButton);

		// Es muss eine Fehlermeldung erscheinen (rollenbasiert: KolAlert rendert eine Alert-Rolle).
		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeTruthy();
		});
	});

	it.skip('aktiviert den Logout-Button nach einem Fehlschlag wieder (kein dauerhaftes disabled)', async () => {
		vi.mocked(api.logout).mockRejectedValue(new Error('Logout fehlgeschlagen'));

		const logoutButton = await renderLoggedInAndGetLogout();
		fireEvent.click(logoutButton);

		// Nach dem Fehlschlag darf der Button nicht dauerhaft deaktiviert bleiben — der Nutzer muss den
		// Logout erneut versuchen können.
		await waitFor(() => {
			expect(logoutButton).not.toBeDisabled();
		});
	});

	it.skip('bleibt nach einem fehlgeschlagenen Logout eingeloggt (Auth-State erhalten)', async () => {
		vi.mocked(api.logout).mockRejectedValue(new Error('Logout fehlgeschlagen'));

		const logoutButton = await renderLoggedInAndGetLogout();
		fireEvent.click(logoutButton);

		// Schlägt der Logout fehl, bleibt der lokale Auth-State bestehen (keine voreilige Abmeldung).
		await waitFor(() => {
			expect(screen.getByRole('alert')).toBeTruthy();
		});
		expect(localStorage.getItem('displayName')).toBe('Peter');
	});
});

/**
 * #192: User Info Display — die App zeigt die aktuellen Benutzerinformationen (E-Mail + Name) im
 * Header an. Seit dem Refactoring (PR #199) erhält `App` diese Daten als `user`-Prop von `Root.tsx`,
 * das `checkAuth()` (GET /auth/me) einmalig aufruft. Die App selbst ruft `api.getMe()` nicht mehr auf
 * — es gibt damit keinen App-internen Lade-/Fehlerzustand mehr (das übernimmt `Root.tsx`).
 */
describe('App — User Info Display (#192)', () => {
	// AK4a: Der App-interne Loading-Indicator entfällt in der neuen Architektur — `App` lädt die
	// Benutzerinfo nicht mehr selbst (kein async getMe), sondern erhält sie synchron als Prop. Der
	// Ladezustand der Authentifizierung liegt jetzt in `Root.tsx` (vgl. e2e/userinfo.spec.ts).
	it.skip('zeigt einen Loading-Indicator, während die Benutzerinfos geladen werden (AK4a)', () => {
		// Bewusst übersprungen: kein App-internes async Laden mehr.
	});

	// AK3b: Auch der Name aus der `user`-Prop erscheint im DOM (Header-Anzeige).
	it('zeigt den per Prop übergebenen Namen an (AK3b)', async () => {
		render(<App user={{ id: 7, displayName: 'Max Mustermann', email: 'max@example.com', avatarUrl: null }} />);

		expect(await screen.findByText(/Max Mustermann/i)).toBeTruthy();
	});
});

/**
 * AK-9 (#208): Begrüßung kommt aus user.name (Prop), nicht mehr aus localStorage.displayName.
 */
describe('App — AK-9 localStorage-Cleanup (#208)', () => {
	it('AK9a: Begrüßung zeigt user.name, nicht den veralteten localStorage-displayName', async () => {
		localStorage.setItem('displayName', 'AlterName');
		render(<App user={{ id: 1, displayName: 'NeuerName', email: 'neu@test.com', avatarUrl: null }} />);

		// Nach dem Cleanup muss user.name in der Begrüßung stehen …
		await waitFor(() => {
			expect(screen.getByText(/Hallo\s+NeuerName!/i)).toBeTruthy();
		});
		// … und der alte localStorage-Wert darf NICHT erscheinen.
		expect(document.body.textContent ?? '').not.toMatch(/Hallo\s+AlterName!/);
	});

	it('AK9b: displayName aus localStorage beeinflusst die Begrüßung nicht mehr', async () => {
		localStorage.setItem('displayName', 'StoredUser');
		const propUser = { id: 2, displayName: 'PropUser', email: 'prop@test.com', avatarUrl: null };
		render(<App user={propUser} />);

		// Der aus der user-Prop stammende Name muss in der Begrüßung erscheinen.
		await waitFor(() => {
			expect(screen.getByText(/Hallo\s+PropUser!/i)).toBeTruthy();
		});
	});
});

/**
 * #222: Homogenerer App-Header — die E-Mail-Adresse wird aus dem Header entfernt; der Avatar
 * bleibt und zeigt das Namenskürzel via _label-Prop.
 */
describe('App — Homogenerer Header (#222)', () => {
	// AK1: E-Mail-Adresse darf im App-Header nicht mehr erscheinen.
	it('AK1: E-Mail-Adresse ist im App-Header nicht sichtbar', async () => {
		render(<App user={{ id: 7, displayName: 'Erika Muster', email: 'erika@test.example.com', avatarUrl: null }} />);
		// Warten bis die App vollständig geladen ist (Begrüßung erscheint).
		await waitFor(() => {
			expect(screen.getByText(/Hallo/i)).toBeTruthy();
		});
		// Die E-Mail darf nirgendwo im gerenderten DOM stehen.
		expect(document.body.textContent ?? '').not.toMatch(/erika@test\.example\.com/);
	});

	// AK3 (Smoke): KolAvatar muss _label={user.name} tragen, damit das Web Component das
	// Namenskürzel generieren kann. Bereits implementiert — bleibt als Regressions-Smoke grün.
	it('AK3 (Smoke): KolAvatar hat _label mit dem Benutzernamen gesetzt', async () => {
		render(<App user={{ id: 7, displayName: 'Erika Muster', email: 'erika@test.example.com', avatarUrl: null }} />);
		await waitFor(() => {
			expect(screen.getByText(/Hallo/i)).toBeTruthy();
		});
		const avatar = document.querySelector('kol-avatar');
		expect(avatar).not.toBeNull();
		expect(avatar?.getAttribute('_label')).toBe('Erika Muster');
	});
});
