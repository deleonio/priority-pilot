import { KolInputRadio } from '@public-ui/react-v19';
import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { BALANCE_VARIANTS, useBalanceVariant, type BalanceVariant } from '../lib/balanceVariant';
import { useShadowDOMLayout } from '../lib/useShadowDOMLayout';

/**
 * Bildwahl für die Lebensbalance im Einstellungen-Tab „Allgemein" — das Zifferblatt der Startseite.
 *
 * Benannte Radiogruppe mit allen Bildern; Zustand und Persistenz kommen aus `useBalanceVariant`
 * (`balanceVariant.ts`, localStorage-Key `pp-balance-variant`). Aufbau bewusst wie
 * `AppearanceSetting` daneben: Beide wählen, **wie** die App aussieht, nicht **was** sie rechnet.
 *
 * Senkrecht statt waagerecht: Sieben Optionen mit sprechenden Namen passen auf 375 px nicht
 * nebeneinander, ohne dass die Beschriftungen umbrechen (mobile-ui-rules.md).
 */
export const BalanceVariantSetting = () => {
	const { variant, setVariant } = useBalanceVariant();
	const { t, i18n } = useTranslation('settings');
	const ref = useRef<HTMLDivElement>(null);

	// #843: marginLeft auf Shadow-DOM Controls setzen (24dp = 1.5rem)
	useShadowDOMLayout(ref, 'kol-input-radio', '[role="radio"]');

	// Stabile Objektidentität (hängt nur an der Modul-Konstante), damit die Radiogruppe nicht bei
	// jedem Render eine neue Options-Liste erhält.
	// Labels sind Getter (übersetzen beim Lesen) — neu bilden, sobald die Sprache wechselt.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const options = useMemo(() => BALANCE_VARIANTS.map(({ value, label }) => ({ label, value })), [i18n.language]);

	return (
		<div ref={ref} data-testid="balance-variant-setting">
			<KolInputRadio
				_label={t('balanceVariant.label')}
				_orientation="vertical"
				_options={options}
				_value={variant}
				_hint={t('balanceVariant.hint')}
				_on={{
					onChange: (_event, value) => {
						if (typeof value === 'string') {
							setVariant(value as BalanceVariant);
						}
					},
				}}
			/>
		</div>
	);
};
