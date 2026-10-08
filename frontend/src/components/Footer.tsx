import { useTranslation } from 'react-i18next';
import { useGeolocation } from '../lib/useGeolocation';

export const Footer = ({ version }: { version: string }) => {
	const { t } = useTranslation('onboarding');
	const { enabled: geoEnabled, position, address } = useGeolocation();
	const location = address?.trim()
		? address
		: geoEnabled && position
			? `${position.latitude.toFixed(4)}° N, ${position.longitude.toFixed(4)}° E`
			: null;

	return (
		<footer className="app-footer" role="contentinfo">
			<span style={{ overflowWrap: 'anywhere' }}>{location}</span>
			{location && <span aria-hidden="true"> | </span>}
			<span>{t('footer.version', { version })}</span>
		</footer>
	);
};
