import { KolAlert } from '@public-ui/react-v19';

/**
 * Fair-Use-Hinweis der KI-Hilfe (#1783 AK5): erscheint erst, wenn eine Antwort gedrosselt kam oder
 * eine Anfrage mit 429 `ai_throttled` abgewiesen wurde — freundlich (`info`), nie mit einer Anzahl
 * verbleibender Anfragen. Ohne Hinweis rendert die Komponente nichts.
 */
export const AiQuotaHint = ({ message }: { message: string | null }) =>
	message === null ? null : (
		<KolAlert _type="info" _label="KI-Hilfe etwas langsamer">
			{message}
		</KolAlert>
	);
