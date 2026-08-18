/**
 * TypeScript-Erweiterungen für Geolocation-Mocks in E2E-Tests
 * (Issue #845 – window.__geolocationCalls / window.__geolocationPositions)
 */
declare global {
	interface Window {
		__geolocationCalls: string[];
		__geolocationPositions: Array<{ latitude: number; longitude: number }>;
	}
}

export {};
