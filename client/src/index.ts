// Öffentliche Typ-Oberfläche des API-Vertrags.
//
// `schema.d.ts` wird von `openapi-typescript` aus ../openapi.yml erzeugt (kein
// handgeschriebener Code, nicht versioniert). Dieses Modul re-exportiert daraus die
// `paths` (für `openapi-fetch` im Frontend) sowie bequeme Aliase der Schema-Typen.
import type { components } from './schema';

export type { paths } from './schema';

type Schemas = components['schemas'];

export type Task = Schemas['Task'];
export type TaskCreate = Schemas['TaskCreate'];
export type TaskUpdate = Schemas['TaskUpdate'];
export type TaskStatus = Schemas['TaskStatus'];
export type TaskTreeNode = Schemas['TaskTreeNode'];
export type DependencyInput = Schemas['DependencyInput'];
export type ApiError = Schemas['Error'];
