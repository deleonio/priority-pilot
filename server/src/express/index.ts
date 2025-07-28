import express from 'express';
import type { paths } from '../api';

export const launchServer = async () => {
	const app = express();
	app.use(express.json());

	app.get(
		'/users',
		(req, res: express.Response<paths['/users']['get']['responses']['200']['content']['application/json']>) => {
			const users = [{ asas: 'John Doe' }];
			res.json(users);
		},
	);

	app.listen(8080, () => console.log('Server läuft auf http://localhost:3000'));
};
