/**
 * Text der Zugänglichkeitserklärung nach § 14 BFSG (#2769): Deutsch unter der festen URL
 * `/barrierefreiheit/`, Englisch unter `/en/accessibility/`, Muster `withdrawal.ts`. Der
 * Mailto-Link im Feedback-Abschnitt setzt `renderAccessibility` mit der Adresse aus
 * `operator.ts`. Konformitätsgrad und Einschränkungen sind Entwurf und werden vor dem
 * Live-Gang vom Menschen freigegeben.
 */
export interface AccessibilitySection {
	heading: string;
	paragraphs: string[];
	/** Beschriftung des Mailto-Links, der dem Abschnitt mit der Betreiber-Adresse nachgestellt wird. */
	feedbackMailto?: string;
}

export interface AccessibilityText {
	title: string;
	intro: string;
	description: string;
	sections: AccessibilitySection[];
}

const DE: AccessibilityText = {
	title: 'Erklärung zur Barrierefreiheit',
	intro:
		'Barrierefreiheit ist uns wichtig. Diese Erklärung beschreibt, wie zugänglich diese Website und die Balamentum-App sind, welche Einschränkungen bekannt sind und wie du uns Feedback gibst.',
	description:
		'Erklärung zur Barrierefreiheit von Balamentum: angestrebter Konformitätsgrad (WCAG 2.2), bekannte Einschränkungen, Feedback-Kontakt und Durchsetzungsstelle nach dem BFSG.',
	sections: [
		{
			heading: 'Konformitätsgrad',
			paragraphs: [
				'Diese Website ist darauf ausgelegt, die Web Content Accessibility Guidelines (WCAG) 2.2 auf Stufe AA zu erfüllen. Angestrebt wird der Konformitätsgrad WCAG 2.2 Stufe AA.',
				'Eine formale, externe Prüfung (zum Beispiel ein BITV-Test) liegt noch nicht vor; diese Einschätzung beruht auf eigener Bewertung. Das Ergebnis einer Prüfung tragen wir hier nach.',
			],
		},
		{
			heading: 'Bekannte Einschränkungen',
			paragraphs: [
				'Derzeit sind uns keine dauerhaften Einschränkungen dieser Website bekannt. Es handelt sich um eine Selbsteinschätzung ohne abgeschlossene externe Prüfung; Erkenntnisse aus Rückmeldungen oder einer Prüfung ergänzen wir an dieser Stelle.',
			],
		},
		{
			heading: 'Feedback',
			paragraphs: [
				'Hilf uns, diese Website zugänglicher zu machen: Wenn du auf Barrieren stößt oder Verbesserungsvorschläge hast, melde dich gern bei uns. Wir melden uns in der Regel innerhalb von fünf Werktagen.',
			],
			feedbackMailto: 'Schreib uns eine E-Mail',
		},
		{
			heading: 'Durchsetzungsstelle',
			paragraphs: [
				'Auf digitale Dienstleistungen ist das Barrierefreiheitsstärkungsgesetz (BFSG) anwendbar. Wenn wir dein Feedback nicht zufriedenstellend beantworten, kannst du die Durchsetzungsstelle nach § 14 BFSG einschalten. Welche Stelle konkret zuständig ist, tragen wir hier nach, sobald sie benannt ist.',
			],
		},
	],
};

const EN: AccessibilityText = {
	title: 'Accessibility statement',
	intro:
		'Accessibility matters to us. This statement describes how accessible this website and the Balamentum app are, which limitations are known and how to give us feedback.',
	description:
		'Accessibility statement for Balamentum: aimed-for conformance level (WCAG 2.2), known limitations, feedback contact and enforcement under the BFSG.',
	sections: [
		{
			heading: 'Conformance status',
			paragraphs: [
				'This website is designed to conform to the Web Content Accessibility Guidelines (WCAG) 2.2, Level AA. The aimed-for conformance level is WCAG 2.2 Level AA.',
				'A formal external audit (such as a BITV assessment) has not yet been carried out; this assessment is our own. We will publish the outcome of an audit here.',
			],
		},
		{
			heading: 'Known limitations',
			paragraphs: [
				'We are currently not aware of any lasting limitations of this website. This is a self-assessment without a completed external audit; findings from feedback or an audit will be added here.',
			],
		},
		{
			heading: 'Feedback',
			paragraphs: [
				'Help us make this website more accessible: if you run into barriers or have suggestions for improvement, please get in touch. We usually reply within five business days.',
			],
			feedbackMailto: 'Send us an email',
		},
		{
			heading: 'Enforcement',
			paragraphs: [
				'As a digital service offered in Germany, Balamentum falls under the German Accessibility Strengthening Act (Barrierefreiheitsstärkungsgesetz, BFSG). If our response to your feedback is not satisfactory, you can contact the enforcement body under Section 14 BFSG. We will name the competent enforcement body here once it has been determined.',
			],
		},
	],
};

export const ACCESSIBILITY: Record<'de' | 'en', AccessibilityText> = { de: DE, en: EN };
