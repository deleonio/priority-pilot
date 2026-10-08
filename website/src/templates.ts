/** Datenquelle liegt einmal im Server (#1993, Muster `plans.ts`); die Website rendert sie nur. */
import type { LifeTemplate } from '../../server/src/logics/templates.ts';

export { TEMPLATES } from '../../server/src/logics/templates.ts';
export type { LifeTemplate } from '../../server/src/logics/templates.ts';

/**
 * Englische Fassung der Vorlagen für `/en/templates/` je deutschem Slug: eigener Slug, Titel,
 * Beschreibung und Schritttitel je Schritt-`id`. Reihenfolge und Abhängigkeiten kommen aus `TEMPLATES`.
 */
export const TEMPLATES_EN: Record<
	string,
	{ slug: string; title: string; description: string; steps: Record<string, string> }
> = {
	hausbau: {
		slug: 'building-a-house',
		title: 'Building a house',
		description: 'From financing to moving in: a checklist for building a house in a sensible order.',
		steps: {
			budget: 'Clarify budget and equity',
			grundstueck: 'Find and check a plot',
			finanzierung: 'Arrange construction financing',
			bauantrag: 'Apply for planning permission',
			bauvertrag: 'Sign the construction contract',
			rohbau: 'Oversee and accept the shell',
			ausbau: 'Agree on the interior finishing',
			abnahme: 'Accept the house and document defects',
			einzug: 'Move in and update your registrations',
		},
	},
	umzug: {
		slug: 'moving-house',
		title: 'Moving house',
		description: 'Moving without chaos: notices, appointments and registrations in the right order.',
		steps: {
			mietvertrag: 'Give notice on the old flat',
			'neue-wohnung': 'Commit to the new flat',
			termin: 'Set the moving date and helpers or removal company',
			vertraege: 'Transfer electricity, internet and insurance',
			packen: 'Pack and label boxes',
			umzugstag: 'Carry out moving day and note the meter readings',
			uebergabe: 'Hand over the old flat',
			ummelden: 'Register your new address with the registration office',
		},
	},
	steuererklaerung: {
		slug: 'tax-return',
		title: 'Tax return',
		description: 'Preparing your tax return: collect receipts, fill in the forms and file on time.',
		steps: {
			frist: 'Check the filing deadline',
			belege: 'Collect the payroll tax certificate and receipts',
			werbungskosten: 'Compile work-related expenses and special expenses',
			formular: 'Fill in the tax forms',
			abgabe: 'File the return electronically',
			bescheid: 'Check the tax assessment',
			einspruch: 'Lodge an objection in time if there are errors',
		},
	},
	hochzeit: {
		slug: 'wedding',
		title: 'Wedding',
		description: 'Planning a wedding: from the date to the registry office and venue to the celebration.',
		steps: {
			budget: 'Set the budget and number of guests',
			termin: 'Choose the date',
			standesamt: 'Register with the registry office',
			location: 'Book venue and catering',
			einladungen: 'Send out invitations',
			dienstleister: 'Book photographer and music',
			feier: 'Hold the ceremony and celebration',
			namensaenderung: 'Report the name change to authorities and banks',
		},
	},
	'geburt-elternzeit': {
		slug: 'birth-and-parental-leave',
		title: 'Birth and parental leave',
		description: 'Organising birth and parental leave: applications, deadlines and visits to authorities at a glance.',
		steps: {
			mutterschutz: 'Agree maternity protection with your employer',
			klinik: 'Register with a hospital or midwife',
			geburt: 'Birth',
			urkunde: 'Apply for the birth certificate at the registry office',
			versicherung: 'Arrange health insurance for the child',
			elternzeit: 'Apply for parental leave with your employer',
			elterngeld: 'Apply for parental allowance',
			kindergeld: 'Apply for child benefit',
		},
	},
	jobwechsel: {
		slug: 'changing-jobs',
		title: 'Changing jobs',
		description: 'Preparing a job change properly: resignation, handover and starting at the new company.',
		steps: {
			unterlagen: 'Update your application documents',
			zusage: 'Check and sign the new contract',
			kuendigung: 'Hand in your resignation',
			zeugnis: 'Request a reference letter',
			uebergabe: 'Hand over tasks and knowledge',
			resturlaub: 'Settle remaining leave and overtime',
			start: 'Start at the new company',
		},
	},
};

/** Vorlage in der Sprache der Seite; Deutsch ist die Datenquelle selbst. */
export const localizeTemplate = (template: LifeTemplate, lang: 'de' | 'en'): LifeTemplate => {
	if (lang === 'de') return template;
	const en = TEMPLATES_EN[template.slug];
	return {
		slug: en.slug,
		title: en.title,
		description: en.description,
		steps: template.steps.map((step) => ({ ...step, title: en.steps[step.id] })),
	};
};

export const TEMPLATE_TEXT = {
	de: {
		title: 'Vorlagen für Lebensprojekte',
		description:
			'Checklisten für Hausbau, Umzug, Steuererklärung und weitere Lebensprojekte in sinnvoller Reihenfolge.',
		lead: 'Checklisten in Abhängigkeitsreihenfolge – jeder Schritt steht nach dem, was davor erledigt sein muss.',
		steps: '{count} Schritte',
		cta: 'In der App starten',
		pageTitle: '{title}-Checkliste',
		checklist: 'Checkliste',
		after: 'nach',
		all: 'Alle Vorlagen',
	},
	en: {
		title: 'Templates for life projects',
		description: 'Checklists for building a house, moving, tax returns and other life projects in a sensible order.',
		lead: 'Checklists in dependency order – each step comes after what has to be done before it.',
		steps: '{count} steps',
		cta: 'Start in the app',
		pageTitle: '{title} checklist',
		checklist: 'Checklist',
		after: 'after',
		all: 'All templates',
	},
} as const;
