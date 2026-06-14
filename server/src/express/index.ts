import express from 'express';
import type { paths } from '../api';

const PORT = Number(process.env.PORT) || 3000;

export const launchServer = async () => {
	const app = express();
	app.use(express.json());

	app.get(
		'/users',
		(_req, res: express.Response<paths['/users']['get']['responses']['200']['content']['application/json']>) => {
			const users = [{ id: 1, name: 'John Doe' }];
			res.json(users);
		},
	);

	app.listen(PORT, () => console.log(`Server läuft auf http://localhost:${PORT}`));
};
