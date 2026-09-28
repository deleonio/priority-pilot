import { NotificationLog, Pillar, ScoreEntry, Task, User } from '../models/index.js';
import type { PillarWithContribution } from '../models/task.js';
import { bewerteCareDefizit } from './careDeficit.js';
import type { BalanceSaeule, KadenzTask } from './heartBalance.js';
import { CARE_SPRACHEN, type CareSprache } from './careSuggestionData.js';
import { sendPushToUser, type PushSender } from './push.js';
import { istGueltigeZeitzone } from './streak.js';

/**
 * Fachlicher Push-Trigger „Fürsorge-Hinweise“ (#1794): schickt höchstens **einen** gebündelten
 * Push je Nutzer und lokalem Kalendertag, wenn eine Säule deutlich defizitär oder überlastet ist
 * (Auswertung über {@link bewerteCareDefizit} aus #1790 — Konstanten werden importiert, nie
 * kopiert). Zwischen 21:00 und 08:00 der Nutzer-Zeitzone wird nicht zugestellt; ohne gültige
 * Zeitzone fällt der Lauf auf UTC zurück (AK8). Der eigene Schalter `users.carePushEnabled`
 * stoppt nur diesen Trigger — Frist-Erinnerungen (`dueTaskReminders.ts`) bleiben unberührt.
 *
 * Muster: `dueTaskReminders.ts` (gebündelte Nachricht, NotificationLog-Dedup erst nach
 * `sent > 0`, injizierbarer PushSender). Der Dedup-Key ist `<userId>:<lokalesISO-Datum>` —
 * das lokale Datum folgt der Nutzer-Zeitzone (Intl), nicht UTC.
 */

const KIND = 'care-push';

/** Push-Sprache: App-Sprache ist serverseitig nicht bekannt (kein Request im Scheduler) — Default `de`. */
const PUSH_SPRACHE: CareSprache = 'de';

type CareSituation = 'defizit' | 'ueberlast';

/** Titel/Text einer Push-Nachricht (der Service Worker `push-sw.js` liest genau diese Felder). */
export interface CarePushText {
	titel: string;
	text: string;
}

/** Ein Katalog-Eintrag: Volltexte je Situation und kanonischer Säule (`pillarData.ts`-Ids 1–5). */
export interface CarePushKatalogEintrag {
	situation: CareSituation;
	saeuleId: number;
	texte: Record<CareSprache, CarePushText>;
}

/**
 * Volltexte aus dem Ton-Leitfaden (`docs/fuersorge-tonalitaet.md` §4/§5) — warm, nicht belehrend,
 * ein bis zwei Sätze. Erste Aufzählungsebene: Situation, zweite: Säule-Id, dritte: Sprache.
 */
const VOLLTEXTE: Record<CareSituation, Record<number, Record<CareSprache, string>>> = {
	defizit: {
		1: {
			de: 'Dein Körper könnte eine Pause gebrauchen. Ein kurzer Spaziergang oder etwas früher ins Bett tut heute schon viel – klein anfangen zählt.',
			en: 'Your body could use a break. A short walk or an earlier night’s sleep already helps a lot – starting small counts.',
			es: 'Tu cuerpo necesita un respiro. Un paseo corto o acostarte un poco antes ya ayudan mucho hoy – empezar poco a poco cuenta.',
			fr: 'Votre corps a besoin d’une pause. Une courte marche ou vous coucher un peu plus tôt aide déjà beaucoup – commencer petit compte.',
			it: 'Il tuo corpo ha bisogno di una pausa. Una breve passeggiata o andare a dormire un po’ prima aiutano già molto – iniziare in piccolo conta.',
			nl: 'Uw lichaam kan een pauze gebruiken. Een korte wandeling of wat eerder naar bed helpt vandaag al veel – klein beginnen telt.',
			pl: 'Twoje ciało potrzebuje odpoczynku. Krótki spacer albo wcześniejsze pójście spać już dziś dużo pomogą – mały początek się liczy.',
			pt: 'Seu corpo precisa de uma pausa. Uma caminhada curta ou dormir um pouco mais cedo já ajudam muito hoje – começar pequeno conta.',
			ru: 'Вашему телу нужна передышка. Короткая прогулка или ранний отход ко сну уже помогут – малый шаг тоже шаг.',
			sv: 'Din kropp behöver en paus. En kort promenad eller lite tidigare läggdags hjälper redan idag – att börja smått räknas.',
		},
		2: {
			de: 'Innere Pausen sind gerade knapp. Fünf Minuten ohne Bildschirm zum Durchatmen können heute schon spürbar entlasten.',
			en: 'Moments of rest are in short supply right now. Five screen-free minutes to breathe can already bring noticeable relief today.',
			es: 'Las pausas mentales andan escasas. Cinco minutos sin pantallas para respirar ya pueden aliviar mucho hoy.',
			fr: 'Les pauses intérieures sont rares en ce moment. Cinq minutes sans écran pour respirer peuvent déjà soulager aujourd’hui.',
			it: 'Le pause interiori sono poche in questo periodo. Cinque minuti senza schermi per respirare possono già alleggerire oggi.',
			nl: 'Rustmomenten zijn op dit moment schaars. Vijf minuten zonder scherm om even door te ademen kan vandaag al opluchten.',
			pl: 'Przerw dla głowy jest ostatnio mało. Pięć minut bez ekranu na spokojny oddech może dziś już przynieść ulgę.',
			pt: 'As pausas mentais andam em falta. Cinco minutos sem telas para respirar já podem aliviar hoje.',
			ru: 'Внутренних пауз сейчас мало. Пять минут без экрана, чтобы просто подышать, уже принесут облегчение.',
			sv: 'Inre pauser är ont om just nu. Fem minuter utan skärm för att andas kan redan idag lätta.',
		},
		3: {
			de: 'Ein kurzes „Wie geht’s?“ an einen Menschen, der dir wichtig ist, könnte heute guttun – für euch beide.',
			en: 'A quick „How are you?“ to someone who matters to you could do good today – for both of you.',
			es: 'Un breve „¿cómo estás?“ a alguien importante para ti puede hacer bien hoy – a los dos.',
			fr: 'Un petit « Comment allez-vous ? » à quelqu’un qui compte pour vous peut faire du bien aujourd’hui – pour vous deux.',
			it: 'Un breve „come stai?“ a una persona importante per te può fare bene oggi – a entrambi.',
			nl: 'Een kort „hoe gaat het met u?“ naar iemand die u dierbaar is, kan vandaag goed doen – voor u beiden.',
			pl: 'Krótkie „co słychać?“ do kogoś ważnego może dziś zrobić dobrze – wam obojgu.',
			pt: 'Um breve „como você está?“ para alguém importante pode fazer bem hoje – para os dois.',
			ru: 'Короткое «как дела?» человеку, который вам дорог, может сегодня сделать добро – вам обоим.',
			sv: 'En kort „hur mår du?“ till någon som är dig nära kan göra gott idag – för er båda.',
		},
		4: {
			de: 'Ein kleiner, abgeschlossener Schritt kann heute guttun: eine Sache anfangen und zu Ende bringen. Fortschritt darf klein sein.',
			en: 'One small completed step can feel good today: start one thing and see it through. Progress is allowed to be small.',
			es: 'Un pequeño paso completado puede hacer bien hoy: empieza una cosa y llévala hasta el final. El progreso puede ser pequeño.',
			fr: 'Un petit pas mené au bout peut faire du bien aujourd’hui : commencez une chose et terminez-la. Le progrès peut être petit.',
			it: 'Un piccolo passo portato a termine può fare bene oggi: comincia una cosa e concludila. Il progresso può essere piccolo.',
			nl: 'Eén klein afgerond stapje kan vandaag goed doen: begin iets en maak het af. Vooruitgang mag klein zijn.',
			pl: 'Mały, dokończony krok może dziś dobrze zrobić: zacznij jedną rzecz i doprowadź ją do końca. Postęp może być mały.',
			pt: 'Um pequeno passo concluído pode fazer bem hoje: comece uma coisa e leve até o fim. O progresso pode ser pequeno.',
			ru: 'Маленький завершённый шаг уже поможет: начните одно дело и доведите до конца. Прогресс может быть маленьким.',
			sv: 'Ett litet avslutat steg kan göra gott idag: börja en sak och för den i mål. Framsteg får vara litet.',
		},
		5: {
			de: 'Was gibt dir gerade Halt? Eine kurze Notiz über das, was dir wichtig ist, kann heute Orientierung schenken.',
			en: 'What gives you a sense of grounding right now? A short note about what matters to you can offer orientation today.',
			es: '¿Qué te da sostén ahora mismo? Una nota breve sobre lo que te importa puede darte orientación hoy.',
			fr: 'Qu’est-ce qui vous porte en ce moment ? Une courte note sur ce qui compte pour vous peut donner un cap aujourd’hui.',
			it: 'Cosa ti dà appoggio in questo momento? Una breve nota su ciò che ti è caro può darti orientamento oggi.',
			nl: 'Wat geeft u nu houvast? Een korte notitie over wat u dierbaar is, kan vandaag richting geven.',
			pl: 'Co daje Ci teraz oparcie? Krótka notatka o tym, co jest dla Ciebie ważne, może dziś dać orientację.',
			pt: 'O que serve de apoio para você agora? Uma nota curta sobre o que é importante pode dar orientação hoje.',
			ru: 'Что даёт вам опору сейчас? Короткая записка о важном может сегодня дать направление.',
			sv: 'Vad ger dig stöd just nu? En kort anteckning om det som betyder något för dig kan ge riktning idag.',
		},
	},
	ueberlast: {
		1: {
			de: 'Du hast deinen Körper zuletzt viel gefordert. Es ist gut, heute bewusst etwas kürzer zu treten – Regeneration ist Teil des Plans.',
			en: 'You have asked a lot of your body lately. It’s good to take it a little easier today – recovery is part of the plan.',
			es: 'Últimamente le has exigido mucho a tu cuerpo. Está bien ir hoy un poco más despacio – recuperar también forma parte del plan.',
			fr: 'Vous avez beaucoup demandé à votre corps ces derniers temps. C’est bien de ralentir un peu aujourd’hui – récupérer fait partie du plan.',
			it: 'Ultimamente hai chiesto molto al tuo corpo. Va bene rallentare un po’ oggi – recuperare fa parte del piano.',
			nl: 'U heeft de laatste tijd veel van uw lichaam gevraagd. Het is goed om het vandaag iets rustiger aan te doen – herstel hoort bij het plan.',
			pl: 'Ostatnio dużo wymagasz od swojego ciała. Dobrze jest dziś trochę zwolnić – regeneracja też jest częścią planu.',
			pt: 'Ultimamente você tem pedido muito ao seu corpo. Tudo bem ir mais devagar hoje – recuperar também faz parte do plano.',
			ru: 'В последнее время вы многого требуете от своего тела. Сегодня можно идти помедленнее – восстановление тоже часть плана.',
			sv: 'Den senaste tiden har du ställt mycket på din kropps konto. Det är okej att ta det lite lugnare idag – återhämtning hör till planen.',
		},
		2: {
			de: 'Viele Gedanken wollen gerade Platz. Nimm dir für heute eine Sache weniger vor – dein Kopf darf Auszeit haben.',
			en: 'A lot of thoughts are competing for space. Plan one thing less for today – your mind deserves a break.',
			es: 'Muchos pensamientos quieren espacio. Deja una cosa menos para hoy – tu mente merece un descanso.',
			fr: 'Beaucoup de pensées demandent de la place. Prévoyez une chose de moins aujourd’hui – votre tête mérite du répit.',
			it: 'Molti pensieri chiedono spazio. Togline una per oggi – la tua mente merita una pausa.',
			nl: 'Veel gedachten willen ruimte. Laat er voor vandaag één ding vallen – uw hoofd mag even uitrusten.',
			pl: 'Wiele myśli chce mieć miejsce. Zostaw dziś jedną rzecz mniej – Twoja głowa może odpocząć.',
			pt: 'Muitos pensamentos querem espaço. Deixe uma coisa a menos para hoje – sua cabeça merece descanso.',
			ru: 'Много мыслей требуют места. Оставьте на сегодня на одну задачу меньше – голове нужен отдых.',
			sv: 'Många tankar vill ha plats. Lämna en sak färre för idag – huvudet får gärna vila.',
		},
		3: {
			de: 'Du bist zuletzt viel für andere da gewesen. Es ist in Ordnung, heute Kraft für dich zu sammeln.',
			en: 'You have been there a lot for others lately. It is okay to gather some strength for yourself today.',
			es: 'Últimamente has estado muy pendiente de los demás. Está bien recoger fuerzas para ti hoy.',
			fr: 'Ces derniers temps, vous avez beaucoup donné aux autres. Il est permis de reprendre des forces aujourd’hui.',
			it: 'Ultimamente sei stato molto presente per gli altri. Va bene recuperare energie per te oggi.',
			nl: 'U bent de laatste tijd veel voor anderen geweest. Het is prima om vandaag wat kracht voor uzelf op te doen.',
			pl: 'Ostatnio wiele dajesz innym. Dziś możesz spokojnie zebrać siły dla siebie.',
			pt: 'Ultimamente você tem estado muito presente para os outros. Tudo bem reunir forças para você hoje.',
			ru: 'В последнее время вы много отдавали другим. Сегодня можно позволить себе набраться сил.',
			sv: 'Du har den senaste tiden funnits mycket för andra. Det är okej att samla kraft åt dig själv idag.',
		},
		4: {
			de: 'Deine Liste ist lang, dein Tag hat Grenzen. Wähle eine Sache, die heute wirklich zählt – der Rest darf warten.',
			en: 'Your list is long and your day has limits. Pick the one thing that truly matters today – the rest can wait.',
			es: 'Tu lista es larga y el día tiene límites. Elige lo que de verdad cuenta hoy – el resto puede esperar.',
			fr: 'Votre liste est longue et la journée a des limites. Choisissez ce qui compte vraiment aujourd’hui – le reste peut attendre.',
			it: 'La tua lista è lunga e la giornata ha dei limiti. Scegli ciò che conta davvero oggi – il resto può aspettare.',
			nl: 'Uw lijst is lang en uw dag heeft grenzen. Kies het ene wat er vandaag echt toe doet – de rest mag wachten.',
			pl: 'Twoja lista jest długa, a dzień ma swoje granice. Wybierz to, co dziś naprawdę się liczy – reszta może poczekać.',
			pt: 'Sua lista é longa e o dia tem limites. Escolha o que importa de verdade hoje – o resto pode esperar.',
			ru: 'Список длинный, а день не безграничен. Выберите то, что сегодня действительно важно – остальное может подождать.',
			sv: 'Listan är lång och dagen har gränser. Välj det som verkligen betyder något idag – resten får vänta.',
		},
		5: {
			de: 'Nicht jede Frage braucht heute eine Antwort. Es ist erlaubt, das große Ganze eine Weile ruhen zu lassen.',
			en: 'Not every question needs an answer today. It is allowed to let the big picture rest for a while.',
			es: 'No todas las preguntas necesitan respuesta hoy. Está bien dejar descansar el panorama grande un rato.',
			fr: 'Toute question n’exige pas de réponse aujourd’hui. Vous avez le droit de laisser le grand tableau reposer un moment.',
			it: 'Non ogni domanda ha bisogno di una risposta oggi. Puoi lasciare riposare il quadro generale per un po’.',
			nl: 'Niet elke vraag vraagt vandaag om een antwoord. Het mag: het grote geheel een poos laten rusten.',
			pl: 'Nie każde pytanie potrzebuje dziś odpowiedzi. Możesz pozwolić, by wielki obraz odsapnął na chwilę.',
			pt: 'Nem toda pergunta precisa de resposta hoje. Você pode deixar o quadro geral descansar por um pouco.',
			ru: 'Не на каждый вопрос нужен ответ сегодня. Можно позволить большой картине немного подождать.',
			sv: 'Inte varje fråga behöver ett svar idag. Det är tillåtet att låta helheten vila en stund.',
		},
	},
};

/**
 * Teilt einen Volltext in Push-Titel (erster Satz) und Push-Text (Rest). Satzenden werden nur
 * bei Satzzeichen gefolgt von Leerzeichen und anschließendem Buchstaben erkannt — verhindert
 * falsche Splits an Abkürzungen und innerhalb französischer/Anführungs-Zitate („… ? “).
 */
const splitTitelText = (volltext: string): CarePushText => {
	for (let i = 0; i < volltext.length - 2; i++) {
		const zeichen = volltext[i];
		const satzende = zeichen === '.' || zeichen === '!' || zeichen === '?';
		if (satzende && volltext[i + 1] === ' ' && /\p{L}/u.test(volltext[i + 2])) {
			const text = volltext.slice(i + 2).trim();
			return { titel: volltext.slice(0, i + 1), text: text || volltext };
		}
	}
	return { titel: volltext, text: volltext };
};

/** Katalog je Situation × kanonischer Säule × Sprache — verbraucht von Tests und {@link pushTextFuer}. */
export const CARE_PUSH_TEXTE: CarePushKatalogEintrag[] = Object.entries(VOLLTEXTE).flatMap(([situation, jeSaeule]) =>
	Object.entries(jeSaeule).map(([saeuleId, texte]) => {
		const katalogtexte = {} as Record<CareSprache, CarePushText>;
		for (const sprache of CARE_SPRACHEN) {
			katalogtexte[sprache] = splitTitelText(texte[sprache]);
		}
		return {
			situation: situation as CareSituation,
			saeuleId: Number(saeuleId),
			texte: katalogtexte,
		};
	}),
);

/** Generische Fallback-Texte für unbekannte (eigene) Säulen — ebenso warm und kurz, je Sprache. */
const FALLBACK: Record<CareSituation, Record<CareSprache, CarePushText>> = {
	defizit: {
		de: {
			titel: 'Eine deiner Säulen kommt gerade zu kurz.',
			text: 'Ein kleiner Schritt heute genügt – klein anfangen zählt.',
		},
		en: {
			titel: 'One of your pillars is running low right now.',
			text: 'One small step today is enough – starting small counts.',
		},
		es: {
			titel: 'Una de tus columnas anda corta ahora mismo.',
			text: 'Un pequeño paso hoy basta – empezar poco a poco cuenta.',
		},
		fr: {
			titel: 'L’un de vos piliers est un peu délaissé en ce moment.',
			text: 'Un petit pas aujourd’hui suffit – commencer petit compte.',
		},
		it: {
			titel: 'Una delle tue colonne è un po’ trascurata in questo periodo.',
			text: 'Un piccolo passo oggi basta – iniziare in piccolo conta.',
		},
		nl: {
			titel: 'Eén van uw pijlers komt nu wat kort.',
			text: 'Een kleine stap vandaag is genoeg – klein beginnen telt.',
		},
		pl: {
			titel: 'Jedna z Twoich filarów jest ostatnio zaniedbana.',
			text: 'Jeden mały krok dzisiaj wystarczy – mały początek się liczy.',
		},
		pt: {
			titel: 'Um dos seus pilares está um pouco negligenciado agora.',
			text: 'Um pequeno passo hoje basta – começar pequeno conta.',
		},
		ru: {
			titel: 'Одна из ваших опор сейчас недополучает внимания.',
			text: 'Один маленький шаг сегодня – уже достаточно.',
		},
		sv: {
			titel: 'En av dina pelare kommer nu till korta.',
			text: 'Ett litet steg idag räcker – att börja smått räknas.',
		},
	},
	ueberlast: {
		de: { titel: 'Eine deiner Säulen trägt gerade viel.', text: 'Erlaube dir heute, etwas kürzer zu treten.' },
		en: {
			titel: 'One of your pillars is carrying a lot right now.',
			text: 'It is okay to take it a little easier today.',
		},
		es: {
			titel: 'Una de tus columnas está cargando mucho ahora mismo.',
			text: 'Está bien ir hoy un poco más despacio.',
		},
		fr: {
			titel: 'L’un de vos piliers porte beaucoup en ce moment.',
			text: 'Il est permis de ralentir un peu aujourd’hui.',
		},
		it: {
			titel: 'Una delle tue colonne sta portando molto in questo periodo.',
			text: 'Va bene rallentare un po’ oggi.',
		},
		nl: { titel: 'Eén van uw pijlers draagt nu veel.', text: 'Het is goed om het vandaag iets rustiger aan te doen.' },
		pl: { titel: 'Jedna z Twoich filarów dźwiga teraz dużo.', text: 'Dobrze jest dziś trochę zwolnić.' },
		pt: { titel: 'Um dos seus pilares está carregando muito agora.', text: 'Tudo bem ir mais devagar hoje.' },
		ru: { titel: 'Одна из ваших опор сейчас несёт большую нагрузку.', text: 'Сегодня можно идти помедленнее.' },
		sv: { titel: 'En av dina pelare bär mycket just nu.', text: 'Det är okej att ta det lite lugnare idag.' },
	},
};

/** Text zur Situation und Säule; unbekannte Säulen (Id > 5) bekommen den generischen Fallback. */
export const pushTextFuer = (situation: CareSituation, saeuleId: number, sprache: CareSprache): CarePushText =>
	CARE_PUSH_TEXTE.find((eintrag) => eintrag.situation === situation && eintrag.saeuleId === saeuleId)?.texte[sprache] ??
	FALLBACK[situation][sprache];

/** Lokales ISO-Datum (`YYYY-MM-DD`) in der Nutzer-Zeitzone; ohne gültige Zone in UTC. */
const lokalesDatum = (datum: Date, zeitzone: string | null): string =>
	new Intl.DateTimeFormat('en-CA', {
		timeZone: zeitzone ?? 'UTC',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(datum);

/** Stunde (0–23, `h23`) und Minute in der Zeitzone. */
const uhrzeitIn = (datum: Date, zeitzone: string): { stunde: number; minute: number } => {
	const teile = new Intl.DateTimeFormat('en-GB', {
		timeZone: zeitzone,
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
	}).format(datum);
	const [stunde, minute] = teile.split(':').map(Number);
	return { stunde, minute };
};

/** Ruhezeit 21:00–08:00 (Grenze 08:00 selbst ist erlaubt) in der Nutzer-Zeitzone. */
const istRuhezeit = (datum: Date, zeitzone: string): boolean => {
	const { stunde } = uhrzeitIn(datum, zeitzone);
	return stunde >= 21 || stunde < 8;
};

/**
 * Versendet je Nutzer höchstens eine Fürsorge-Nachricht pro lokalem Kalendertag. Ruhezeit-Skip
 * und Schalter-aus schreiben bewusst **keinen** Log-Eintrag — sonst würde der fehlgeschlagene/
 * blockierte Lauf den eigentlichen Versand am selben Tag wegdeduppen.
 *
 * @param now Auswertungszeitpunkt (Scheduler: jetzt; Tests: feste Zeit).
 * @param send injizierbarer Versand (siehe `logics/push.ts`); Tests reichen einen Mock herein.
 */
export const runCarePush = async (now: Date = new Date(), send?: PushSender): Promise<{ usersNotified: number }> => {
	const users = await User.findAll();
	let usersNotified = 0;
	for (const user of users) {
		// AK4: der eigene Schalter stoppt nur den Fürsorge-Push (Default ein — der Schalter „schaltet ab“).
		if (user.carePushEnabled === false) {
			continue;
		}
		const saeulen = await Pillar.findAll({ where: { userId: user.id }, order: [['id', 'ASC']] });
		if (saeulen.length === 0) {
			continue;
		}
		const tasks = await Task.findAll({ where: { userId: user.id }, include: [Pillar] });
		const entries = await ScoreEntry.findAll({ include: [{ model: Task, where: { userId: user.id } }] });
		const zeitpunktProTask = new Map(entries.map((entry) => [entry.taskId, entry.zeitpunkt]));
		const kadenzTasks: KadenzTask[] = tasks.map((task) => ({
			status: task.status,
			estimatedEffort: task.estimatedEffort,
			pillars: ((task.Pillars ?? []) as PillarWithContribution[]).map((pillar) => ({
				pillarId: pillar.id,
				share: pillar.TaskPillar.share,
			})),
			erledigtAm: zeitpunktProTask.get(task.id) ?? null,
		}));
		const balanceSaeulen: BalanceSaeule[] = saeulen.map((saeule) => ({
			id: saeule.id,
			name: saeule.name,
			weight: saeule.weight,
		}));
		const defizite = bewerteCareDefizit(balanceSaeulen, kadenzTasks, now);
		// Überlast hat Vorrang (Erlaubnis zum Kürzen schlägt den Schritt-Vorschlag), sonst die erste
		// defizitäre Säule (Ids aufsteigend — `bewerteCareDefizit` behält die Reihenfolge bei).
		const ueberlastete = defizite.filter((eintrag) => eintrag.ueberlast);
		const defizitaere = defizite.filter((eintrag) => eintrag.defizitaer);
		const situation: CareSituation | null =
			ueberlastete.length > 0 ? 'ueberlast' : defizitaere.length > 0 ? 'defizit' : null;
		if (!situation) {
			continue;
		}
		const betroffeneSaeule = (ueberlastete.length > 0 ? ueberlastete : defizitaere)[0];
		// AK2: Ruhezeit nur mit explizit gültiger Nutzer-Zeitzone; ohne Zone kein Block (UTC-Fallback).
		const zeitzone = istGueltigeZeitzone(user.zeitzone ?? undefined) ? (user.zeitzone as string) : null;
		if (zeitzone && istRuhezeit(now, zeitzone)) {
			continue;
		}
		const dedupeKey = `${user.id}:${lokalesDatum(now, zeitzone)}`;
		const bereitsGesendet = await NotificationLog.findOne({ where: { kind: KIND, dedupeKey } });
		if (bereitsGesendet) {
			continue;
		}
		const text = pushTextFuer(situation, betroffeneSaeule.id, PUSH_SPRACHE);
		const { sent } = await sendPushToUser(user.id, { title: text.titel, body: text.text, url: '/' }, send);
		if (sent > 0) {
			await NotificationLog.create({ userId: user.id, kind: KIND, dedupeKey, sentAt: now });
			usersNotified++;
		}
	}
	return { usersNotified };
};
