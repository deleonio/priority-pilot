import { KolInputRadio } from '@public-ui/react-v19';
import { useEffect, useMemo, useRef } from 'react';
import type { ThemePreference } from '../lib/theme';
import { useTheme } from '../lib/theme';
import { THEME_LABELS, THEME_ORDER } from './ThemeToggle';

/**
 * Darstellungs-Bedienelement für den Einstellungen-Tab „Allgemein" (#285).
 *
 * Verschiebt die frühere Header-Toolbar-Umschaltung in die Einstellungen: eine benannte Radiogruppe
 * („Darstellung") mit den drei Optionen **System / Hell / Dunkel**. Die Zustands-/Persistenzlogik
 * kommt unverändert aus `useTheme` (`theme.ts`, localStorage-Key `pp-theme`) — es gibt keine zweite
 * Quelle der Wahrheit. Die Optionen und ihre Labels teilt sich das Element mit dem früheren
 * Umschalter über die Konstanten aus `ThemeToggle.tsx`.
 */
export const AppearanceSetting = () => {
	const { preference, setPreference } = useTheme();
	const ref = useRef<HTMLDivElement>(null);

	// Optionen als stabile Objektidentität (nur von den Modul-Konstanten abhängig), damit die
	// Radiogruppe nicht bei jedem Render eine neue Options-Liste erhält.
	const options = useMemo(() => THEME_ORDER.map((value) => ({ label: THEME_LABELS[value], value })), []);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useEffect(() => {
		if (!ref.current) return;

		let updateTimeout: ReturnType<typeof setTimeout> | null = null;

		const updateMargins = () => {
			const shadowHosts = ref.current?.querySelectorAll('kol-input-radio');
			shadowHosts?.forEach((host) => {
				try {
					const shadowRoot = (host as HTMLElement).shadowRoot;
					if (shadowRoot) {
						const controls = shadowRoot.querySelectorAll('[role="radio"]');
						controls.forEach((control) => {
							(control as HTMLElement).style.marginLeft = '1.5rem';
						});
					}
				} catch (error) {
					// Closed Shadow-DOM oder anderer Fehler – Element überspringen
					console.debug('Shadow-DOM Zugriff fehlgeschlagen:', error);
				}
			});
		};

		// MutationObserver mit Debounce (100ms) für späte Renderings
		const observer = new MutationObserver(() => {
			if (updateTimeout) clearTimeout(updateTimeout);
			updateTimeout = setTimeout(updateMargins, 100);
		});

		if (ref.current) {
			observer.observe(ref.current, { childList: true, subtree: true });
			// Initial update direkt nach Mount
			updateMargins();
		}

		return () => {
			if (updateTimeout) clearTimeout(updateTimeout);
			observer.disconnect();
		};
	}, []);

	return (
		<div ref={ref}>
			<KolInputRadio
				_label="Darstellung"
				_orientation="horizontal"
				_options={options}
				_value={preference}
				_hint={'Wähle das Farbschema der Anwendung. „System" folgt der Einstellung deines Betriebssystems.'}
				_on={{
					onChange: (_event, value) => {
						if (typeof value === 'string') {
							setPreference(value as ThemePreference);
						}
					},
				}}
			/>
		</div>
	);
};
