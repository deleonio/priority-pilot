import { register } from '@public-ui/components';
import { defineCustomElements } from '@public-ui/components/loader';
import { DEFAULT } from '@public-ui/theme-default';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import { applyInitialTheme } from './lib/theme';
// KolIcons-Font laden, damit die eingebauten KoliBri-Icons (KolAlert, KolSpin, Selects …) rendern.
// Direkter Pfad-Import statt Bare-Specifier, weil die `exports`-Map von @public-ui/components den
// Asset-Subpfad nicht freigibt (siehe doc/HOWTO_ICON_FONTS); Vite bündelt den Font darüber selbst.
import '../node_modules/@public-ui/components/assets/kolicons/style.css';
// Font Awesome (Solid) aus dem Default-Theme für Icons, die die KolIcons-Font nicht kennt — z. B.
// das Reload-Symbol des „Aktualisieren"-Buttons (kolicons hat kein Reload-/Refresh-Icon). Wieder
// Direkt-Pfad-Import, weil die `exports`-Map von @public-ui/theme-default nur den Paket-Einstieg
// freigibt; `fontawesome.min.css` liefert die Glyphen, `solid.min.css` die Solid-Schriftart.
import '../node_modules/@public-ui/theme-default/assets/fontawesome-free/css/fontawesome.min.css';
import '../node_modules/@public-ui/theme-default/assets/fontawesome-free/css/solid.min.css';
import './app.css';

// Farbschema vor dem ersten Render absichern. Der eigentliche Anti-FOUC-Anstrich passiert bereits
// im Inline-Bootstrap in index.html (vor dem CSS-Paint); dieser Aufruf ist idempotent und greift
// als Fallback, falls der Inline-Bootstrap fehlt, und hält die Wahl mit dem useTheme-Hook konsistent.
applyInitialTheme();

const container = document.getElementById('root');
if (container === null) {
	throw new Error('Root-Element #root nicht gefunden.');
}
const root = createRoot(container);

const renderApp = () => {
	root.render(
		<StrictMode>
			<Root />
		</StrictMode>,
	);
};

// KoliBri-Komponenten im Default-Theme registrieren — sollte vor dem ersten Render geschehen.
// Schlägt die Registrierung fehl, wird die App dennoch gerendert (kein weißer Screen); die
// KoliBri-Komponenten werten dann ggf. ohne Upgrade aus.
register(DEFAULT, defineCustomElements)
	.then(renderApp)
	.catch((reason: unknown) => {
		console.error('Fehler bei der KoliBri-Registrierung:', reason);
		renderApp();
	});
