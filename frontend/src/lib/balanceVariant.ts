import { useCallback, useState } from 'react';

/**
 * Welches Bild die Startseite für die Lebensbalance zeichnet — die „Zifferblätter" der App.
 *
 * Alle Varianten rechnen mit **denselben** Zahlen (`lib/heartBalance.ts`): Sie sind Lesarten
 * derselben Auskunft, keine eigenen Kennzahlen. Was sie unterscheidet, ist die Frage, die
 * das Bild in den Vordergrund stellt:
 *
 * - **Herz** — das gewohnte Gefäß, das sich wie ein Wasserglas füllt. Füllstand = Gesamt-Balance,
 *   Streifenbreite = Verteilung (`HeartVessel`/`heartGeometry.ts`).
 * - **Blasen** — je Säule eine schwingende Ellipse, gestapelt von groß nach klein; Seifenblasen-Glas
 *   mit Fresnel-Saum und Neon-Schein.
 * - **Scheiben** — derselbe Stapel, aber deckend und scharfkantig. Dieselbe Geometrie, entgegen-
 *   gesetztes Material: Wo die Blasen die Farbe in eine Haut legen und den Rest durchscheinen
 *   lassen, ist hier jede Scheibe eine satte Fläche mit harter Kante.
 * - **Ringe** — je Säule ein Bogen wie die Aktivitätsringe einer Uhr, stärkste Säule außen.
 * - **Strahlen** — je Säule ein Lichtstrahl vom Mittelpunkt nach außen, längster auf 12 Uhr.
 * - **Blüte** — alle Säulen als **eine** Silhouette: eine geschlossene Kurve, deren Lappen je Säule
 *   so weit reichen wie ihr Wert. Weiches, organisches Material.
 * - **Kristall** — dieselbe Silhouette mit harten Kanten: Stützpunkte und Facetten statt weicher
 *   Lappen, leuchtende Knoten an den Spitzen.
 *
 * Die vier Figuren (alles außer dem Herz) zeichnen **dieselbe Zahlenreihe** (`balanceMetric.ts`): je Säule das Verhältnis
 * Ist zu Soll. Sie unterscheiden sich in der Form, nie im Inhalt — und teilen sich Zifferblatt,
 * Auftakt, Ruhepuls und Material (`balanceFigure.ts`, `balance-figure.frag`).
 *
 * Persistenz im Muster von `animations.ts`/`heartAnimation.ts`: reine Funktionen plus ein kleiner
 * Hook, alle `localStorage`-Zugriffe Best-Effort (gesperrter Storage darf den App-Start nie
 * verhindern). Die Wahl gilt **pro Gerät** — wie das Theme, mit dem sie die Zeile in den
 * Einstellungen teilt.
 */

/** Schlüssel der Bilder. Der gespeicherte Wert ist genau einer davon. */
export type BalanceVariant = 'herz' | 'blasen' | 'scheiben' | 'ringe' | 'strahlen' | 'bluete' | 'kristall';

/** Die Figuren, die sich Zifferblatt, Kennzahl und Rahmen teilen (`BalanceFigure`) — alles außer dem Herz. */
export type FigureKind = Exclude<BalanceVariant, 'herz'>;

/** Reihenfolge und Beschriftung für die Auswahl in den Einstellungen. */
export const BALANCE_VARIANTS: readonly { value: BalanceVariant; label: string }[] = [
	{ value: 'herz', label: 'Herz' },
	{ value: 'blasen', label: 'Blasen' },
	{ value: 'scheiben', label: 'Scheiben' },
	{ value: 'ringe', label: 'Ringe' },
	{ value: 'strahlen', label: 'Strahlen' },
	{ value: 'bluete', label: 'Blüte' },
	{ value: 'kristall', label: 'Kristall' },
];

/**
 * Default ist das **Herz**: Es ist das Bild, das bestehende Nutzer kennen — eine neue Voreinstellung
 * würde ihnen die Startseite ohne Anlass umbauen. Die Blasen-Bilder sind Angebote, keine Ablösung.
 */
const DEFAULT_VARIANT: BalanceVariant = 'herz';

/** `localStorage`-Schlüssel der gespeicherten Wahl (muss mit den Tests übereinstimmen). */
const STORAGE_KEY = 'pp-balance-variant';

const isVariant = (value: string | null): value is BalanceVariant =>
	BALANCE_VARIANTS.some((variant) => variant.value === value);

/** Liest die gespeicherte Wahl; fehlt oder verfälscht sie, gilt der Default. */
export const readBalanceVariant = (): BalanceVariant => {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isVariant(stored) ? stored : DEFAULT_VARIANT;
	} catch {
		// localStorage kann durch Browser-Einstellungen werfen — dann gilt der Standard.
		return DEFAULT_VARIANT;
	}
};

/** Speichert die Wahl; Fehler (z. B. voller/gesperrter Storage) werden bewusst ignoriert. */
export const storeBalanceVariant = (variant: BalanceVariant): void => {
	try {
		localStorage.setItem(STORAGE_KEY, variant);
	} catch {
		// Persistenz ist Best-Effort; die Wahl gilt zumindest für die laufende Sitzung.
	}
};

interface UseBalanceVariantResult {
	/** Aktuell gewähltes Bild (Default `herz`). */
	variant: BalanceVariant;
	/** Wahl setzen (persistiert und sofort im State übernommen). */
	setVariant: (variant: BalanceVariant) => void;
}

/**
 * React-Hook zur Bildwahl — liest initial aus `localStorage`, persistiert bei Änderung. Jede
 * Instanz hält ihren eigenen State: Auswahl (Einstellungen) und Bild (Dashboard) liegen in
 * verschiedenen Tabs der App und sind nie gleichzeitig montiert, der Wechsel greift also beim
 * nächsten Aufbau des Dashboards. Dasselbe Muster wie `useHeartAnimationEnabled`.
 */
export const useBalanceVariant = (): UseBalanceVariantResult => {
	const [variant, setVariantState] = useState<BalanceVariant>(readBalanceVariant);

	const setVariant = useCallback((next: BalanceVariant): void => {
		storeBalanceVariant(next);
		setVariantState(next);
	}, []);

	return { variant, setVariant };
};
