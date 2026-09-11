import type { Task } from 'client';
import { TaskStatus } from 'client';

/**
 * Reine Ableitung (#1361, docs/spec/issue-1361.md): „Tag geschafft" gilt nur, wenn keine Aufgabe
 * offen oder in Bearbeitung ist UND die letzte Erledigung (`letzterTag` aus `GET /scores/streak`)
 * auf den heutigen Kalendertag fällt — ohne die Zusatzbedingung würde ein leeres, frisch angelegtes
 * Konto ohne jede Erledigung ebenfalls den Hinweis zeigen.
 */
export const istTagGeschafft = (tasks: Task[], letzterTag: string | null, heuteTag: string): boolean => {
	const keineOffenenAufgaben = tasks.every(
		(task) => task.status !== TaskStatus.Open && task.status !== TaskStatus.InProcess,
	);
	return keineOffenenAufgaben && letzterTag === heuteTag;
};
