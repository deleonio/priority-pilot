import { KolAlert, KolButton, KolPopoverButton } from '@public-ui/react-v19';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { isNativeChannel } from '../lib/platform';

/** Zielroute: der Pakete-Reiter der Einstellungen. */
const PAKETE_ROUTE = '/settings/pakete';

const PlansButton = ({ onClick }: { onClick: () => void }) => {
	const { t } = useTranslation('dashboard');
	return <KolButton _label={t('featurePopover.showPlans')} _variant="secondary" _on={{ onClick }} />;
};

/** Router-Variante; eigenes Bauteil, damit der Hook nur im Router-Kontext läuft (Modals rendern ohne). */
const RouterPlansButton = () => {
	const navigate = useNavigate();
	return <PlansButton onClick={() => navigate(PAKETE_ROUTE)} />;
};

/**
 * Button „Pakete ansehen" in der Alert-Card (nie ein Link). Im Modal (`inModal`) öffnet er einen neuen
 * Tab — eine Navigation würde ungesicherte Eingaben verwerfen; in der nativen App gibt es dort keinen.
 */
const PlansAction = ({ inModal, onShowPlans }: { inModal: boolean; onShowPlans?: () => void }) => {
	const inRouter = useInRouterContext();
	if (onShowPlans !== undefined) return <PlansButton onClick={onShowPlans} />;
	if (!inModal && inRouter) return <RouterPlansButton />;
	if (inModal && isNativeChannel()) return null;
	return (
		<PlansButton
			onClick={() =>
				window.open(`${import.meta.env.BASE_URL}${PAKETE_ROUTE.slice(1)}`, '_blank', 'noopener,noreferrer')
			}
		/>
	);
};

/**
 * Paket-Hinweis zu einer gesperrten Funktion: ein Info-Button, dessen Popover die Erklärung als
 * Alert-Card samt Button „Pakete ansehen" trägt. Hält die Fläche ruhig, solange der Nutzer nicht nachfragt; das gesperrte
 * Bedienelement bleibt sichtbar. Text im Slot statt in `_label` (KoliBri rendert `_label` im Shadow DOM).
 */
export const FeaturePopoverButton = ({
	label,
	testId,
	inModal = false,
	onShowPlans,
	children,
}: {
	label: string;
	testId?: string;
	/** In einem Modal: Button öffnet die Pakete in neuem Tab. */
	inModal?: boolean;
	/** Überschreibt die Navigation (z. B. Tab-Wechsel innerhalb der Einstellungen). */
	onShowPlans?: () => void;
	children: ReactNode;
}) => {
	const ref = useRef<HTMLKolPopoverButtonElement | null>(null);
	return (
		<KolPopoverButton
			ref={ref}
			data-testid={testId}
			className="feature-popover-button"
			_label={label}
			_icons={{ left: { icon: 'fa-solid fa-circle-info' } }}
			_variant="secondary"
			_popoverAlign="bottom"
		>
			<KolAlert
				_type="info"
				_variant="card"
				_label={label}
				_hasCloser
				_on={{ onClose: () => void ref.current?.hidePopover() }}
			>
				{children}
				<PlansAction inModal={inModal} onShowPlans={onShowPlans} />
			</KolAlert>
		</KolPopoverButton>
	);
};
