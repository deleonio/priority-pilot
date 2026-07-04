import { KolButton } from '@public-ui/react-v19';
import guideMarkdown from '../../../docs/user-guide.md?raw';
import { renderMarkdown } from '../lib/renderMarkdown';

/**
 * In-App-Hilfeseite (#229), erreichbar unter `/hilfe`. Sie rendert das Nutzerhandbuch
 * (`docs/user-guide.md`) als formatiertes Markdown mit echten HTML-Überschriften (`h1`/`h2` …) und
 * bietet einen „← Zurück"-Button zurück in die Anwendung.
 *
 * Der Markdown-Inhalt wird per `?raw`-Import aus derselben Quelle wie das verlinkte Handbuch geladen,
 * sodass App-Hilfe und Datei nie auseinanderdriften. Das Layout ist Mobile-First: begrenzte Breite,
 * `overflow-wrap`/`word-break` verhindern horizontales Überlaufen auch bei 375px (AK5).
 */
export const HelpPage = () => {
	// Vollständige Navigation statt History-Push: Das App-Routing entscheidet in `Root.tsx` anhand
	// von `window.location.pathname`, welche Ansicht rendert; ein echter Seitenwechsel greift dort.
	const goBack = (): void => {
		window.location.href = '/';
	};

	return (
		<main className="help-page">
			<header className="help-page__header">
				<KolButton _label="← Zurück" _variant="secondary" _on={{ onClick: goBack }} />
				<span className="help-page__brand">Priority Pilot</span>
			</header>
			<article className="help-page__content">{renderMarkdown(guideMarkdown)}</article>
		</main>
	);
};
