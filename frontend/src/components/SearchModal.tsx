import { KolButton, KolInputText, KolSingleSelect } from '@public-ui/react-v19';
import type { Category } from 'client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { readAiPreferences } from '../lib/aiPreferences';
import { readVoiceAutostartPreference } from '../lib/voiceAutostart';
import { Modal } from './Modal';
import { VoiceField } from './VoiceField';

/**
 * Sentinel-Wert der Kategorie-Auswahl („alle Kategorien"). Kategorie-IDs sind serverseitig `>= 1`,
 * `0` kollidiert daher mit keiner echten Kategorie (Muster `ADD_PILLAR_PLACEHOLDER`).
 */
const ALL_CATEGORIES = 0;

interface SearchModalProps {
	/** Kategorien des Nutzers für den Filter (`GET /categories`); leer blendet das Feld aus. */
	categories?: Category[];
	onClose: () => void;
	/** Übergibt Suchbegriff und Kategoriefilter (`null` = alle Kategorien) an die Aufgabenansicht. */
	onSearch: (query: string, categoryId: number | null) => void;
}

/**
 * Modal-Dialog für die globale Suche (#8009e9bf-9e02-491c-8c73-6b4bac74f087).
 * Enthält ein Suchfeld mit Audioaufzeichnungs-Funktionalität (via `VoiceField`, #264/#522)
 * und übergibt Suchbegriff samt Kategorie an die Aufgabenansicht, die dann zum Aufgaben-Tab
 * wechselt und filtert.
 *
 * Bei aktiver KI wird eine frei formulierte Anfrage („offene Sachen zum Hausbau") vor dem Suchen
 * durch `POST /tasks/parse-search` geschickt: Das trennt Suchbegriff und Kategorie, sodass auch
 * eine diktierte Anfrage direkt den Filter setzt. Scheitert der Aufruf oder ist die KI aus, wird
 * mit dem eingegebenen Text gesucht — die Suche funktioniert immer, das Parsing ist die Zugabe.
 */
export const SearchModal = ({ categories = [], onClose, onSearch }: SearchModalProps) => {
	const [searchQuery, setSearchQuery] = useState('');
	const [categoryId, setCategoryId] = useState<number | null>(null);
	const [parsing, setParsing] = useState(false);
	const [voiceAutostart] = useState(readVoiceAutostartPreference);
	// Ob der Text per Sprache entstanden ist: Nur dann lohnt das Zerlegen — getippte Suchen sind
	// bereits der reine Suchbegriff, und der Filter steht als eigenes Feld daneben.
	const [fromVoice, setFromVoice] = useState(false);
	const inputRef = useRef<HTMLKolInputTextElement>(null);
	const aiEnabled = useMemo(() => readAiPreferences().aiEnabled, []);

	const categoryOptions = useMemo(
		() => [
			{ label: '— alle Kategorien —', value: ALL_CATEGORIES },
			...categories.map((category) => ({ label: category.name, value: category.id })),
		],
		[categories],
	);

	// Autofokus auf das Suchfeld beim Öffnen
	useEffect(() => {
		const id = setTimeout(() => {
			inputRef.current?.shadowRoot?.querySelector('input')?.focus();
		}, 200);
		return () => clearTimeout(id);
	}, []);

	const handleSearch = async (): Promise<void> => {
		const query = searchQuery.trim();
		if (query === '') {
			return;
		}
		if (!aiEnabled || !fromVoice || categories.length === 0) {
			onSearch(query, categoryId);
			onClose();
			return;
		}
		setParsing(true);
		try {
			const parsed = await api.parseSearch({ text: query });
			onSearch(parsed.text?.trim() ?? '', parsed.categoryId ?? categoryId);
			onClose();
		} catch {
			// Kontrollierte Degradation: Ohne Zerlegung wird mit dem gesprochenen Text gesucht.
			onSearch(query, categoryId);
			onClose();
		} finally {
			setParsing(false);
		}
	};

	const handleKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter') {
			void handleSearch();
		}
	};

	return (
		<Modal title="Suche" onClose={onClose} width="var(--pp-modal-width-desktop)">
			<div className="search-modal">
				<VoiceField
					variant="input"
					fieldLabel="Suchbegriff eingeben"
					autoStart={voiceAutostart}
					onTranscript={(text) => {
						setSearchQuery((prev) => (prev ? `${prev} ${text}` : text));
						setFromVoice(true);
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
								setFromVoice(false);
							},
							onKeyDown: handleKeyDown,
						}}
					/>
				</VoiceField>
				{categories.length > 0 && (
					<KolSingleSelect
						_label="Kategorie"
						_options={categoryOptions}
						_value={categoryId ?? ALL_CATEGORIES}
						_on={{
							onChange: (_event, value) => {
								const next = Number(value);
								setCategoryId(Number.isInteger(next) && next !== ALL_CATEGORIES ? next : null);
							},
						}}
					/>
				)}
				<div className="search-modal__actions">
					<KolButton
						_label={parsing ? 'Suche startet…' : 'Suche starten'}
						_variant="primary"
						_icons="fa-solid fa-magnifying-glass"
						_disabled={parsing || searchQuery.trim() === ''}
						_on={{ onClick: () => void handleSearch() }}
					/>
					<KolButton _label="Abbrechen" _variant="secondary" _disabled={parsing} _on={{ onClick: onClose }} />
				</div>
			</div>
		</Modal>
	);
};
