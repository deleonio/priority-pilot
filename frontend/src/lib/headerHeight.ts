import { useLayoutEffect, type RefObject } from 'react';

/**
 * Tatsächliche Höhe der Kopfzeile als CSS-Variable auf `<html>`.
 *
 * Die Kopfzeile steht seit dem randbündigen Umbau `fixed` am Viewport und damit außerhalb des
 * Flusses — die Shell (`.app`) reserviert ihren Platz als Padding. Solange die Leiste einzeilig
 * bleibt, trifft das rein rechnerische Token `--pp-header-reserve-*` die Höhe exakt, und CSS allein
 * genügt.
 *
 * Es gibt genau einen Fall, in dem die Rechnung nicht mehr stimmt: Bei starker Textvergrößerung
 * (WCAG 1.4.4/1.4.10 verlangen 200 % ohne Inhaltsverlust) passen Logo, die sechs Kopf-Aktionen und
 * der Avatar nicht mehr in eine Zeile. Die Leiste bricht um und wird mehr als doppelt so hoch wie
 * die Reservierung — gemessen 361px gegen 201px reservierten Platz; der Inhalt darunter wäre
 * verdeckt und damit verloren. Wie hoch eine umgebrochene Flex-Zeile wird, kann CSS nicht
 * vorausberechnen, deshalb misst diese Stelle nach.
 *
 * Kein Rückkopplungs-Risiko: Die Variable verändert nur das Padding der Shell, nie die Geometrie der
 * Kopfzeile selbst (die hängt an der Viewport-Breite). Geschrieben wird zudem nur bei tatsächlicher
 * Änderung des gerundeten Wertes — das verhindert ein Hin- und Herpendeln, falls die neue
 * Dokumenthöhe einen Scrollbalken ein- oder ausblendet.
 *
 * Ohne JavaScript oder ohne `ResizeObserver` (z. B. im ersten Paint) bleibt die Variable ungesetzt;
 * das CSS nutzt sie ausschließlich mit dem Token als Fallback.
 */
export const HEADER_HEIGHT_PROPERTY = '--pp-header-measured';

/**
 * Meldet die gemessene Höhe des referenzierten Kopfzeilen-Elements als `--pp-header-measured` an
 * `<html>` und hält sie bei jeder Größenänderung aktuell.
 */
export const useMeasuredHeaderHeight = (ref: RefObject<HTMLElement | null>): void => {
	useLayoutEffect(() => {
		const header = ref.current;
		if (header === null || typeof ResizeObserver === 'undefined') {
			return;
		}

		const root = document.documentElement;
		let published: number | null = null;
		const publish = (): void => {
			const height = Math.ceil(header.getBoundingClientRect().height);
			if (height === published) {
				return;
			}
			published = height;
			root.style.setProperty(HEADER_HEIGHT_PROPERTY, `${height}px`);
		};

		publish();
		const observer = new ResizeObserver(publish);
		observer.observe(header);

		return () => {
			observer.disconnect();
			root.style.removeProperty(HEADER_HEIGHT_PROPERTY);
		};
	}, [ref]);
};
