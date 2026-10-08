import { KolAlert, KolButton, KolCard, KolTextarea } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { ButtonAction } from './ApiTokensSection';

/** Obergrenze der Vorgaben in Zeichen — Spiegel von `MAX_INSTRUCTIONS_LENGTH` in `routes/mcpInstructions.ts`. */
const MAX_LENGTH = 2000;

/**
 * Einstellungen → „KI" → Karte „Dialog-Vorgaben für die KI" (#1935): Freitext, den der MCP-Endpunkt
 * im `initialize`-Handshake an verbundene KI-Clients übermittelt. Speichern ist explizit (kein
 * Auto-Save); `open` sperrt Feld und Button wie die Schwester-Karten, die Vorgaben bleiben erhalten.
 */
export const McpInstructionsSection = ({ open = true }: { open?: boolean }) => {
	// `null` = noch nicht geladen; `saved` ist der Serverstand, `draft` der lokal bearbeitete Text.
	const { t } = useTranslation(['settings', 'common']);
	const [saved, setSaved] = useState<string | null>(null);
	const [draft, setDraft] = useState('');
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

	useEffect(() => {
		let active = true;
		api
			.getMcpInstructions()
			.then((result) => {
				if (!active) return;
				const text = result?.instructions ?? '';
				setSaved(text);
				setDraft(text);
			})
			.catch(() => {
				if (active) setFeedback({ type: 'error', text: t('mcpInstructions.loadError') });
			});
		return () => {
			active = false;
		};
	}, [t]);

	const dirty = saved !== null && draft.trim() !== saved;

	const handleSave = async (): Promise<void> => {
		if (!dirty || busy) return;
		setFeedback(null);
		setBusy(true);
		try {
			const result = await api.updateMcpInstructions(draft);
			const text = result?.instructions ?? draft.trim();
			setSaved(text);
			setDraft(text);
			setFeedback({ type: 'success', text: t('mcpInstructions.saved') });
		} catch (reason) {
			setFeedback({
				type: 'error',
				text: t('mcpInstructions.saveFailed', { message: (await toApiError(reason)).message }),
			});
		} finally {
			setBusy(false);
		}
	};

	return (
		<KolCard className="settings-card" _label={t('mcpInstructions.title')} _level={2}>
			<div className="settings-card-stack" data-testid="mcp-instructions-panel">
				<p>{t('mcpInstructions.intro')}</p>
				<KolTextarea
					_label={t('mcpInstructions.label')}
					_hint={t('mcpInstructions.hint')}
					_placeholder={t('mcpInstructions.placeholder')}
					_rows={5}
					_maxLength={MAX_LENGTH}
					_hasCounter
					_disabled={!open || saved === null}
					_value={draft}
					data-testid="mcp-instructions-input"
					_on={{
						onInput: (_event, value) => setDraft(String(value ?? '')),
						onChange: (_event, value) => setDraft(String(value ?? '')),
					}}
				/>
				<ButtonAction onClick={() => void handleSave()}>
					<KolButton
						_label={busy ? t('mcpInstructions.saving') : t('common:actions.save')}
						class="settings-action-btn"
						_variant="primary"
						_disabled={!open || !dirty || busy}
						data-testid="mcp-instructions-save"
					/>
				</ButtonAction>
				{feedback !== null && (
					<KolAlert
						_type={feedback.type}
						_label={feedback.type === 'success' ? t('mcpInstructions.savedLabel') : t('mcpInstructions.errorLabel')}
					>
						{feedback.text}
					</KolAlert>
				)}
			</div>
		</KolCard>
	);
};
