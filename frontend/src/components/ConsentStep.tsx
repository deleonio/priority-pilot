import { KolDetails } from '@public-ui/react-v19';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api';

/** Rechtsseiten der öffentlichen Website (#1891, #1892) — einzige Textquelle, same-origin geladen (#2227). */
const LEGAL_LINKS = { terms: '/nutzungsbedingungen/', privacy: '/datenschutz/' } as const;

type LegalKey = keyof typeof LEGAL_LINKS;
type LegalText = { status: 'loading' | 'error' } | { status: 'ready'; html: string };

/**
 * Übernimmt nur den Inhalt von `main#main` der Website-Seite (#2227): aktive Elemente und
 * `on*`-Attribute entfallen, Überschriften rücken um zwei Ebenen (der Schritt hat die einzige
 * `<h1>`), Links öffnen in neuem Tab, Tabellen scrollen im eigenen Wrapper.
 */
const extractLegalHtml = (page: string, path: string): string => {
	const main = new DOMParser().parseFromString(page, 'text/html').querySelector('main#main');
	if (!main) throw new Error('main#main fehlt');
	main.querySelectorAll('script, style, iframe, object, embed, link').forEach((node) => node.remove());
	main.querySelectorAll('*').forEach((node) => {
		[...node.attributes].forEach((attr) => {
			if (attr.name.startsWith('on')) node.removeAttribute(attr.name);
		});
	});
	main.querySelectorAll('h1, h2, h3, h4').forEach((heading) => {
		const shifted = document.createElement(`h${Number(heading.tagName[1]) + 2}`);
		shifted.append(...heading.childNodes);
		heading.replaceWith(shifted);
	});
	main.querySelectorAll('a[href]').forEach((link) => {
		const href = new URL(link.getAttribute('href') ?? '', `${window.location.origin}${path}`);
		if (href.protocol === 'http:' || href.protocol === 'https:') {
			link.setAttribute('href', href.href);
			link.setAttribute('target', '_blank');
			link.setAttribute('rel', 'noopener noreferrer');
		} else {
			link.removeAttribute('href');
		}
	});
	main.querySelectorAll('table').forEach((table) => {
		const wrapper = document.createElement('div');
		wrapper.className = 'consent-step__scroll';
		table.replaceWith(wrapper);
		wrapper.append(table);
	});
	return main.innerHTML;
};

/**
 * Zustimmungsschritt nach dem Login (#1901): zwei Haken für Nutzungsbedingungen und
 * Datenschutzerklärung (je Text aufklappbar lesbar, #2227), „Weiter“ erst bei beiden, danach `POST /auth/terms`. Wie `LoginPage` aus
 * rohen Elementen im `.login-page`-Rahmen: der Schritt steht vor der App und teilt deren Optik.
 * Wer nicht zustimmen will, meldet sich ab.
 */
export const ConsentStep = ({ onAccepted }: { onAccepted: () => void }) => {
	const { t, i18n } = useTranslation('messages');
	const [terms, setTerms] = useState(false);
	const [privacy, setPrivacy] = useState(false);
	const [saving, setSaving] = useState(false);
	const [failed, setFailed] = useState(false);
	const [texts, setTexts] = useState<Partial<Record<LegalKey, LegalText>>>({});
	const headingRef = useRef<HTMLHeadingElement>(null);

	useEffect(() => {
		headingRef.current?.focus();
	}, []);

	const complete = terms && privacy;

	const save = (): void => {
		setSaving(true);
		setFailed(false);
		api
			.acceptTerms()
			.then(onAccepted)
			.catch(() => {
				setFailed(true);
				setSaving(false);
			});
	};

	const logout = (): void => {
		// Wie der Logout in `App.tsx`: kein stiller Re-Login direkt danach.
		void api
			.logout()
			.catch(() => undefined)
			.finally(() => {
				sessionStorage.setItem('pp_just_logged_out', '1');
				window.location.href = `${import.meta.env.BASE_URL}login`;
			});
	};

	/** Lädt den Rechtstext beim ersten Aufklappen; geladene Texte bleiben, Fehler dürfen erneut versucht werden. */
	const loadText = (key: LegalKey): void => {
		if (texts[key]?.status === 'ready' || texts[key]?.status === 'loading') return;
		setTexts((current) => ({ ...current, [key]: { status: 'loading' } }));
		fetch(LEGAL_LINKS[key])
			.then((response) => (response.ok ? response.text() : Promise.reject(new Error(String(response.status)))))
			.then((page) =>
				setTexts((current) => ({
					...current,
					[key]: { status: 'ready', html: extractLegalHtml(page, LEGAL_LINKS[key]) },
				})),
			)
			.catch(() => setTexts((current) => ({ ...current, [key]: { status: 'error' } })));
	};

	const text = (key: LegalKey, link: string) => {
		const entry = texts[key];
		if (entry?.status === 'loading') return <p aria-live="polite">{t('consent.loading')}</p>;
		if (entry?.status === 'error') {
			return (
				<div role="alert" className="login-page__alert">
					{t('consent.loadFailed')}{' '}
					<a
						className="consent-step__link"
						href={LEGAL_LINKS[key]}
						target="_blank"
						rel="noopener noreferrer"
						hrefLang="de"
					>
						{link} {t('consent.newTab')}
					</a>
				</div>
			);
		}
		if (entry?.status === 'ready') {
			return (
				<div
					className="consent-step__text"
					role="region"
					tabIndex={0}
					aria-label={link}
					dangerouslySetInnerHTML={{ __html: entry.html }}
				/>
			);
		}
		return null;
	};

	const item = (
		key: LegalKey,
		checked: boolean,
		onChange: (value: boolean) => void,
		label: string,
		read: string,
		link: string,
	) => (
		<div className="consent-step__item">
			<label className="consent-step__check">
				<input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
				{label}
			</label>
			<KolDetails _label={read} _open={false} _on={{ onToggle: (_event, open) => open && loadText(key) }}>
				{text(key, link)}
			</KolDetails>
		</div>
	);

	return (
		<div className="login-page">
			<div className="login-page__inner">
				<div className="login-page__card">
					<h1 ref={headingRef} tabIndex={-1} className="login-page__title">
						{t('consent.title')}
					</h1>
					<p className="login-page__sub">{t('consent.intro')}</p>
					<fieldset className="consent-step__group">
						<legend className="visually-hidden">{t('consent.legend')}</legend>
						{item('terms', terms, setTerms, t('consent.acceptTerms'), t('consent.readTerms'), t('consent.termsLink'))}
						{item(
							'privacy',
							privacy,
							setPrivacy,
							t('consent.acceptPrivacy'),
							t('consent.readPrivacy'),
							t('consent.privacyLink'),
						)}
					</fieldset>
					{(i18n.resolvedLanguage ?? i18n.language) !== 'de' && (
						<p className="consent-step__hint">{t('legal.germanOnly')}</p>
					)}
					{failed && (
						<div role="alert" className="login-page__alert">
							{t('consent.error')}
						</div>
					)}
					<button
						type="button"
						className="login-page__btn login-page__btn--primary"
						disabled={!complete || saving}
						aria-describedby={complete ? undefined : 'consent-step-hint'}
						onClick={save}
					>
						{t('consent.continue')}
					</button>
					{!complete && (
						<p id="consent-step-hint" className="consent-step__hint">
							{t('consent.hint')}
						</p>
					)}
				</div>
				<button type="button" className="login-page__back consent-step__logout" onClick={logout}>
					{t('consent.logout')}
				</button>
			</div>
		</div>
	);
};
