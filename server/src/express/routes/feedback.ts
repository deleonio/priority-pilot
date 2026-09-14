import { Router } from 'express';
import type { Request, Response } from 'express';
import { sendError } from '../http-error.js';
import { readAppVersion } from '../../logics/appInfo.js';
import { githubObsidianClient, type ObsidianGithubClient } from '../../logics/obsidianFeedback.js';

type ErrorDto = { message: string };

/** Erlaubte Feedback-Kategorien (Issue #1435, AK4) — alles andere ist ein 400. */
const CATEGORIES = ['bug', 'feature', 'idee', 'frage'] as const;
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

/**
 * Router für `POST /feedback` (Issue #1435). Auth via Session — `requireAuth` ist in
 * `index.ts` VOR diesem Router registriert, der Endpunkt ist also nie anonym erreichbar (AK7).
 * Der GitHub-Zugriff läuft über den injizierbaren {@link ObsidianGithubClient}.
 */
export const createFeedbackRouter = ({
	obsidianGithubClient = githubObsidianClient,
}: { obsidianGithubClient?: ObsidianGithubClient } = {}): Router => {
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

		try {
			// Branch zuerst sicherstellen — ohne ihn würde die Contents-API auf `main` schreiben.
			if ((await obsidianGithubClient.getBranchSha(repo, branch)) === null) {
				await obsidianGithubClient.createBranch(repo, branch, SOURCE_BRANCH);
			}
			await obsidianGithubClient.commitFile(repo, branch, path, buildContent(validation.value, user, now));
			res.status(201).json({ path });
		} catch (error) {
			// #1465: Ohne Log war ein Fehlschlag von außen wie von innen unsichtbar — der Grund stand
			// nirgends. Die Meldungen aus `obsidianFeedback.ts` nennen nur Methode, Pfad und Status
			// (kein Tokenwert, kein Upstream-Body), sind also loggbar. Muster: `routes/auth.ts`.
			console.error('Feedback konnte nicht gespeichert werden:', error instanceof Error ? error.message : error);
			// Upstream-Fehlertext bewusst verschlucken (PAT/Details dürfen nicht nach außen).
			sendError(res, 502, 'Feedback konnte gerade nicht gespeichert werden. Bitte später erneut versuchen.');
		}
	});

	return router;
};
