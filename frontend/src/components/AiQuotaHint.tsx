import { KolAlert } from '@public-ui/react-v19';
import { useTranslation } from 'react-i18next';

/**
 * Fair-Use-Hinweis der KI-Hilfe (#1783 AK5): erscheint erst, wenn eine Antwort gedrosselt kam oder
 * eine Anfrage mit 429 `ai_throttled` abgewiesen wurde — freundlich (`info`), nie mit einer Anzahl
 * verbleibender Anfragen. Ohne Hinweis rendert die Komponente nichts.
 */
export const AiQuotaHint = ({ message }: { message: string | null }) => {
	const { t } = useTranslation('billing');
	return message === null ? null : (
		<KolAlert _type="info" _label={t('aiQuotaHint.label')}>
			{message}
		</KolAlert>
	);
};
