import { KolAlert, KolButton } from '@public-ui/react-v19';
import { useEffect, useState } from 'react';

type InstallPromptProps = {
	onDismiss?: () => void;
};

export const InstallPrompt = ({ onDismiss }: InstallPromptProps) => {
	const [showPrompt, setShowPrompt] = useState(false);
	const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
	const [isInstalled, setIsInstalled] = useState(false);
	const [isIOS, setIsIOS] = useState(false);

	useEffect(() => {
		// Prüfe, ob die App bereits installiert ist (standalone mode)
		const checkInstalled = () => {
			const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
			setIsInstalled(isStandalone);
		};

		// Prüfe, ob iOS Safari
		const userAgent = window.navigator.userAgent.toLowerCase();
		const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
		const isSafari = /safari/.test(userAgent) && !/chrome|crios|fxios|edg/.test(userAgent);
		const isIOSSafari = isIOSDevice && isSafari;
		setIsIOS(isIOSSafari);

		// iOS Safari feuert kein beforeinstallprompt-Event. Damit der iOS-Branch
		// überhaupt erreichbar ist, muss showPrompt hier gesetzt werden – aber nur,
		// wenn die App nicht bereits im Standalone-Modus läuft.
		const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
		if (isIOSSafari && !isStandaloneMode) {
			setShowPrompt(true);
		}

		// Event-Listener für beforeinstallprompt
		const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
			// Verhindere, dass der Browser den Standard-Prompt zeigt
			e.preventDefault();
			// Speichere das Event für später
			setDeferredPrompt(e);
			// Zeige unseren eigenen Prompt an
			setShowPrompt(true);
		};

		// Event-Listener für appinstalled
		const handleAppInstalled = () => {
			setIsInstalled(true);
			setShowPrompt(false);
		};

		// Initial prüfen
		checkInstalled();

		// Event-Listener hinzufügen
		window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
		window.addEventListener('appinstalled', handleAppInstalled as EventListener);

		// Media Query Listener für display-mode Änderungen
		const mediaQuery = window.matchMedia('(display-mode: standalone)');
		const handleDisplayModeChange = (e: MediaQueryListEvent) => {
			setIsInstalled(e.matches);
		};
		mediaQuery.addEventListener('change', handleDisplayModeChange);

		return () => {
			window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
			window.removeEventListener('appinstalled', handleAppInstalled as EventListener);
			mediaQuery.removeEventListener('change', handleDisplayModeChange);
		};
	}, []);

	const handleInstall = async () => {
		if (deferredPrompt) {
			// Zeige den Installations-Prompt
			deferredPrompt.prompt();
			// Warte auf die Antwort des Nutzers
			const { outcome } = await deferredPrompt.userChoice;
			// Setze Prompt zurück
			setDeferredPrompt(null);
			// Verstecke unseren Prompt
			setShowPrompt(false);

			if (outcome === 'accepted') {
				setIsInstalled(true);
			}

			if (onDismiss) {
				onDismiss();
			}
		}
	};

	const handleDismiss = () => {
		setShowPrompt(false);
		setDeferredPrompt(null);
		if (onDismiss) {
			onDismiss();
		}
	};

	// Nicht anzeigen, wenn bereits installiert oder kein Prompt verfügbar
	if (isInstalled || !showPrompt) {
		return null;
	}

	// iOS Safari Fallback
	if (isIOS) {
		return (
			<KolAlert _type="info" _label="App installieren">
				<p>
					Tippe auf <strong>Teilen</strong> und dann auf <strong>Zum Home-Bildschirm</strong>, um Priority Pilot als App
					zu installieren.
				</p>
				<KolButton _label="Schließen" _variant="secondary" _on={{ onClick: handleDismiss }} />
			</KolAlert>
		);
	}

	// Standard Fallback für andere Browser
	return (
		<KolAlert _type="info" _label="App installieren">
			<p>Möchtest du Priority Pilot als App auf deinem Gerät installieren?</p>
			<div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
				<KolButton _label="Installieren" _variant="primary" _on={{ onClick: handleInstall }} />
				<KolButton _label="Nicht jetzt" _variant="secondary" _on={{ onClick: handleDismiss }} />
			</div>
		</KolAlert>
	);
};
