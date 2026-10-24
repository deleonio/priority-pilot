import { KolBadge } from '@public-ui/react-v19';
import type { Category, Task } from 'client';
import { useTranslation } from 'react-i18next';
import { virtualPriorityLabel, type BalancePriority } from '../lib/balancePriority';
import { BADGE_COLOR, PRIORITY_COLOR } from '../lib/badgeColors';
import { seriesBadge } from '../lib/series';
import { priorityBadge } from '../lib/task';
import { CategoryBadge } from './CategoryBadge';
import { PillarMissingBadge } from './PillarMissingBadge';
import { PinnedBadge } from './PinnedBadge';
import { SeriesBadge } from './SeriesBadge';

/** i18n-Schlüssel des Anzeigenamens der KI-Eignungs-Kategorie (#2349). */
const AI_SUITABILITY_LABEL = {
	draft: 'taskTree.aiSuitability.draft',
	summary: 'taskTree.aiSuitability.summary',
	research: 'taskTree.aiSuitability.research',
} as const;

/** Stabiler Default für `seriesById` (kein neues Map-Objekt je Render). */
const NO_SERIES: ReadonlyMap<number, { autoCreate?: boolean }> = new Map();

interface TaskBadgesProps {
	/** Die Aufgabe; `null` (Baumknoten ohne geladenen Task) zeigt nur die kontextlosen Badges. */
	task: Task | null;
	/** Kategorie-ID der Aufgabe/Serie — löst das Kategorie-Badge auf; ohne Kontext (Leseseite) entfällt es. */
	categoryId?: number | null;
	/** Kategorien des Nutzers — ohne sie kann die `categoryId` nicht zum Badge aufgelöst werden. */
	categories?: Category[];
	/** Hat der Nutzer überhaupt Säulen angelegt? Nur dann ist ein fehlender Beitrag eine Aussage. */
	pillarsConfigured?: boolean;
	/** Fortschritt (erledigt/gesamt) des Knotens; ohne Eintrag hat der Task keine Unter-Tasks. */
	progress?: { done: number; total: number };
	/** ID des angemeldeten Kontos (#1213) — unterscheidet „Erstellt von: …“ von „Für: …“. */
	userId?: number | null;
	/** Serien des Nutzers je ID (#2359): Aufgaben aus Vorlagen tragen „Vorlage“ statt des Serien-Icons. */
	seriesById?: ReadonlyMap<number, { autoCreate?: boolean }>;
	/** Virtuelle Balance-Priorität dieses Tasks; `null` → Original-P-Badge. */
	balancePriority?: BalancePriority | null;
}

/**
 * Badge-Zeile einer Aufgabe (#2938): die gemeinsame Zeile aus `TaskTree` (Konzept
 * `docs/ux-konzept-ansichten.md` Abschnitt 9 — herausgelöst statt kopiert), damit der
 * Aufgabenbaum und die neue Leseseite `/aufgaben/<id>` dieselben Badges zeigen. Ohne
 * Kontext-Prop (Kategorien, Säulen, Serie, Fortschritt) entfällt der jeweilige Badge
 * still — „Leer bleibt leer“.
 */
export const TaskBadges = ({
	task,
	categoryId = null,
	categories,
	pillarsConfigured = false,
	progress,
	userId = null,
	seriesById = NO_SERIES,
	balancePriority = null,
}: TaskBadgesProps) => {
	const { t } = useTranslation(['tasks', 'common']);
	const priority = task?.priority ?? 1;
	// Im Balance-Modus zeigt das Badge die virtuelle Priorität (~P{n}, eigene Farbe nach Stufe)
	// statt der Server-Prio — unterscheidbar per Tilde-Präfix, nie nur per Farbe (KI-UX).
	const priorityBadgeInfo = priorityBadge(balancePriority?.virtualPriority ?? priority);
	const priorityBadgeLabel =
		balancePriority != null ? virtualPriorityLabel(balancePriority.virtualPriority) : priorityBadgeInfo.label;
	const priorityColor = PRIORITY_COLOR[priorityBadgeInfo.type];
	// #2359: Aufgabe aus einer Vorlage — Text-Badge „Vorlage“/„Vorlage (geändert)“ statt Serien-Icon + „geändert“.
	const templateBadge =
		task !== null && task.seriesId != null && seriesById.get(task.seriesId)?.autoCreate === false
			? seriesBadge(task, seriesById)
			: null;

	return (
		<div className="task-tree-badges">
			{/* #1213: Provenienz-Hinweise als Text-Badge (KI-UX: nie nur Farbe, muted ohne
			    weiteren Hex-Wert; umbrechfähig über die bestehende Badge-Zeile). „Für: …"
			    sieht der Ersteller, „Erstellt von: …" der Empfänger. */}
			{task !== null && task.forUserName != null && (
				<KolBadge
					_label={t('taskTree.forUser', { name: task.forUserName })}
					className="task-tree-badge task-tree-badge--provenance"
				/>
			)}
			{/* #1521 (AK7): Gruppen-Aufgabe trägt den Gruppennamen statt eines Personennamens —
			    für jedes Mitglied sichtbar, solange sie niemand erledigt hat. */}
			{task !== null && task.groupName != null && task.userId == null && (
				// Bewusst ein Light-DOM-Span statt KolBadge: der Test-Anker (`data-testid`) muss am
				// sichtbaren Element hängen, und KolBadge nimmt weder Fremd-Attribute entgegen noch
				// liefert sein Shadow-Label eine messbare Box für die 375px-Prüfung (AK8).
				<span
					data-testid="group-task-badge"
					className="task-tree-badge task-tree-badge--provenance task-tree-badge-anchor"
				>
					{t('taskTree.forUser', { name: task.groupName })}
				</span>
			)}
			{/* #2349: KI-Eignung (Heuristik, nur mit ai_assist) als nicht-interaktives Text-Badge; Light-DOM-Span
			    wie das Gruppen-Badge (Test-Anker + messbare Box), ohne Upsell-Hinweis (ADR 0014). */}
			{task?.aiSuitability != null && (
				<span
					data-testid="ai-suitability-badge"
					className="task-tree-badge task-tree-badge--provenance task-tree-badge-anchor"
				>
					{t(AI_SUITABILITY_LABEL[task.aiSuitability])}
				</span>
			)}
			{task !== null && task.forUserName == null && task.createdByName != null && task.createdById !== userId && (
				<KolBadge
					_label={t('taskTree.createdBy', { name: task.createdByName })}
					className="task-tree-badge task-tree-badge--provenance"
				/>
			)}
			<CategoryBadge category={categories?.find((category) => category.id === categoryId)} />
			{/* #1518: Serien-Icon mit Screenreader-Text statt Text-Badge „Serie" — die Liste zeigt je
			    Serie nur die aktuelle Instanz. */}
			{templateBadge !== null ? (
				<KolBadge _label={templateBadge.label} className="task-tree-badge" />
			) : (
				task !== null && task.seriesId != null && <SeriesBadge />
			)}
			{/* #1582: Der Pin-Zustand steht als Icon-Badge in derselben Zeile wie Serie/Ort — die
			    Pin-Aktion selbst liegt im „…"-Popover (siehe Toolbar unten). */}
			{task !== null && task.pinned && <PinnedBadge />}
			{task !== null && task.isException && templateBadge === null && (
				<KolBadge _label={t('taskTree.changed')} _color={BADGE_COLOR.changed} className="task-tree-badge" />
			)}
			{/* #1465: Zahlt die Aufgabe auf keine Säule ein, zeigt die Zeile das Säulen-Badge —
			    sichtbar, ohne den Eintrag zu öffnen. Es ersetzt das beschreibungs-getriebene
			    „Hinweis"-Badge aus #1430. Ohne angelegte Säulen bleibt es aus, sonst trüge es
			    jede Zeile. */}
			{task !== null && pillarsConfigured && (task.pillars ?? []).length === 0 && <PillarMissingBadge />}
			{progress !== undefined && (
				<KolBadge
					_label={`${progress.done}/${progress.total}`}
					_color={BADGE_COLOR.progress}
					className="task-tree-badge"
				/>
			)}
			{/* #1583 AK6: Checklisten-Fortschritt bleibt sichtbar, solange nicht alle Einträge
			    abgehakt sind — dieselbe „erledigt/gesamt"-Formatierung wie in TaskTable.tsx. */}
			{task !== null && (task.checklist?.length ?? 0) > 0 && (
				<KolBadge
					_label={`${task.checklist!.filter((item) => item.completed).length}/${task.checklist!.length}`}
					_color={BADGE_COLOR.info}
					className="task-tree-badge task-tree-badge--checklist"
				/>
			)}
			{task !== null && (
				<KolBadge
					_label={priorityBadgeLabel}
					_color={priorityColor}
					className="task-tree-badge task-tree-badge--priority"
				/>
			)}
		</div>
	);
};
