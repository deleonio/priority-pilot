import { KolButton } from '@public-ui/react-v19';
import { useState, type ReactNode } from 'react';

interface CopyButtonProps {
	text: string;
	ariaLabel: string;
	onSuccess?: () => void;
	children?: ReactNode;
}

/**
 * Icon-only copy button with visual feedback on success.
 * Wraps the copy action in a click handler for testability (see ButtonAction pattern).
 */
export const CopyButton = ({ text, ariaLabel, onSuccess, children }: CopyButtonProps) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (): Promise<void> => {
		try {
			await navigator.clipboard?.writeText(text);
			setCopied(true);
			onSuccess?.();
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Errors handled by parent component via KolAlert
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
			{children}
		</span>
	);
};
