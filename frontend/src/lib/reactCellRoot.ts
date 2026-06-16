import { createReactRenderElement } from '@public-ui/react-v19';
import type { ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

// KoliBri-Tabellenzellen werden über die `render`-Callback-Funktion mit einem rohen DOM-Element
// bedient. Um darin echte React-Komponenten (z. B. KolToolbar) zu rendern, halten wir pro
// Zellen-Element genau eine React-Root in einer WeakMap — niemals eine neue Root pro Render-Aufruf,
// sonst entstehen Doppel-Mounts und React-Warnungen (insbesondere unter StrictMode), und das
// asynchrone Re-Mounten lässt Zellinhalte zeitversetzt erscheinen.
const roots = new WeakMap<HTMLElement, Root>();

/** Rendert `node` in die KoliBri-Zelle `cell` über eine pro Element gecachte React-Root. */
export const renderIntoCell = (cell: HTMLElement, node: ReactNode): void => {
	let root = roots.get(cell);
	if (root === undefined) {
		root = createRoot(createReactRenderElement(cell));
		roots.set(cell, root);
	}
	root.render(node);
};
