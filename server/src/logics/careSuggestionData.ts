/**
 * Kuratierte Fürsorge-Vorlagen als Stammdaten (#1791) — je feste Säule (`SEED_PILLARS`, ids 1–5)
 * mindestens fünf Vorlagen in jeder der zehn App-Sprachen (Spiegel zu `frontend/src/i18n/locales/`;
 * eine neue App-Sprache → `CARE_SPRACHEN` erweitern). Der `key` ist sprachunabhängig und damit
 * stabiler Dismissal-Bezug (`models/careSuggestionDismissal.ts`) — niemals den Titel als Schlüssel
 * nehmen (Sprachwechsel). Texte folgen dem Ton-Leitfaden (`docs/fuersorge-tonalitaet.md`): warm,
 * nicht belehrend, konkret für heute. Kanonische Stammdaten an einer Stelle, Muster
 * `models/pillarData.ts`; #1804 (KI-Vorschläge Plus/Pro) ergänzt später dynamische Vorschläge
 * daneben, statt diesen Katalog zu ersetzen.
 */
export const CARE_SPRACHEN = ['de', 'en', 'es', 'fr', 'it', 'nl', 'pl', 'pt', 'ru', 'sv'] as const;

export type CareSprache = (typeof CARE_SPRACHEN)[number];

interface VorlagenText {
	titel: string;
	beschreibung: string;
}

export const CARE_VORLAGEN: readonly { key: string; saeuleId: number; texte: Record<CareSprache, VorlagenText> }[] = [
	// ── Säule 1: Körper ──
	{
		key: 'koerper-1',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Spaziergang an der frischen Luft',
				beschreibung: 'Ein kurzer Gang um den Block reicht schon – Bewegung wirkt auch in kleinen Portionen.',
			},
			en: {
				titel: 'A walk in the fresh air',
				beschreibung: 'A short walk around the block is enough – movement helps even in small doses.',
			},
			es: {
				titel: 'Un paseo al aire libre',
				beschreibung: 'Con una vuelta corta a la calle basta: el movimiento también ayuda en dosis pequeñas.',
			},
			fr: {
				titel: 'Une marche au grand air',
				beschreibung: 'Un petit tour du quartier suffit : le mouvement fait du bien, même en petites doses.',
			},
			it: {
				titel: 'Una passeggiata all\u2019aria aperta',
				beschreibung: 'Basta un giro breve: il movimento fa bene anche in piccole dosi.',
			},
			nl: {
				titel: 'Een wandeling in de frisse lucht',
				beschreibung: 'Een korte ronde om de buurt is genoeg – beweging helpt ook in kleine porties.',
			},
			pl: {
				titel: 'Spacer na świeżym powietrzu',
				beschreibung: 'Wystarczy krótki spacer wokół bloku – ruch pomaga nawet w małych dawkach.',
			},
			pt: {
				titel: 'Um passeio ao ar livre',
				beschreibung: 'Uma volta curta ao quarteirão já basta – o movimento faz bem mesmo em doses pequenas.',
			},
			ru: {
				titel: 'Прогулка на свежем воздухе',
				beschreibung: 'Достаточно короткой прогулки вокруг дома — движение помогает и в малых дозах.',
			},
			sv: {
				titel: 'En promenad i friska luften',
				beschreibung: 'En kort runda runt kvarteret räcker – rörelse hjälper även i små doser.',
			},
		},
	},
	{
		key: 'koerper-2',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Bewusst früher ins Bett',
				beschreibung: 'Etwas mehr Schlaf ist eine Geste der Fürsorge, kein Versäumnis – dein Körper dankt es dir.',
			},
			en: {
				titel: 'Go to bed a little earlier',
				beschreibung: 'A bit more sleep is an act of care, not a failure – your body will thank you.',
			},
			es: {
				titel: 'Acostarse un poco antes',
				beschreibung: 'Dormir algo más es un gesto de cuidado, no un descuido: tu cuerpo te lo agradece.',
			},
			fr: {
				titel: 'Se coucher un peu plus tôt',
				beschreibung: 'Dormir un peu plus est un geste de soin, pas un manquement – ton corps te dira merci.',
			},
			it: {
				titel: 'Andare a dormire un po\u2019 prima',
				beschreibung:
					'Dormire qualche minuto in più è un gesto di cura, non una mancanza: il tuo corpo te ne sarà grato.',
			},
			nl: {
				titel: 'Bewust iets eerder naar bed',
				beschreibung: 'Wat meer slaap is een gebaar van zorg, geen tekortkoming – je lichaam zegt dank je.',
			},
			pl: {
				titel: 'Położyć się dziś wcześniej',
				beschreibung: 'Więcej snu to gest troski, a nie zaniedbanie – twoje ciało ci podziękuje.',
			},
			pt: {
				titel: 'Dormir um pouco mais cedo',
				beschreibung: 'Dormir um pouco mais é um gesto de cuidado, não uma falha – o seu corpo agradece.',
			},
			ru: {
				titel: 'Лечь спать чуть раньше',
				beschreibung: 'Немного больше сна — это забота о себе, а не упущение: тело скажет спасибо.',
			},
			sv: {
				titel: 'Gå och lägg dig lite tidigare',
				beschreibung: 'Lite extra sömn är en omsorgsgest, inte en brist – din kropp tackar dig.',
			},
		},
	},
	{
		key: 'koerper-3',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Ein Glas Wasser trinken',
				beschreibung: 'Kleine Aufmerksamkeit zählt: trink ein Glas Wasser und atme dabei einmal tief durch.',
			},
			en: {
				titel: 'Drink a glass of water',
				beschreibung: 'Small gestures count: drink a glass of water and take one deep breath.',
			},
			es: {
				titel: 'Beber un vaso de agua',
				beschreibung: 'Los gestos pequeños cuentan: bebe un vaso de agua y respira hondo una vez.',
			},
			fr: {
				titel: 'Boire un verre d\u2019eau',
				beschreibung: 'Les petits gestes comptent : bois un verre d\u2019eau et respire profondément une fois.',
			},
			it: {
				titel: 'Bere un bicchiere d\u2019acqua',
				beschreibung: 'Contano i piccoli gesti: bevi un bicchiere d\u2019acqua e fai un respiro profondo.',
			},
			nl: {
				titel: 'Een glas water drinken',
				beschreibung: 'Kleine gebaren tellen: drink een glas water en adem één keer diep in.',
			},
			pl: {
				titel: 'Wypić szklankę wody',
				beschreibung: 'Liczą się drobne gesty: wypij szklankę wody i weź jeden głęboki oddech.',
			},
			pt: {
				titel: 'Beber um copo de água',
				beschreibung: 'Os gestos pequenos contam: beba um copo de água e respire fundo uma vez.',
			},
			ru: {
				titel: 'Выпить стакан воды',
				beschreibung: 'Маленькие жесты важны: выпейте стакан воды и сделайте один глубокий вдох.',
			},
			sv: {
				titel: 'Dricka ett glas vatten',
				beschreibung: 'Små gester räknas: drick ett glas vatten och ta ett djupt andetag.',
			},
		},
	},
	{
		key: 'koerper-4',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Zehn Minuten dehnen',
				beschreibung: 'Sanftes Dehnen löst Verspannungen – zehn Minuten reichen, um dich leichter zu fühlen.',
			},
			en: {
				titel: 'Ten minutes of stretching',
				beschreibung: 'Gentle stretching eases tension – ten minutes are enough to feel lighter.',
			},
			es: {
				titel: 'Diez minutos de estiramientos',
				beschreibung: 'Estirarte suavemente alivia las tensiones: diez minutos bastan para sentirte más ligero.',
			},
			fr: {
				titel: 'Dix minutes d\u2019étirements',
				beschreibung:
					'S\u2019étirer en douceur relâche les tensions – dix minutes suffisent pour se sentir plus léger.',
			},
			it: {
				titel: 'Dieci minuti di stretching',
				beschreibung: 'Stirarti con dolcezza scioglie le tensioni: dieci minuti bastano per sentirti più leggero.',
			},
			nl: {
				titel: 'Tien minuten rekken en strekken',
				beschreibung: 'Zacht rekken lost spanning op – tien minuten is genoeg om lichter te voelen.',
			},
			pl: {
				titel: 'Dziesięć minut rozciągania',
				beschreibung: 'Łagodne rozciąganie rozluźnia napięcia – dziesięć minut wystarczy, by poczuć się lżej.',
			},
			pt: {
				titel: 'Dez minutos de alongamento',
				beschreibung: 'Alongar suavemente alivia tensões – dez minutos bastam para se sentir mais leve.',
			},
			ru: {
				titel: 'Десять минут растяжки',
				beschreibung: 'Мягкая растяжка снимает напряжение — десяти минут достаточно, чтобы почувствовать себя легче.',
			},
			sv: {
				titel: 'Tio minuters stretchning',
				beschreibung: 'Mjuk stretchning släpper spänningar – tio minuter räcker för att kännas lättare.',
			},
		},
	},
	{
		key: 'koerper-5',
		saeuleId: 1,
		texte: {
			de: {
				titel: 'Kurze Pause ohne Bildschirm',
				beschreibung: 'Deine Augen dürfen ausruhen: schau aus dem Fenster und lass die Gedanken wandern.',
			},
			en: {
				titel: 'A short screen-free break',
				beschreibung: 'Your eyes deserve a rest: look out of the window and let your thoughts wander.',
			},
			es: {
				titel: 'Un descanso breve sin pantallas',
				beschreibung: 'Tus ojos merecen un descanso: mira por la ventana y deja vagar tus pensamientos.',
			},
			fr: {
				titel: 'Une courte pause sans écran',
				beschreibung: 'Tes yeux méritent du repos : regarde par la fenêtre et laisse errer tes pensées.',
			},
			it: {
				titel: 'Una breve pausa senza schermi',
				beschreibung: 'I tuoi occhi meritano una pausa: guarda dalla finestra e lascia vagare i pensieri.',
			},
			nl: {
				titel: 'Even pauze zonder scherm',
				beschreibung: 'Je ogen mogen uitrusten: kijk uit het raam en laat je gedachten dwalen.',
			},
			pl: {
				titel: 'Krótka przerwa bez ekranu',
				beschreibung: 'Twoje oczy zasługują na odpoczynek: spójrz przez okno i pozwól myślom błądzić.',
			},
			pt: {
				titel: 'Uma pausa breve sem ecrã',
				beschreibung: 'Os seus olhos merecem descanso: olhe pela janela e deixe os pensamentos vagarem.',
			},
			ru: {
				titel: 'Короткая пауза без экранов',
				beschreibung: 'Ваши глаза заслужили отдых: посмотрите в окно и дайте мыслям свободно побродить.',
			},
			sv: {
				titel: 'Ett kort avbrott utan skärm',
				beschreibung: 'Dina ögon förtjänar vila: titta ut genom fönstret och låt tankarna vandra.',
			},
		},
	},
	// ── Säule 2: Mentale Gesundheit ──
	{
		key: 'mental-1',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Fünf Minuten bewusst atmen',
				beschreibung: 'Setz dich bequem hin und atme fünfmal tief ein und aus – das nimmt den Druck von heute.',
			},
			en: {
				titel: 'Breathe consciously for five minutes',
				beschreibung: 'Sit comfortably and take five slow breaths in and out – it eases the pressure of today.',
			},
			es: {
				titel: 'Cinco minutos de respiración consciente',
				beschreibung: 'Siéntate cómodamente y respira cinco veces profundo: eso quita presión al día.',
			},
			fr: {
				titel: 'Cinq minutes de respiration consciente',
				beschreibung:
					'Installe-toi confortablement et respire cinq fois profondément – cela allège la pression du jour.',
			},
			it: {
				titel: 'Cinque minuti di respirazione consapevole',
				beschreibung: 'Siediti comodamente e respira a fondo cinque volte – alleggerisce la pressione di oggi.',
			},
			nl: {
				titel: 'Vijf minuten bewust ademen',
				beschreibung: 'Ga lekker zitten en adem vijf keer diep in en uit – dat haalt de druk van vandaag af.',
			},
			pl: {
				titel: 'Pięć minut świadomego oddychania',
				beschreibung: 'Usiądź wygodnie i weź pięć głębokich oddechów – to zdejmuje presję dzisiejszego dnia.',
			},
			pt: {
				titel: 'Cinco minutos de respiração consciente',
				beschreibung: 'Sente-se confortavelmente e respire fundo cinco vezes – isso alivia a pressão do dia.',
			},
			ru: {
				titel: 'Пять минут осознанного дыхания',
				beschreibung: 'Устройтесь удобно и сделайте пять глубоких вдохов и выдохов — это снимает напряжение дня.',
			},
			sv: {
				titel: 'Fem minuters medveten andning',
				beschreibung: 'Sätt dig bekvämt och andas långsamt fem gånger – det tar pressen av dagen.',
			},
		},
	},
	{
		key: 'mental-2',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Drei Dankbarkeiten notieren',
				beschreibung: 'Schreib drei Dinge auf, die heute gut waren – kleine Momente zählen ausdrücklich mit.',
			},
			en: {
				titel: 'Note three things you are grateful for',
				beschreibung: 'Write down three things that were good today – small moments count, explicitly.',
			},
			es: {
				titel: 'Anotar tres motivos de gratitud',
				beschreibung: 'Escribe tres cosas buenas de hoy – los momentos pequeños cuentan también.',
			},
			fr: {
				titel: 'Noter trois raisons de gratitude',
				beschreibung: 'Écris trois choses qui ont été bien aujourd\u2019hui – les petits moments comptent aussi.',
			},
			it: {
				titel: 'Annotare tre motivi di gratitudine',
				beschreibung: 'Scrivi tre cose che oggi sono andate bene – anche i piccoli momenti contano.',
			},
			nl: {
				titel: 'Drie dankmomenten opschrijven',
				beschreibung: 'Schrijf drie dingen op die vandaag goed waren – juist kleine momenten tellen mee.',
			},
			pl: {
				titel: 'Zapisać trzy powody do wdzięczności',
				beschreibung: 'Zapisz trzy rzeczy, które dziś były dobre – małe momenty też się liczą.',
			},
			pt: {
				titel: 'Anotar três motivos de gratidão',
				beschreibung: 'Escreva três coisas boas de hoje – os momentos pequenos também contam.',
			},
			ru: {
				titel: 'Записать три повода для благодарности',
				beschreibung: 'Напишите три вещи, которые сегодня были хороши — малые моменты тоже в счёт.',
			},
			sv: {
				titel: 'Skriva ner tre tacksamheter',
				beschreibung: 'Skriv ner tre saker som var bra idag – små stunder räknas också.',
			},
		},
	},
	{
		key: 'mental-3',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Eine kurze Achtsamkeitspause',
				beschreibung: 'Ein paar Minuten achtsam sein ist keine verlorene Zeit, sondern eine Pause, die trägt.',
			},
			en: {
				titel: 'A short mindfulness pause',
				beschreibung: 'A few mindful minutes are not wasted time but a pause that carries you.',
			},
			es: {
				titel: 'Una breve pausa de atención plena',
				beschreibung: 'Unos minutos de atención plena no son tiempo perdido, sino una pausa que sostiene.',
			},
			fr: {
				titel: 'Une courte pause de pleine conscience',
				beschreibung: 'Quelques minutes de pleine conscience ne sont pas du temps perdu, mais une pause qui porte.',
			},
			it: {
				titel: 'Una breve pausa di consapevolezza',
				beschreibung: 'Alcuni minuti di consapevolezza non sono tempo perso, ma una pausa che sostiene.',
			},
			nl: {
				titel: 'Een korte mindfulnesspauze',
				beschreibung: 'Een paar minuten mindful zijn is geen verloren tijd, maar een pauze die draagt.',
			},
			pl: {
				titel: 'Krótka pauza uważności',
				beschreibung: 'Kilka minut uważności to nie stracony czas, tylko przerwa, która podtrzymuje.',
			},
			pt: {
				titel: 'Uma breve pausa de atenção plena',
				beschreibung: 'Alguns minutos de atenção plena não são tempo perdido, mas uma pausa que sustenta.',
			},
			ru: {
				titel: 'Короткая пауза осознанности',
				beschreibung: 'Несколько минут осознанности — не потерянное время, а пауза, которая поддерживает.',
			},
			sv: {
				titel: 'En kort paus för närvaro',
				beschreibung: 'Några minuter av närvaro är inte förlorad tid, utan en paus som bär.',
			},
		},
	},
	{
		key: 'mental-4',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Drei Sätze ins Tagebuch',
				beschreibung: 'Schreib auf, was dich heute beschäftigt – auf Papier darf sein, was da ist.',
			},
			en: {
				titel: 'Three sentences in your journal',
				beschreibung: 'Write down what is on your mind today – on paper, whatever is there is allowed.',
			},
			es: {
				titel: 'Tres frases en el diario',
				beschreibung: 'Escribe lo que te ocupa hoy: en el papel cabe todo lo que sientas.',
			},
			fr: {
				titel: 'Trois phrases dans ton carnet',
				beschreibung: 'Note ce qui t\u2019occupe aujourd\u2019hui – sur le papier, tout ce qui est là a sa place.',
			},
			it: {
				titel: 'Tre frasi nel diario',
				beschreibung: 'Scrivi ciò che ti occupa oggi – sulla carta è permesso tutto ciò che senti.',
			},
			nl: {
				titel: 'Drie zinnen in je dagboek',
				beschreibung: 'Schrijf op wat je vandaag bezighoudt – op papier mag er alles zijn wat er is.',
			},
			pl: {
				titel: 'Trzy zdania w dzienniku',
				beschreibung: 'Zapisz, co dziś zajmuje twoje myśli – na papierze może być wszystko, co czujesz.',
			},
			pt: {
				titel: 'Três frases no diário',
				beschreibung: 'Escreva o que lhe ocupa hoje – no papel cabe tudo o que sente.',
			},
			ru: {
				titel: 'Три предложения в дневнике',
				beschreibung: 'Запишите, что занимает вас сегодня — на бумаге позволено всё, что есть.',
			},
			sv: {
				titel: 'Tre meningar i dagboken',
				beschreibung: 'Skriv ner det som upptar dig idag – på papperet får allt som finns vara.',
			},
		},
	},
	{
		key: 'mental-5',
		saeuleId: 2,
		texte: {
			de: {
				titel: 'Eine Stunde ohne Handy',
				beschreibung: 'Eine Auszeit vom Bildschirm schenkt dir Raum – die Welt wartet geduldig.',
			},
			en: {
				titel: 'One hour without your phone',
				beschreibung: 'A break from the screen gives you room – the world will wait patiently.',
			},
			es: {
				titel: 'Una hora sin móvil',
				beschreibung: 'Un descanso de la pantalla te da espacio – el mundo puede esperar con paciencia.',
			},
			fr: {
				titel: 'Une heure sans téléphone',
				beschreibung: 'Une pause loin de l\u2019écran te fait de la place – le monde attend patiemment.',
			},
			it: {
				titel: 'Un\u2019ora senza telefono',
				beschreibung: 'Una pausa dallo schermo ti regala spazio – il mondo aspetta con pazienza.',
			},
			nl: {
				titel: 'Een uur zonder telefoon',
				beschreibung: 'Een pauze van het scherm geeft je ruimte – de wereld wacht geduldig.',
			},
			pl: {
				titel: 'Godzina bez telefonu',
				beschreibung: 'Przerwa od ekranu daje ci przestrzeń – świat cierpliwie poczeka.',
			},
			pt: {
				titel: 'Uma hora sem telemóvel',
				beschreibung: 'Uma pausa do ecrã dá-lhe espaço – o mundo espera com paciência.',
			},
			ru: { titel: 'Час без телефона', beschreibung: 'Пауза без экрана даёт пространство — мир терпеливо подождёт.' },
			sv: {
				titel: 'En timme utan mobil',
				beschreibung: 'En paus från skärmen ger dig utrymme – världen väntar tålmodigt.',
			},
		},
	},
	// ── Säule 3: Beziehungen ──
	{
		key: 'beziehungen-1',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Einer wichtigen Person schreiben',
				beschreibung: 'Ein kurzer Gruß verbindet – auch mitten in einem vollen Alltag.',
			},
			en: {
				titel: 'Write to someone who matters',
				beschreibung: 'A short greeting connects – even in the middle of a busy day.',
			},
			es: {
				titel: 'Escribir a alguien importante',
				beschreibung: 'Un saludo breve conecta – incluso en pleno día a día.',
			},
			fr: {
				titel: 'Écrire à quelqu\u2019un qui compte',
				beschreibung: 'Un petit mot connecte – même en plein quotidien.',
			},
			it: {
				titel: 'Scrivere a una persona cara',
				beschreibung: 'Un saluto breve crea legami – anche in mezzo a una giornata piena.',
			},
			nl: {
				titel: 'Schrijven naar iemand die je dierbaar is',
				beschreibung: 'Een kort groetje verbindt – ook midden in een drukke dag.',
			},
			pl: {
				titel: 'Napisać do bliskiej osoby',
				beschreibung: 'Krótkie pozdrowienie łączy – nawet w środku zabieganego dnia.',
			},
			pt: {
				titel: 'Escrever a alguém querido',
				beschreibung: 'Uma saudação breve aproxima – mesmo no meio de um dia cheio.',
			},
			ru: {
				titel: 'Написать дорогому человеку',
				beschreibung: 'Короткое приветствие сближает — даже среди загруженного дня.',
			},
			sv: {
				titel: 'Skriva till någon du bryr dig om',
				beschreibung: 'En kort hälsning skapar förbindelse – även mitt i en fullspäckad dag.',
			},
		},
	},
	{
		key: 'beziehungen-2',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Anrufen statt tippen',
				beschreibung: 'Stimmen verbinden mehr als Nachrichten: ein kurzer Anruf reicht, um Nähe zu spüren.',
			},
			en: {
				titel: 'Call instead of typing',
				beschreibung: 'Voices connect more than messages: a brief call is enough to feel close.',
			},
			es: {
				titel: 'Llamar en vez de escribir',
				beschreibung: 'Las voces conectan más que los mensajes: una llamada corta basta para sentir cercanía.',
			},
			fr: {
				titel: 'Appeler plutôt qu\u2019écrire',
				beschreibung: 'Les voix relient plus que les messages : un court appel suffit pour se sentir proche.',
			},
			it: {
				titel: 'Chiamare invece di scrivere',
				beschreibung: 'Le voci uniscono più dei messaggi: una breve chiamata basta per sentire vicinanza.',
			},
			nl: {
				titel: 'Bellen in plaats van typen',
				beschreibung: 'Stemmen verbinden meer dan berichten: een kort telefoontje is genoeg om nabijheid te voelen.',
			},
			pl: {
				titel: 'Zadzwonić zamiast pisać',
				beschreibung: 'Głosy łączą bardziej niż wiadomości: krótka rozmowa wystarczy, by poczuć bliskość.',
			},
			pt: {
				titel: 'Ligar em vez de escrever',
				beschreibung: 'As vozes ligam mais do que as mensagens: uma chamada curta basta para sentir proximidade.',
			},
			ru: {
				titel: 'Позвонить вместо сообщения',
				beschreibung: 'Голоса сближают больше, чем сообщения: короткого звонка достаточно для чувства близости.',
			},
			sv: {
				titel: 'Ringa i stället för att skriva',
				beschreibung: 'Röster förbinder mer än meddelanden: ett kort samtal räcker för att känna närhet.',
			},
		},
	},
	{
		key: 'beziehungen-3',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Gemeinsam essen',
				beschreibung: 'Eine Mahlzeit zu zweit ist Nähe im kleinsten Rahmen – lade jemanden zu etwas Einfachem ein.',
			},
			en: {
				titel: 'Share a meal',
				beschreibung: 'A meal for two is closeness in its smallest form – invite someone to something simple.',
			},
			es: {
				titel: 'Comer juntos',
				beschreibung: 'Una comida a dos es cercanía en su forma más simple – invita a alguien a algo sencillo.',
			},
			fr: {
				titel: 'Partager un repas',
				beschreibung:
					'Un repas à deux est de la proximité dans sa forme la plus simple – invite quelqu\u2019un à quelque chose de simple.',
			},
			it: {
				titel: 'Mangiare insieme',
				beschreibung:
					'Un pasto in due è vicinanza nella sua forma più semplice – invita qualcuno a qualcosa di semplice.',
			},
			nl: {
				titel: 'Samen eten',
				beschreibung:
					'Een maaltijd met z\u2019n tweeën is nabijheid in haar kleinste vorm – nodig iemand uit voor iets eenvoudigs.',
			},
			pl: {
				titel: 'Zjeść razem posiłek',
				beschreibung: 'Wspólny posiłek to bliskość w najprostszej formie – zaproś kogoś na coś prostego.',
			},
			pt: {
				titel: 'Fazer uma refeição juntos',
				beschreibung: 'Uma refeição a dois é proximidade na forma mais simples – convide alguém para algo simples.',
			},
			ru: {
				titel: 'Пообедать вместе',
				beschreibung: 'Совместная трапеза — близость в самой простой форме: пригласите кого-нибудь на что-то простое.',
			},
			sv: {
				titel: 'Äta tillsammans',
				beschreibung: 'En måltid för två är närhet i sin enklaste form – bjud in någon till något enkelt.',
			},
		},
	},
	{
		key: 'beziehungen-4',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Ein ehrliches Dankeschön',
				beschreibung: 'Ein aufrichtiges Danke stärkt Beziehungen: wer freut sich heute über deine Worte?',
			},
			en: {
				titel: 'Say an honest thank you',
				beschreibung: 'A sincere thank-you strengthens bonds: who would be happy about your words today?',
			},
			es: {
				titel: 'Un agradecimiento sincero',
				beschreibung: 'Un gracias auténtico fortalece los vínculos: ¿quién se alegra hoy de tus palabras?',
			},
			fr: {
				titel: 'Un merci sincère',
				beschreibung: 'Un merci authentique renforce les liens : qui se réjouira de tes mots aujourd\u2019hui ?',
			},
			it: {
				titel: 'Un grazie sincero',
				beschreibung: 'Un grazie autentico rafforza i legami: chi sarà felice delle tue parole oggi?',
			},
			nl: {
				titel: 'Een oprecht dankjewel',
				beschreibung: 'Een oprecht dankjewel versterkt relaties: wie wordt er vandaag blij van jouw woorden?',
			},
			pl: {
				titel: 'Szczere podziękowanie',
				beschreibung: 'Szczere podziękowanie wzmacnia więzi: kto ucieszy się dziś z twoich słów?',
			},
			pt: {
				titel: 'Um agradecimento sincero',
				beschreibung: 'Um obrigado autêntico fortalece laços: quem ficará feliz com as suas palavras hoje?',
			},
			ru: {
				titel: 'Сказать искреннее спасибо',
				beschreibung: 'Искреннее «спасибо» укрепляет связи: кто сегодня обрадуется вашим словам?',
			},
			sv: {
				titel: 'Ett uppriktigt tack',
				beschreibung: 'Ett uppriktigt tack stärker band: vem blir glad över dina ord idag?',
			},
		},
	},
	{
		key: 'beziehungen-5',
		saeuleId: 3,
		texte: {
			de: {
				titel: 'Einen gemeinsamen Moment ausmachen',
				beschreibung: 'Ein fester Termin für eine wichtige Person nimmt sich selbst ernst – trag ihn schon ein.',
			},
			en: {
				titel: 'Plan a shared moment',
				beschreibung: 'A set time for an important person takes itself seriously – put it in the calendar now.',
			},
			es: {
				titel: 'Quedar un momento juntos',
				beschreibung: 'Una cita fija para alguien importante se toma en serio a sí misma – anótala ya.',
			},
			fr: {
				titel: 'Fixer un moment ensemble',
				beschreibung: 'Un rendez-vous pour une personne importante se prend au sérieux – inscris-le déjà.',
			},
			it: {
				titel: 'Fissare un momento insieme',
				beschreibung: 'Un appuntamento fisso per una persona importante si prende sul serio – annotalo subito.',
			},
			nl: {
				titel: 'Samen een moment plannen',
				beschreibung: 'Een vaste tijd voor iemand belangrijk neemt zichzelf serieus – zet hem er alvast in.',
			},
			pl: {
				titel: 'Umówić wspólny moment',
				beschreibung: 'Stały termin dla ważnej osoby bierze samego siebie na serio – wpisz go już teraz.',
			},
			pt: {
				titel: 'Combinar um momento a dois',
				beschreibung: 'Um horário fixo para alguém importante leva-se a sério – marque já.',
			},
			ru: {
				titel: 'Договориться о встрече',
				beschreibung: 'Определённое время для важного человека — это забота: впишите его в календарь.',
			},
			sv: {
				titel: 'Boka ett gemensamt ögonblick',
				beschreibung: 'En fast tid för någon viktig tar sig själv på allvar – lägg in den direkt.',
			},
		},
	},
	// ── Säule 4: Wirksamkeit ──
	{
		key: 'wirksamkeit-1',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Eine Mini-Aufgabe erledigen',
				beschreibung: 'Ein Schritt genügt: such dir die kleinste offene Aufgabe und lass sie heute erledigt sein.',
			},
			en: {
				titel: 'Finish one tiny task',
				beschreibung: 'One step is enough: pick the smallest open task and let it be done today.',
			},
			es: {
				titel: 'Terminar una mini tarea',
				beschreibung: 'Con un paso basta: elige la tarea abierta más pequeña y déjala hecha hoy.',
			},
			fr: {
				titel: 'Terminer une mini-tâche',
				beschreibung: 'Une étape suffit : choisis la plus petite tâche ouverte et termine-la aujourd\u2019hui.',
			},
			it: {
				titel: 'Concludere un mini compito',
				beschreibung: 'Basta un passo: scegli il compito aperto più piccolo e chiudilo oggi.',
			},
			nl: {
				titel: 'Eén mini-taak afronden',
				beschreibung: 'Eén stap is genoeg: kies de kleinste openstaande taak en maak haar vandaag af.',
			},
			pl: {
				titel: 'Dokończyć drobne zadanie',
				beschreibung: 'Wystarczy jeden krok: wybierz najmniejsze otwarte zadanie i zakończ je dziś.',
			},
			pt: {
				titel: 'Concluir uma mini-tarefa',
				beschreibung: 'Um passo basta: escolha a tarefa aberta mais pequena e conclua-a hoje.',
			},
			ru: {
				titel: 'Завершить одну маленькую задачу',
				beschreibung: 'Достаточно шага: выберите самую мелкую открытую задачу и завершите её сегодня.',
			},
			sv: {
				titel: 'Göra klart en liten uppgift',
				beschreibung: 'Ett steg räcker: välj den minsta öppna uppgiften och gör den klar idag.',
			},
		},
	},
	{
		key: 'wirksamkeit-2',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Zehn Minuten an einem Projekt',
				beschreibung: 'Zehn Minuten Fokus wirken Wunder – heute zählt der Anfang, nicht das Ende.',
			},
			en: {
				titel: 'Ten minutes on a project',
				beschreibung: 'Ten minutes of focus work wonders – today counts the beginning, not the end.',
			},
			es: {
				titel: 'Diez minutos en un proyecto',
				beschreibung: 'Diez minutos de foco hacen maravillas – hoy cuenta el comienzo, no el final.',
			},
			fr: {
				titel: 'Dix minutes sur un projet',
				beschreibung:
					'Dix minutes de concentration font des merveilles – aujourd\u2019hui, c\u2019est le début qui compte, pas la fin.',
			},
			it: {
				titel: 'Dieci minuti su un progetto',
				beschreibung: 'Dieci minuti di focus fanno miracoli – oggi conta l\u2019inizio, non la fine.',
			},
			nl: {
				titel: 'Tien minuten aan een project',
				beschreibung: 'Tien minuten focus doen wonderen – vandaag telt het begin, niet het einde.',
			},
			pl: {
				titel: 'Dziesięć minut nad projektem',
				beschreibung: 'Dziesięć minut skupienia czyni cuda – dziś liczy się początek, nie koniec.',
			},
			pt: {
				titel: 'Dez minutos num projeto',
				beschreibung: 'Dez minutos de foco fazem maravilhas – hoje conta o começo, não o fim.',
			},
			ru: {
				titel: 'Десять минут над проектом',
				beschreibung: 'Десять минут сосредоточенности творят чудеса — сегодня важен старт, а не финиш.',
			},
			sv: {
				titel: 'Tio minuter på ett projekt',
				beschreibung: 'Tio minuters fokus gör underverk – idag räknas början, inte slutet.',
			},
		},
	},
	{
		key: 'wirksamkeit-3',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Eine Ecke aufräumen',
				beschreibung: 'Ein aufgeräumter Ort macht Platz für Neues – fang mit der Ecke an, die dich stört.',
			},
			en: {
				titel: 'Clear one small corner',
				beschreibung: 'A tidy place makes room for new things – start with the corner that bothers you.',
			},
			es: {
				titel: 'Ordenar un rincón pequeño',
				beschreibung: 'Un lugar ordenado hace espacio para lo nuevo – empieza por el rincón que te molesta.',
			},
			fr: {
				titel: 'Ranger un petit coin',
				beschreibung: 'Un endroit rangé fait de la place pour du neuf – commence par le coin qui te dérange.',
			},
			it: {
				titel: 'Sistemare un piccolo angolo',
				beschreibung: 'Un luogo in ordine fa spazio al nuovo – inizia dall\u2019angolo che ti dà fastidio.',
			},
			nl: {
				titel: 'Eén hoekje opruimen',
				beschreibung: 'Een opgeruimde plek maakt ruimte voor het nieuwe – begin bij het hoekje dat je stoort.',
			},
			pl: {
				titel: 'Posprzątać mały kącik',
				beschreibung: 'Uporządkowane miejsce robi miejsce na nowe – zacznij od kącika, który ci przeszkadza.',
			},
			pt: {
				titel: 'Arrumar um cantinho',
				beschreibung: 'Um lugar arrumado abre espaço para o novo – comece pelo canto que o incomoda.',
			},
			ru: {
				titel: 'Навести порядок в одном уголке',
				beschreibung: 'Порядок в одном месте освобождает место новому — начните с уголка, который мешает.',
			},
			sv: {
				titel: 'Städa ett litet hörn',
				beschreibung: 'En städad plats ger utrymme för det nya – börja med hörnet som stör dig.',
			},
		},
	},
	{
		key: 'wirksamkeit-4',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Einen Erfolg festhalten',
				beschreibung: 'Schreib einen Erfolg von heute auf – auch kleine Siege verdienen Erinnerung.',
			},
			en: {
				titel: 'Record one win',
				beschreibung: 'Write down one success from today – small victories deserve to be remembered.',
			},
			es: {
				titel: 'Anotar un logro',
				beschreibung: 'Escribe un logro de hoy – también las victorias pequeñas merecen recuerdo.',
			},
			fr: {
				titel: 'Noter une réussite',
				beschreibung:
					'Écris une réussite d\u2019aujourd\u2019hui – les petites victoires méritent elles aussi d\u2019être gardées.',
			},
			it: {
				titel: 'Annotare un successo',
				beschreibung: 'Scrivi un successo di oggi – anche le piccole vittorie meritano di essere ricordate.',
			},
			nl: {
				titel: 'Eén succes vastleggen',
				beschreibung: 'Schrijf één succes van vandaag op – ook kleine overwinningen verdienen herinnering.',
			},
			pl: {
				titel: 'Zapisać jeden sukces',
				beschreibung: 'Zapisz jeden sukces z dzisiaj – małe zwycięstwa też zasługują na pamięć.',
			},
			pt: {
				titel: 'Registar uma vitória',
				beschreibung: 'Escreva uma vitória de hoje – as pequenas conquistas também merecem memória.',
			},
			ru: {
				titel: 'Записать одну победу',
				beschreibung: 'Запишите одну победу за сегодня — и малые победы достойны памяти.',
			},
			sv: {
				titel: 'Notera en framgång',
				beschreibung: 'Skriv ner en framgång från idag – små segrar förtjänar också minne.',
			},
		},
	},
	{
		key: 'wirksamkeit-5',
		saeuleId: 4,
		texte: {
			de: {
				titel: 'Eine Aufgabe streichen',
				beschreibung: 'Manchmal ist Weglassen die wirksamste Tat: streich eine Aufgabe, die heute niemand braucht.',
			},
			en: {
				titel: 'Cross off one task',
				beschreibung: 'Sometimes letting go is the most effective act: cross off a task nobody needs today.',
			},
			es: {
				titel: 'Tachar una tarea',
				beschreibung: 'A veces omitir es el acto más eficaz: tacha una tarea que hoy nadie necesita.',
			},
			fr: {
				titel: 'Rayer une tâche',
				beschreibung:
					'Parfois, renoncer est l\u2019acte le plus efficace : raye une tâche dont personne n\u2019a besoin aujourd\u2019hui.',
			},
			it: {
				titel: 'Cancellare un compito',
				beschreibung: 'A volte rinunciare è il gesto più efficace: elimina un compito che oggi nessuno richiede.',
			},
			nl: {
				titel: 'Eén taak schrappen',
				beschreibung: 'Soms is laten gaan de krachtigste daad: schrap een taak die vandaag niemand nodig heeft.',
			},
			pl: {
				titel: 'Skreślić jedno zadanie',
				beschreibung: 'Czasem rezygnacja to najskuteczniejszy czyn: skreśl zadanie, którego dziś nikt nie potrzebuje.',
			},
			pt: {
				titel: 'Riscar uma tarefa',
				beschreibung: 'Às vezes abrir mão é o gesto mais eficaz: risque uma tarefa que hoje ninguém precisa.',
			},
			ru: {
				titel: 'Вычеркнуть одну задачу',
				beschreibung: 'Иногда отказаться — самое действенное: вычеркните задачу, которая сегодня никому не нужна.',
			},
			sv: {
				titel: 'Stryka en uppgift',
				beschreibung: 'Ibland är att släppa det mest verksamma: stryk en uppgift som ingen behöver idag.',
			},
		},
	},
	// ── Säule 5: Sinn ──
	{
		key: 'sinn-1',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Ein Moment für deine Werte',
				beschreibung: 'Frag dich kurz: Was war heute wichtig für dich? Deine Antwort zeigt, worauf du baust.',
			},
			en: {
				titel: 'A moment for your values',
				beschreibung: 'Ask yourself briefly: what mattered to you today? Your answer shows what you stand on.',
			},
			es: {
				titel: 'Un momento para tus valores',
				beschreibung:
					'Pregúntate brevemente: ¿qué fue importante para ti hoy? Tu respuesta muestra sobre qué te apoyas.',
			},
			fr: {
				titel: 'Un moment pour tes valeurs',
				beschreibung:
					'Demande-toi brièvement : qu\u2019est-ce qui a compté pour toi aujourd\u2019hui ? Ta réponse montre sur quoi tu t\u2019appuies.',
			},
			it: {
				titel: 'Un momento per i tuoi valori',
				beschreibung:
					'Chiediti brevemente: cosa è stato importante per te oggi? La tua risposta mostra su cosa fai leva.',
			},
			nl: {
				titel: 'Een moment voor je waarden',
				beschreibung:
					'Vraag jezelf kort af: wat was vandaag belangrijk voor jou? Je antwoord laat zien waar je op bouwt.',
			},
			pl: {
				titel: 'Chwila dla twoich wartości',
				beschreibung: 'Zadaj sobie krótkie pytanie: co było dziś dla ciebie ważne? Odpowiedź pokazuje, na czym stoisz.',
			},
			pt: {
				titel: 'Um momento para os seus valores',
				beschreibung:
					'Pergunte brevemente a si próprio: o que foi importante para si hoje? A resposta mostra onde se apoia.',
			},
			ru: {
				titel: 'Минутка для ваших ценностей',
				beschreibung: 'Коротко спросите себя: что было для вас важно сегодня? Ответ покажет, на чём вы стоите.',
			},
			sv: {
				titel: 'Ett ögonblick för dina värderingar',
				beschreibung: 'Fråga dig kort: vad var viktigt för dig idag? Ditt svar visar vad du vilar på.',
			},
		},
	},
	{
		key: 'sinn-2',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Jemanden unterstützen',
				beschreibung: 'Eine kleine Hilfe verbindet dich mit etwas Größerem – biete heute jemandem deine Hilfe an.',
			},
			en: {
				titel: 'Support someone',
				beschreibung: 'A small act of help connects you to something bigger – offer your help to someone today.',
			},
			es: {
				titel: 'Apoyar a alguien',
				beschreibung: 'Una pequeña ayuda te conecta con algo más grande – ofrece tu ayuda a alguien hoy.',
			},
			fr: {
				titel: 'Soutenir quelqu\u2019un',
				beschreibung: 'Un petit coup de main te relie à plus grand – offre ton aide à quelqu\u2019un aujourd\u2019hui.',
			},
			it: {
				titel: 'Sostenere qualcuno',
				beschreibung: 'Un piccolo aiuto ti collega a qualcosa di più grande – offri il tuo aiuto a qualcuno oggi.',
			},
			nl: {
				titel: 'Iemand steunen',
				beschreibung: 'Een kleine hulp verbindt je met iets groters – bied vandaag je hulp aan iemand aan.',
			},
			pl: {
				titel: 'Wspierać kogoś',
				beschreibung: 'Mała pomoc łączy cię z czymś większym – zaoferuj dziś komuś swoją pomoc.',
			},
			pt: {
				titel: 'Apoiar alguém',
				beschreibung: 'Uma pequena ajuda liga-o a algo maior – ofereça hoje a sua ajuda a alguém.',
			},
			ru: {
				titel: 'Поддержать кого-то',
				beschreibung: 'Маленькая помощь связывает с чем-то большим — предложите сегодня кому-нибудь свою помощь.',
			},
			sv: {
				titel: 'Stötta någon',
				beschreibung: 'En liten hjälp förbinder dig med något större – erbjud idag din hjälp till någon.',
			},
		},
	},
	{
		key: 'sinn-3',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Bewusst draußen sein',
				beschreibung: 'Ein Moment in der Natur erinnert daran, wozu du gehörst – schau einmal richtig hin.',
			},
			en: {
				titel: 'Be outdoors consciously',
				beschreibung: 'A moment in nature reminds you what you belong to – take a good look.',
			},
			es: {
				titel: 'Estar fuera conscientemente',
				beschreibung: 'Un momento en la naturaleza recuerda a qué perteneces – mira con calma.',
			},
			fr: {
				titel: 'Être dehors en conscience',
				beschreibung: 'Un moment dans la nature rappelle à quoi tu appartiens – regarde bien une fois.',
			},
			it: {
				titel: 'Stare fuori con consapevolezza',
				beschreibung: 'Un momento nella natura ricorda a cosa appartieni – guarda con attenzione una volta.',
			},
			nl: {
				titel: 'Bewust buiten zijn',
				beschreibung: 'Een moment in de natuur herinnert je waar je bij hoort – kijk eens goed om je heen.',
			},
			pl: {
				titel: 'Świadomie pobyć na zewnątrz',
				beschreibung: 'Chwila w przyrodzie przypomina, do czego należysz – przyjrzyj się raz uważnie.',
			},
			pt: {
				titel: 'Estar lá fora com atenção',
				beschreibung: 'Um momento na natureza lembra a que pertence – olhe com atenção uma vez.',
			},
			ru: {
				titel: 'Осознанно побыть на природе',
				beschreibung: 'Минута на природе напоминает, частью чего вы являетесь — посмотрите внимательно.',
			},
			sv: {
				titel: 'Vara ute med närvaro',
				beschreibung: 'Ett ögonblick i naturen påminner om vad du hör hemma hos – titta dig ordentligt omkring.',
			},
		},
	},
	{
		key: 'sinn-4',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Eine Minute Stille',
				beschreibung: 'Eine Minute Stille ohne Ziel schenkt dir Nähe zu dir selbst – einfach da sein reicht.',
			},
			en: {
				titel: 'One minute of silence',
				beschreibung: 'A minute of silence without a goal brings you close to yourself – simply being is enough.',
			},
			es: {
				titel: 'Un minuto de silencio',
				beschreibung: 'Un minuto de silencio sin meta te acerca a ti mismo – con estar basta.',
			},
			fr: {
				titel: 'Une minute de silence',
				beschreibung: 'Une minute de silence sans but te rapproche de toi-même – être là suffit.',
			},
			it: {
				titel: 'Un minuto di silenzio',
				beschreibung: 'Un minuto di silenzio senza meta ti avvicina a te stesso – essere lì basta.',
			},
			nl: {
				titel: 'Een minuut stilte',
				beschreibung: 'Een minuut stilte zonder doel brengt je bij jezelf – er gewoon zijn is genoeg.',
			},
			pl: {
				titel: 'Minuta ciszy',
				beschreibung: 'Minuta ciszy bez celu przybliża cię do ciebie samego – samo bycie wystarczy.',
			},
			pt: {
				titel: 'Um minuto de silêncio',
				beschreibung: 'Um minuto de silêncio sem objetivo aproxima-o de si – basta estar.',
			},
			ru: {
				titel: 'Минута тишины',
				beschreibung: 'Минута тишины без цели возвращает вас к себе — достаточно просто быть.',
			},
			sv: {
				titel: 'En minut av tystnad',
				beschreibung: 'En minuts tystnad utan mål för dig närmare dig själv – att bara vara räcker.',
			},
		},
	},
	{
		key: 'sinn-5',
		saeuleId: 5,
		texte: {
			de: {
				titel: 'Ein inspirierender Text',
				beschreibung: 'Lies ein paar Zeilen, die dich bewegen – gute Worte tragen weiter, als man denkt.',
			},
			en: {
				titel: 'An inspiring text',
				beschreibung: 'Read a few lines that move you – good words carry further than you think.',
			},
			es: {
				titel: 'Un texto inspirador',
				beschreibung: 'Lee unas líneas que te conmuevan – las buenas palabras llevan más lejos de lo que crees.',
			},
			fr: {
				titel: 'Un texte inspirant',
				beschreibung: 'Lis quelques lignes qui te touchent – les bons mots portent plus loin qu\u2019on ne croit.',
			},
			it: {
				titel: 'Un testo ispiratore',
				beschreibung: 'Leggi qualche riga che ti commuove – le buone parole portano più lontano di quanto si pensi.',
			},
			nl: {
				titel: 'Een inspirerende tekst',
				beschreibung: 'Lees een paar regels die je raken – goede woorden dragen verder dan je denkt.',
			},
			pl: {
				titel: 'Inspirujący tekst',
				beschreibung: 'Przeczytaj kilka zdań, które cię poruszą – dobre słowa niosą dalej, niż myślisz.',
			},
			pt: {
				titel: 'Um texto inspirador',
				beschreibung: 'Leia algumas linhas que o toquem – as boas palavras levam mais longe do que se pensa.',
			},
			ru: {
				titel: 'Вдохновляющий текст',
				beschreibung: 'Прочитайте несколько строк, которые вас тронут — хорошие слова несут дальше, чем кажется.',
			},
			sv: {
				titel: 'En inspirerande text',
				beschreibung: 'Läs några rader som rör dig – goda ord bär längre än man tror.',
			},
		},
	},
];
