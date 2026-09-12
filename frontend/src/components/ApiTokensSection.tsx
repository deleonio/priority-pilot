import { KolAlert, KolButton, KolCard, KolInputCheckbox, KolInputText, KolSelect } from '@public-ui/react-v19';
import type { ApiToken } from 'client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { CopyButton } from './CopyButton';

/** Vorbelegter Name eines neuen Tokens — ein Klick reicht, der Name bleibt änderbar. */
const DEFAULT_TOKEN_NAME = 'Externer Client';

/** Zeitpunkte in der Liste als „TT.MM.JJJJ" — die Uhrzeit trägt hier keine Entscheidung. */
const formatDate = (iso: string): string => new Date(iso).toLocaleDateString('de-DE');

/** Klartext-Label je Rechtestufe (#1356, AK8) — Farbe trägt nie allein Bedeutung. */
const SCOPE_LABEL: Record<ApiToken['scope'], string> = { read: 'Nur lesend', readwrite: 'Lesen und Schreiben' };

/**
 * Feste Laufzeiten beim Anlegen (#1357, AK1) — 365 Tage ist die Höchstlaufzeit (12 Monate). Der
 * Platzhalter ist als deaktivierte erste Option modelliert: ein natives `<select>` würde sonst
 * die erste echte Laufzeit vorauswählen, obwohl AK6 „keine Vorauswahl" verlangt.
 */
const DURATION_OPTIONS = [
	{ label: 'Bitte auswählen', value: '', disabled: true },
	{ label: '30 Tage', value: '30' },
	{ label: '90 Tage', value: '90' },
	{ label: '180 Tage', value: '180' },
	{ label: '365 Tage (12 Monate)', value: '365' },
];

/** Tippt die Laufzeit-Auswahl auf die vom Server erlaubte Whitelist (#1357, AK1); `''` = keine Wahl. */
const parseExpiresInDays = (value: string): 30 | 90 | 180 | 365 | undefined => {
	if (value === '30' || value === '90' || value === '180' || value === '365')
		return Number(value) as 30 | 90 | 180 | 365;
	return undefined;
};

/** Ob ein Ablaufdatum bereits in der Vergangenheit liegt (#1357, AK7). */
const isExpired = (iso: string): boolean => new Date(iso).getTime() <= Date.now();

/**
 * Ablaufdatum als „TT.MM.JJJJ" (#1357, AK7) — mit führenden Nullen, anders als `formatDate`
 * (dessen `toLocaleDateString('de-DE')` Tag/Monat einstellig lässt, z. B. „1.1.2027").
 */
const formatExpiryDate = (iso: string): string => {
	const date = new Date(iso);
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	return `${day}.${month}.${date.getFullYear()}`;
};

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
	// Laufzeit-Auswahl (#1357, AK6) — leer = keine Auswahl getroffen, Pflichtfeld ohne Vorauswahl.
	const [expiresInDays, setExpiresInDays] = useState('');
	const durationSelectRef = useRef<HTMLKolSelectElement>(null);

	// KolSelect rendert die native `<select>` im offenen Shadow DOM des Hosts (`kol-select-wc`
	// hat selbst KEIN eigenes Shadow DOM, sondern rendert scoped direkt in den Shadow-Baum des
	// Hosts) — ein `data-testid` nur auf dem Host würde bei E2E-Interaktionen (`selectOption`) ins
	// Leere laufen, weil Playwright dafür das native `<select>`-Element selbst braucht. Hydration
	// läuft asynchron, daher MutationObserver statt einmaligem Query direkt nach dem Mount — und
	// der Observer muss auf dem `shadowRoot` selbst sitzen (nicht auf dem Host-Element), sonst
	// sieht er Mutationen im Shadow-Baum gar nicht (MutationObserver überquert Shadow-Grenzen beim
	// Beobachten des Hosts nicht automatisch).
	// `data-testid` wird bewusst NICHT als JSX-Prop auf `KolSelect` gesetzt, sondern nur
	// imperativ über diesen Effekt: der React-Wrapper (`@public-ui/react-v19`) schreibt in
	// `componentDidUpdate` bei JEDEM Prop-Wechsel (z. B. `_value` nach der Laufzeit-Auswahl) alle
	// String-Props per `setAttribute` erneut auf den Host — ein per JSX gesetztes `data-testid`
	// käme dadurch nach der ersten Auswahl zurück und ergäbe zwei Treffer (Host + natives
	// `<select>`, Strict-Mode-Verletzung bei Playwright). Imperativ gesetzt, taucht es in
	// `Object.keys(props)` des Wrappers nicht auf und wird nie erneut angefasst. Der Host trägt
	// das Attribut zunächst selbst (Unit-Test-Pfad: jsdom hydriert KoliBri nicht, `shadowRoot`
	// bleibt dort `null`); sobald die native `<select>` real existiert, wandert es dorthin, damit
	// genau ein Element matcht.
	useEffect(() => {
		const host = durationSelectRef.current;
		if (!host) return;
		host.setAttribute('data-testid', 'api-token-duration-select');
		const shadowRoot = host.shadowRoot;
		if (!shadowRoot) return;
		const tagNativeSelect = (): boolean => {
			const native = shadowRoot.querySelector('select');
			if (native) {
				native.setAttribute('data-testid', 'api-token-duration-select');
				host.removeAttribute('data-testid');
				return true;
			}
			return false;
		};
		if (tagNativeSelect()) return;
		const observer = new MutationObserver(() => {
			if (tagNativeSelect()) observer.disconnect();
		});
		observer.observe(shadowRoot, { childList: true, subtree: true });
		return () => observer.disconnect();
	}, []);
	// Klartext des zuletzt erzeugten Tokens — nur im Speicher dieser Sitzung, nie erneut abrufbar.
	const [plaintext, setPlaintext] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	// Id des Tokens, für den die Rückfrage „wirklich zurückziehen?" gerade offen steht.
	const [revokeId, setRevokeId] = useState<number | null>(null);
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
		// Ohne gewählte Laufzeit ist der Klick wirkungslos (#1357, AK6) — kein API-Aufruf.
		const days = parseExpiresInDays(expiresInDays);
		if (days === undefined) return;
		setError(null);
		setBusy(true);
		try {
			const { token, ...meta } = await api.createApiToken({ name: name.trim(), expiresInDays: days });
			setPlaintext(token);
			setTokens((previous) => [...previous, meta]);
			setName(DEFAULT_TOKEN_NAME);
			setExpiresInDays('');
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
					<KolSelect
						ref={durationSelectRef}
						_label="Laufzeit"
						_options={DURATION_OPTIONS}
						_value={expiresInDays}
						_on={{ onChange: (_event, value) => setExpiresInDays(String(value)) }}
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
						<div className="copy-row">
							<span className="api-tokens__plaintext" data-testid="mcp-url">
								{MCP_URL}
							</span>
							<CopyButton text={MCP_URL} ariaLabel="URL kopieren" onError={(message) => setError(message)} />
						</div>
						<span>Header-Konfiguration für externe Clients (z. B. Claude-Connector):</span>
						<span className="api-tokens__plaintext">Authorization: Bearer &lt;Token&gt;</span>
						<span className="api-tokens__plaintext">api-key: &lt;Token&gt;</span>
					</div>
					{plaintext !== null && (
						<KolAlert _type="info" _label="Token einmalig sichtbar">
							<div className="copy-row">
								<span className="api-tokens__plaintext" data-testid="api-token-plaintext">
									{plaintext}
								</span>
								<CopyButton text={plaintext} ariaLabel="Token kopieren" onError={(message) => setError(message)} />
							</div>
						</KolAlert>
					)}
				</div>
			</KolCard>

			<KolCard className="settings-card" _label="Vergebene Tokens" _level={2}>
				{/*
					#1358: Die Herabstufung war vorher nirgends sichtbar — ein Token, das gestern noch
					schreiben durfte, meldete nach dem Update nur einen Fehler im MCP-Client.
				*/}
				<p className="api-tokens__scope-hint">
					Ein Token liest standardmäßig nur. Schreibende MCP-Werkzeuge wie <code>task_create</code> melden einen Fehler,
					solange der Schalter auf „Nur lesend" steht — auch bei Tokens, die vor dieser Einstellung vergeben wurden.
				</p>
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
										}${
											token.expiresAt == null
												? ''
												: ` · gültig bis ${formatExpiryDate(token.expiresAt)}${isExpired(token.expiresAt) ? ' (abgelaufen)' : ''}`
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
