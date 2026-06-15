import { register } from '@public-ui/components';
import { defineCustomElements } from '@public-ui/components/loader';
import { DEFAULT } from '@public-ui/theme-default';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// KoliBri-Komponenten im Default-Theme registrieren — muss vor dem ersten Render geschehen.
void register(DEFAULT, defineCustomElements).then(() => {
	const container = document.getElementById('root');
	if (container === null) {
		throw new Error('Root-Element #root nicht gefunden.');
	}
	createRoot(container).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
