import { ResponseError } from 'client';
import { describe, expect, it, vi } from 'vitest';

// vi.mock-Hoisting: Die Factory wird vor allen Imports ausgefuehrt, daher muessen
// die Mock-Objekte ueber vi.hoisted() vorab deklariert werden.
const { mockPOST, mockPATCH, mockDELETE, mockUse } = vi.hoisted(() => ({
	mockPOST: vi.fn(),
	mockPATCH: vi.fn(),
	mockDELETE: vi.fn(),
	// CSRF-Middleware-Registrierung (api.ts ruft client.use() beim Import) — ohne Implementierung.
	mockUse: vi.fn(),
}));

vi.mock('openapi-fetch', () => ({
	default: vi.fn(() => ({
		POST: mockPOST,
		PATCH: mockPATCH,
		DELETE: mockDELETE,
		use: mockUse,
	})),
}));

import { api } from './api';

describe('api.createPillar', () => {
	it('liefert die erstellte Säule (Pillar) zurück', async () => {
		const pillar = { id: 2, name: 'Sport', description: '', weight: 0 };
		mockPOST.mockResolvedValueOnce({ data: pillar, response: { ok: true } });

		const result = await api.createPillar({ pillarCreate: { name: 'Sport', description: '' } });

		expect(result).toEqual(pillar);
	});

	it('wirft ResponseError bei 409 (Name existiert bereits)', async () => {
		const errorResponse = { ok: false, status: 409 } as Response;
		mockPOST.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.createPillar({ pillarCreate: { name: 'Familie', description: '' } })).rejects.toThrow(
			ResponseError,
		);
	});

	it('wirft ResponseError bei 400 (Validierungsfehler)', async () => {
		const errorResponse = { ok: false, status: 400 } as Response;
		mockPOST.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.createPillar({ pillarCreate: { name: '', description: '' } })).rejects.toThrow(ResponseError);
	});

	it('wirft ResponseError bei undefined data trotz ok:true', async () => {
		mockPOST.mockResolvedValueOnce({ data: undefined, response: { ok: true } });

		await expect(api.createPillar({ pillarCreate: { name: 'Test', description: '' } })).rejects.toThrow(ResponseError);
	});
});

describe('api.updatePillar', () => {
	it('liefert die aktualisierte Säule zurück', async () => {
		const updated = { id: 1, name: 'Familie', description: 'Neu', weight: 20 };
		mockPATCH.mockResolvedValueOnce({ data: updated, response: { ok: true } });

		const result = await api.updatePillar({ id: 1, pillarUpdate: { description: 'Neu' } });

		expect(result).toEqual(updated);
	});

	it('wirft ResponseError bei 404 (Säule nicht gefunden)', async () => {
		const errorResponse = { ok: false, status: 404 } as Response;
		mockPATCH.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.updatePillar({ id: 999, pillarUpdate: { name: 'Nicht da' } })).rejects.toThrow(ResponseError);
	});

	it('wirft ResponseError bei 409 (Name-Konflikt)', async () => {
		const errorResponse = { ok: false, status: 409 } as Response;
		mockPATCH.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.updatePillar({ id: 1, pillarUpdate: { name: 'Doppelt' } })).rejects.toThrow(ResponseError);
	});
});

describe('api.deletePillar', () => {
	it('gibt nichts zurück (void) bei Erfolg', async () => {
		mockDELETE.mockResolvedValueOnce({ data: undefined, response: { ok: true, status: 204 } });

		const result = await api.deletePillar({ id: 1 });

		expect(result).toBeUndefined();
	});

	it('wirft ResponseError bei nicht-erfolgreicher Antwort', async () => {
		const errorResponse = { ok: false, status: 500 } as Response;
		mockDELETE.mockResolvedValueOnce({ data: undefined, response: errorResponse });

		await expect(api.deletePillar({ id: 1 })).rejects.toThrow(ResponseError);
	});
});
