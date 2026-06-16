import { register } from '@public-ui/components';
import { defineCustomElements } from '@public-ui/components/loader';
import { DEFAULT } from '@public-ui/theme-default';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('root');
if (container === null) {
	throw new Error('Root-Element #root nicht gefunden.');
}
const root = createRoot(container);

const renderApp = () => {
	root.render(
		<StrictMode>
			<App />
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
