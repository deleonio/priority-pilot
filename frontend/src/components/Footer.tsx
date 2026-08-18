import { useGeolocation } from '../lib/useGeolocation';

export const Footer = ({ version }: { version: string }) => {
	const { enabled: geoEnabled, position } = useGeolocation();

	return (
		<footer className="app-footer" role="contentinfo">
			{geoEnabled && position && (
				<span style={{ marginRight: '1rem' }}>
					📍 {position.latitude.toFixed(4)}° N, {position.longitude.toFixed(4)}° E
				</span>
			)}
			<span>Version {version}</span>
		</footer>
	);
};
