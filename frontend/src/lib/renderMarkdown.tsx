import type { JSX, ReactNode } from 'react';

/**
 * Minimaler, sicherer Markdown-Renderer für das Nutzerhandbuch (#229).
 *
 * Bewusst schlank gehalten und ohne zusätzliche Abhängigkeit: Er deckt genau die Konstrukte ab, die
 * im Handbuch (`docs/user-guide.md`) vorkommen — Überschriften (`#`/`##`/`###`), Absätze, ungeordnete
 * Listen sowie Inline-Auszeichnungen (`**fett**`, `_kursiv_`, `` `code` ``). Es wird KEIN HTML per
 * `dangerouslySetInnerHTML` eingespeist; alle Knoten entstehen als echte React-Elemente. Dadurch
 * werden `#`/`##`-Überschriften zu echten `<h1>`/`<h2>`-Elementen im Light-DOM (Anforderung AK4).
 */

let inlineKey = 0;

/** Löst die Inline-Auszeichnungen einer Textzeile in React-Knoten auf. */
const renderInline = (text: string): ReactNode[] => {
	// Reihenfolge der Alternativen ist wichtig: Code (schützt seinen Inhalt) vor Fett vor Kursiv.
	const pattern = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g;
	const nodes: ReactNode[] = [];
	let lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = pattern.exec(text)) !== null) {
		if (match.index > lastIndex) {
			nodes.push(text.slice(lastIndex, match.index));
		}
		const token = match[0];
		const key = `i${(inlineKey += 1)}`;
		if (token.startsWith('`')) {
			nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
		} else if (token.startsWith('**')) {
			nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
		} else {
			nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
		}
		lastIndex = match.index + token.length;
	}
	if (lastIndex < text.length) {
		nodes.push(text.slice(lastIndex));
	}
	return nodes;
};

/**
 * Wandelt einen Markdown-String in eine Liste von React-Block-Elementen um (Überschriften, Absätze,
 * Listen). Zeilenbasiert; leere Zeilen trennen Absätze.
 */
export const renderMarkdown = (markdown: string): ReactNode => {
	inlineKey = 0;
	const lines = markdown.replace(/\r\n/g, '\n').split('\n');
	const blocks: JSX.Element[] = [];

	let listItems: string[] | null = null;
	let paragraph: string[] | null = null;
	let blockKey = 0;

	const flushList = (): void => {
		if (listItems !== null) {
			const items = listItems;
			blocks.push(
				<ul key={`b${(blockKey += 1)}`}>
					{items.map((item, index) => (
						<li key={index}>{renderInline(item)}</li>
					))}
				</ul>,
			);
			listItems = null;
		}
	};

	const flushParagraph = (): void => {
		if (paragraph !== null) {
			const text = paragraph.join(' ');
			blocks.push(<p key={`b${(blockKey += 1)}`}>{renderInline(text)}</p>);
			paragraph = null;
		}
	};

	for (const rawLine of lines) {
		const line = rawLine.trimEnd();
		const heading = /^(#{1,6})\s+(.*)$/.exec(line);
		const listItem = /^[-*]\s+(.*)$/.exec(line);

		if (heading !== null) {
			flushList();
			flushParagraph();
			const level = heading[1].length;
			const content = renderInline(heading[2]);
			const key = `b${(blockKey += 1)}`;
			const Tag = `h${level}` as keyof JSX.IntrinsicElements;
			blocks.push(<Tag key={key}>{content}</Tag>);
			continue;
		}

		if (listItem !== null) {
			flushParagraph();
			if (listItems === null) {
				listItems = [];
			}
			listItems.push(listItem[1]);
			continue;
		}

		if (line.trim() === '') {
			flushList();
			flushParagraph();
			continue;
		}

		// Fortlaufende Absatz-Zeile (auch eingerückte Folgezeilen eines Listenpunkts hängen wir an
		// den zuletzt geöffneten Block an: an die Liste, falls offen, sonst an den Absatz).
		if (listItems !== null) {
			listItems[listItems.length - 1] += ` ${line.trim()}`;
			continue;
		}
		if (paragraph === null) {
			paragraph = [];
		}
		paragraph.push(line.trim());
	}

	flushList();
	flushParagraph();

	return blocks;
};
