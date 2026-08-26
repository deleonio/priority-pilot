import { KolButton, KolInputText, KolModal } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { useVoiceInput } from '../lib/useVoiceInput';
import { Modal } from './Modal';

interface SearchModalProps {
	onClose: () => void;
	onSearch: (query: string) => void;
}

/**
 * Modal-Dialog für die globale Suche (#8009e9bf-9e02-491c-8c73-6b4bac74f087).
 * Enthält ein Suchfeld mit Audioaufzeichnungs-Funktionalität und übergibt den
 * Suchbegriff an die Aufgabenansicht, die dann zum Aufgaben-Tab wechselt und filtert.
 */
export const SearchModal = ({ onClose, onSearch }: SearchModalProps) => {
	const [searchQuery, setSearchQuery] = useState('');
	const inputRef = useRef<HTMLKolInputTextElement>(null);

	// Voice Input für die Audioaufzeichnung
	const { isRecording, startRecording, stopRecording, isSupported, voiceError } = useVoiceInput({
		onTranscript: (text: string) => {
			setSearchQuery((prev) => prev + (prev.endsWith(' ') ? text : ' ' + text));
		},
		lang: 'de-DE',
	});

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

	const handleKeyDown = (event: React.KeyboardEvent): void => {
		if (event.key === 'Enter') {
			handleSearch();
		}
	};

	const handleVoiceClick = (): void => {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	};

	return (
		<Modal title="Suche" onClose={onClose} width="var(--pp-modal-width-desktop)">
			<div className="search-modal">
				<div className="search-modal__input-wrapper">
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
					{isSupported && (
						<button
							type="button"
							aria-label={isRecording ? 'Aufnahme stoppen' : 'Sprachaufnahme starten'}
							aria-pressed={isRecording}
							className={`search-modal__mic-button${isRecording ? ' search-modal__mic-button--recording' : ''}`}
							onClick={handleVoiceClick}
						>
							🎤
						</button>
					)}
				</div>
				{voiceError !== null && (
					<p className="mic-error" role="alert">
						{voiceError}
					</p>
				)}
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
