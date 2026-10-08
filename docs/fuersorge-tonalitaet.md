# Fürsorge-Tonalität — wie die App mit ihren Nutzern spricht

Leitfaden für alle Fürsorge-Texte der App: Hinweise auf dem Dashboard, Push-Benachrichtigungen und
Vorschläge. Ohne Vorgaben klingen solche Texte je nach Stelle belehrend, schuldzuweisend oder
beliebig — dieses Dokument legt Ton, Prüffrage und Beispieltexte fest.

Verbraucher dieses Leitfadens: Texterarbeitung in `frontend/src/i18n/locales/<sprache>/`
(#1791, #1794). Schwesterdokumente: [docs/mobile-ui-rules.md](mobile-ui-rules.md) (Bedienung),
[docs/zifferblatt-konzept.md](zifferblatt-konzept.md) (Bilder der Lebensbalance).

## 1. Ton-Grundregeln

- **Warm, nicht belehrend.** Die App begleitet, sie predigt nicht. Keine Soll-Vorträge, keine
  Ermahnungen, kein moralisierendes Vokabular („vernachlässigt“, „verschlafen“, „verpasst“).
- **Nie schuldzuweisend.** Ein niedriger Stand ist eine Beobachtung, kein Fehlverhalten. Der Text
  fragt nie „warum hast du …“, er bietet nie ein Urteil an.
- **Konkret statt statistisch.** Ein kleiner, heute machbarer Schritt hilft mehr als eine Trend-
  Diagnose. Fortschritt darf klein sein — das sagt der Text auch.
- **Kurz.** Ein Gedanke je Hinweis. Push-Texte sind ein Satz, höchstens zwei.

## 2. Die Prüffrage

> **„Sorgt der Text, oder protokolliert er nur?“**

Ein Text, der nur feststellt („Säule Körper: 12 % Erfüllung“), protokolliert. Ein Text sorgt, wenn
er dem Leser heute etwas Gutes anbietet — einen Schritt, eine Erlaubnis oder echte Anerkennung.
Jeder Fürsorge-Text muss diese Frage mit „sorgt“ beantworten können.

Gegenüberstellung (aus #1797):

| ❌ protokolliert und klagt an                | ✅ sorgt                                     |
| -------------------------------------------- | -------------------------------------------- |
| „Du hast deine Körper-Säule vernachlässigt.“ | „Dein Körper könnte eine Pause gebrauchen …“ |

## 3. Die drei Situationen

| Situation | Wann                                           | Ziel des Textes                        |
| --------- | ---------------------------------------------- | -------------------------------------- |
| Defizit   | Eine Säule liegt deutlich unter ihrem Soll     | Einen kleinen Schritt anbieten         |
| Überlast  | Eine Säule oder der Gesamt-Tag ist überfüllt   | Erlaubnis zum Kürzen geben             |
| Lob       | Eine Säule wird gepflegt oder erfüllt ihr Soll | Anerkennung, die sichtbar macht, wirkt |

Die festen fünf Säulen folgen `SEED_PILLARS` (`server/src/models/pillarData.ts`, Petzolds „Fünf
Säulen der Identität“): **Körper, Mentale Gesundheit, Beziehungen, Wirksamkeit, Sinn**.

## 4. Beispieltexte — Deutsch (Referenzfassung)

| Säule              | Defizit                                                                                                                                  | Überlast                                                                                                                          | Lob                                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Körper             | Dein Körper könnte eine Pause gebrauchen. Ein kurzer Spaziergang oder etwas früher ins Bett tut heute schon viel – klein anfangen zählt. | Du hast deinen Körper zuletzt viel gefordert. Es ist gut, heute bewusst etwas kürzer zu treten – Regeneration ist Teil des Plans. | Schön, wie verlässlich du in den letzten Tagen auf deinen Körper achtest. Das wirkt – mach in deinem Tempo weiter. |
| Mentale Gesundheit | Innere Pausen sind gerade knapp. Fünf Minuten ohne Bildschirm zum Durchatmen können heute schon spürbar entlasten.                       | Viele Gedanken wollen gerade Platz. Nimm dir für heute eine Sache weniger vor – dein Kopf darf Auszeit haben.                     | Du gibst deinen Gedanken gerade bewusst Raum. Diese Fürsorge für dich selbst zahlt sich aus.                       |
| Beziehungen        | Ein kurzes „Wie geht’s?“ an einen Menschen, der dir wichtig ist, könnte heute guttun – für euch beide.                                   | Du bist zuletzt viel für andere da gewesen. Es ist in Ordnung, heute Kraft für dich zu sammeln.                                   | Du pflegst deine Beziehungen mit viel Wärme. Diese Verbindungen tragen dich – heute und in den kommenden Tagen.    |
| Wirksamkeit        | Ein kleiner, abgeschlossener Schritt kann heute guttun: eine Sache anfangen und zu Ende bringen. Fortschritt darf klein sein.            | Deine Liste ist lang, dein Tag hat Grenzen. Wähle eine Sache, die heute wirklich zählt – der Rest darf warten.                    | Du hast heute manches auf den Weg gebracht. Schön zu sehen, wie deine Pläne Form annehmen.                         |
| Sinn               | Was gibt dir gerade Halt? Eine kurze Notiz über das, was dir wichtig ist, kann heute Orientierung schenken.                              | Nicht jede Frage braucht heute eine Antwort. Es ist erlaubt, das große Ganze eine Weile ruhen zu lassen.                          | Du richtest deinen Tag bewusst nach deinen Werten aus. Das gibt deinem Plan – und dir – Richtung.                  |

## 5. Beispieltexte

Die App führt Deutsch und Englisch; die übrigen Sprachen bleiben als Referenz für eine spätere
Erweiterung. Anreden folgen der jeweiligen App-Konvention: du-Form (de, en, es, it, pl, sv, pt), Sie-Form
(fr: vous, nl: u, ru: Вы).

### Englisch (en)

| Säule              | Defizit                                                                                                                       | Überlast                                                                                                             | Lob                                                                                                           |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Körper             | Your body could use a break. A short walk or an earlier night’s sleep already helps a lot – starting small counts.            | You have asked a lot of your body lately. It’s good to take it a little easier today – recovery is part of the plan. | Lovely how consistently you have cared for your body these past days. It shows – keep going at your own pace. |
| Mentale Gesundheit | Moments of rest are in short supply right now. Five screen-free minutes to breathe can already bring noticeable relief today. | A lot of thoughts are competing for space. Plan one thing less for today – your mind deserves a break.               | You are giving your thoughts room on purpose. This care for yourself is paying off.                           |
| Beziehungen        | A quick „How are you?“ to someone who matters to you could do good today – for both of you.                                   | You have been there a lot for others lately. It is okay to gather some strength for yourself today.                  | You tend to your relationships with real warmth. These connections carry you – today and in the days ahead.   |
| Wirksamkeit        | One small completed step can feel good today: start one thing and see it through. Progress is allowed to be small.            | Your list is long and your day has limits. Pick the one thing that truly matters today – the rest can wait.          | You set quite a few things in motion today. It’s nice to watch your plans take shape.                         |
| Sinn               | What gives you a sense of grounding right now? A short note about what matters to you can offer orientation today.            | Not every question needs an answer today. It is allowed to let the big picture rest for a while.                     | You are shaping your day around your values on purpose. That gives your plan – and you – direction.           |

### Spanisch (es)

| Säule              | Defizit                                                                                                                    | Überlast                                                                                                                      | Lob                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Körper             | Tu cuerpo necesita un respiro. Un paseo corto o acostarte un poco antes ya ayudan mucho hoy – empezar poco a poco cuenta.  | Últimamente le has exigido mucho a tu cuerpo. Está bien ir hoy un poco más despacio – recuperar también forma parte del plan. | Qué bien cuidas tu cuerpo estos días con tanta constancia. Se nota – sigue así, a tu propio ritmo. |
| Mentale Gesundheit | Las pausas mentales andan escasas. Cinco minutos sin pantallas para respirar ya pueden aliviar mucho hoy.                  | Muchos pensamientos quieren espacio. Deja una cosa menos para hoy – tu mente merece un descanso.                              | Estás dando espacio a tus pensamientos a conciencia. Ese cuidado contigo mismo da sus frutos.      |
| Beziehungen        | Un breve „¿cómo estás?“ a alguien importante para ti puede hacer bien hoy – a los dos.                                     | Últimamente has estado muy pendiente de los demás. Está bien recoger fuerzas para ti hoy.                                     | Cuidas tus relaciones con mucho cariño. Esos lazos te sostienen – hoy y en los días que vienen.    |
| Wirksamkeit        | Un pequeño paso completado puede hacer bien hoy: empieza una cosa y llévala hasta el final. El progreso puede ser pequeño. | Tu lista es larga y el día tiene límites. Elige lo que de verdad cuenta hoy – el resto puede esperar.                         | Hoy has puesto muchas cosas en marcha. Da gusto ver cómo tus planes toman forma.                   |
| Sinn               | ¿Qué te da sostén ahora mismo? Una nota breve sobre lo que te importa puede darte orientación hoy.                         | No todas las preguntas necesitan respuesta hoy. Está bien dejar descansar el panorama grande un rato.                         | Organizas tu día según tus valores con intención. Eso da dirección a tu plan – y a ti.             |

### Französisch (fr)

| Säule              | Defizit                                                                                                                          | Überlast                                                                                                                                | Lob                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Körper             | Votre corps a besoin d’une pause. Une courte marche ou vous coucher un peu plus tôt aide déjà beaucoup – commencer petit compte. | Vous avez beaucoup demandé à votre corps ces derniers temps. C’est bien de ralentir un peu aujourd’hui – récupérer fait partie du plan. | Belle constance dans la façon de prendre soin de votre corps ces derniers jours. Ça se voit – continuez à votre rythme. |
| Mentale Gesundheit | Les pauses intérieures sont rares en ce moment. Cinq minutes sans écran pour respirer peuvent déjà soulager aujourd’hui.         | Beaucoup de pensées demandent de la place. Prévoyez une chose de moins aujourd’hui – votre tête mérite du répit.                        | Vous faites délibérément de la place à vos pensées. Ce soin porté à vous-même porte ses fruits.                         |
| Beziehungen        | Un petit « Comment allez-vous ? » à quelqu’un qui compte pour vous peut faire du bien aujourd’hui – pour vous deux.              | Ces derniers temps, vous avez beaucoup donné aux autres. Il est permis de reprendre des forces aujourd’hui.                             | Vous prenez soin de vos relations avec beaucoup de chaleur. Ces liens vous portent – aujourd’hui comme demain.          |
| Wirksamkeit        | Un petit pas mené au bout peut faire du bien aujourd’hui : commencez une chose et terminez-la. Le progrès peut être petit.       | Votre liste est longue et la journée a des limites. Choisissez ce qui compte vraiment aujourd’hui – le reste peut attendre.             | Vous avez mis bien des choses en mouvement aujourd’hui. C’est joli de voir vos plans prendre forme.                     |
| Sinn               | Qu’est-ce qui vous porte en ce moment ? Une courte note sur ce qui compte pour vous peut donner un cap aujourd’hui.              | Toute question n’exige pas de réponse aujourd’hui. Vous avez le droit de laisser le grand tableau reposer un moment.                    | Vous organisez votre journée selon vos valeurs, avec intention. Cela donne une direction à votre plan – et à vous.      |

### Italienisch (it)

| Säule              | Defizit                                                                                                                                    | Überlast                                                                                                      | Lob                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Körper             | Il tuo corpo ha bisogno di una pausa. Una breve passeggiata o andare a dormire un po’ prima aiutano già molto – iniziare in piccolo conta. | Ultimamente hai chiesto molto al tuo corpo. Va bene rallentare un po’ oggi – recuperare fa parte del piano.   | Che costanza nel prenderti cura del tuo corpo in questi giorni. Si vede – continua al tuo ritmo.          |
| Mentale Gesundheit | Le pause interiori sono poche in questo periodo. Cinque minuti senza schermi per respirare possono già alleggerire oggi.                   | Molti pensieri chiedono spazio. Togline una per oggi – la tua mente merita una pausa.                         | Stai dando spazio ai tuoi pensieri con consapevolezza. Questa cura per te dà i suoi frutti.               |
| Beziehungen        | Un breve „come stai?“ a una persona importante per te può fare bene oggi – a entrambi.                                                     | Ultimamente sei stato molto presente per gli altri. Va bene recuperare energie per te oggi.                   | Curi le tue relazioni con tanto calore. Questi legami ti sostengono – oggi e nei giorni a venire.         |
| Wirksamkeit        | Un piccolo passo portato a termine può fare bene oggi: comincia una cosa e concludila. Il progresso può essere piccolo.                    | La tua lista è lunga e la giornata ha dei limiti. Scegli ciò che conta davvero oggi – il resto può aspettare. | Oggi hai messo in moto parecchie cose. È bello vedere i tuoi piani prendere forma.                        |
| Sinn               | Cosa ti dà appoggio in questo momento? Una breve nota su ciò che ti è caro può darti orientamento oggi.                                    | Non ogni domanda ha bisogno di una risposta oggi. Puoi lasciare riposare il quadro generale per un po’.       | Ordini la tua giornata intorno ai tuoi valori, con intenzione. Questo dà direzione al tuo piano – e a te. |

### Niederländisch (nl)

| Säule              | Defizit                                                                                                                     | Überlast                                                                                                                                 | Lob                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Körper             | Uw lichaam kan een pauze gebruiken. Een korte wandeling of wat eerder naar bed helpt vandaag al veel – klein beginnen telt. | U heeft de laatste tijd veel van uw lichaam gevraagd. Het is goed om het vandaag iets rustiger aan te doen – herstel hoort bij het plan. | Mooi hoe consequent u de laatste dagen voor uw lichaam zorgt. Het valt op – ga door in uw tempo.       |
| Mentale Gesundheit | Rustmomenten zijn op dit moment schaars. Vijf minuten zonder scherm om even door te ademen kan vandaag al opluchten.        | Veel gedachten willen ruimte. Laat er voor vandaag één ding vallen – uw hoofd mag even uitrusten.                                        | U geeft uw gedachten bewust ruimte. Deze zorg voor uzelf betaalt zich terug.                           |
| Beziehungen        | Een kort „hoe gaat het met u?“ naar iemand die u dierbaar is, kan vandaag goed doen – voor u beiden.                        | U bent de laatste tijd veel voor anderen geweest. Het is prima om vandaag wat kracht voor uzelf op te doen.                              | U onderhoudt uw relaties met veel warmte. Deze verbindingen dragen u – vandaag en in de komende dagen. |
| Wirksamkeit        | Eén klein afgerond stapje kan vandaag goed doen: begin iets en maak het af. Vooruitgang mag klein zijn.                     | Uw lijst is lang en uw dag heeft grenzen. Kies het ene wat er vandaag echt toe doet – de rest mag wachten.                               | U heeft vandaag heel wat op gang gebracht. Fijn om te zien hoe uw plannen vorm krijgen.                |
| Sinn               | Wat geeft u nu houvast? Een korte notitie over wat u dierbaar is, kan vandaag richting geven.                               | Niet elke vraag vraagt vandaag om een antwoord. Het mag: het grote geheel een poos laten rusten.                                         | U richt uw dag bewust in naar uw waarden. Dat geeft richting aan uw plan – en aan uzelf.               |

### Polnisch (pl)

| Säule              | Defizit                                                                                                                         | Überlast                                                                                                         | Lob                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Körper             | Twoje ciało potrzebuje odpoczynku. Krótki spacer albo wcześniejsze pójście spać już dziś dużo pomogą – mały początek się liczy. | Ostatnio dużo wymagasz od swojego ciała. Dobrze jest dziś trochę zwolnić – regeneracja też jest częścią planu.   | Świetnie, jak konsekwentnie dbasz o swoje ciało w ostatnich dniach. To widać – idź dalej we własnym tempie. |
| Mentale Gesundheit | Przerw dla głowy jest ostatnio mało. Pięć minut bez ekranu na spokojny oddech może dziś już przynieść ulgę.                     | Wiele myśli chce mieć miejsce. Zostaw dziś jedną rzecz mniej – Twoja głowa może odpocząć.                        | Świadomie robisz miejsce na swoje myśli. Ta troska o siebie owocuje.                                        |
| Beziehungen        | Krótkie „co słychać?“ do kogoś ważnego może dziś zrobić dobrze – wam obojgu.                                                    | Ostatnio wiele dajesz innym. Dziś możesz spokojnie zebrać siły dla siebie.                                       | Pielęgnujesz swoje relacje z dużą ciepłotą. Te więzi Cię dźwigają – dziś i w kolejnych dniach.              |
| Wirksamkeit        | Mały, dokończony krok może dziś dobrze zrobić: zacznij jedną rzecz i doprowadź ją do końca. Postęp może być mały.               | Twoja lista jest długa, a dzień ma swoje granice. Wybierz to, co dziś naprawdę się liczy – reszta może poczekać. | Dziś wiele rzeczy ruszyło z miejsca dzięki Tobie. Miło patrzeć, jak Twoje plany nabierają kształtu.         |
| Sinn               | Co daje Ci teraz oparcie? Krótka notatka o tym, co jest dla Ciebie ważne, może dziś dać orientację.                             | Nie każde pytanie potrzebuje dziś odpowiedzi. Możesz pozwolić, by wielki obraz odsapnął na chwilę.               | Świadomie układasz dzień wokół swoich wartości. To nadaje kierunek Twojemu planowi – i Tobie.               |

### Portugiesisch (pt)

| Säule              | Defizit                                                                                                                        | Überlast                                                                                                             | Lob                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Körper             | Seu corpo precisa de uma pausa. Uma caminhada curta ou dormir um pouco mais cedo já ajudam muito hoje – começar pequeno conta. | Ultimamente você tem pedido muito ao seu corpo. Tudo bem ir mais devagar hoje – recuperar também faz parte do plano. | Que constância em cuidar do seu corpo nos últimos dias. Dá para notar – continue no seu ritmo.            |
| Mentale Gesundheit | As pausas mentais andam em falta. Cinco minutos sem telas para respirar já podem aliviar hoje.                                 | Muitos pensamentos querem espaço. Deixe uma coisa a menos para hoje – sua cabeça merece descanso.                    | Você está dando espaço aos seus pensamentos com intenção. Esse cuidado com você dá frutos.                |
| Beziehungen        | Um breve „como você está?“ para alguém importante pode fazer bem hoje – para os dois.                                          | Ultimamente você tem estado muito presente para os outros. Tudo bem reunir forças para você hoje.                    | Você cuida das suas relações com muito carinho. Esses laços sustentam você – hoje e nos dias que vêm.     |
| Wirksamkeit        | Um pequeno passo concluído pode fazer bem hoje: comece uma coisa e leve até o fim. O progresso pode ser pequeno.               | Sua lista é longa e o dia tem limites. Escolha o que importa de verdade hoje – o resto pode esperar.                 | Hoje você colocou muita coisa em marcha. É bom ver seus planos ganhando forma.                            |
| Sinn               | O que serve de apoio para você agora? Uma nota curta sobre o que é importante pode dar orientação hoje.                        | Nem toda pergunta precisa de resposta hoje. Você pode deixar o quadro geral descansar por um pouco.                  | Você organiza o seu dia em torno dos seus valores, com intenção. Isso dá direção ao seu plano – e a você. |

### Russisch (ru)

| Säule              | Defizit                                                                                                      | Überlast                                                                                                                | Lob                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Körper             | Вашему телу нужна передышка. Короткая прогулка или ранний отход ко сну уже помогут – малый шаг тоже шаг.     | В последнее время вы многого требуете от своего тела. Сегодня можно идти помедленнее – восстановление тоже часть плана. | Как последовательно вы заботитесь о своём теле в последние дни. Это заметно – продолжайте в своём темпе. |
| Mentale Gesundheit | Внутренних пауз сейчас мало. Пять минут без экрана, чтобы просто подышать, уже принесут облегчение.          | Много мыслей требуют места. Оставьте на сегодня на одну задачу меньше – голове нужен отдых.                             | Вы сознательно даёте место своим мыслям. Эта забота о себе приносит плоды.                               |
| Beziehungen        | Короткое «как дела?» человеку, который вам дорог, может сегодня сделать добро – вам обоим.                   | В последнее время вы много отдавали другим. Сегодня можно позволить себе набраться сил.                                 | Вы бережно относитесь к своим отношениям. Эти связи вас поддерживают – сегодня и в дни впереди.          |
| Wirksamkeit        | Маленький завершённый шаг уже поможет: начните одно дело и доведите до конца. Прогресс может быть маленьким. | Список длинный, а день не безграничен. Выберите то, что сегодня действительно важно – остальное может подождать.        | Сегодня у вас сдвинулось с места немало дел. Приятно видеть, как планы обретают форму.                   |
| Sinn               | Что даёт вам опору сейчас? Короткая записка о важном может сегодня дать направление.                         | Не на каждый вопрос нужен ответ сегодня. Можно позволить большой картине немного подождать.                             | Вы сознательно строите день вокруг своих ценностей. Это придаёт направление вашему плану – и вам.        |

### Schwedisch (sv)

| Säule              | Defizit                                                                                                               | Überlast                                                                                                                             | Lob                                                                                                |
| ------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Körper             | Din kropp behöver en paus. En kort promenad eller lite tidigare läggdags hjälper redan idag – att börja smått räknas. | Den senaste tiden har du ställt mycket på din kropps konto. Det är okej att ta det lite lugnare idag – återhämtning hör till planen. | Vad fin rutin du har i att ta hand om din kropp den senaste tiden. Det syns – fortsätt i din takt. |
| Mentale Gesundheit | Inre pauser är ont om just nu. Fem minuter utan skärm för att andas kan redan idag lätta.                             | Många tankar vill ha plats. Lämna en sak färre för idag – huvudet får gärna vila.                                                    | Du ger medvetet rum åt dina tankar. Den här omsorgen om dig själv bär frukt.                       |
| Beziehungen        | En kort „hur mår du?“ till någon som är dig nära kan göra gott idag – för er båda.                                    | Du har den senaste tiden funnits mycket för andra. Det är okej att samla kraft åt dig själv idag.                                    | Du vårdar dina relationer med mycket värme. Dessa band bär dig – idag och i dagarna som kommer.    |
| Wirksamkeit        | Ett litet avslutat steg kan göra gott idag: börja en sak och för den i mål. Framsteg får vara litet.                  | Listan är lång och dagen har gränser. Välj det som verkligen betyder något idag – resten får vänta.                                  | Idag har du fått många saker i rullning. Trevligt att se dina planer ta form.                      |
| Sinn               | Vad ger dig stöd just nu? En kort anteckning om det som betyder något för dig kan ge riktning idag.                   | Inte varje fråga behöver ett svar idag. Det är tillåtet att låta helheten vila en stund.                                             | Du lägger medvetet din dag efter dina värderingar. Det ger riktning åt din plan – och åt dig.      |

## 6. Neue Texte schreiben

Neue Fürsorge-Texte (z. B. für eine neue Säule, einen neuen Anlass) folgen demselben Muster:

1. Situation bestimmen (Defizit / Überlast / Lob), Säule benennen.
2. Entwurf auf Deutsch nach Abschnitt 4 — warm, konkret, ohne Vorwurf.
3. Prüffrage stellen: „Sorgt der Text, oder protokolliert er nur?“ — nur „sorgt“ zählt.
4. Übersetzung ins Englische gemäß Abschnitt 5 (Anreden-Konvention je Sprache beachten).
5. Ablage als i18n-Key unter `frontend/src/i18n/locales/<sprache>/`, Referenztext hier ergänzen.

## 7. Zweckbestimmung und Begriffsliste

Balamentum dient der **Lebensbalance und Selbstfürsorge**. Es ist **kein Medizinprodukt** und kein Ersatz für ärztlichen Rat. Die Liste ist für alle Texte verbindlich (Website, App, Store); Spiegel der Zu-meiden-Liste: `website/src/i18n-mdr-wording.test.ts`.

| Erlaubt                                                 | Zu meiden                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------- |
| Lebensbalance, Selbstfürsorge, Impuls, Ausgleich, Pause | Burnout-Prävention, Therapie, Heilung, Diagnose, Behandlung |
| „kann guttun“, „darf heute sein“                        | Stressabbau, „hilft gegen …“, Heil- oder Wirkversprechen    |
| „kein Medizinprodukt, kein Ersatz für ärztlichen Rat“   | Aussagen zu Krankheit, Symptomen oder Genesung              |

Die TelefonSeelsorge (0800 111 0 111) steht ausschließlich in den Nutzungsbedingungen (Abschnitt Haftung), nicht im Fürsorge-Hinweis: Balamentum ist ein Aufgabenmanager, der Aufgaben zurück in die Balance vorschlägt, kein Beratungsangebot.
