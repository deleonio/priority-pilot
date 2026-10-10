import type { RequestHandler } from 'express';
import { spracheAusHeader } from '../logics/careSuggestionData.js';
import { pillarTextIn, SEED_PILLARS } from '../models/pillarData.js';
import { PILLAR_DISTRIBUTION_RULE } from '../logics/pillarContributions.js';
import type { FeatureId } from '../logics/plans.js';
import { FEATURE_LABELS } from './planGuard.js';

/**
 * Englische Fassung der nutzersichtbaren API-Meldungen (`{ message }`). Schlüssel ist der deutsche
 * Wortlaut: Die Routen bleiben unverändert deutsch, {@link translateMessages} tauscht an der
 * Antwortgrenze, wenn der Request `Accept-Language: en` trägt. Unbekannte Texte bleiben deutsch —
 * bewusst ohne Entwickler-Validierungen (Feldname + „muss …“), Konfigurations- und Admin-Texte.
 * Wer eine deutsche Meldung ändert, zieht den Schlüssel hier nach.
 */

const PILLAR_DISTRIBUTION_RULE_EN =
	'A distribution must cover all pillars of the account (or the list is empty), each share must be between 5 and 80, and the sum must be 100.';

const EXAKT: Record<string, string> = {
	'Abhängiger Task (dependingTaskId) nicht gefunden.': 'Dependent task (dependingTaskId) not found.',
	'Abhängigkeit kann nicht hinzugefügt werden: Es würde ein Zyklus entstehen.':
		'Dependency cannot be added: it would create a cycle.',
	'Abhängigkeit nicht gefunden.': 'Dependency not found.',
	'Anmeldung erforderlich.': 'Sign-in required.',
	'Aufgaben lassen sich nicht an ein Duo freigeben.': 'Tasks cannot be shared with a duo.',
	'Ausgeloggt.': 'Logged out.',
	'Bitte E-Mail-Adresse und Art der Kündigung angeben.': 'Please enter an email address and the type of cancellation.',
	'Bitte Nutzungsbedingungen und Datenschutzerklärung bestätigen.':
		'Please accept the terms of use and the privacy policy.',
	'Bitte eine gültige E-Mail-Adresse angeben.': 'Please enter a valid email address.',
	'Bitte eine gültige Kalender-Adresse (http oder https) angeben.':
		'Please enter a valid calendar address (http or https).',
	'Bitte einen Grund angeben.': 'Please enter a reason.',
	'Bitte gib eine gültige E-Mail-Adresse an.': 'Please enter a valid email address.',
	'Bitte kündige zuerst dein Abo. Danach kannst du dein Konto löschen.':
		'Please cancel your subscription first. You can then delete your account.',
	'CalDAV ist auf diesem Server nicht eingerichtet. Verbinde den Kalender über seine ICS-Adresse.':
		'CalDAV is not set up on this server. Connect the calendar via its ICS address.',
	'Das Abo ist bereits gekündigt.': 'The subscription has already been cancelled.',
	'Das Konto ist bereits Mitglied dieser Gruppe.': 'This account is already a member of this group.',
	'Das Konto konnte nicht gelöscht werden.': 'The account could not be deleted.',
	'Der Anmeldecode ist abgelaufen oder wurde schon benutzt.': 'The sign-in code has expired or has already been used.',
	'Der Anmeldelink ist abgelaufen oder wurde schon benutzt.': 'The sign-in link has expired or has already been used.',
	'Die Google-Anmeldung ist ungültig.': 'The Google sign-in is invalid.',
	'Der Empfänger teilt keine Gruppe mit dir.': 'The recipient does not share a group with you.',
	'Der Kauf gehört zu einem anderen Konto.': 'The purchase belongs to a different account.',
	'Der Kauf ist nicht aktiv.': 'The purchase is not active.',
	'Der Task kann nicht auf „Erledigt“ gesetzt werden, solange noch Checkpunkte offen sind.':
		'The task cannot be set to "Done" while it still has open checkpoints.',
	'Der Task kann nicht auf „Erledigt“ gesetzt werden, solange noch offene Unteraufgaben existieren.':
		'The task cannot be set to "Done" while it still has open subtasks.',
	'Die Aufgabe eignet sich nicht für einen KI-Entwurf.': 'This task is not suitable for an AI draft.',
	'Die Aufgabe hängt an Aufgaben, die der Empfänger nicht sehen kann. Abhängigkeiten entfernen oder den Empfänger wechseln.':
		'The task depends on tasks the recipient cannot see. Remove the dependencies or choose a different recipient.',
	'Die Bildadresse muss beginnen mit https://.': 'The image address must start with https://.',
	'Die CSV-Datei enthält keine Zeilen.': 'The CSV file contains no rows.',
	'Die CSV-Datei enthält keine übernehmbaren Zeilen.': 'The CSV file contains no rows that can be imported.',
	'Die CSV-Datei hat mehr als 5000 Datenzeilen.': 'The CSV file has more than 5000 data rows.',
	'Die CSV-Datei ist größer als 10 MB.': 'The CSV file is larger than 10 MB.',
	'Die Kalender-Adresse ließ sich nicht abrufen.': 'The calendar address could not be retrieved.',
	'Die Modellliste des Providers konnte nicht geladen werden.': "The provider's model list could not be loaded.",
	'Die Token-Verwaltung ist über einen API-Token nicht erreichbar.':
		'Token management is not available via an API token.',
	'Die fünf Säulen sind fest und gelten stets. Anlegen, Umbenennen und Löschen sind gesperrt.':
		'The five pillars are fixed and always apply. Creating, renaming and deleting them is locked.',
	'Dieser Einladungslink ist nicht mehr gültig.': 'This invitation link is no longer valid.',
	'Du bist bereits Mitglied dieser Gruppe.': 'You are already a member of this group.',
	'Du bist der letzte Admin einer Gruppe mit weiteren Mitgliedern. Ernenne zuerst eine andere Person zum Admin oder löse die Gruppe auf.':
		'You are the last admin of a group with other members. Make someone else an admin first or dissolve the group.',
	'Du bist kein Mitglied dieser Gruppe.': 'You are not a member of this group.',
	'Duo nicht gefunden.': 'Duo not found.',
	'E-Mail ist bereits registriert.': 'This email address is already registered.',
	'E-Mail und Passwort sind erforderlich.': 'Email and password are required.',
	'Ein Duo hat höchstens zwei Mitglieder.': 'A duo has at most two members.',
	'Eine Aufgabe kann entweder an eine Person oder an eine Gruppe gerichtet sein.':
		'A task can be addressed either to a person or to a group.',
	'Eine Kategorie mit diesem Namen existiert bereits.': 'A category with this name already exists.',
	'Eine ruhende Serie legt keine Aufgaben an.': 'A resting series does not create any tasks.',
	'Eingebaute Provider (Mistral/OpenRouter) sind fix — sie können nicht bearbeitet oder gelöscht werden. Frei sind nur Aktivierung und Modellwahl.':
		'Built-in providers (Mistral/OpenRouter) are fixed — they cannot be edited or deleted. Only activation and model choice are open.',
	'Eingeloggt.': 'Logged in.',
	'Einladung nicht gefunden.': 'Invitation not found.',
	'Einladungslink nicht gefunden.': 'Invitation link not found.',
	'Eintrag nicht gefunden.': 'Entry not found.',
	'Es besteht bereits ein laufendes Abo.': 'There is already an active subscription.',
	'Es läuft bereits ein Abo über Google Play.': 'A subscription via Google Play is already active.',
	'Es läuft bereits ein Abo über einen anderen Anbieter.': 'A subscription via another provider is already active.',
	'Es läuft bereits eine Challenge.': 'A challenge is already running.',
	'Es läuft bereits eine Neuberechnung — erst deren Ende abwarten.':
		'A recalculation is already running — please wait until it has finished.',
	'Es sind keine Säulen konfiguriert.': 'No pillars are configured.',
	'Feedback ist aktuell nicht konfiguriert. Bitte später erneut versuchen.':
		'Feedback is not configured at the moment. Please try again later.',
	'Feedback konnte gerade nicht gespeichert werden. Bitte später erneut versuchen.':
		'Feedback could not be saved right now. Please try again later.',
	'Für CalDAV bitte Benutzername und App-Passwort angeben.': 'For CalDAV, please enter a username and an app password.',
	'Für diese Adresse ist die Anmeldung nicht freigegeben.': 'Sign-in is not enabled for this address.',
	'Für dieses Konto ist bereits eine Einladung offen.': 'An invitation is already open for this account.',
	'Gespeicherter Ort nicht gefunden.': 'Saved place not found.',
	'Google ist gerade nicht erreichbar.': 'Google cannot be reached right now.',
	'Google-OAuth ist nicht konfiguriert.': 'Google OAuth is not configured.',
	'Gruppe nicht gefunden.': 'Group not found.',
	'In der App ist kein Kauf über PayPal möglich.': 'Purchases via PayPal are not possible in the app.',
	'Interner Serverfehler.': 'Internal server error.',
	'Kalender nicht gefunden.': 'Calendar not found.',
	'Kategorie nicht gefunden.': 'Category not found.',
	'Kein API-Key angegeben — der Test kann keine Anfrage stellen.':
		'No API key provided — the test cannot send a request.',
	'Kein Abo gefunden.': 'No subscription found.',
	'Kein Modell gewählt — wähle zuerst ein Modell.': 'No model selected — please choose a model first.',
	'Keine Berechtigung.': 'Not allowed.',
	'Konto nicht gefunden.': 'Account not found.',
	'Käufe über Google Play gibt es nur in der Android-App.':
		'Purchases via Google Play are only available in the Android app.',
	'Link ungültig oder abgelaufen.': 'Link invalid or expired.',
	'Login fehlgeschlagen. Bitte prüfe deine Zugangsberechtigung.': 'Login failed. Please check your access permission.',
	'Mitglied nicht gefunden.': 'Member not found.',
	'Nicht eingeloggt.': 'Not logged in.',
	'Nicht gefunden.': 'Not found.',
	'Nur Administratoren dürfen Einladungslinks erzeugen.': 'Only administrators can create invitation links.',
	'Nur Administratoren dürfen Einladungslinks ungültig machen.': 'Only administrators can revoke invitation links.',
	'Nur Administratoren dürfen Rollen ändern.': 'Only administrators can change roles.',
	'Nur Administratoren dürfen andere Mitglieder entfernen.': 'Only administrators can remove other members.',
	'Nur Administratoren dürfen die Gruppe bearbeiten.': 'Only administrators can edit the group.',
	'Nur Administratoren dürfen einladen.': 'Only administrators can invite.',
	'Nur Administratoren sehen offene Einladungen.': 'Only administrators can see open invitations.',
	'Passwort muss 8–72 Zeichen lang sein.': 'Password must be 8–72 characters long.',
	'PayPal war nicht erreichbar.': 'PayPal could not be reached.',
	'Provider nicht gefunden.': 'Provider not found.',
	'Rechnung nicht gefunden.': 'Invoice not found.',
	'Serie nicht gefunden.': 'Series not found.',
	'Session konnte nicht gespeichert werden.': 'The session could not be saved.',
	'Session-Fehler.': 'Session error.',
	'Task nicht gefunden.': 'Task not found.',
	'Token nicht gefunden.': 'Token not found.',
	'Unbekannte Kalender-Art.': 'Unknown calendar type.',
	'Unbekanntes Abo-Produkt.': 'Unknown subscription product.',
	'Ungültige Zugangsdaten.': 'Invalid credentials.',
	'Ungültiger Anzeigename: erforderlich, 1 bis 60 Zeichen (Leerzeichen am Rand werden entfernt).':
		'Invalid display name: required, 1 to 60 characters (leading and trailing spaces are removed).',
	'Ungültiger CSRF-Token.': 'Invalid CSRF token.',
	'Vorlage nicht gefunden.': 'Template not found.',
	'Web-Push ist nicht konfiguriert (VAPID-Schlüssel fehlen).': 'Web push is not configured (VAPID keys missing).',
	'Zu viele Anfragen in kurzer Zeit. Bitte einen Moment warten.':
		'Too many requests in a short time. Please wait a moment.',
	'Die Gruppe braucht mindestens einen Administrator — ernenne zuerst eine andere Person.':
		'The group needs at least one administrator — make someone else an admin first.',
	'Der letzte Wechsel wird gerade abgerechnet — bitte später erneut versuchen.':
		'The last change is being billed right now — please try again later.',
	'Falls die Adresse zugelassen ist, ist ein Anmeldelink unterwegs.':
		'If the address is approved, a sign-in link is on its way.',
	'Bitte einen Titel angeben.': 'Please enter a title.',
	'Der Titel ist zu lang: maximal 65 Zeichen erlaubt.': 'The title is too long: at most 65 characters allowed.',
	'Bitte ein gültiges Datum (JJJJ-MM-TT) angeben.': 'Please enter a valid date (YYYY-MM-DD).',
	'Unbekannte Säule.': 'Unknown pillar.',
	'Der Kauf enthält kein Abo-Produkt.': 'The purchase does not contain a subscription product.',
	'Play Developer API nicht erreichbar.': 'Google Play could not be reached.',
	[PILLAR_DISTRIBUTION_RULE]: PILLAR_DISTRIBUTION_RULE_EN,
	[`Ungültige Säulen-Beiträge. ${PILLAR_DISTRIBUTION_RULE}`]: `Invalid pillar contributions. ${PILLAR_DISTRIBUTION_RULE_EN}`,
};

const FEATURES_EN: Record<FeatureId, string> = {
	groups: 'Groups',
	voice_input: 'Voice input',
	ai_assist: 'AI assistance',
	graph_write: 'Dependencies in the task graph',
	graph_weight: 'Weighted dependencies',
	location_reminders: 'Location reminders',
	mcp_readwrite: 'Write access via MCP',
	mcp_read: 'Read access via MCP',
	feedback: 'Feedback and app support',
	sync: 'Sync across all devices',
	knowledge_entries: 'Knowledge entries',
};

const featureEn = (label: string): string => {
	const id = (Object.keys(FEATURE_LABELS) as FeatureId[]).find((key) => FEATURE_LABELS[key] === label);
	return id ? FEATURES_EN[id] : label;
};

/** Meldungen mit eingesetzten Werten: Muster auf den deutschen Wortlaut, englische Fassung. */
const MUSTER: [RegExp, (...teile: string[]) => string][] = [
	[
		/^(.+) ist ab Paket „(.+)" verfügbar\.$/,
		(feature, plan) => `${featureEn(feature)} is available from the "${plan}" plan.`,
	],
	[/^Dein Paket erlaubt höchstens (\d+) Kalender\.$/, (n) => `Your plan allows at most ${n} calendars.`],
	[
		/^Der Gruppenname ist Pflicht und darf (\d+) Zeichen nicht überschreiten\.$/,
		(n) => `The group name is required and must not exceed ${n} characters.`,
	],
	[/^Der Zeitraum darf höchstens (\d+) Tage umfassen\.$/, (n) => `The period may span at most ${n} days.`],
	[/^Höchstens (\d+) Einträge möglich\.$/, (n) => `At most ${n} entries are possible.`],
	[/^Bitte einen Text mit 1 bis (\d+) Zeichen angeben\.$/, (n) => `Please enter a text with 1 to ${n} characters.`],
	[
		/^Bitte eine Adresse mit 1 bis (\d+) Zeichen angeben\.$/,
		(n) => `Please enter an address with 1 to ${n} characters.`,
	],
	[/^Bitte einen Namen mit 1 bis (\d+) Zeichen angeben\.$/, (n) => `Please enter a name with 1 to ${n} characters.`],
	[/^Bitte eine Laufzeit von (.+) Tagen wählen\.$/, (tage) => `Please choose a validity of ${tage} days.`],
	[
		/^Die Summe der Gewichte muss (\S+) ergeben \(aktuell (\S+)\)\.$/,
		(soll, ist) => `The weights must add up to ${soll} (currently ${ist}).`,
	],
	[/^Jede Säule braucht mindestens (\S+) % Gewicht\.$/, (n) => `Each pillar needs at least ${n} % weight.`],
	[
		/^Ungültige Dialog-Vorgaben: Text mit höchstens (\d+) Zeichen erwartet\.$/,
		(n) => `Invalid dialog instructions: text with at most ${n} characters expected.`,
	],
	[
		/^Die KI-Hilfe antwortet gerade etwas langsamer — in etwa (\d+) Sekunden geht es weiter\.$/,
		(n) => `The AI assistant is responding a little more slowly right now — it will continue in about ${n} seconds.`,
	],
	[
		/^(.+) \(Einstellungen → KI-Provider: „Testen“ zeigt die Ursache\.\)$/,
		(grund) => `${grund} (Settings → AI provider: "Test" shows the cause.)`,
	],
];

/** Englische Fassung einer API-Meldung; ohne Eintrag bleibt der deutsche Text. */
const meldungEn = (message: string): string => {
	const exakt = EXAKT[message];
	if (exakt !== undefined) {
		return exakt;
	}
	for (const [muster, en] of MUSTER) {
		const treffer = muster.exec(message);
		if (treffer) {
			return en(...treffer.slice(1));
		}
	}
	return message;
};

/** Listen/Felder, deren Einträge Säulen sind (Scores, Duo, Aufgaben-Beiträge, Begründungen). */
const SAEULEN_BEHAELTER = new Set(['saeulen', 'pillars', 'Pillars', 'saeule', 'pillar']);
const SEED_KEYS = new Set(SEED_PILLARS.map((pillar) => pillar.key));

/**
 * Englische Antwort: `message` übersetzen und Katalogtexte unveränderter Standard-Säulen tauschen —
 * nur in Säulen-Objekten (Seed-`key` oder Eintrag eines Säulen-Behälters), damit gleichnamige
 * Kategorien oder Gruppen („Sinn“) unangetastet bleiben.
 */
const bodyEn = (value: unknown, key?: string, inSaeulen = false): unknown => {
	if (typeof value === 'string') {
		if (key === 'message') return meldungEn(value);
		if (key === 'saeuleName') return pillarTextIn('en', value);
		return inSaeulen && key !== undefined && ['name', 'description', 'pillars'].includes(key)
			? pillarTextIn('en', value)
			: value;
	}
	if (Array.isArray(value)) return value.map((item) => bodyEn(item, key, SAEULEN_BEHAELTER.has(key ?? '')));
	if (value !== null && typeof value === 'object') {
		// Model-Instanzen und Datumswerte so serialisieren, wie `res.json` es täte.
		const toJson = (value as { toJSON?: () => unknown }).toJSON;
		if (typeof toJson === 'function') return bodyEn(toJson.call(value), key, inSaeulen);
		const seedKey = (value as { key?: unknown }).key;
		const saeule =
			inSaeulen || SAEULEN_BEHAELTER.has(key ?? '') || (typeof seedKey === 'string' && SEED_KEYS.has(seedKey));
		return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bodyEn(v, k, saeule)]));
	}
	return value;
};

/** Übersetzt jede JSON-Antwort ({@link bodyEn}), wenn der Request `Accept-Language: en` trägt. */
export const translateMessages: RequestHandler = (req, res, next) => {
	if (spracheAusHeader(req.get('accept-language')) === 'en') {
		const json = res.json.bind(res);
		res.json = (body?: unknown) => json(bodyEn(body));
	}
	next();
};
