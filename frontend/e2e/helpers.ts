import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { ApiFixture } from './fixtures';

/** JSON-Antwort für eine gemockte Route bauen. */
const json = (body: unknown, status = 200) => ({
	status,
	contentType: 'application/json',
	body: JSON.stringify(body),
});

/** Endpunkte, die optional einen 500-Fehler liefern sollen (für den Fehlerzustand). */
export interface ApiErrorOverrides {
	tasks?: boolean;
	pillars?: boolean;
	forest?: boolean;
	next?: boolean;
}

/**
 * Registriert die API-Mocks für alle vier Endpunkte. **Muss vor `page.goto('/')` aufgerufen werden**,
 * damit der initiale Lade-Schwung der App (`App.tsx` lädt `/tasks`, `/forest`, `/next`, `/pillars`
 * parallel) abgefangen wird und der Vite-Proxy gar nicht erst getroffen wird (kein Backend nötig).
 *
 * Pfad-Matching bewusst exakt am Pfad-Ende (`**\/tasks` ohne nachfolgenden Slash), damit z. B.
 * `/tasks/{id}` nicht versehentlich getroffen wird (für die Snapshots ohnehin irrelevant).
 */
export const mockApi = async (page: Page, fixture: ApiFixture, errors: ApiErrorOverrides = {}): Promise<void> => {
	const fail = (route: Parameters<Parameters<Page['route']>[1]>[0]) =>
		route.fulfill(json({ message: 'Interner Serverfehler (Datenbank nicht erreichbar).' }, 500));

	await page.route('**/tasks', (route) => (errors.tasks === true ? fail(route) : route.fulfill(json(fixture.tasks))));
	await page.route('**/pillars', (route) =>
		errors.pillars === true ? fail(route) : route.fulfill(json(fixture.pillars)),
	);
	await page.route('**/forest', (route) =>
		errors.forest === true ? fail(route) : route.fulfill(json(fixture.forest)),
	);
	await page.route('**/next', (route) => (errors.next === true ? fail(route) : route.fulfill(json(fixture.next))));
};

/** Ein vom Frontend abgesetzter Mutations-Request, wie ihn {@link mockMutations} aufzeichnet. */
export interface RecordedRequest {
	method: string;
	/** Pfad ohne Host/Query, z. B. `/tasks/1/dependencies`. */
	pathname: string;
	/** Vollständige URL des Requests. */
	url: string;
	/** Geparster JSON-Body (oder `null`, wenn kein Body anliegt — z. B. bei `DELETE`). */
	body: unknown;
}

/** Minimaler, schema-konformer Roh-Task für die Mutations-Antworten der Mock-Schicht. */
const sampleTask = (overrides: Partial<ApiFixture['tasks'][number]> = {}): ApiFixture['tasks'][number] => ({
	id: 999,
	title: 'Antwort-Task',
	status: 'Open',
	priority: 3,
	estimatedEffort: 0.5,
	actualEffort: null,
	description: null,
	deadline: null,
	pillars: [],
	...overrides,
});

/** Liefert die Erfolgs-Antwort für einen gemockten Mutations-Request (nach Methode + Pfad). */
const mutationResponse = (method: string, pathname: string, body: unknown, fixture: ApiFixture) => {
	// Reihenfolge bewusst von speziell nach allgemein, damit z. B. `/dependencies/{depId}` vor
	// `/tasks/{id}` greift.
	if (method === 'PUT' && pathname.endsWith('/pillars/weights')) {
		return json(fixture.pillars);
	}
	if (method === 'DELETE' && /\/tasks\/\d+\/dependencies\/\d+$/.test(pathname)) {
		return { status: 204, contentType: 'application/json', body: '' };
	}
	if (method === 'POST' && /\/tasks\/\d+\/dependencies$/.test(pathname)) {
		return json(sampleTask({ id: 1 }));
	}
	if (method === 'POST' && pathname.endsWith('/tasks')) {
		const fields = (body ?? {}) as Partial<ApiFixture['tasks'][number]>;
		return json(sampleTask({ ...fields, id: 999 }), 201);
	}
	if (method === 'PATCH' && /\/tasks\/\d+$/.test(pathname)) {
		const fields = (body ?? {}) as Partial<ApiFixture['tasks'][number]>;
		return json(sampleTask({ ...fields, id: 1 }));
	}
	if (method === 'DELETE' && /\/tasks\/\d+$/.test(pathname)) {
		return { status: 204, contentType: 'application/json', body: '' };
	}
	// Fallback: jede sonstige Mutation als generischer Erfolg (z. B. der Säulen-Vorschlag).
	return json({});
};

/**
 * Registriert die Mocks für die **Mutations-Endpunkte** (`POST`/`PATCH`/`DELETE /tasks/**`,
 * `**\/dependencies/**`, `PUT /pillars/weights`) und zeichnet jeden abgesetzten Request auf, damit
 * die Klick-Tests Methode, Pfad und Body des tatsächlich gesendeten Requests assertieren können.
 *
 * **Nach {@link mockApi} aufrufen:** Der hier registrierte Catch-all-Handler wird (zuletzt
 * registriert) zuerst geprüft und reicht `GET`-Requests via `route.fallback()` an die spezifischen
 * Lade-Mocks (bzw. an die echten Vite-Assets) weiter — nur Mutations werden hier beantwortet.
 *
 * @returns Das (lebende) Array der aufgezeichneten Requests — wächst mit jeder Mutation.
 */
export const mockMutations = async (
	page: Page,
	fixture: ApiFixture,
	options: { fail?: boolean } = {},
): Promise<RecordedRequest[]> => {
	const requests: RecordedRequest[] = [];
	await page.route('**/*', async (route) => {
		const request = route.request();
		if (request.method() === 'GET') {
			await route.fallback();
			return;
		}
		const url = new URL(request.url());
		let body: unknown;
		try {
			body = request.postDataJSON();
		} catch {
			body = null;
		}
		requests.push({ method: request.method(), pathname: url.pathname, url: request.url(), body });
		if (options.fail === true) {
			await route.fulfill(json({ message: 'Interner Serverfehler (Datenbank nicht erreichbar).' }, 500));
			return;
		}
		await route.fulfill(mutationResponse(request.method(), url.pathname, body, fixture));
	});
	return requests;
};

/**
 * Wartet, bis die Ansicht für einen stabilen Screenshot bereit ist:
 *  1. ein bekanntes, stabiles Element ist sichtbar (Standard: KolHeading „Priority Pilot"),
 *  2. die KoliBri-Web-Components sind hydriert (asynchrone Registrierung in `main.tsx`),
 *  3. die Schriftarten — inkl. KolIcons-Font — sind geladen (`document.fonts.ready`).
 */
export const waitForStableView = async (page: Page, readyText = 'Priority Pilot'): Promise<void> => {
	// 1. Stabiles Element abwarten (rendert erst nach React-Mount + KoliBri-Upgrade sichtbar).
	await expect(page.getByText(readyText, { exact: true }).first()).toBeVisible();

	// 2. Auf das Upgrade der KoliBri-Custom-Elements warten: ein definiertes Element (`kol-button`)
	//    muss registriert sein und sein Shadow-DOM aufgebaut haben. Solange noch ein nicht-aufgelöstes
	//    Custom-Element existiert (`:not(:defined)`), ist die Hydration nicht abgeschlossen.
	await page.waitForFunction(() => {
		const pending = document.querySelectorAll(':not(:defined)');
		if (pending.length > 0) {
			return false;
		}
		const button = document.querySelector('kol-button');
		// Ohne Buttons (z. B. theoretischer Sonderfall) gilt die Seite als hydriert.
		return button === null || button.shadowRoot !== null;
	});

	// 3. Fonts (inkl. KolIcons) abwarten, sonst flackern Icon-Glyphen im Screenshot.
	await page.evaluate(() => document.fonts.ready);
};
