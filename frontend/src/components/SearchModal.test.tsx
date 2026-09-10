import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { Category } from 'client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../api';
import { SearchModal } from './SearchModal';

vi.mock('../api', () => ({ api: { parseSearch: vi.fn() } }));

// `Modal` nutzt KoliBris `KolDialog` (natives `<dialog>`), in jsdom nicht lauffähig — Passthrough
// wie in PillarList.test.tsx / CategoryList.test.tsx.
vi.mock('./Modal', () => ({
	Modal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

// `VoiceField` kapselt die Spracherkennung (kein `SpeechRecognition` in jsdom). Der Double rendert
// die Kinder und stellt einen Knopf bereit, der ein Transkript einspielt — damit ist der
// Sprach-Pfad (`fromVoice`) ohne Browser-API testbar.
vi.mock('./VoiceField', () => ({
	VoiceField: ({ children, onTranscript }: { children: ReactNode; onTranscript: (text: string) => void }) => (
		<div>
			{children}
			<button onClick={() => onTranscript('offene Sachen zum Hausbau')}>Transkript einspielen</button>
		</div>
	),
}));

vi.mock('@public-ui/react-v19', () => ({
	KolButton: ({
		_label,
		_disabled,
		_on,
	}: {
		_label?: string;
		_disabled?: boolean;
		_on?: { onClick?: (_e: MouseEvent) => void };
	}) => (
		<button disabled={_disabled} onClick={(e) => _on?.onClick?.(e.nativeEvent)}>
			{_label}
		</button>
	),
	KolInputText: ({
		_label,
		_value,
		_on,
	}: {
		_label?: string;
		_value?: string;
		_on?: { onInput?: (e: Event) => void };
	}) => (
		<input
			aria-label={_label}
			value={_value ?? ''}
			onChange={(e) => _on?.onInput?.({ ...e.nativeEvent, target: e.target } as unknown as Event)}
		/>
	),
	KolSingleSelect: ({
		_label,
		_value,
		_options,
		_on,
	}: {
		_label?: string;
		_value?: string | number;
		_options?: { label: string; value: string | number }[];
		_on?: { onChange?: (_e: unknown, v: unknown) => void };
	}) => (
		<select
			aria-label={_label}
			value={String(_value ?? '')}
			onChange={(e) => _on?.onChange?.(e.nativeEvent, e.target.value)}
		>
			{(_options ?? []).map((option) => (
				<option key={String(option.value)} value={String(option.value)}>
					{option.label}
				</option>
			))}
		</select>
	),
}));

afterEach(cleanup);

const categories: Category[] = [{ id: 7, name: 'Hausbau', color: '#b42318' }];

/**
 * Tests der Sprachsuche. Der Kern ist ein Fall, der im Kreuzverhör zu PR #1325 aufgefallen ist und
 * still durchging: Liefert das Modell nur eine Kategorie und keinen `text`, darf der gesprochene
 * Suchbegriff nicht verloren gehen — sonst sucht die App nach dem leeren String.
 */
describe('SearchModal — Sprachsuche mit Kategorie-Erkennung', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		localStorage.clear();
	});

	/** Öffnet den Dialog, spielt ein Transkript ein und startet die Suche. */
	const searchByVoice = async (onSearch: (query: string, categoryId: number | null) => void): Promise<void> => {
		render(<SearchModal categories={categories} onClose={vi.fn()} onSearch={onSearch} />);
		fireEvent.click(screen.getByRole('button', { name: 'Transkript einspielen' }));
		fireEvent.click(screen.getByRole('button', { name: /suche starten/i }));
		await waitFor(() => expect(onSearch).toHaveBeenCalled());
	};

	it('übernimmt Suchbegriff und Kategorie aus der Zerlegung', async () => {
		vi.mocked(api.parseSearch).mockResolvedValue({ text: 'offene Sachen', categoryId: 7 });
		const onSearch = vi.fn();

		await searchByVoice(onSearch);

		expect(api.parseSearch).toHaveBeenCalledWith({ text: 'offene Sachen zum Hausbau' });
		expect(onSearch).toHaveBeenCalledWith('offene Sachen', 7);
	});

	it('filtert nur nach Kategorie, wenn die Zerlegung keinen Suchbegriff übrig lässt', async () => {
		vi.mocked(api.parseSearch).mockResolvedValue({ categoryId: 7 });
		const onSearch = vi.fn();

		await searchByVoice(onSearch);

		// Der Rohtext wäre hier ein Titel-Filter, den keine Aufgabe erfüllt („offene Sachen zum
		// Hausbau" steht in keinem Titel) — die Liste bliebe leer statt die Kategorie zu zeigen.
		expect(onSearch).toHaveBeenCalledWith('', 7);
	});

	it('sucht mit dem gesprochenen Text, wenn die Zerlegung gar nichts erkennt', async () => {
		// Vertragsgemäß gültiges Nicht-Ergebnis (`extractParsedSearch` gibt `{}` zurück). Ohne diesen
		// Fallback liefe die Suche mit leerer Anfrage und zeigte die ungefilterte Gesamtliste.
		vi.mocked(api.parseSearch).mockResolvedValue({});
		const onSearch = vi.fn();

		await searchByVoice(onSearch);

		expect(onSearch).toHaveBeenCalledWith('offene Sachen zum Hausbau', null);
	});

	it('sucht bei einem Fehler der Zerlegung mit dem gesprochenen Text weiter', async () => {
		vi.mocked(api.parseSearch).mockRejectedValue(new Error('LLM nicht erreichbar'));
		const onSearch = vi.fn();

		await searchByVoice(onSearch);

		expect(onSearch).toHaveBeenCalledWith('offene Sachen zum Hausbau', null);
	});

	it('ruft für getippte Suchen keine Zerlegung auf', async () => {
		const onSearch = vi.fn();
		render(<SearchModal categories={categories} onClose={vi.fn()} onSearch={onSearch} />);

		fireEvent.change(screen.getByLabelText('Suchbegriff eingeben'), { target: { value: 'Fliesen' } });
		fireEvent.click(screen.getByRole('button', { name: /suche starten/i }));

		await waitFor(() => expect(onSearch).toHaveBeenCalledWith('Fliesen', null));
		expect(api.parseSearch).not.toHaveBeenCalled();
	});
});
