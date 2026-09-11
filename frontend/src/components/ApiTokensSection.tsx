import { KolAlert, KolButton, KolCard, KolInputCheckbox, KolInputText } from '@public-ui/react-v19';
import type { ApiToken } from 'client';
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';

/** Vorbelegter Name eines neuen Tokens — ein Klick reicht, der Name bleibt änderbar. */
const DEFAULT_TOKEN_NAME = 'Externer Client';

/** Zeitpunkte in der Liste als „TT.MM.JJJJ" — die Uhrzeit trägt hier keine Entscheidung. */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

/** Klartext-Label je Rechtestufe (#1356, AK8) — Farbe trägt nie allein Bedeutung. */
const SCOPE_LABEL: Record<ApiToken['scope'], string> = { read: 'Nur lesend', readwrite: 'Lesen und Schreiben' };

/** MCP-Endpunkt dieser App — aus der aktuellen Origin abgeleitet, damit er in jeder Umgebung stimmt. */
const MCP_URL = `${window.location.origin}/api/v1/mcp/v1`;

/**
 * Aktions-Hülle um einen `KolButton`: der Klick wird am umgebenden Element abgefangen statt über
 * `_on` am Web-Component. Grund ist die Testbarkeit (#1352): `kol-button` ist in jsdom kein
 * definiertes Custom Element, `_on` bleibt dort eine reine Property und ein echter Klick liefe ins
 * Leere. Der Klick des internen Buttons ist `composed` und verlässt den Shadow-Root — im Browser
 * wie im Test landet er damit genau einmal hier.
 */
const ButtonAction = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
	<span className="api-tokens__action" onClick={onClick}>
		{children}
	</span>
);

/**
 * Rechte-Umschalter je Token (#1356, AK8): `KolInputCheckbox _variant="switch"` wie die übrigen
 * sieben Schalter im Frontend (`SettingsPage.tsx`). `_on.onChange` ist der einzige Pfad — KoliBri
 * dispatcht das `change`-Event direkt auf dem Host-Element, ein zusätzlicher Host-Listener würde
 * im Browser doppelt feuern.
 */
const ScopeToggle = ({ token, disabled, onToggle }: { token: ApiToken; disabled: boolean; onToggle: () => void }) => (
	<KolInputCheckbox
		_variant="switch"
		_label={`Rechte für Token ${token.name}`}
		_hideLabel={true}
		_checked={token.scope === 'readwrite'}
		_disabled={disabled}
		data-testid="api-token-scope-toggle"
		_on={{ onChange: () => onToggle() }}
	/>
);

/**
 * Einstellungen → „Zugriff": persönliche API-Tokens für externe Clients (#1352). Ein Klick auf
 * „Token erzeugen" legt einen Token an und zeigt seinen Klartext **genau einmal** — danach kennt
 * der Server nur noch dessen Hash und die Liste zeigt ausschließlich Metadaten (Name, Erstellung,
 * letzte Nutzung). „Zurückziehen" sperrt den Token ab dem nächsten Aufruf.
 *
 * Aufbau wie `LlmSettings.tsx`: `KolCard` als Gruppierungsfläche, `ul`/`li` mit Zeilen-Aktionen
 * statt Tabelle (Mobile-Regel 3). Der Rückzug läuft über eine zweistufige Bestätigung direkt in
 * der Zeile (Progressive Disclosure, `docs/ux-pattern-sequential-confirmation.md`): kein einzelner
 * Klick löst die irreversible Aktion aus.
 */
export const ApiTokensSection = () => {
	const [tokens, setTokens] = useState<ApiToken[]>([]);
	const [name, setName] = useState(DEFAULT_TOKEN_NAME);
	// Klartext des zuletzt erzeugten Tokens — nur im Speicher dieser Sitzung, nie erneut abrufbar.
	const [plaintext, setPlaintext] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	// Id des Tokens, für den die Rückfrage „wirklich zurückziehen?" gerade offen steht.
	const [revokeId, setRevokeId] = useState<number | null>(null);
	const [mcpUrlCopied, setMcpUrlCopied] = useState(false);
	// Id des Tokens, dessen Rechtestufe gerade per PATCH umgeschaltet wird (eigene Sperre, unabhängig
	// von `busy`, damit das Umschalten eines Tokens nicht Anlegen/Zurückziehen eines anderen blockiert).
	const [scopeBusyId, setScopeBusyId] = useState<number | null>(null);

	useEffect(() => {
		let active = true;
		api
			.listApiTokens()
			.then((list) => {
				if (active) setTokens(list ?? []);
			})
			.catch(() => {
				if (active) setError('Die Token-Liste konnte nicht geladen werden.');
			});
		return () => {
			active = false;
		};
	}, []);

	const handleCreate = async (): Promise<void> => {
		setError(null);
		setCopied(false);
		setBusy(true);
		try {
			const { token, ...meta } = await api.createApiToken({ name: name.trim() });
			setPlaintext(token);
			setTokens((previous) => [...previous, meta]);
			setName(DEFAULT_TOKEN_NAME);
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	// Sofort-Wechsel ohne Speichern-Klick (#1356, AK8) — Wert bleibt bei einem fehlgeschlagenen PATCH
	// unverändert sichtbar (State-Update erst nach der Server-Antwort).
	const handleToggleScope = async (token: ApiToken): Promise<void> => {
		const nextScope: ApiToken['scope'] = token.scope === 'readwrite' ? 'read' : 'readwrite';
		setError(null);
		setScopeBusyId(token.id);
		try {
			const updated = await api.updateApiToken({ id: token.id, scope: nextScope });
			setTokens((previous) => previous.map((entry) => (entry.id === token.id ? updated : entry)));
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setScopeBusyId(null);
		}
	};

	const handleRevoke = async (id: number): Promise<void> => {
		setError(null);
		setBusy(true);
		try {
			await api.deleteApiToken({ id });
			setTokens((previous) => previous.filter((entry) => entry.id !== id));
			setRevokeId(null);
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="api-tokens" data-testid="api-tokens-panel">
			<KolCard className="settings-card" _label="Zugriff für externe Clients" _level={2}>
				<div className="api-tokens__create">
					<p>
						Ein Token spricht dieselben Schnittstellen an wie diese Oberfläche — mit deinen Daten und deinen Rechten.
						Der Klartext ist nur direkt nach dem Erzeugen sichtbar.
					</p>
					<KolInputText
						_label="Name des Tokens"
						_value={name}
						_on={{ onInput: (_event, value) => setName(String(value)) }}
					/>
					<ButtonAction onClick={() => void handleCreate()}>
						<KolButton _label="Token erzeugen" class="settings-action-btn" _variant="primary" _disabled={busy} />
					</ButtonAction>
					{error !== null && (
						<KolAlert _type="error" _label="Fehler">
							{error}
						</KolAlert>
					)}
					<div className="api-tokens__mcp-url">
						<span>MCP-Endpunkt für externe Clients:</span>
						<span className="api-tokens__plaintext" data-testid="mcp-url">
							{MCP_URL}
						</span>
						<ButtonAction
							onClick={() => {
								void navigator.clipboard?.writeText(MCP_URL).then(() => setMcpUrlCopied(true));
							}}
						>
							<KolButton _label="URL kopieren" class="settings-action-btn" _variant="secondary" />
						</ButtonAction>
						{mcpUrlCopied && <span className="api-tokens__copied">In die Zwischenablage kopiert.</span>}
						<span>Header-Konfiguration für externe Clients (z. B. Claude-Connector):</span>
						<span className="api-tokens__plaintext">Authorization: Bearer &lt;Token&gt;</span>
					</div>
					{plaintext !== null && (
						<KolAlert _type="info" _label="Token einmalig sichtbar">
							<span className="api-tokens__plaintext" data-testid="api-token-plaintext">
								{plaintext}
							</span>
							<ButtonAction
								onClick={() => {
									void navigator.clipboard?.writeText(plaintext).then(() => setCopied(true));
								}}
							>
								<KolButton _label="Token kopieren" class="settings-action-btn" _variant="secondary" />
							</ButtonAction>
							{copied && <span className="api-tokens__copied">In die Zwischenablage kopiert.</span>}
						</KolAlert>
					)}
				</div>
			</KolCard>

			<KolCard className="settings-card" _label="Vergebene Tokens" _level={2}>
				{tokens.length === 0 ? (
					<p>Noch kein Token vergeben.</p>
				) : (
					<ul className="api-tokens__list">
						{tokens.map((token) => (
							<li key={token.id} className="api-tokens__item" data-testid="api-token-row">
								<span className="api-tokens__name">
									{token.name}
									<span className="api-tokens__meta">
										{` · erstellt ${formatDate(token.createdAt)} · ${
											token.lastUsedAt == null
												? 'noch nicht genutzt'
												: `zuletzt genutzt ${formatDate(token.lastUsedAt)}`
										}`}
									</span>
								</span>
								<span className="api-tokens__scope">
									<span className="api-tokens__scope-label">{SCOPE_LABEL[token.scope]}</span>
									<ScopeToggle
										token={token}
										disabled={scopeBusyId === token.id}
										onToggle={() => void handleToggleScope(token)}
									/>
								</span>
								{revokeId === token.id ? (
									<span className="api-tokens__confirm">
										<span className="api-tokens__confirm-question">
											Wirklich zurückziehen? Clients verlieren den Zugriff.
										</span>
										<ButtonAction onClick={() => setRevokeId(null)}>
											<KolButton _label="Abbrechen" class="settings-action-btn" _variant="secondary" _disabled={busy} />
										</ButtonAction>
										<ButtonAction onClick={() => void handleRevoke(token.id)}>
											<KolButton
												data-testid="api-token-revoke-confirm"
												_label="Endgültig zurückziehen"
												class="settings-action-btn"
												_variant="danger"
												_disabled={busy}
											/>
										</ButtonAction>
									</span>
								) : (
									<ButtonAction onClick={() => setRevokeId(token.id)}>
										<KolButton _label="Zurückziehen" class="settings-action-btn" _variant="danger" />
									</ButtonAction>
								)}
							</li>
						))}
					</ul>
				)}
			</KolCard>
		</div>
	);
};
