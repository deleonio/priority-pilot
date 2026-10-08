import {
	KolAccordion,
	KolAlert,
	KolButton,
	KolHeading,
	KolInputCheckbox,
	KolInputText,
	KolSelect,
} from '@public-ui/react-v19';
import type { ApiToken } from 'client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { api } from '../api';
import { toApiError } from '../lib/apiError';
import { planLabel } from '../lib/planOffers';
import { useFollowingOpen } from '../lib/useFollowingOpen';
import { useEntitlement } from '../lib/usePlan';
import { getPublicOrigin } from '../lib/siteOrigin';
import { FeaturePopoverButton } from './FeaturePopoverButton';
import { CopyButton } from './CopyButton';

/** Zeitpunkte in der Liste als „TT.MM.JJJJ" — die Uhrzeit trägt hier keine Entscheidung. */
const formatDate = (iso: string, language: string): string => new Date(iso).toLocaleDateString(language);

/**
 * Feste Laufzeiten beim Anlegen (#1357, AK1) — 365 Tage ist die Höchstlaufzeit (12 Monate). Der
 * Platzhalter ist als deaktivierte erste Option modelliert: ein natives `<select>` würde sonst
 * die erste echte Laufzeit vorauswählen, obwohl AK6 „keine Vorauswahl" verlangt.
 */
const DURATION_OPTIONS = [
	{ labelKey: 'apiTokens.durationPlaceholder', value: '', disabled: true },
	{ labelKey: 'apiTokens.duration30', value: '30' },
	{ labelKey: 'apiTokens.duration90', value: '90' },
	{ labelKey: 'apiTokens.duration180', value: '180' },
	{ labelKey: 'apiTokens.duration365', value: '365' },
] as const;

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
const formatExpiryDate = (iso: string, language: string): string =>
	new Date(iso).toLocaleDateString(language, { day: '2-digit', month: '2-digit', year: 'numeric' });

/** MCP-Endpunkt dieser App — aus der aktuellen Origin abgeleitet, damit er in jeder Umgebung stimmt. */
const MCP_URL = `${getPublicOrigin()}/api/v1/mcp/v1`;

/**
 * Aktions-Hülle um einen `KolButton`: der Klick wird am umgebenden Element abgefangen statt über
 * `_on` am Web-Component. Grund ist die Testbarkeit (#1352): `kol-button` ist in jsdom kein
 * definiertes Custom Element, `_on` bleibt dort eine reine Property und ein echter Klick liefe ins
 * Leere. Der Klick des internen Buttons ist `composed` und verlässt den Shadow-Root — im Browser
 * wie im Test landet er damit genau einmal hier.
 */
export const ButtonAction = ({ onClick, children }: { onClick: () => void; children: ReactNode }) => (
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
const ScopeToggle = ({ token, disabled, onToggle }: { token: ApiToken; disabled: boolean; onToggle: () => void }) => {
	const { t } = useTranslation('settings');
	return (
		<KolInputCheckbox
			_variant="switch"
			_label={t('apiTokens.scopeToggle', { name: token.name })}
			_hideLabel={true}
			_checked={token.scope === 'readwrite'}
			_disabled={disabled}
			data-testid="api-token-scope-toggle"
			_on={{ onChange: () => onToggle() }}
		/>
	);
};

/**
 * Einstellungen → „KI" → Karte „Access-Token" (#1903): persönliche API-Tokens für externe Clients (#1352). Ein Klick auf
 * „Token erzeugen" legt einen Token an und zeigt seinen Klartext **genau einmal** — danach kennt
 * der Server nur noch dessen Hash und die Liste zeigt ausschließlich Metadaten (Name, Erstellung,
 * letzte Nutzung). „Zurückziehen" sperrt den Token ab dem nächsten Aufruf.
 *
 * Aufbau wie `LlmSettings.tsx`: ein `KolAccordion`, das `open` folgt (Schalter
 * „KI aktivieren"; Token bleiben auch bei „aus" gültig), `ul`/`li` mit Zeilen-Aktionen
 * statt Tabelle (Mobile-Regel 3). Der Rückzug läuft über eine zweistufige Bestätigung direkt in
 * der Zeile (Progressive Disclosure, `docs/ux-pattern-sequential-confirmation.md`): kein einzelner
 * Klick löst die irreversible Aktion aus.
 */
export const ApiTokensSection = ({ open = true }: { open?: boolean }) => {
	const { t, i18n } = useTranslation(['settings', 'common']);
	const accordion = useFollowingOpen(open);
	const [tokens, setTokens] = useState<ApiToken[] | null>(null);
	// Vorbelegter Name eines neuen Tokens — ein Klick reicht, der Name bleibt änderbar.
	const defaultTokenName = t('apiTokens.defaultName');
	const [name, setName] = useState(defaultTokenName);
	const durationOptions = DURATION_OPTIONS.map(({ labelKey, ...option }) => ({ ...option, label: t(labelKey) }));
	// Laufzeit-Auswahl (#1357, AK6) — leer = keine Auswahl getroffen, Pflichtfeld ohne Vorauswahl.
	const [expiresInDays, setExpiresInDays] = useState('');
	const durationSelectRef = useRef<HTMLKolSelectElement>(null);

	// #1526 AK2/AK4/AK7: `undefined` (kein Entitlement geladen) sperrt bewusst NICHT zusätzlich —
	// erst eine bekannte, ablehnende Serverantwort (`allowed === false`) sperrt Formular bzw. Regler.
	const readEntitlement = useEntitlement('mcp_read');
	const readwriteEntitlement = useEntitlement('mcp_readwrite');
	const formLocked = readEntitlement !== undefined && !readEntitlement.allowed;
	const scopeLocked = readwriteEntitlement !== undefined && !readwriteEntitlement.allowed;

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
	// Eigener Ladefehler für die Liste (#1646) — getrennt von `error` (Formular), damit Fehler und
	// Leer-Zustand im Detail „Vorhandene Access-Token" nie gleichzeitig erscheinen (Muster: SubscriptionSection).
	const [loadError, setLoadError] = useState<string | null>(null);
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
				if (active) setLoadError(t('apiTokens.loadError'));
			});
		return () => {
			active = false;
		};
	}, [t]);

	const handleCreate = async (): Promise<void> => {
		// Ohne gewählte Laufzeit ist der Klick wirkungslos (#1357, AK6) — kein API-Aufruf.
		const days = parseExpiresInDays(expiresInDays);
		if (days === undefined) return;
		setError(null);
		setBusy(true);
		try {
			const { token, ...meta } = await api.createApiToken({ name: name.trim(), expiresInDays: days });
			setPlaintext(token);
			setTokens((previous) => [...(previous ?? []), meta]);
			setName(defaultTokenName);
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
			setTokens((previous) => previous?.map((entry) => (entry.id === token.id ? updated : entry)) ?? previous);
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
			setTokens((previous) => previous?.filter((entry) => entry.id !== id) ?? previous);
			setRevokeId(null);
		} catch (reason) {
			setError((await toApiError(reason)).message);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="api-tokens" data-testid="api-tokens-panel">
			<KolAccordion className="settings-card" _label={t('apiTokens.title')} _level={2} _disabled={!open} {...accordion}>
				<p>{t('apiTokens.intro')}</p>
				<KolHeading _label={t('apiTokens.createHeading')} _level={3} />
				<>
					<div className="api-tokens__create">
						<p>{t('apiTokens.createText')}</p>
						{/* #1526 AK2: fehlt `mcp_read`, ist das gesamte Erzeugen-Formular gesperrt — der Alert
						    steht direkt darüber, damit die Sperrung sofort erklärt ist. */}
						{readEntitlement !== undefined && !readEntitlement.allowed && (
							<FeaturePopoverButton label={t('apiTokens.planRequired')}>
								{t('apiTokens.createPlanText', { plan: planLabel(readEntitlement.requiredPlan) })}
							</FeaturePopoverButton>
						)}
						<KolInputText
							_label={t('apiTokens.nameLabel')}
							_type="search"
							_value={name}
							_disabled={formLocked}
							_on={{ onInput: (_event, value) => setName(String(value)) }}
						/>
						<KolSelect
							ref={durationSelectRef}
							_label={t('apiTokens.durationLabel')}
							_options={durationOptions}
							_value={expiresInDays}
							_disabled={formLocked}
							_on={{ onChange: (_event, value) => setExpiresInDays(String(value)) }}
						/>
						<ButtonAction onClick={() => void handleCreate()}>
							<KolButton
								_label={t('apiTokens.create')}
								class="settings-action-btn"
								_variant="primary"
								_disabled={busy || formLocked}
							/>
						</ButtonAction>
						{error !== null && (
							<KolAlert _type="error" _label={t('apiTokens.errorLabel')}>
								{error}
							</KolAlert>
						)}
						<div className="api-tokens__mcp-url">
							<span>{t('apiTokens.mcpEndpoint')}</span>
							<div className="copy-row">
								<span className="api-tokens__plaintext" data-testid="mcp-url">
									{MCP_URL}
								</span>
								<CopyButton
									text={MCP_URL}
									ariaLabel={t('apiTokens.copyUrl')}
									onError={(message) => setError(message)}
								/>
							</div>
							<span>{t('apiTokens.headerConfig')}</span>
							<span className="api-tokens__plaintext">Authorization: Bearer &lt;Token&gt;</span>
							<span className="api-tokens__plaintext">api-key: &lt;Token&gt;</span>
						</div>
						{plaintext !== null && (
							<KolAlert _type="info" _label={t('apiTokens.plaintextLabel')}>
								<div className="copy-row">
									<span className="api-tokens__plaintext" data-testid="api-token-plaintext">
										{plaintext}
									</span>
									<CopyButton
										text={plaintext}
										ariaLabel={t('apiTokens.copyToken')}
										onError={(message) => setError(message)}
									/>
								</div>
							</KolAlert>
						)}
					</div>
				</>
				<KolHeading _label={t('apiTokens.listHeading')} _level={3} />
				<>
					{/*
						#1358: Die Herabstufung war vorher nirgends sichtbar — ein Token, das gestern noch
						schreiben durfte, meldete nach dem Update nur einen Fehler im MCP-Client.
					*/}
					<p className="api-tokens__scope-hint">
						<Trans t={t} i18nKey="apiTokens.scopeHint" components={{ code: <code /> }} />
					</p>
					{loadError !== null ? (
						<KolAlert _type="error" _label={t('apiTokens.errorLabel')}>
							{loadError}
						</KolAlert>
					) : tokens === null ? null : tokens.length === 0 ? (
						<p>{t('apiTokens.empty')}</p>
					) : (
						<ul className="api-tokens__list">
							{tokens.map((token) => (
								<li key={token.id} className="api-tokens__item" data-testid="api-token-row">
									<span className="api-tokens__name">
										{token.name}
										<span className="api-tokens__meta">
											{` · ${t('apiTokens.created', { date: formatDate(token.createdAt, i18n.language) })} · ${
												token.lastUsedAt == null
													? t('apiTokens.notUsed')
													: t('apiTokens.lastUsed', { date: formatDate(token.lastUsedAt, i18n.language) })
											}${
												token.expiresAt == null
													? ''
													: ` · ${t('apiTokens.validUntil', { date: formatExpiryDate(token.expiresAt, i18n.language) })}${isExpired(token.expiresAt) ? ` ${t('apiTokens.expired')}` : ''}`
											}`}
										</span>
									</span>
									<span className="api-tokens__scope-group">
										<span className="api-tokens__scope">
											<span className="api-tokens__scope-label">
												{t(token.scope === 'readwrite' ? 'apiTokens.scopeReadwrite' : 'apiTokens.scopeRead')}
											</span>
											<ScopeToggle
												token={token}
												disabled={scopeBusyId === token.id || scopeLocked}
												onToggle={() => {
													// #1526 AK4: `_disabled` verhindert nur den echten Browser-Klick — der Guard hier
													// hält den Regler auch dann wirkungslos, wenn `onChange` direkt ausgelöst wird.
													if (!scopeLocked) void handleToggleScope(token);
												}}
											/>
										</span>
										{/* #1526 AK4/AK6: löst das freischwebende `PlanBadge` ab — die Erklärung steht jetzt
										    unterhalb der Scope-Zeile, direkt neben dem gesperrten Regler. */}
										{readwriteEntitlement !== undefined && !readwriteEntitlement.allowed && (
											<FeaturePopoverButton label={t('apiTokens.planRequired')}>
												{t('apiTokens.readwritePlanText', { plan: planLabel(readwriteEntitlement.requiredPlan) })}
											</FeaturePopoverButton>
										)}
									</span>
									{revokeId === token.id ? (
										<span className="api-tokens__confirm">
											<span className="api-tokens__confirm-question">{t('apiTokens.revokeQuestion')}</span>
											<ButtonAction onClick={() => setRevokeId(null)}>
												<KolButton
													_label={t('common:actions.cancel')}
													class="settings-action-btn"
													_variant="secondary"
													_disabled={busy}
												/>
											</ButtonAction>
											<ButtonAction onClick={() => void handleRevoke(token.id)}>
												<KolButton
													data-testid="api-token-revoke-confirm"
													_label={t('apiTokens.revokeConfirm')}
													class="settings-action-btn"
													_variant="danger"
													_disabled={busy}
												/>
											</ButtonAction>
										</span>
									) : (
										<ButtonAction onClick={() => setRevokeId(token.id)}>
											<KolButton _label={t('apiTokens.revoke')} class="settings-action-btn" _variant="danger" />
										</ButtonAction>
									)}
								</li>
							))}
						</ul>
					)}
				</>
			</KolAccordion>
		</div>
	);
};
