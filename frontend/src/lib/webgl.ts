/**
 * Einmalige, jsdom-sichere Frage: Kann dieser Browser WebGL2?
 *
 * Alle Balance-Bilder zeichnen zuerst mit WebGL und fallen sonst auf ihr SVG zurück — dieselbe
 * Frage an zwei Stellen, also nur eine Antwortquelle. `WebGL2RenderingContext` wird zuerst geprüft,
 * damit Umgebungen ohne WebGL (Tests) `getContext` gar nicht erst anfassen müssen; jsdom meldet
 * dort sonst „Not implemented" auf der Konsole.
 */
export const supportsWebGl2 = (): boolean => {
	try {
		return typeof WebGL2RenderingContext !== 'undefined' && !!document.createElement('canvas').getContext('webgl2');
	} catch {
		return false;
	}
};
