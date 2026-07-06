import { KolAlert } from '@public-ui/react-v19';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const UpdatePrompt = () => {
	const {
		needRefresh: [needRefresh],
		offlineReady: [offlineReady],
		updateServiceWorker,
	} = useRegisterSW();

	if (!needRefresh && !offlineReady) {
		return null;
	}

	return (
		<>
			{needRefresh && (
				<KolAlert _type="info" _label="Update">
					<p>Neue Version verfügbar</p>
					<button
						data-testid="pwa-update-reload"
						onClick={() => updateServiceWorker(true)}
						style={{ marginTop: '0.5rem', cursor: 'pointer' }}
					>
						Neu laden
					</button>
				</KolAlert>
			)}
			{offlineReady && (
				<KolAlert _type="success" _label="Offline">
					<p>App ist offline-bereit</p>
				</KolAlert>
			)}
		</>
	);
};
