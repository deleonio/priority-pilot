import express from 'express';
import type { paths } from '../api';

const PORT = Number(process.env.PORT) || 3000;

export const launchServer = async () => {
	const app = express();
	app.use(express.json());

	// Platzhalter gegen den neuen API-Vertrag — die eigentlichen Task-Handler folgen in #8.
	app.get(
		'/tasks',
		(_req, res: express.Response<paths['/tasks']['get']['responses']['200']['content']['application/json']>) => {
			res.json([]);
		},
	);

	app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
};
