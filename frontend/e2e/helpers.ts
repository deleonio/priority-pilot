import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
// #2623: Überlast-Schwelle aus der Server-Konstante ableiten statt kopieren (Single Source of Truth).
import { UEBERLAST_MINDEST_ERLEDIGUNGEN } from '../../server/src/logics/careDeficit.js';

/**
 * Wartet, bis die Ansicht stabil und vollständig hydriert ist, bevor mit ihr interagiert wird:
 *  1. ein bekanntes, stabiles Element ist sichtbar (Standard: sr-only H1 „Dashboard"),
 *  2. die KoliBri-Web-Components sind hydriert (asynchrone Registrierung in `main.tsx`),
 *  3. die Schriftarten — inkl. KolIcons-Font — sind geladen (`document.fonts.ready`).
 *
 * Generischer, mock-freier Helfer: wird von den funktionalen CRUD-Specs (`crud.spec.ts`) genutzt, um
 * Klicks/Assertions erst nach abgeschlossenem React-Mount + KoliBri-Upgrade abzusetzen.
 */
export const waitForStableView = async (page: Page, readyText = 'Dashboard'): Promise<void> => {
	// 1. Stabiles Element abwarten (rendert erst nach React-Mount + KoliBri-Upgrade sichtbar).
	// `:visible` filtern, NICHT bloß `.first()`: Settings mountet inaktive KolTabs-Panels
	// dauerhaft mit (nur [hidden]) — ein exakter Text kann dort VOR dem eigentlichen Ziel im DOM
	// stehen (z. B. „Gruppen" als Feature-Zeile der Pakete-Tabelle vor dem Gruppen-Tab-Inhalt),
	// ohne `:visible` würde `.first()` dauerhaft auf dem verdeckten Treffer hängen bleiben (#1509).
	await expect(page.getByText(readyText, { exact: true }).and(page.locator(':visible')).first()).toBeVisible();

	// 2. Auf das Upgrade der KoliBri-Custom-Elements warten: ein definiertes Element (`kol-button`)
	//    muss registriert sein und sein Shadow-DOM aufgebaut haben. Solange noch ein nicht-aufgelöstes
	//    Custom-Element existiert (`:not(:defined)`), ist die Hydration nicht abgeschlossen.
	await page.waitForFunction(() => {
		const pending = document.querySelectorAll(':not(:defined)');
		if (pending.length > 0) {
			return false;
		}
		// #1320: `kol-tabs` hängt seine Panel-Inhalte erst beim Aufbau des Shadow-DOM in die
		// internen Slots (es schreibt dazu `slot="tab-N"` auf `tabpanel-slot-N` um). Bis dahin
		// sind die Panel-Kinder keinem Slot zugewiesen, also ohne Layout: `boundingBox()` liefert
		// `null`, `getComputedStyle()` leere Werte. Der Ready-Marker aus Schritt 1 kann früher
		// stehen als diese Zuweisung — jede Messung direkt danach liefe sonst ins Leere.
		const unslottedPanel = Array.from(document.querySelectorAll('kol-tabs')).some((host) =>
			Array.from(host.children).some((child) => child.assignedSlot === null),
		);
		if (unslottedPanel) {
			return false;
		}
		const button = document.querySelector('kol-button');
		// Ohne Buttons (z. B. theoretischer Sonderfall) gilt die Seite als hydriert.
		return button === null || button.shadowRoot !== null;
	});

	// 3. Fonts (inkl. KolIcons) abwarten, sonst flackern Icon-Glyphen / verschieben sich Layouts.
	await page.evaluate(() => document.fonts.ready);
};

/**
 * Schaltet das Farbschema im Seitenkontext um — für Tests, die einen Modus erzwingen wollen, ohne
 * über localStorage/`useTheme` und einen Reload zu gehen.
 *
 * Spiegelt `applyTheme()` aus `src/lib/theme.ts`: **beide** Schalter werden gesetzt. Das
 * `data-theme`-Attribut steuert die App-eigenen `--pp-*`-Tokens, `color-scheme` steuert die
 * KoliBri-Komponenten — deren Theme löst seit `@public-ui/theme-default` 4.4.1 jede Farbe über
 * `light-dark()` gegen `color-scheme` auf und erbt den Wert über die Shadow-DOM-Grenze.
 *
 * Warum nicht nur `setAttribute('data-theme', …)`: `applyTheme()` schreibt `color-scheme` als
 * **Inline-Style** auf `<html>`. Der gewinnt gegen die Regel `:root[data-theme='dark']` in
 * `app.css` — wer nur das Attribut umsetzt, bekommt eine dunkle App-Fläche mit hellen
 * KoliBri-Komponenten und misst damit genau den Flickenteppich, den 4.4.1 beseitigt.
 */
export const setTheme = async (page: Page, theme: 'light' | 'dark'): Promise<void> => {
	await page.evaluate((value) => {
		document.documentElement.dataset.theme = value;
		document.documentElement.style.colorScheme = value;
	}, theme);

	// Vorbedingung für alles Folgende: der Modus ist wirklich aktiv (sonst misst der Test still
	// das andere Schema).
	await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
};

/**
 * Findet einen Task-Titel per Exakt-Text, klammert dabei aber die Dashboard-Widgets und die
 * Fürsorge-Hinweis-Karte aus. Seit #1448 („Nächste Aufgabe", „Was ist jetzt dran?") und #1465
 * („Wichtigste Tasks", „Anstehende Deadlines", „In der Nähe") zeigen diese Widgets den reinen Titel
 * ohne `#<ID> –`-Präfix, wodurch sie mit gleichnamigen Titeln in Listen/Formularen textgleich werden —
 * ein seitenweites `getByText(title, { exact: true })` kollidiert dann mit dem Widget-Span und wirft
 * `strict mode violation`. Seit #2522 lädt auch die Fürsorge-Hinweis-Karte nach dem Erledigen neu und
 * kann den frisch angelegten Task als Vorschlagstitel zeigen (`care-hint-titel`).
 */
const DASHBOARD_TITLE_CLASSES = [
	'dashboard-next-task-title',
	'dashboard-suggestion-title',
	'dashboard-top-task-title',
	'dashboard-deadline-title',
	'dashboard-nearby-title',
	'care-hint-titel',
];

export const taskTitleText = (page: Page, title: string): Locator =>
	page
		.getByText(title, { exact: true })
		.and(page.locator(DASHBOARD_TITLE_CLASSES.map((className) => `:not(.${className})`).join('')));

/**
 * #2723: Öffnet das Avatar-Popover (Benutzermenü) im Header und liefert den Avatar-Trigger zurück.
 * „Hilfe" und „Abmelden" liegen seit #2723 nicht mehr in der Toolbar „Kopf-Aktionen", sondern
 * hinter dem Avatar-Trigger — Specs, die auf diese Aktionen klicken, müssen das Menü vorher öffnen.
 *
 * Idempotent: Ist das Popover schon offen, wird nicht erneut geklickt (der Klick würde schließen).
 */
export const openAvatarMenu = async (page: Page): Promise<Locator> => {
	const trigger = page.locator('.app-header__user button').first();
	await expect(trigger).toBeVisible();
	if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
		await trigger.click();
	}
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
	return trigger;
};

/**
 * Liefert eine Kopf-Aktion. Die vier Navigations-Aktionen („Zum Dashboard", „Suche",
 * „Neuen Task anlegen", „Einstellungen") stehen seit #691 auf JEDER Viewport-Breite direkt in der
 * Toolbar „Kopf-Aktionen"; seit #2723 liegen „Hilfe" und „Abmelden" stattdessen hinter dem
 * Avatar-Trigger — für sie öffnet dieser Helfer das Popover und liefert den Popover-Eintrag.
 *
 * Das `toBeVisible` wartet zugleich das asynchrone Layout der KoliBri-Toolbar ab (Items werden im
 * Shadow-DOM aufgebaut), damit nachfolgende Messungen nicht in den Pre-Hydration-Zustand laufen.
 */
export const headerAction = async (page: Page, label: string | RegExp): Promise<Locator> => {
	const labelText = typeof label === 'string' ? label : label.source;
	if (/hilfe|abmelden|logout/i.test(labelText)) {
		await openAvatarMenu(page);
		const inPopover = page.getByRole('button', { name: label });
		await expect(inPopover).toBeVisible();
		return inPopover;
	}
	const inToolbar = page.getByRole('toolbar', { name: /Kopf-Aktionen/ }).getByRole('button', { name: label });
	await expect(inToolbar).toBeVisible();
	return inToolbar;
};

const escapeForRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Locator für einen KolAccordion-Trigger über seine Überschrift. Verankerter Regex statt
 * `exact: true`, damit z. B. „Füreinander angelegt“ nicht den Abschnitt „… angelegte Serien“
 * mittrifft (Substring-Match).
 *
 * Seit KoliBri 4.5.0-rc.0 ist der Trigger ein natives `<summary>` in einem `<details>` (vorher
 * `kol-button-wc`) — verifizierter Upstream-Regressions-Befund: Chromium exponiert dafür weder
 * eine ARIA-Rolle noch `aria-expanded`, `page.getByRole('button', …)` findet den Trigger also
 * nicht mehr. Der CSS-Selektor `kol-accordion summary` durchdringt das Shadow-DOM automatisch
 * (Playwright-Standardverhalten) und trifft weiterhin zuverlässig.
 */
export const accordionTrigger = (page: Page, label: string): Locator =>
	page
		.locator('kol-accordion summary, kol-details summary')
		.filter({ hasText: new RegExp(`^${escapeForRegExp(label)}$`) });

/** Auf-/Zugeklappt-Zustand kommt seit `<details>`/`<summary>` nur noch aus der nativen `open`-Eigenschaft. */
export const isAccordionOpen = (trigger: Locator): Promise<boolean> =>
	trigger.evaluate((el) => el.closest('details')?.open === true);

/**
 * Öffnet einen zugeklappten KolAccordion-Abschnitt über seine Überschrift.
 *
 * Idempotent: nur bei geschlossenem Abschnitt wird geklickt — ein schon offener Abschnitt
 * (#1260: TaskForm startet im Edit mit gefüllten Werten aufgeklappt) wird nicht zugeklappt.
 */
export const openAccordionSection = async (page: Page, label: string): Promise<void> => {
	const trigger = accordionTrigger(page, label);
	if (!(await isAccordionOpen(trigger))) {
		await trigger.click();
		await expect.poll(() => isAccordionOpen(trigger)).toBe(true);
		// Öffnungs-Animation abwarten (KolAccordion: grid-template-rows 0.3s), bevor der Aufrufer
		// weitermisst — sonst landen Bounding-Box-Assertions in der laufenden Expansion
		// (#1072-AK4-/#1159-AK5-Flakes).
		// `xpath=ancestor::details[1]` statt eines `kol-accordion`-Filters: Trigger und `<details>`
		// stehen im selben Shadow-Root, die relative XPath-Achse trifft daher unabhängig von
		// Verschachtelung (z. B. Gruppen-Karte umschließt „Mitglieder einladen") immer exakt das
		// unmittelbar umschließende Accordion — `page.locator('kol-accordion').filter({ has: trigger })`
		// hängt sich mit dem gefilterten `summary`-Trigger-Locator auf (Playwright kombiniert
		// verschachtelte `.filter()`-Locators nicht zuverlässig als `has`-Selektor).
		await waitForStableBox(page, trigger.locator('xpath=ancestor::details[1]'));
	}
};

/**
 * Wartet, bis die Bounding-Box eines Elements stabil ist (Y-Position und Höhe über zwei
 * Messungen im 100-ms-Abstand unverändert): Öffnungs-Animationen (KolAccordion,
 * grid-template-rows 0.3s) und asynchron settlende KoliBri-Elemente (Counter-Zeile, Input-Höhe
 * nach Font-Load) schieben sonst in laufende Messungen hinein (#1051-F1-Flake, beide Richtungen).
 * Mindestabstand 300 ms vor dem ersten Sample: unter Last startet die Transition verzögert —
 * zwei vorgleichende Reads vor dem Start wären „falsch stabil" (#1159-AK5 im Volllauf).
 */
export const waitForStableBox = async (page: Page, locator: Locator, maxTries = 9): Promise<void> => {
	await page.waitForTimeout(300);
	let previous = await locator.boundingBox();
	for (let remaining = maxTries; remaining > 0; remaining--) {
		await page.waitForTimeout(100);
		const current = await locator.boundingBox();
		if (
			previous &&
			current &&
			Math.abs(current.y - previous.y) < 0.5 &&
			Math.abs(current.height - previous.height) < 0.5
		) {
			break;
		}
		previous = current;
	}
};

/**
 * Misst im Seitenkontext (`locator.evaluate(measureHorizontalScroll)`), ob innerhalb eines
 * Elements — einschließlich aller offenen Shadow-Roots — ein horizontal scrollbarer Container mit
 * echtem Überlauf existiert (`overflow-x: auto|scroll` und `scrollWidth > clientWidth`).
 *
 * #1258: Negativ-Vertrag „kein horizontales Scrollen bei 375px, auch nicht innerhalb der
 * Erledigt-Tabelle". `body.scrollWidth` ist dafür unbrauchbar (die App-Shell clippt mit
 * `overflow-x: hidden`, der Wert wäre strukturell grün) — hier wird der tatsächliche Scroll-
 * Container im KoliBri-Shadow-DOM gesucht. Start im eigenen Shadow-Root des Elements, weil
 * KolTableStateful ohne Light-DOM-Kinder verwendet wird. Bewusst schließungs-frei, damit
 * Playwright die Funktion serialisieren kann; rekursive Durchquerung ausschließlich lesend
 * (keine internen Klassen-/Tag-Selektoren, #824-Guard).
 */
export const measureHorizontalScroll = (
	el: HTMLElement,
): { scroller: { scrollWidth: number; clientWidth: number } | null } => {
	const scan = (root: ParentNode): { scrollWidth: number; clientWidth: number } | null => {
		for (const node of Array.from(root.querySelectorAll('*'))) {
			if (node instanceof HTMLElement) {
				const overflowX = getComputedStyle(node).overflowX;
				if ((overflowX === 'auto' || overflowX === 'scroll') && node.scrollWidth > node.clientWidth + 1) {
					return { scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
				}
				const shadow = node.shadowRoot;
				if (shadow) {
					const hit = scan(shadow);
					if (hit) return hit;
				}
			}
		}
		return null;
	};
	return { scroller: scan(el.shadowRoot ?? el) };
};

/**
 * Init-Script (als String, vor dem Seitenaufbau injiziert), das die Web Speech API mockt:
 *  1. `MockSpeechRecognition` mit `start()`, `stop()`, `abort()`, `onstart`, `onresult`, `onend`,
 *  2. Zuweisung an `window.SpeechRecognition` und `window.webkitSpeechRecognition`,
 *  3. Beobachtungs-Flags `window.__speechRecognitionStarted` / `window.__speechRecognitionStopped`,
 *  4. `window.__fireSpeechResult(text, isFinal?)`, um ein Erkennungsergebnis auszulösen,
 *  5. `window.__fireSpeechEnd()` / `window.__fireSpeechError(error)`, um ein Engine-Ende ohne
 *     Ergebnis bzw. einen Erkennungsfehler auszulösen.
 */
export const SPEECH_MOCK_INIT_SCRIPT = `
	(() => {
		window.__speechRecognitionStarted = false;
		window.__speechRecognitionStopped = false;
		let activeInstance = null;

		class MockSpeechRecognition {
			constructor() {
				this.lang = '';
				this.continuous = false;
				this.interimResults = false;
				this.onstart = null;
				this.onresult = null;
				this.onend = null;
				this.onerror = null;
				activeInstance = this;
			}
			start() {
				window.__speechRecognitionStarted = true;
				activeInstance = this;
				setTimeout(() => {
					if (typeof this.onstart === 'function') {
						this.onstart();
					}
				}, 0);
			}
			stop() {
				window.__speechRecognitionStopped = true;
				setTimeout(() => {
					if (typeof this.onend === 'function') {
						this.onend();
					}
				}, 0);
			}
			abort() {
				setTimeout(() => {
					if (typeof this.onerror === 'function') {
						this.onerror({ error: 'aborted' });
					}
					if (typeof this.onend === 'function') {
						this.onend();
					}
				}, 0);
			}
		}

		window.SpeechRecognition = MockSpeechRecognition;
		window.webkitSpeechRecognition = MockSpeechRecognition;

		window.__fireSpeechResult = (text, isFinal) => {
			if (activeInstance && typeof activeInstance.onresult === 'function') {
				activeInstance.onresult({
					resultIndex: 0,
					results: { 0: { 0: { transcript: text }, isFinal: isFinal !== false }, length: 1 },
				});
			}
		};
		window.__fireSpeechEnd = () => {
			if (activeInstance && typeof activeInstance.onend === 'function') {
				activeInstance.onend();
			}
		};
		window.__fireSpeechError = (error) => {
			if (activeInstance && typeof activeInstance.onerror === 'function') {
				activeInstance.onerror({ error });
			}
		};
	})();
`;

/**
 * Setzt die Gewichte aller vorhandenen Säulen über die echte API auf Gleichverteilung (je
 * `100 / n` %). Muster: `setEqualWeightsViaApi` in `pillar-dynamic-cases.spec.ts`.
 *
 * #1574: Die e2e-Suite teilt sich eine In-Memory-DB über alle parallelen Worker eines Shards, und
 * jede Spec, die Gewichte speichert (crud, #1555, #1574), hinterlässt ihre Verteilung allen
 * parallelen/nachfolgenden Tests. Vor #1574 waren die typischerweise gespeicherten Extrem-
 * verteilungen ([1, 0, 0, 0, 0]) Fixpunkte der Regler-Interaktion (`End`/`Home` klemmten genau
 * darauf); die #1574-Flows (0,2 → 0,6 bzw. 0,1) sind keine Fixpunkte — ohne Reset lief z. B.
 * `ArrowLeft` von 0,1 auf 0,0 weiter und traf statt des Bestätigungs-Modals den 0-%/100-%-Block
 * (AK4). Specs, die vom ausgeglichenen Seed (5 × 20 %) ausgehen, stellen ihn mit diesem Helper
 * aktiv her. `page.request` läuft dabei bewusst an `page.route`-Countern vorbei (API-Requests
 * werden nicht abgefangen) —PUT-Zähler der Specs bleiben unberührt.
 */
/**
 * Meldet einen frischen Nutzer per `POST /auth/register` an, damit die Spec serverseitig auf ihre
 * eigenen Daten eingeschränkt ist.
 *
 * #1573: Ohne Session greift `ownerScope(undefined)` nicht (`logics/ownerScope.ts`,
 * Pass-Through-Modus) — `GET /pillars` liefert dann den gesamten Säulen-Bestand der Shard-DB,
 * also auch die fünf Standard-Säulen jedes Nutzers, den eine parallele Spec registriert hat.
 * Specs, deren Regler-Choreografie GENAU FÜNF Säulen voraussetzt (erste auf 0,6, übrige auf 0,1),
 * treffen sonst je nach Shard-Zuschnitt neun oder mehr Regler auf 0,0 und landen im 0-%-Block von
 * `PillarWeightsForm` (`hasExtremeShare`) statt im Bestätigungs-Modal. Gegensteuern per Anlegen
 * oder Löschen geht seit der CRUD-Sperre nicht mehr.
 *
 * Die Registrierung setzt das Session-Cookie im Browser-Context (`page.request` teilt sich den
 * Cookie-Jar mit der Seite) und säht die fünf Standard-Säulen (`auth.ts`, `SEED_PILLARS`).
 * `/auth/me` bleibt von der Fixture gemockt — die Auth-Gate im Frontend ist davon unberührt.
 *
 * Kontextagnostisch (Request-Kontext statt `Page`), damit auch die zentrale Fixture je Test eine
 * eigene Session registrieren kann (#2508).
 */
export const createOwnSession = async (
	request: APIRequestContext,
	label: string,
): Promise<{ email: string; password: string }> => {
	const email = `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
	const password = `e2e-${label}-pw`;
	const response = await request.post('/auth/register', { data: { email, password } });
	expect(response.status(), 'register muss eine Session und die fünf Standard-Säulen liefern').toBe(201);
	return { email, password };
};

export const registerOwnSession = async (page: Page, label: string): Promise<void> => {
	await createOwnSession(page.request, label);
};

/**
 * Setzt Konto-Präferenzen der eigenen Session (#2398). Mit Session zieht die App beim Start den
 * Kontostand nach und überschreibt den `localStorage`-Spiegel — ein reiner `addInitScript`-Seed
 * (z. B. `pp-expert-mode`) hält dann nur bis zum ersten Abgleich.
 */
export const seedAccountPreferences = async (page: Page, preferences: Record<string, boolean>): Promise<void> => {
	const response = await page.request.put('/api/v1/account-preferences', { data: preferences });
	expect(response.status(), 'Konto-Präferenzen müssen gespeichert werden').toBe(200);
};

/**
 * #2527-Test-Pflege: sät die Mindestmenge an Erledigungen OHNE Säulen-Beitrag — Care-Vorschläge
 * und die Defizit-Begründung greifen erst ab der Überlast-Mindestmenge; ohne Beitrag bleibt
 * jede Säule defizitär, damit die Interaktions-Specs weiterhin bedienbare Vorschläge sehen.
 */
export const seedMindestErledigungen = async (page: Page): Promise<void> => {
	for (let i = 0; i < UEBERLAST_MINDEST_ERLEDIGUNGEN; i++) {
		const created = await page.request.post('/api/v1/tasks', {
			data: { title: `E2E Pflege-Erledigt ${i + 1}`, priority: 3, estimatedEffort: 1 },
		});
		expect(created.status(), 'Setup: Task-Anlage muss 201 liefern').toBe(201);
		const { id } = (await created.json()) as { id: number };
		const done = await page.request.patch(`/api/v1/tasks/${id}`, { data: { status: 'Done' } });
		expect(done.status(), 'Setup: Statuswechsel auf Done muss 200 liefern').toBe(200);
	}
};

/**
 * Vollverteilung über alle Säulen für API-Fixtures (#2077): jeder Anteil in [5, 80], Summe
 * exakt 100, `emphasisIndex` trägt den Höchstanteil; `confidence` nur bei Übergabe. Die reine
 * Logik liegt für den Unit-Test in `src/lib/pillarContributions.ts` (#2154: Vitest excludiert
 * das e2e-Verzeichnis, `@playwright/test` crasht unter jsdom) — hier nur der Re-Export, Signatur und
 * Exportstelle bleiben für die Specs stabil.
 */
export { fullPillarContributions } from '../src/lib/pillarContributions';

export const setEqualPillarWeights = async (page: Page): Promise<void> => {
	const response = await page.request.get('/api/v1/pillars');
	const pillars = (await response.json()) as { id: number }[];
	if (pillars.length === 0) {
		return;
	}
	await page.request.put('/api/v1/pillars/weights', {
		data: { weights: pillars.map((pillar) => ({ id: pillar.id, weight: 100 / pillars.length })) },
	});
};

/**
 * #2186: Die Wochen-Balance-Karte erscheint nur sonntags (`WeeklyBalanceCard.tsx`) und baut beim
 * Nachladen das Dashboard-Layout um. Fällt der Lauf in der Zeitzone der Page auf einen Sonntag, stellt
 * der Helfer ihre Uhr einen Tag zurück auf Samstag (gleiche ISO-Woche, die Uhr läuft weiter). Vor
 * `page.goto` aufrufen. Bewusst nur in Specs, die sonntags am Layout brechen, nicht global in der
 * Fixture: Das echte Backend bleibt auf Sonntag, Specs mit „heute“-Logik (`issue-1361-day-done`)
 * liefen sonst mit dem Browser auseinander.
 */
export const avoidSunday = async (page: Page): Promise<void> => {
	const now = Date.now();
	if (await page.evaluate((time) => new Date(time).getDay() === 0, now)) {
		await page.clock.install({ time: now - 86_400_000 });
	}
};

/** Verbindlicher Mobil-Viewport 375×812 (`.ai-knowledge/project.md`, Mobile-First); Guard: `.github/scripts/e2e-viewport.test.ts`. */
export const MOBILE = { width: 375, height: 812 } as const;
