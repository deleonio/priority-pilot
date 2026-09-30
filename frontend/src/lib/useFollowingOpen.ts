import { useEffect, useState } from 'react';

/**
 * Klappzustand eines `KolDetails`, der `open` folgt, sich aber per Nutzerklick unabhängig davon
 * umschalten lässt (#1552-Muster): ein rein gesteuertes `_open={open}` ohne Handler wird vom
 * nächsten unbeteiligten Re-Render zurückreconciliert.
 */
export const useFollowingOpen = (open: boolean) => {
	const [detailOpen, setDetailOpen] = useState(open);
	useEffect(() => setDetailOpen(open), [open]);
	return {
		_open: detailOpen,
		_on: { onToggle: (_event: Event, value?: boolean) => setDetailOpen(value === true) },
	};
};
