import { KolButton, KolSpin } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';

interface HelpPageProps {
	onBack: () => void;
}

export const HelpPage = ({ onBack }: HelpPageProps) => {
	const [content, setContent] = useState<string | null>(null);

	useEffect(() => {
		fetch('/user-guide.md')
			.then((r) => r.text())
			.then(setContent)
			.catch(() => setContent('# Hilfe\n\n- Handbuch konnte nicht geladen werden.'));
	}, []);

	return (
		<main className="help-page">
			<header className="help-page-header">
				<KolButton
					_label="Zurück"
					_icons={{ left: { icon: 'fa-solid fa-arrow-left' } }}
					_variant="secondary"
					_on={{ onClick: onBack }}
				/>
			</header>
			{content === null ? (
				<div className="help-page-loading">
					<KolSpin _show _variant="cycle" _label="Lädt Handbuch …" />
				</div>
			) : (
				<div className="help-page-content">
					<ReactMarkdown>{content}</ReactMarkdown>
				</div>
			)}
		</main>
	);
};
