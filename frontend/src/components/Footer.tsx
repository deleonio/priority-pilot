import { useGeolocation } from '../lib/useGeolocation';

export const Footer = ({ version }: { version: string }) => {
	const { enabled: geoEnabled, position, address } = useGeolocation();
	const location = address?.trim()
		? address
		: geoEnabled && position
			? `${position.latitude.toFixed(4)}° N, ${position.longitude.toFixed(4)}° E`
			: null;

	return (
		<footer className="app-footer" role="contentinfo">
			<span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{location}</span>
			{location && <span aria-hidden="true"> | </span>}
			<span>Version {version}</span>
		</footer>
	);
};
