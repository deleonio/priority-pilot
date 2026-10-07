// Ersatz für `virtual:pwa-register/react` im Android-Build ohne VitePWA (#2378): kein Service Worker,
// daher nie ein Update- oder Offline-Hinweis.
export const useRegisterSW = () => ({
	needRefresh: [false, () => {}] as const,
	offlineReady: [false, () => {}] as const,
	updateServiceWorker: async () => {},
});
