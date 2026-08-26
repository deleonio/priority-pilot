import { KolButton, KolInputText } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { VoiceField } from './VoiceField';

interface SearchModalProps {
	onClose: () => void;
	onSearch: (query: string) => void;
}

/**
 * Modal-Dialog für die globale Suche (#8009e9bf-9e02-491c-8c73-6b4bac74f087).
 * Enthält ein Suchfeld mit Audioaufzeichnungs-Funktionalität (via `VoiceField`, #264/#522)
 * und übergibt den Suchbegriff an die Aufgabenansicht, die dann zum Aufgaben-Tab wechselt
 * und filtert.
 */
export const SearchModal = ({ onClose, onSearch }: SearchModalProps) => {
	const [searchQuery, setSearchQuery] = useState('');
	const inputRef = useRef<HTMLKolInputTextElement>(null);

	// Autofokus auf das Suchfeld beim Öffnen
	useEffect(() => {
		const id = setTimeout(() => {
			inputRef.current?.shadowRoot?.querySelector('input')?.focus();
		}, 200);
		return () => clearTimeout(id);
	}, []);

	const handleSearch = (): void => {
		if (searchQuery.trim()) {
			onSearch(searchQuery.trim());
			onClose();
		}
	};

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter') {
			handleSearch();
		}
	};

	return (
		<Modal title="Suche" onClose={onClose} width="var(--pp-modal-width-desktop)">
			<div className="search-modal">
				<VoiceField
					variant="input"
					fieldLabel="Suchbegriff eingeben"
					onTranscript={(text) => {
						setSearchQuery((prev) => prev + (prev.endsWith(' ') ? text : ' ' + text));
					}}
				>
					<KolInputText
						ref={inputRef}
						_label="Suchbegriff eingeben"
						_type="search"
						_placeholder="Aufgaben durchsuchen..."
						_value={searchQuery}
						_on={{
							onInput: (event: Event) => {
								setSearchQuery((event.target as HTMLInputElement).value);
							},
							onKeyDown: handleKeyDown,
						}}
					/>
				</VoiceField>
				<div className="search-modal__actions">
					<KolButton
						_label="Suche starten"
						_variant="primary"
						_icons="fa-solid fa-magnifying-glass"
						_disabled={searchQuery.trim() === ''}
						_on={{ onClick: handleSearch }}
					/>
					<KolButton _label="Abbrechen" _variant="secondary" _on={{ onClick: onClose }} />
				</div>
			</div>
		</Modal>
	);
};
