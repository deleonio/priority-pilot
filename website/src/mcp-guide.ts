/**
 * Text der MCP-Anleitungsseite (#1978): Deutsch unter `/mcp/`, Englisch unter `/en/mcp/`, die
 * übrigen Sprachen folgen dem deutschen x-default. Liegt als Modul neben dem Renderer und nicht
 * in den i18n-Dateien, weil der Key-Parity-Test den Text sonst in alle zehn Sprachen duplizieren
 * würde (Muster `privacy.ts`/`terms.ts`). Der Endpunkt steht als Platzhalter `{endpoint}` und wird
 * vom Renderer mit der absoluten URL je Deployment (SITE_URL) eingesetzt.
 */

export interface McpGuideSection {
	heading: string;
	paragraphs: string[];
	/** Aufzählung (Schritte, Beispiel-Prompts), gerendert als `ul`. */
	items?: string[];
	/** Monospace-Block (z. B. Endpunkt-Zeile), gerendert als `pre><code`. */
	code?: string;
	/** Label des Claude-Ein-Klick-Links; nur in der Claude-Sektion gesetzt. */
	claudeCta?: string;
}

export interface McpGuideText {
	title: string;
	description: string;
	intro: string;
	sections: McpGuideSection[];
	back: string;
}

export const MCP_GUIDE: Record<'de' | 'en', McpGuideText> = {
	de: {
		title: 'Balamentum per MCP anbinden',
		description:
			'Balamentum per MCP (Model Context Protocol) anbinden: Endpunkt, Access-Token, Claude-Ein-Klick-Link und ChatGPT-Schritte, plus Beispiel-Prompts wie „Frag deine Balance“.',
		intro:
			'Balamentum lässt sich über das Model Context Protocol (MCP) mit KI-Assistenten wie Claude und ChatGPT verbinden. Der Assistent kann dann deine Balance auslesen und — je nach Paket — Aufgaben für dich planen.',
		back: 'Zurück zur Startseite',
		sections: [
			{
				heading: 'Endpunkt',
				paragraphs: ['Der Server spricht JSON-RPC 2.0 über HTTP und ist ausschließlich per POST erreichbar:'],
				code: 'POST {endpoint}',
			},
			{
				heading: 'Access-Token erzeugen',
				paragraphs: [
					'In der App unter „Einstellungen → API-Tokens“ einen Token erzeugen. Der Klartext wird nur einmal angezeigt — direkt sicher ablegen. Jede Anfrage braucht den Token im HTTP-Header „Authorization: Bearer <token>“.',
					'Paketgrenzen: Lesen (Balance und Aufgaben abrufen) steht ab Plus bereit, Lesen und Schreiben ab Pro. Details zeigt die Preistabelle in der App.',
				],
			},
			{
				heading: 'Mit Claude verbinden',
				claudeCta: 'Balamentum in Claude verbinden',
				paragraphs: ['Der Ein-Klick-Link öffnet Claude mit vorausgefülltem Connector-Dialog (Name und Endpunkt-URL):'],
				items: [
					'Alternativ manuell: „Einstellungen → Connectors → Add custom connector“ und als Server-URL {endpoint} eintragen.',
				],
			},
			{
				heading: 'Mit ChatGPT verbinden',
				paragraphs: ['ChatGPT bindet eigene MCP-Server über den Entwicklermodus an (ChatGPT Plus oder Pro):'],
				items: [
					'Unter „Einstellungen → Apps & Connectors → Erweitert“ den Entwicklermodus aktivieren.',
					'Danach unter „Connectors“ auf „Erstellen“ klicken und als Server-URL {endpoint} eintragen.',
					'Connector auswählen — ChatGPT versteht damit die Balamentum-Werkzeuge.',
				],
			},
			{
				heading: 'Beispiel-Prompts',
				paragraphs: ['Zum Ausprobieren — der Assistent wählt die passenden Balamentum-Werkzeuge selbst aus:'],
				items: [
					'„Frag deine Balance“ — zeigt den Stand deiner Lebensbalance-Säulen (Werkzeug balance_status).',
					'„Plane meine Woche nach meiner Balance“ — schlägt die nächsten Aufgaben vor, gewichtet nach deiner Balance (Werkzeuge next_task und task_list).',
				],
			},
		],
	},
	en: {
		title: 'Connect Balamentum via MCP',
		description:
			'Connect Balamentum via MCP (Model Context Protocol): endpoint, access token, one-click link for Claude and step-by-step instructions for ChatGPT, plus example prompts like "Ask for your balance".',
		intro:
			'Balamentum connects to AI assistants like Claude and ChatGPT through the Model Context Protocol (MCP). The assistant can then read your balance and — depending on your plan — plan tasks for you.',
		back: 'Back to the homepage',
		sections: [
			{
				heading: 'Endpoint',
				paragraphs: ['The server speaks JSON-RPC 2.0 over HTTP and is reachable via POST only:'],
				code: 'POST {endpoint}',
			},
			{
				heading: 'Create an access token',
				paragraphs: [
					'In the app, open “Settings → API-Tokens” and create a token. The plaintext is shown only once — store it right away. Every request needs the token in the HTTP header “Authorization: Bearer <token>”.',
					'Plan limits: reading (balance and tasks) is available from Plus, reading and writing from Pro. The pricing table in the app has the details.',
				],
			},
			{
				heading: 'Connect Claude',
				claudeCta: 'Connect Balamentum in Claude',
				paragraphs: ['The one-click link opens Claude with the connector dialog prefilled (name and endpoint URL):'],
				items: [
					'Alternatively manual: “Settings → Connectors → Add custom connector” and enter {endpoint} as the server URL.',
				],
			},
			{
				heading: 'Connect ChatGPT',
				paragraphs: ['ChatGPT attaches custom MCP servers through developer mode (ChatGPT Plus or Pro):'],
				items: [
					'Enable Developer Mode under “Settings → Apps & Connectors → Advanced”.',
					'Click “Create” under “Connectors” and enter {endpoint} as the server URL.',
					'Select the connector — ChatGPT now understands the Balamentum tools.',
				],
			},
			{
				heading: 'Example prompts',
				paragraphs: ['To try it out — the assistant picks the matching Balamentum tools on its own:'],
				items: [
					'“Ask for your balance” — shows the current state of your life balance pillars (tool balance_status).',
					'“Plan my week based on my balance” — suggests the next tasks, weighted by your balance (tools next_task and task_list).',
				],
			},
		],
	},
};
