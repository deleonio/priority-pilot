import { KolButton } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface CopyButtonProps {
	text: string;
	ariaLabel: string;
	onSuccess?: () => void;
	onError?: (message: string) => void;
}

/**
 * Icon-only copy button with visual feedback on success.
 * Wraps the copy action in a click handler for testability (see ButtonAction pattern).
 */
export const CopyButton = ({ text, ariaLabel, onSuccess, onError }: CopyButtonProps) => {
	const { t } = useTranslation('dashboard');
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	const handleCopy = async (): Promise<void> => {
		try {
			if (!navigator.clipboard) {
				throw new Error('Clipboard API nicht verfügbar');
			}
			await navigator.clipboard.writeText(text);
			setCopied(true);
			onSuccess?.();
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
			timeoutRef.current = setTimeout(() => setCopied(false), 2000);
		} catch {
			onError?.(t('copyButton.error'));
		}
	};

	return (
		<span className="copy-button" onClick={handleCopy}>
			<KolButton
				_label={ariaLabel}
				_hideLabel={true}
				_variant="secondary"
				_icons={{ left: { icon: copied ? 'kolicon-check-marked' : 'fa-solid fa-copy' } }}
			/>
		</span>
	);
};
