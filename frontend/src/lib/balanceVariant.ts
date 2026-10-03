import { useCallback, useEffect, useState } from 'react';

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
 * - **Segmente** — der Ring als Tortengrafik der Ist-Anteile: Jedes Stück ist so breit wie der
 *   Anteil seiner Säule und gefüllt von innen bis auf ihren Wert.
 * - **Zeiger** — je Säule ein Zeiger auf dem gemeinsamen Zifferblatt, gleichmäßig über den Kreis
 *   verteilt; der längste steht auf 12 Uhr.
 *
 * Die acht Figuren (alles außer dem Herz) zeichnen **dieselbe Zahlenreihe** (`balanceMetric.ts`): je Säule das Verhältnis
 * Ist zu Soll. Sie unterscheiden sich in der Form, nie im Inhalt — und teilen sich Zifferblatt,
 * Auftakt, Ruhepuls und Material (`balanceFigure.ts`, `balance-figure.frag`).
 *
 * Persistenz im Muster von `animations.ts`/`heartAnimation.ts`: reine Funktionen plus ein kleiner
 * Hook, alle `localStorage`-Zugriffe Best-Effort (gesperrter Storage darf den App-Start nie
 * verhindern). Die Wahl liegt **am Konto** (#2009): der Hook zieht sie beim Laden vom Server
 * nach und sendet jede neue Wahl per PUT dorthin — der `localStorage` bleibt als Spiegel für
 * den schnellen Erst-Paint. Das Theme bleibt bewusst gerätelokal, mit dem sie die Zeile in den
 * Einstellungen teilt.
 */

/** Schlüssel der Bilder. Der gespeicherte Wert ist genau einer davon. */
export type BalanceVariant =
	'herz' | 'blasen' | 'scheiben' | 'ringe' | 'strahlen' | 'bluete' | 'kristall' | 'segmente' | 'zeiger';

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
	{ value: 'segmente', label: 'Segmente' },
	{ value: 'zeiger', label: 'Zeiger' },
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

/**
 * Endpunkt der Konto-Wahl — fester `/api/v1`-Pfad außerhalb der `api`-Fassade (Muster
 * `lib/auth.ts`), weil der PUT als EINZELNER Aufruf genügen muss: die Fassade würde vor jedem
 * Schreibzugriff erst einen CSRF-Token holen, der Best-Effort-Vertrag verträgt keinen Vorab-Fetch.
 * Den Token liefert stattdessen der GET als Antwort-Header (`x-csrf-token`, Server #2009).
 */
const API_URL = '/api/v1/balance-variant';

/** CSRF-Token aus dem GET-Antwort-Header; der PUT sendet ihn mit, wenn er bekannt ist. */
let csrfToken: string | null = null;

/** Die Konto-Wahl wird pro Seitenlade genau einmal nachgezogen — weitere Montierungen (Tab-Wechsel) lesen den Spiegel. */
let kontoNachgezogen = false;

interface UseBalanceVariantResult {
	/** Aktuell gewähltes Bild (Default `herz`). */
	variant: BalanceVariant;
	/** Wahl setzen (persistiert und sofort im State übernommen). */
	setVariant: (variant: BalanceVariant) => void;
}

/**
 * React-Hook zur Bildwahl — liest initial aus `localStorage`, zieht die Konto-Wahl beim ersten
 * Montieren vom Server nach (#2009) und sendet jede Änderung per PUT dorthin (Best-Effort:
 * ein einzelner Aufruf, Fehler werden geschluckt — die lokale Wahl bleibt aktiv). Jede
 * Instanz hält ihren eigenen State: Auswahl (Einstellungen) und Bild (Dashboard) liegen in
 * verschiedenen Tabs der App und sind nie gleichzeitig montiert, der Wechsel greift also beim
 * nächsten Aufbau des Dashboards. Dasselbe Muster wie `useHeartAnimationEnabled`.
 */
export const useBalanceVariant = (): UseBalanceVariantResult => {
	const [variant, setVariantState] = useState<BalanceVariant>(readBalanceVariant);

	useEffect(() => {
		if (kontoNachgezogen) return;
		kontoNachgezogen = true;
		try {
			void fetch(API_URL)
				.then(async (response) => {
					if (!response.ok) return;
					const token = response.headers.get('x-csrf-token');
					if (token) csrfToken = token;
					const dto = (await response.json()) as { variant?: string };
					const kontowahl = dto.variant ?? null;
					if (!isVariant(kontowahl)) return;
					// Das Konto gewinnt gegen einen älteren Gerätewert (AK4) — Spiegel folgen.
					storeBalanceVariant(kontowahl);
					setVariantState(kontowahl);
				})
				.catch(() => {
					// Konto nicht erreichbar — der Spiegel (Gerät) bleibt Quelle für diese Sitzung.
				});
		} catch {
			// fetch kann mit relativer URL z. B. in Testumgebungen synchron werfen — Best-Effort.
		}
	}, []);

	const setVariant = useCallback((next: BalanceVariant): void => {
		storeBalanceVariant(next);
		setVariantState(next);
		try {
			void fetch(API_URL, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
					...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
				},
				body: JSON.stringify({ variant: next }),
			})
				.then((response) => {
					// Verworfener Token (Rotation): der nächste GET primiert neu (Semantik wie `api.ts`).
					if (response.status === 403) csrfToken = null;
				})
				.catch(() => {
					// Netzwerk weg — die lokale Wahl bleibt aktiv (Best-Effort).
				});
		} catch {
			// Best-Effort: nichts wirft, die Wahl gilt zumindest lokal.
		}
	}, []);

	return { variant, setVariant };
};
