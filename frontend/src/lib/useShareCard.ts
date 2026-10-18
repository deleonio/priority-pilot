import { useState } from 'react';
import { rasterisiere } from './karteRasterisieren';

/**
 * Gemeinsame Karten-Logik der drei Bilanz-Karten (#2695): Erzeugen mit Fehler- und Spinner-Zustand,
 * Herunterladen über Object-URL und Teilen per `navigator.canShare` samt Download-Fallback. Die
 * Karten liefern nur ihre SVG-Erzeugung samt Dateinamen sowie Titel/Text für `navigator.share`.
 *
 * Das SVG entsteht erst im Klickpfad — bloßes Ansehen der Karte rasterisiert nichts. Abbruch des
 * Systemdialogs (`AbortError`) ist kein Fehlerzustand; ein nicht-abort Share-Fehler fällt in den
 * Download-Pfad. `onGeteilt` feuert nur nach echtem System-Share (#1989, nur Wochenkarte).
 */
export const useShareCard = ({
	erzeugeSvg,
	titel,
	text,
	onGeteilt,
}: {
	erzeugeSvg: () => { svg: string; dateiname: string };
	titel: string;
	text: string;
	/** Optionaler Rückruf nach echtem System-Share (#1989): Share-Ping der Wochenkarte, fire-and-forget. */
	onGeteilt?: () => void;
}) => {
	const [rastert, setRastert] = useState(false);
	const [fehler, setFehler] = useState(false);

	/** Erst im Klickpfad erzeugt — bloßes Ansehen der Karte rasterisiert nichts. */
	const erzeugeKarte = async (): Promise<{ blob: Blob; dateiname: string } | null> => {
		setRastert(true);
		setFehler(false);
		try {
			const { svg, dateiname } = erzeugeSvg();
			return { blob: await rasterisiere(svg), dateiname };
		} catch {
			setFehler(true);
			return null;
		} finally {
			setRastert(false);
		}
	};

	const ladeHerunter = (karte: { blob: Blob; dateiname: string }): void => {
		const url = URL.createObjectURL(karte.blob);
		const anker = document.createElement('a');
		anker.href = url;
		anker.download = karte.dateiname;
		document.body.append(anker);
		anker.click();
		anker.remove();
		URL.revokeObjectURL(url);
	};

	const speichern = async (): Promise<void> => {
		const karte = await erzeugeKarte();
		if (karte) {
			ladeHerunter(karte);
		}
	};

	const teilen = async (): Promise<void> => {
		const karte = await erzeugeKarte();
		if (!karte) {
			return;
		}
		const datei = new File([karte.blob], karte.dateiname, { type: 'image/png' });
		// File-Share nur, wenn die Plattform Dateien annimmt — sonst fällt der Klick in den
		// Download-Pfad (kein toter Button).
		if (navigator.canShare?.({ files: [datei] })) {
			try {
				await navigator.share({ files: [datei], title: titel, text });
				onGeteilt?.();
				return;
			} catch (fehlerBeimTeilen) {
				// Abbruch des Systemdialogs ist keine Störung (UX-Beratung) — kein Fallback, kein Fehler.
				if ((fehlerBeimTeilen as DOMException)?.name === 'AbortError') {
					return;
				}
			}
		}
		ladeHerunter(karte);
	};

	return { rastert, fehler, speichern, teilen };
};
