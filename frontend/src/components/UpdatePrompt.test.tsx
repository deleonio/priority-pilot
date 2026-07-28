import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Spec-Tests (#353) für den PWA-Update-Fluss (registerType: 'prompt', Update-Prompt).
 *
 * `virtual:pwa-register/react` ist ein von vite-plugin-pwa bereitgestelltes virtuelles Modul,
 * das unter Vitest nicht auflösbar ist. Wir mocken es daher modulweit und steuern den von
 * `useRegisterSW()` gelieferten Zustand über veränderliche Modulvariablen, die jeder Test
 * in `beforeEach` zurücksetzt und einzeln überschreibt.
 */

// Veränderlicher Zustand, den der Mock bei jedem `useRegisterSW()`-Aufruf frisch ausliest.
let needRefreshValue = false;
let offlineReadyValue = false;
const updateServiceWorker = vi.fn();
const setNeedRefresh = vi.fn();
const setOfflineReady = vi.fn();

vi.mock('virtual:pwa-register/react', () => ({
	// Signatur entspricht dem echten Hook: needRefresh/offlineReady sind [state, setter]-Tupel.
	useRegisterSW: () => ({
		needRefresh: [needRefreshValue, setNeedRefresh],
		offlineReady: [offlineReadyValue, setOfflineReady],
		updateServiceWorker,
	}),
}));

/**
 * KoliBri-Mock (#373): Wir bilden die im Komponentenbaum genutzten KoliBri-Komponenten auf schlanke
 * DOM-Stellvertreter ab, die im JSDOM deterministisch prüfbar sind. Wichtig:
 * - children MÜSSEN durchgereicht werden, sonst brechen die bestehenden #353-Text-/Testid-Checks.
 * - KolButton reicht `_on.onClick` an einen nativen `<button>` weiter, damit fireEvent.click greift.
 * - Über `data-comp` lässt sich der verwendete Komponententyp (kol-alert vs. kol-card) prüfen.
 */
vi.mock('@public-ui/react-v19', () => ({
	KolAlert: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div role="alert" data-comp="kol-alert" data-label={_label}>
			{children}
		</div>
	),
	KolCard: ({ _label, children }: { _label?: string; children?: ReactNode }) => (
		<div data-comp="kol-card" data-label={_label}>
			{children}
		</div>
	),
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button data-comp="kol-button" disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
}));

// Import NACH vi.mock, damit die Komponente den gemockten Hook erhält.
import { UpdatePrompt } from './UpdatePrompt';

afterEach(cleanup);

beforeEach(() => {
	needRefreshValue = false;
	offlineReadyValue = false;
	updateServiceWorker.mockReset();
	setNeedRefresh.mockReset();
	setOfflineReady.mockReset();
});

describe('UpdatePrompt (#353)', () => {
	// AK2 — Update-Banner bei neuer Version
	it('AK2: zeigt Update-Banner „Neue Version verfügbar" + „Neu laden", wenn needRefresh=true', () => {
		needRefreshValue = true;

		render(<UpdatePrompt />);

		expect(screen.getByText(/Neue Version verfügbar/i)).toBeInTheDocument();
		expect(screen.getByText(/Neu laden/i)).toBeInTheDocument();
	});

	// AK3 — Reload löst Update aus.
	// Testbare Naht: KolButton ist ein Web Component, dessen `_on.onClick`-Callback in JSDOM nicht
	// über einen echten DOM-Klick auslösbar ist (siehe InstallPrompt-Präzedenzfall). Das Reload-
	// Steuerelement muss deshalb ein nativ klickbares Element mit `data-testid="pwa-update-reload"`
	// sein, damit der Handler deterministisch getestet werden kann.
	it('AK3: Klick auf „Neu laden" ruft updateServiceWorker(true) auf', () => {
		needRefreshValue = true;

		render(<UpdatePrompt />);

		// Vor der Interaktion darf kein Update ausgelöst worden sein (verhindert trügerische Coverage).
		expect(updateServiceWorker).not.toHaveBeenCalled();

		fireEvent.click(screen.getByTestId('pwa-update-reload'));

		expect(updateServiceWorker).toHaveBeenCalledWith(true);
	});

	// AK4 — Offline-bereit-Hinweis
	it('AK4a: zeigt „App ist offline-bereit", wenn offlineReady=true', () => {
		offlineReadyValue = true;

		render(<UpdatePrompt />);

		expect(screen.getByText(/App ist offline-bereit/i)).toBeInTheDocument();
	});

	it('AK4b: zeigt „App ist offline-bereit" NICHT, wenn offlineReady=false', () => {
		offlineReadyValue = false;

		render(<UpdatePrompt />);

		expect(screen.queryByText(/App ist offline-bereit/i)).not.toBeInTheDocument();
	});

	it('AK4c: Klick auf „Schließen" ruft setOfflineReady(false) auf', () => {
		offlineReadyValue = true;

		render(<UpdatePrompt />);

		expect(setOfflineReady).not.toHaveBeenCalled();

		fireEvent.click(screen.getByTestId('pwa-offline-close'));

		expect(setOfflineReady).toHaveBeenCalledWith(false);
	});

	// AK5 — Kein Banner ohne Signal
	it('AK5: rendert nichts, wenn needRefresh=false und offlineReady=false', () => {
		needRefreshValue = false;
		offlineReadyValue = false;

		const { container } = render(<UpdatePrompt />);

		expect(container).toBeEmptyDOMElement();
	});
});

describe('UpdatePrompt — KoliBri-Card & Fixierung (#373)', () => {
	// AK2 — Als KoliBri-Card statt KolAlert.
	it('AK2a: needRefresh=true → kol-card im DOM (nicht mehr kol-alert)', () => {
		needRefreshValue = true;

		const { container } = render(<UpdatePrompt />);

		expect(container.querySelector('[data-comp="kol-card"]')).toBeInTheDocument();
	});

	it('AK2b: needRefresh=true → Reload-Aktion als kol-button „Neu laden"', () => {
		needRefreshValue = true;

		const { container } = render(<UpdatePrompt />);

		const button = container.querySelector('[data-comp="kol-button"]');
		expect(button).toBeInTheDocument();
		expect(button).toHaveTextContent(/Neu laden/i);
	});

	it('AK2c: offlineReady=true → kol-card im DOM', () => {
		offlineReadyValue = true;

		const { container } = render(<UpdatePrompt />);

		expect(container.querySelector('[data-comp="kol-card"]')).toBeInTheDocument();
	});

	it('AK2d: offlineReady=true → Schließen-Aktion als kol-button „Schließen"', () => {
		offlineReadyValue = true;

		const { container } = render(<UpdatePrompt />);

		const button = container.querySelector('[data-comp="kol-button"]');
		expect(button).toBeInTheDocument();
		expect(button).toHaveTextContent(/Schließen/i);
	});

	// AK1 — Umgebender Container mit Klasse update-prompt (später position: fixed via CSS).
	it('AK1: needRefresh=true → umgebender Container hat Klasse update-prompt', () => {
		needRefreshValue = true;

		const { container } = render(<UpdatePrompt />);

		expect(container.querySelector('.update-prompt')).toBeInTheDocument();
	});

	// AK3 — Verhalten unverändert, jetzt über kol-button.
	it('AK3a: Klick auf kol-button „Neu laden" ruft updateServiceWorker(true) auf', () => {
		needRefreshValue = true;

		const { container } = render(<UpdatePrompt />);

		expect(updateServiceWorker).not.toHaveBeenCalled();

		fireEvent.click(container.querySelector('[data-comp="kol-button"]')!);

		expect(updateServiceWorker).toHaveBeenCalledWith(true);
	});

	it('AK3b: Klick auf kol-button „Schließen" ruft setOfflineReady(false) auf', () => {
		offlineReadyValue = true;

		const { container } = render(<UpdatePrompt />);

		expect(setOfflineReady).not.toHaveBeenCalled();

		fireEvent.click(container.querySelector('[data-comp="kol-button"]')!);

		expect(setOfflineReady).toHaveBeenCalledWith(false);
	});
});

// AK1 — Prompt-Modus + Workbox-Optionen aktiv.
// Die Vite-Config baut PWA-/Proxy-Setup auf; ein direkter Import würde `readFileSync` gegen die
// root package.json ausführen und den VitePWA-Plugin-Baum instanziieren. Robuster und ausreichend
// ist eine Textprüfung der Config-Quelle per Regex.
describe('vite.config.ts — PWA Update-Fluss (AK1, #353)', () => {
	const configPath = fileURLToPath(new URL('../../vite.config.ts', import.meta.url));
	const configSource = readFileSync(configPath, 'utf-8');

	it('AK1a: registerType ist „prompt" (nicht „autoUpdate")', () => {
		expect(configSource).toMatch(/registerType:\s*'prompt'/);
		expect(configSource).not.toMatch(/registerType:\s*'autoUpdate'/);
	});

	it('AK1b: workbox setzt cleanupOutdatedCaches: true', () => {
		expect(configSource).toMatch(/cleanupOutdatedCaches:\s*true/);
	});

	it('AK1c: workbox setzt clientsClaim: true', () => {
		expect(configSource).toMatch(/clientsClaim:\s*true/);
	});

	it('AK1d: workbox setzt skipWaiting: false', () => {
		expect(configSource).toMatch(/skipWaiting:\s*false/);
	});
});
