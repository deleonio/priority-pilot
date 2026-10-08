import { KolInputRadio } from '@public-ui/react-v19';
import type { Pillar } from 'client';
import { useMemo, useRef } from 'react';
import { BalanceFigure } from './BalanceFigure';
import { HeartVessel } from './HeartVessel';
import { BALANCE_VARIANTS, useBalanceVariant, type BalanceVariant } from '../lib/balanceVariant';
import { buildHeartBalance } from '../lib/heartBalance';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Bildwahl für die Lebensbalance im Einstellungen-Tab „Allgemein" — das Zifferblatt der Startseite.
 *
 * Benannte Radiogruppe mit allen Bildern; Zustand und Persistenz kommen aus `useBalanceVariant`
 * (`balanceVariant.ts`, localStorage-Key `pp-balance-variant`). Aufbau bewusst wie
 * `AppearanceSetting` daneben: Beide wählen, **wie** die App aussieht, nicht **was** sie rechnet.
 *
 * Senkrecht statt waagerecht: Neun Optionen mit sprechenden Namen passen auf 375 px nicht
 * nebeneinander, ohne dass die Beschriftungen umbrechen (mobile-ui-rules.md).
 *
 * Darunter eine stille Vorschau des gewählten Bildes mit festen Beispieldaten — sie wechselt mit
 * der Auswahl, ohne dass man die Einstellungen verlassen muss.
 */

/** Beispiel-Säulen mit leichter Schieflage, damit jedes Bild seine Unterschiede zeigt. */
const PREVIEW_PILLARS: Pillar[] = [
	{ id: 1, name: 'Körper', description: '', weight: 1 },
	{ id: 2, name: 'Beziehungen', description: '', weight: 1 },
	{ id: 3, name: 'Arbeit', description: '', weight: 1 },
	{ id: 4, name: 'Sinn', description: '', weight: 1 },
];
const PREVIEW_BALANCE = buildHeartBalance(
	PREVIEW_PILLARS,
	new Map([
		[1, 9],
		[2, 7],
		[3, 5],
		[4, 3],
	]),
);

export const BalanceVariantSetting = () => {
	const { variant, setVariant } = useBalanceVariant();
	const ref = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');

	// Stabile Objektidentität (hängt nur an der Modul-Konstante), damit die Radiogruppe nicht bei
	// jedem Render eine neue Options-Liste erhält.
	const options = useMemo(() => BALANCE_VARIANTS.map(({ value, label }) => ({ label, value })), []);

	return (
		<div ref={ref} data-testid="balance-variant-setting">
			<KolInputRadio
				_label="Bild der Lebensbalance"
				_orientation="vertical"
				_options={options}
				_value={variant}
				_hint="Alle Bilder zeigen dieselbe Rechnung: je Säule das Verhältnis von Ist zu Ziel — die stärkste Säule bekommt überall die größte Form. „Herz“ füllt ein Gefäß; „Blasen“ und „Scheiben“ stapeln dieselben Formen in zwei Materialien, „Ringe“ zeigt sie als Bögen, „Strahlen“ als Lichtkeile. „Blüte“ und „Kristall“ fassen alle Säulen zu einer Silhouette zusammen — weich einmal, kantig einmal. „Segmente“ teilt den Ring nach Ist-Anteilen auf, „Zeiger“ zeigt je Säule einen Zeiger auf dem Zifferblatt."
				_on={{
					onChange: (_event, value) => {
						if (typeof value === 'string') {
							setVariant(value as BalanceVariant);
						}
					},
				}}
			/>
			<div
				className="heart-balance-stage heart-balance-stage--still balance-variant-preview"
				data-variante={variant}
				data-testid="balance-variant-preview"
			>
				{variant === 'herz' ? (
					<HeartVessel balance={PREVIEW_BALANCE} animated={false} ariaLabel="Vorschau: Herz" />
				) : (
					<BalanceFigure
						balance={PREVIEW_BALANCE}
						figure={variant}
						animated={false}
						beatSeconds={2}
						ariaLabel={`Vorschau: ${BALANCE_VARIANTS.find((option) => option.value === variant)?.label ?? ''}`}
					/>
				)}
			</div>
		</div>
	);
};
