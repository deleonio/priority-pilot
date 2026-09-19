import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { readAppVersion } from '../../logics/appInfo.js';
import { githubObsidianClient, type ObsidianGithubClient } from '../../logics/obsidianFeedback.js';
import { isMailConfigured, sendMailToUser, type MailSender } from '../../logics/mail.js';
import { User } from '../../models/index.js';

type ErrorDto = { message: string };

/** Erlaubte Feedback-Kategorien (Issue #1435, in #1475 auf drei konsolidiert) — alles andere ist ein 400. */
const CATEGORIES = ['frage', 'wunsch', 'bug'] as const;
type Category = (typeof CATEGORIES)[number];

/** Code-Defaults der Konfiguration; überschreibbar über die `FEEDBACK_GITHUB_*`-Variablen. */
const DEFAULT_REPO = 'deleonio/Obsidian';
const DEFAULT_BRANCH = 'app-feedback';
const DEFAULT_DIR = 'Feedback';
/** Quell-Branch, von dem der Feedback-Branch bei Bedarf abgezweigt wird (AK6). */
const SOURCE_BRANCH = 'main';

interface FeedbackInput {
	category: Category;
	title: string;
	description: string;
}

/** Validiert den Body von `POST /feedback` (AK4): Kategorie aus der Liste, Titel und Text gefüllt. */
const validateBody = (body: unknown): { ok: true; value: FeedbackInput } | { ok: false; message: string } => {
	if (typeof body !== 'object' || body === null) {
		return { ok: false, message: 'Request-Body muss ein Objekt sein.' };
	}
	const { category, title, description } = body as Record<string, unknown>;

	if (typeof category !== 'string' || !CATEGORIES.includes(category as Category)) {
		return { ok: false, message: `kategorie muss einer von ${CATEGORIES.join(', ')} sein.` };
	}
	if (typeof title !== 'string' || title.trim() === '') {
		return { ok: false, message: 'title darf nicht leer sein.' };
	}
	if (typeof description !== 'string' || description.trim() === '') {
		return { ok: false, message: 'description darf nicht leer sein.' };
	}

	return { ok: true, value: { category: category as Category, title: title.trim(), description: description.trim() } };
};

/** Titel → dateinamentauglicher Slug (Kleinbuchstaben, Umlaute aufgelöst, max. 60 Zeichen). */
const slugify = (title: string): string => {
	const slug = title
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60)
		.replace(/-+$/g, '');
	return slug === '' ? 'feedback' : slug;
};

/**
 * Dateipfad im Vault (AK2): `<dir>/<YYYY-MM-DD>-<kategorie>-<slug>-<zufall>.md`. Der
 * Zufallssuffix verhindert, dass zwei Einreichungen mit gleichem Titel am selben Tag
 * kollidieren (die Contents-API würde die zweite sonst als Update ohne SHA ablehnen).
 */
const buildPath = (dir: string, input: FeedbackInput, now: Date): string => {
	const day = now.toISOString().slice(0, 10);
	const suffix = Math.random().toString(36).slice(2, 8);
	return `${dir}/${day}-${input.category}-${slugify(input.title)}-${suffix}.md`;
};

/** Markdown mit YAML-Frontmatter nach der Vorlage aus dem Ticket (AK3). */
const buildContent = (input: FeedbackInput, user: string, now: Date): string =>
	[
		'---',
		`datum: ${now.toISOString()}`,
		`kategorie: ${input.category}`,
		`nutzer: ${JSON.stringify(user)}`,
		`appVersion: ${JSON.stringify(readAppVersion())}`,
		'quelle: app-feedback',
		'---',
		'',
		`# ${input.title}`,
		'',
		input.description,
		'',
	].join('\n');

/** Betreff/Text der Admin-Benachrichtigung (AK2): keine Tokenwerte, keine Zugangsdaten. */
const buildAdminMail = (input: FeedbackInput, user: string): { subject: string; text: string } => ({
	subject: `Neues Feedback (${input.category}): ${input.title}`,
	text: [
		`Kategorie: ${input.category}`,
		`Titel: ${input.title}`,
		'',
		input.description,
		'',
		`Nutzer: ${user}`,
		`App-Version: ${readAppVersion()}`,
		'',
	].join('\n'),
});

/**
 * Benachrichtigt alle Admin-Nutzer per Mail (Issue #1502, AK1). Läuft unabhängig vom
 * Ausgang des Obsidian-Commits (AK5) — der Aufrufer ruft dies nach dem try/catch-Block auf.
 * Ohne SMTP-Konfiguration wird kein Versandversuch gemacht (AK3); Transportfehler werden
 * bereits von {@link sendMailToUser} verschluckt und ohne Details geloggt (AK4).
 */
const notifyAdmins = async (input: FeedbackInput, user: string, mailSender?: MailSender): Promise<void> => {
	if (!isMailConfigured()) {
		return;
	}
	const admins = await User.findAll({ where: { role: 'admin' } });
	const mail = buildAdminMail(input, user);
	for (const admin of admins) {
		await sendMailToUser({ email: admin.email }, mail, mailSender);
	}
};

/**
 * Router für `POST /feedback` (Issue #1435). Auth via Session — `requireAuth` ist in
 * `index.ts` VOR diesem Router registriert, der Endpunkt ist also nie anonym erreichbar (AK7).
 * Der GitHub-Zugriff läuft über den injizierbaren {@link ObsidianGithubClient}. Zusätzlich
 * werden alle Admin-Nutzer per Mail informiert (Issue #1502) — über den injizierbaren
 * {@link MailSender}.
 */
export const createFeedbackRouter = ({
	obsidianGithubClient = githubObsidianClient,
	mailSender,
}: { obsidianGithubClient?: ObsidianGithubClient; mailSender?: MailSender } = {}): Router => {
	const router = Router();

	router.post('/feedback', async (req: Request, res: Response<{ path: string } | ErrorDto>) => {
		const validation = validateBody(req.body);
		if (!validation.ok) {
			sendError(res, 400, validation.message);
			return;
		}

		// Fehlkonfiguration (kein PAT) ist kein Nutzerfehler: 503 statt 500, ohne Tokenbezug im Text.
		if (!process.env.FEEDBACK_GITHUB_TOKEN?.trim()) {
			sendError(res, 503, 'Feedback ist aktuell nicht konfiguriert. Bitte später erneut versuchen.');
			return;
		}

		const repo = process.env.FEEDBACK_GITHUB_REPO?.trim() || DEFAULT_REPO;
		const branch = process.env.FEEDBACK_GITHUB_BRANCH?.trim() || DEFAULT_BRANCH;
		const dir = process.env.FEEDBACK_GITHUB_DIR?.trim() || DEFAULT_DIR;
		const now = new Date();
		const path = buildPath(dir, validation.value, now);
		const user = req.session?.user?.email ?? 'unbekannt';

		let commitFailed = false;
		try {
			// Branch zuerst sicherstellen — ohne ihn würde die Contents-API auf `main` schreiben.
			if ((await obsidianGithubClient.getBranchSha(repo, branch)) === null) {
				await obsidianGithubClient.createBranch(repo, branch, SOURCE_BRANCH);
			}
			await obsidianGithubClient.commitFile(repo, branch, path, buildContent(validation.value, user, now));
		} catch (error) {
			// #1465: Ohne Log war ein Fehlschlag von außen wie von innen unsichtbar — der Grund stand
			// nirgends. Die Meldungen aus `obsidianFeedback.ts` nennen nur Methode, Pfad und Status
			// (kein Tokenwert, kein Upstream-Body), sind also loggbar. Muster: `routes/auth.ts`.
			console.error('Feedback konnte nicht gespeichert werden:', error instanceof Error ? error.message : error);
			commitFailed = true;
		}

		// #1502: läuft unabhängig vom Ausgang des Commits (AK5) — und wird VOR der Response
		// abgewartet, damit der Mailversand für den Aufrufer bereits abgeschlossen ist.
		await notifyAdmins(validation.value, user, mailSender);

		if (commitFailed) {
			// Upstream-Fehlertext bewusst verschlucken (PAT/Details dürfen nicht nach außen).
			sendError(res, 502, 'Feedback konnte gerade nicht gespeichert werden. Bitte später erneut versuchen.');
			return;
		}
		res.status(201).json({ path });
	});

	return router;
};
