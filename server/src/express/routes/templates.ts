import { Router } from 'express';
import type { Request, Response } from 'express';
import type { components } from '../../api';
import sequelize from '../../database.js';
import { TEMPLATES, type LifeTemplate } from '../../logics/templates.js';
import { Category, Dependency, Task } from '../../models/index.js';
import { sendError, handleWriteError, type ErrorDto } from '../http-error.js';
import { getUserId, ownerScope } from '../requireAuth.js';

type PreviewDto = components['schemas']['TemplatePreview'];
type ApplyResultDto = components['schemas']['TemplateApplyResult'];

const findTemplate = (slug: string): LifeTemplate | undefined => TEMPLATES.find((entry) => entry.slug === slug);

/**
 * Vorlagen als importierbare Aufgabenpakete (#1993, Spec `docs/spec/issue-1993.md`): Vorschau
 * (nur lesen) und Übernahme in EINER Transaktion — Aufgaben, Abhängigkeiten und Kategorie
 * entstehen ganz oder gar nicht. Router hängt hinter dem globalen `requireAuth`.
 */
export const templatesRouter = Router();

templatesRouter.get('/templates/:slug/preview', (req: Request, res: Response<PreviewDto | ErrorDto>) => {
	const template = findTemplate(String(req.params.slug));
	if (!template) {
		sendError(res, 404, 'Vorlage nicht gefunden.');
		return;
	}
	res.json({
		slug: template.slug,
		title: template.title,
		taskCount: template.steps.length,
		dependencyCount: template.steps.reduce((sum, step) => sum + step.after.length, 0),
		steps: template.steps,
	});
});

templatesRouter.post('/templates/:slug/apply', async (req: Request, res: Response<ApplyResultDto | ErrorDto>) => {
	const template = findTemplate(String(req.params.slug));
	if (!template) {
		sendError(res, 404, 'Vorlage nicht gefunden.');
		return;
	}
	const userId = getUserId(req);
	try {
		const taskIds = await sequelize.transaction(async (transaction) => {
			// Kategorie des Nutzers mit gleichem Namen wiederverwenden (Name ist pro Nutzer eindeutig).
			const category =
				(await Category.findOne({ where: { name: template.title, ...ownerScope(userId) }, transaction })) ??
				(await Category.create({ name: template.title, userId: userId ?? null }, { transaction }));
			const idByStep = new Map<string, number>();
			for (const step of template.steps) {
				const task = await Task.create({ title: step.title, categoryId: category.id, userId }, { transaction });
				idByStep.set(step.id, task.id);
			}
			const edges = template.steps.flatMap((step) =>
				step.after.map((before) => ({
					dependentTaskId: idByStep.get(step.id),
					dependingTaskId: idByStep.get(before),
				})),
			);
			await Dependency.bulkCreate(edges, { transaction });
			return [...idByStep.values()];
		});
		res.status(201).json({ taskIds });
	} catch (error) {
		handleWriteError(res, error);
	}
});
