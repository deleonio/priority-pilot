/**
 * Minimaler statischer Server für `website/dist/` (lokale Vorschau und E2E). Liefert `pfad/index.html`
 * für Verzeichnis-URLs, sonst 404 — so wie Caddy im Betrieb (docs/server-setup.md § 7).
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const port = Number(process.env.PORT ?? 4180);
const types: Record<string, string> = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain; charset=utf-8',
	'.xml': 'application/xml',
};

createServer((req, res) => {
	const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
	let file = normalize(join(dist, pathname));
	if (!file.startsWith(dist)) {
		res.writeHead(403).end();
		return;
	}
	if (existsSync(file) && statSync(file).isDirectory()) {
		file = join(file, 'index.html');
	}
	if (!existsSync(file)) {
		res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
		return;
	}
	res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
	createReadStream(file).pipe(res);
}).listen(port, () => console.log(`[website] http://localhost:${port}`));
