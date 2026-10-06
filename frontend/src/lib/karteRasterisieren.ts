import { KARTE_BREITE, KARTE_HOEHE } from './weeklyShareCard';

/** Rasterungs-Skalierung: 2× aus dem SVG, damit das PNG auf Retina nicht matscht (Muster Wochenkarte). */
const RASTER_SKALA = 2;

/** SVG→PNG ohne neue npm-Abhängigkeit: data-URL ins `Image`, auf 2×-Canvas gemalt, als Blob. */
export const rasterisiere = (svg: string): Promise<Blob> =>
	new Promise((resolve, reject) => {
		const bild = new Image();
		bild.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = KARTE_BREITE * RASTER_SKALA;
			canvas.height = KARTE_HOEHE * RASTER_SKALA;
			const kontext = canvas.getContext('2d');
			// Optional call: ohne zeichenfähigen 2D-Kontext (jsdom, blockiertes Canvas) bleibt das
			// Bild leer, statt die Erzeugung crashen zu lassen.
			kontext?.drawImage?.(bild, 0, 0, canvas.width, canvas.height);
			canvas.toBlob(
				(blob) => (blob ? resolve(blob) : reject(new Error('Rasterisierung lieferte kein PNG'))),
				'image/png',
			);
		};
		bild.onerror = () => reject(new Error('SVG ließ sich nicht laden'));
		bild.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
	});
