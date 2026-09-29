import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * SSRF-Sperre für nutzerdefinierte LLM-Endpoints (F-2, #1561): Der Server ruft die URL selbst ab,
 * sie darf also nicht ins interne Netz zeigen (Loopback, private Netze, Link-Local inkl.
 * Cloud-Metadaten, ULA). IPv4-gemappte IPv6-Adressen prüft `BlockList` gegen die IPv4-Netze;
 * NAT64 und 6to4 betten beliebige IPv4-Ziele ein und sind deshalb ganz gesperrt.
 */
const internal = new BlockList();
for (const [network, prefix] of [
	['0.0.0.0', 8],
	['10.0.0.0', 8],
	['100.64.0.0', 10],
	['127.0.0.0', 8],
	['169.254.0.0', 16],
	['172.16.0.0', 12],
	['192.168.0.0', 16],
	['224.0.0.0', 4],
	['240.0.0.0', 4],
] as const) {
	internal.addSubnet(network, prefix, 'ipv4');
}
for (const [network, prefix] of [
	['::', 128],
	['::1', 128],
	['64:ff9b::', 96],
	['2002::', 16],
	['fc00::', 7],
	['fe80::', 10],
	['ff00::', 8],
] as const) {
	internal.addSubnet(network, prefix, 'ipv6');
}

const isInternal = (address: string): boolean => internal.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4');

export const INTERNAL_ENDPOINT_MESSAGE = 'endpoint darf nicht auf eine interne Adresse zeigen.';

/**
 * `false`, wenn der Host der URL auf eine interne Adresse zeigt. Nicht auflösbare Hosts gelten als
 * öffentlich: Der Abruf scheitert dann ohnehin, und Tests laufen ohne DNS.
 */
export const isPublicEndpoint = async (url: string): Promise<boolean> => {
	let host: string;
	try {
		host = new URL(url).hostname.replace(/^\[|\]$/g, '');
	} catch {
		return false;
	}
	if (isIP(host) !== 0) return !isInternal(host);
	try {
		const addresses = await lookup(host, { all: true });
		return addresses.every(({ address }) => !isInternal(address));
	} catch {
		return true;
	}
};

/**
 * `fetch` gegen einen Provider-Endpoint: mit `guard` (nutzerdefinierter Provider) erst die
 * SSRF-Prüfung direkt vor dem Abruf (verkleinert das DNS-Rebinding-Fenster) und keine Redirects,
 * die ins interne Netz umleiten könnten. Wirft wie `fetch` — die Aufrufer fangen das bereits ab.
 */
export const fetchProviderEndpoint = async (url: string, init: RequestInit, guard: boolean): Promise<Response> => {
	if (guard && !(await isPublicEndpoint(url))) {
		throw new Error('Endpoint zeigt auf eine interne Adresse.');
	}
	return fetch(url, guard ? { ...init, redirect: 'error' } : init);
};
