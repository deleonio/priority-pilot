import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Baut das Backend EINMAL pro Lauf, bevor die Worker starten.
 *
 * Vorher erledigte das jeder Serverstart selbst (`nodemon` exec `pnpm build && node dist/index.js`).
 * Mit mehreren Workern je Shard (siehe e2e/servers.ts) liefen diese Builds gleichzeitig ins selbe
 * `server/dist` und zerlegten sich gegenseitig. Ein Build vorweg ist außerdem schneller: Er fällt
 * einmal an statt je Worker.
 */
export default function globalSetup(): void {
	execFileSync('pnpm', ['--filter', 'server', 'build'], {
		cwd: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
		stdio: 'inherit',
	});
}
