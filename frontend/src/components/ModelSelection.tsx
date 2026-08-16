import { useEffect, useState } from 'react';
import { api } from '../api.js';

type FreeModel = { id: string; name: string };

interface ModelSelectionProps {
	// Optional: Callback bei Modell-Auswahl
	onModelSelect?: (modelId: string) => void;
}

/**
 * ModelSelection-Komponente (Issue #742).
 * Zeigt einen Button zum Öffnen einer Liste der kostenlosen Modelle.
 * Speichert die Auswahl im localStorage (persistiert zwischen Sessions).
 */
export const ModelSelection = ({ onModelSelect }: ModelSelectionProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [freeModels, setFreeModels] = useState<FreeModel[]>([]);
	const [selectedModelId, setSelectedModelId] = useState<string>(
		() => localStorage.getItem('selectedFreeModel') || 'openrouter/free',
	);
	const [loading, setLoading] = useState(true);

	// Free Models laden – nur beim Mount (einmalig)
	useEffect(() => {
		if (loading) {
			const loadModels = async () => {
				try {
					const data = await api.getFreeModels();
					setFreeModels(data.models);
				} catch (error) {
					console.error('Failed to load free models:', error);
					// Fallback: Standard-Liste bei Fehler
					setFreeModels([
						{ id: 'openrouter/free', name: 'OpenRouter Free' },
						{ id: 'google/gemma-7b-it:free', name: 'Gemma 7B IT (Free)' },
						{ id: 'mistralai/mistral-7b-instruct:free', name: 'Mistral 7B Instruct (Free)' },
					]);
				} finally {
					setLoading(false);
				}
			};
			loadModels();
		}
	}, [loading]);

	// Auswahl speichern und Callback aufrufen
	const handleSelect = (modelId: string) => {
		setSelectedModelId(modelId);
		localStorage.setItem('selectedFreeModel', modelId);
		setIsOpen(false);
		onModelSelect?.(modelId);
	};

	const selectedModel = freeModels.find((m) => m.id === selectedModelId) || { id: 'openrouter/free', name: 'Fallback' };

	return (
		<>
			{/* Button zum Öffnen der Modell-Auswahl */}
			<button
				type="button"
				data-testid="model-selection-button"
				onClick={() => setIsOpen(true)}
				disabled={loading}
				className="px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
			>
				{loading ? 'Laden...' : selectedModel?.name || 'Modell wählen'}
			</button>

			{/* Anzeige des aktuell gewählten Modells (für Test AK3) */}
			{!isOpen && (
				<span data-testid="current-model-display" className="sr-only">
					{selectedModelId}
				</span>
			)}

			{/* Dialog/Overlay */}
			{isOpen && (
				<>
					{/* Backdrop – klickbar zum Schließen */}
					<div className="fixed inset-0 bg-black/30 z-40" onClick={() => setIsOpen(false)} role="presentation" />

					{/* Dialog */}
					<div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
						<div
							className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[60vh] flex flex-col pointer-events-auto"
							role="dialog"
							aria-modal="true"
							aria-labelledby="model-selection-title"
						>
							<div className="p-4 border-b flex justify-between items-center">
								<h2 id="model-selection-title" className="text-lg font-semibold">
									Kostenloses Modell wählen
								</h2>
								<button
									type="button"
									data-testid="close-model-selection"
									onClick={() => setIsOpen(false)}
									className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
								>
									×
								</button>
							</div>

							{/* Modell-Liste */}
							<div data-testid="free-models-list" className="p-2 overflow-y-auto flex-1">
								{freeModels.map((model) => (
									<button
										key={model.id}
										type="button"
										data-testid="free-model-item"
										data-model-id={model.id}
										aria-selected={model.id === selectedModelId}
										onClick={() => handleSelect(model.id)}
										className={`w-full text-left px-4 py-3 rounded-md mb-1 ${
											model.id === selectedModelId
												? 'bg-blue-100 border-2 border-blue-500'
												: 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
										}`}
									>
										<div className="font-medium">{model.name}</div>
										<div className="text-xs text-gray-500">{model.id}</div>
									</button>
								))}
							</div>

							<div className="p-4 border-t">
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="w-full px-4 py-2 bg-gray-200 rounded-md hover:bg-gray-300"
								>
									Abbrechen
								</button>
							</div>
						</div>
					</div>
				</>
			)}
		</>
	);
};
