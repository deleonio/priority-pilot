# Changelog

_Diese Datei wird automatisch aus den GitHub-Releases generiert — nicht von Hand bearbeiten. Ein Abschnitt fasst alle Releases derselben Minor-Version zusammen; neue Einträge entstehen über die `release:*`-Labels des PR-Documenters, s. CONTRIBUTING.md._

## v0.25 - 2026-10-14

_Enthält v0.25.0 – v0.25.7._

### 🐞 Bug Fixes

- fix(server): block geocode rate limit header bypass by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2587

### Other Changes

- docs(arc42): add ADR 0024 to decision table (V-19) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2582
- docs(skills): german-only chat and full-queue status for coordinator by @deleonio in https://github.com/deleonio/priority-pilot/pull/2583
- [P0/S] Server: CSRF-Schutz greift, sobald die Anmeldung aktiv ist (#2540) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2584
- fix(server): user search with literal wildcards and result limit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2585
- fix(server): book llm provider test against ai quota and throttle it (#2542) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2586
- fix(server): log invoice delivery errors after commit, don't throw by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2588

## v0.24 - 2026-10-13

_Enthält v0.24.0 – v0.24.13._

### 🎉 New Features

- feat(frontend): starter sentence for new accounts instead of deficit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2573
- feat(frontend): one-tap complete with success feedback and undo (#2526) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2572

### 🚀 Improvements

- feat(frontend): keep save button in view when creating tasks (#2525) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2577

### Other Changes

- fix(frontend): show app magic-link landing despite existing session by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2566
- fix(deps): update dependency i18next to v26.4.4 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2512
- docs(adr): add 0024 direct completion with undo instead of dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2568
- feat(server): require minimum completions before overload (#2521) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2569
- feat(frontend): refresh care hint after completing a task (#2522) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2570
- feat(server): pillar names in care texts follow app language (#2523) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2571
- feat(frontend): single primary action per missed task (#2524) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2575
- feat(frontend): show done tasks on their completion day in week view by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2576
- test(frontend): measure missed/deadlines top edges atomically (#2578) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2579
- test(frontend): mark onboarding dismissed up front in header focus test by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2581

## v0.23 - 2026-10-12

_Enthält v0.23.0 – v0.23.4._

### 🎉 New Features

- feat(frontend): show packages without purchase on Play channel by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2500
- feat(server): list and revoke android app logins via api-tokens by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2504
- feat(frontend): revoke android app sessions in token management (#2499) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2506

### 🐞 Bug Fixes

- fix(deps): update dependency @capacitor/browser to v8.0.5 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2489
- feat(server): harden token scope, ICS host switch and CORS max-age by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2502
- fix(server): prevent data loss and silent task/score input errors by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2511
- feat(frontend): translate fixed balance texts and raw i18n keys (#2496) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2513
- chore: fix store description and portuguese salutation (#2498) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2516
- fix(server): forest shows handover and group tasks like the list (#2515) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2531

### 🚀 Improvements

- fix(deps): update capacitor monorepo to v8.5.3 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2486
- fix(deps): update dependency @capacitor/push-notifications to v8.1.3 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2503

### 🔧 Engineering

- fix(deps): update dependency @capacitor/app to v8.1.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2488
- docs(arc42): align adr 0016 status row with adr 0021/0023 (v-17) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2490
- test(frontend): wait for toolbar re-render before settings re-click by @deleonio in https://github.com/deleonio/priority-pilot/pull/2505
- docs(skills): grep old values in e2e and unit tests during spec phase by @deleonio in https://github.com/deleonio/priority-pilot/pull/2507
- fix(deps): update dependency express-rate-limit to v8.7.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2509
- test(e2e): isolate spec data per shard (#2508) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2510
- test(frontend): stabilize archivo host font check by @deleonio in https://github.com/deleonio/priority-pilot/pull/2514

### Other Changes

- fix(native): stop committing generated capacitor.settings.gradle by @deleonio in https://github.com/deleonio/priority-pilot/pull/2517
- feat(series): manage checklist on series and templates (#2501) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2530
- feat(auth): magic link signs in where it was requested (#2563) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2564

## v0.22 - 2026-10-11

_Enthält v0.22.0 – v0.22.10._

### 🐞 Bug Fixes

- docs(guide): sync user guide to current app state 2026-10-11 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2478

### 🔧 Engineering

- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1887
- chore(deps): update gradle to v8.14.6 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2483
- chore(deps): update pi-erweiterungen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2484

### Other Changes

- docs: sync spec files to actual code state 2026-10-11 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2477
- feat(frontend): use built-in KolCard closer for demo hint (#2474) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2476
- docs(knowledge): describe frontend coverage gate as implemented (v-18) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2479
- feat(frontend): make launch banner dismissible (#2480) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2481
- fix(deps): pin dependency pdf-lib to 1.17.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2482
- fix(frontend): launch banner dismissible per login, demo hint removed by @deleonio in https://github.com/deleonio/priority-pilot/pull/2485
- feat(frontend): two-column balance image picker with preview above hint by @deleonio in https://github.com/deleonio/priority-pilot/pull/2487

## v0.21 - 2026-10-10

_Enthält v0.21.0 – v0.21.7._

### 🎉 New Features

- feat(frontend): allow clearing a set deadline in task form (#2463) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2466
- feat(frontend): dismissible demo hint card (#2471) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2473

### 🚀 Improvements

- feat(server): raise checklist limit from 20 to 50 items (#2462) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2465

### 🔧 Engineering

- docs(arc42): sync architecture doc to actual code state 2026-10-10 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2468

### Other Changes

- feat(frontend): series auto-create switch before start date (#2464) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2472
- feat(server): reject done with open checklist items (#2467) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2470
- feat(frontend): render demo hint as dismissible kolcard (#2474) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2475

## v0.20 - 2026-10-09

_Enthält v0.20.0 – v0.20.4._

### 🎉 New Features

- feat(server): manage task checklist items one by one via mcp (#2460) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2461

### Other Changes

- docs(project): add tester to user roles and link to arc42 5.2 (V-15) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2455
- fix(server): persist db allowance so review login survives allowlist by @deleonio in https://github.com/deleonio/priority-pilot/pull/2457
- feat(server): manage task checklists via MCP tools (#2458) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2459

## v0.19 - 2026-10-09

_Enthält v0.19.0 – v0.19.19._

### 🎉 New Features

- feat(frontend): add cookieless matomo to website and web app by @deleonio in https://github.com/deleonio/priority-pilot/pull/2435

### 🐞 Bug Fixes

- docs(arc42): sync android app docs and adr table with adr 0021 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2439
- fix(frontend): fall back to browser login on canceled native sign-in by @deleonio in https://github.com/deleonio/priority-pilot/pull/2453

### 🚀 Improvements

- feat(frontend): preview selected balance picture in settings by @deleonio in https://github.com/deleonio/priority-pilot/pull/2436
- docs(skill): coordinator stops on empty queue and sends one push by @deleonio in https://github.com/deleonio/priority-pilot/pull/2440

### 🔧 Engineering

- docs(adr-0018): grant plus instead of pro for opt-in trial by @deleonio in https://github.com/deleonio/priority-pilot/pull/2438
- docs(skill): empty-queue stop ignores PRs parked with the author by @deleonio in https://github.com/deleonio/priority-pilot/pull/2441
- build(frontend): drop push-sw.js from android bundle by @deleonio in https://github.com/deleonio/priority-pilot/pull/2449

### Other Changes

- feat(server): add password review access for google play (#2426) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2433
- feat(frontend): deadline pagination, compact missed list, slim banner by @deleonio in https://github.com/deleonio/priority-pilot/pull/2416
- feat(frontend): reduce balance variants to rays, bloom, crystal, hands by @deleonio in https://github.com/deleonio/priority-pilot/pull/2437
- feat(i18n): translate app, server texts and website to english by @deleonio in https://github.com/deleonio/priority-pilot/pull/2429
- fix(server): reset review account on every login by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2444
- [P2/S] Hilfe: Feedback-Formular wählt „Wünsche und Ideen“ vor (#2443) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2446
- revert(balance): alle neun Zifferblätter wiederherstellen by @deleonio in https://github.com/deleonio/priority-pilot/pull/2447
- feat(frontend): show care hint actions in one row with icon buttons by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2448
- feat(frontend): move missed tasks into dashboard grid, unify gap by @deleonio in https://github.com/deleonio/priority-pilot/pull/2450
- feat(native): sign in natively via Credential Manager instead of browser by @deleonio in https://github.com/deleonio/priority-pilot/pull/2451
- fix(server): exempt app channel from CSRF so native sign-in completes by @deleonio in https://github.com/deleonio/priority-pilot/pull/2452
- fix(server): allow app request headers in CORS preflight by @deleonio in https://github.com/deleonio/priority-pilot/pull/2454

## v0.18 - 2026-10-08

_Enthält v0.18.0 – v0.18.45._

### 🎉 New Features

- feat(server): add read-only CalDAV calendar sources (#2211) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2347
- feat(free-time): suggest tasks for free calendar gaps by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2348
- feat(server): add series autoCreate switch and rhythm none by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2373
- feat(server): add on-demand series instance endpoint by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2382
- feat(server): issue app tokens and CORS for the Android app by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2389
- feat(frontend): app token auth and push in embedded android app by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2391
- feat(server): create recurring tasks via mcp task tools (#1938) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2394
- feat(server): configurable mcp dialog instructions per user by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2396
- feat(frontend): suggest splitting repeatedly postponed large tasks by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2400
- feat(server): add knowledge entries for pillar suggestions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2409
- feat(frontend): refetch data on return to foreground by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2408

### 🐞 Bug Fixes

- fix(website): shrink image film section to 48rem by @deleonio in https://github.com/deleonio/priority-pilot/pull/2346
- fix(native): alte Service Worker in der Android-App abmelden by @deleonio in https://github.com/deleonio/priority-pilot/pull/2385
- feat(server): suggest care actions for every deficit pillar by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2401
- ci(workbench): time-box playwright deps install, fall back without apt by @deleonio in https://github.com/deleonio/priority-pilot/pull/2410

### 🚀 Improvements

- feat(frontend): restore plan matrix, list higher-tier features last by @deleonio in https://github.com/deleonio/priority-pilot/pull/2366
- chore(native): bundle web app into android app bundle by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2392
- feat(server): add pinned field to mcp task_update by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2395
- feat(frontend): store content preferences per account (#2398) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2407
- docs(native): add step-by-step firebase setup for push by @deleonio in https://github.com/deleonio/priority-pilot/pull/2431

### 🔧 Engineering

- ci(android): upload daily release aab as draft to internal play track by @deleonio in https://github.com/deleonio/priority-pilot/pull/2352
- chore: roll out daily android release to internal test track by @deleonio in https://github.com/deleonio/priority-pilot/pull/2370
- docs(skill): add fixed status block to ticket-coordination rounds by @deleonio in https://github.com/deleonio/priority-pilot/pull/2386
- docs(skill): add coordinator learnings from 2026-10-07 by @deleonio in https://github.com/deleonio/priority-pilot/pull/2417
- docs(adr): add ADR 0022 and concept for opt-in e2e encryption (#1923) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2413

### Other Changes

- feat(server): confirm withdrawal consent on first invoice (#2329) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2336
- feat(server): flag task llm suitability via keyword heuristic by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2351
- feat(server): add ai draft action for llm-suitable tasks by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2367
- docs(native-apps): Google Play purchase verification setup (#2368) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2372
- docs(adr): ADR 0020 Serien Automatisch anlegen / Vorlage (#2354) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2374
- feat(server): render invoice pdf as letter with logo, table and footer by @deleonio in https://github.com/deleonio/priority-pilot/pull/2369
- fix(native): widen android versionCode digits with hard limits by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2371
- feat(server): create due series automatically every day by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2384
- docs(adr): ADR 0021 Android-App als SPA ohne Service Worker by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2387
- docs(adr): ADR 0021 Android-App als SPA ohne Service Worker by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2387
- feat(frontend): add auto-create switch and series templates tab (#2358) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2383
- feat(frontend): add android build without pwa and fixed site url by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2388
- feat(frontend): add create-task dialog to series and templates by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2390
- feat(server): list only open tasks in mcp task_list by default (#2144) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2393
- [P2/M] Server: Inventar der Fachlogik (REST/MCP/Jobs) und Konvention für ihren Ort (#1934) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2403
- [P1/S] Paketübersicht: Synchronisation in allen Paketen ausweisen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2402
- docs: evaluate Open-Meteo vs DWD weather APIs (#1931) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2411
- refactor(server): gerundete Entfernung zentral in logics/geo.ts (#2406) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2419
- docs(tickets): require priority/effort prefix in titles by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2421
- feat(server): add mcp tools for series and templates (#2360) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2420
- feat(frontend): rhythm and auto-delete only when auto-create on (#2414) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2418
- feat(server): apply task defaults and create instances in POST /series by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2412
- refactor(server): compute series generation horizon in one place (#2405) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2425
- feat(frontend): save task as series template (#2361) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2422
- feat(frontend): name series/template switch and dialog title (#2415) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2424
- feat(frontend): add capture-from-template to quick capture (#2363) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2423
- ci(android): add tag input to roll app bundle into test track by @deleonio in https://github.com/deleonio/priority-pilot/pull/2430
- docs(marketing): add play store listing with texts and images by @deleonio in https://github.com/deleonio/priority-pilot/pull/2432
- fix(server): count deadline as missed only from the next day (#2427) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2428
- docs: define payment method per channel (pwa, android, ios) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2434

## v0.17 - 2026-10-07

_Enthält v0.17.0 – v0.17.45._

### 🎉 New Features

- feat(server): carry upgrade credit over to following cycles (#2241) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2280
- feat(frontend): add welcome steps card to dashboard after onboarding by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2284
- feat(admin): delete user subscriptions and invoices completely (#2295) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2296
- feat(server): send waitlist activation mail with login link by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2310
- feat(server): send emails for payment failure and subscription end by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2320
- feat(ci): add ai:hold-merge label to block auto-merge by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2333
- feat(admin): delete foreign user account from admin user list by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2331

### 🐞 Bug Fixes

- fix(server): allow account deletion with abandoned paypal checkout by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2309
- fix(frontend): keep legal text details open in consent step by @deleonio in https://github.com/deleonio/priority-pilot/pull/2314
- fix(server): remove duplicate MailSender import in paypal.ts by @deleonio in https://github.com/deleonio/priority-pilot/pull/2322
- test(e2e): finish pillar recalc fake run on demand instead of wall clock by @deleonio in https://github.com/deleonio/priority-pilot/pull/2323
- fix(frontend): keep collapsible sections open across re-renders by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2332

### 🚀 Improvements

- feat(frontend): show price and downgrade-at-period-end in change dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2326

### 🔧 Engineering

- refactor(frontend): extract share-card rasterization into shared helper by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2273
- test(e2e): fix shard isolation in #2221 and #763 specs by @deleonio in https://github.com/deleonio/priority-pilot/pull/2290
- test: cover invitation auto-allow of unknown emails (#2223) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2288
- test(server): freeze time in #2143 proration AK3 test (#2279) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2297
- fix(ci): arm spec-phase soft-abort on hard deadline by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2337
- chore(native): rename android package id to balamentum.app by @deleonio in https://github.com/deleonio/priority-pilot/pull/2334
- test(e2e): isolate admin specs from shared Anna Admin users by @deleonio in https://github.com/deleonio/priority-pilot/pull/2342

### Other Changes

- feat(server): refund and chargeback credit and cancel package (#2237) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2266
- feat(frontend): brand footer with logos on monthly card (#2255) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2269
- fix(server): defer plan takeover for delayed-start subscriptions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2271
- docs(skills): add proactive 3-hour progress report to coordinator by @deleonio in https://github.com/deleonio/priority-pilot/pull/2272
- fix(billing): treat subscriptions with overdue payment as open by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2274
- feat(server): activate upgrade only after payment received (#2238) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2270
- test(server): verify prorated credit on plan upgrade by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2277
- feat(server): allow account deletion after paypal cancellation by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2278
- feat(server): admin lock cancels PayPal subscription by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2281
- feat(frontend): move brand elements into shared month card, use balamentum.modevel.de by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2283
- fix(server): ignore late payments on cancelled subscriptions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2282
- feat(frontend): remember onboarding dismissal across reload by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2285
- test(frontend): isolate issue-763 e2e spec with its own session by @deleonio in https://github.com/deleonio/priority-pilot/pull/2291
- feat(frontend): explain free path without ai in onboarding import by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2289
- feat(frontend): show legal texts inline in consent step by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2293
- [P2/M] Website: Rechtstexte für die anderen Sprachen (#2226) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2294
- fix(ci): use latest verify run in gate, tolerate ai:reviewed on fixup by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2292
- chore(deps): update dependency @modelcontextprotocol/sdk to v1.31.0 [security] by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2298
- feat(server): check PayPal config on production startup by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2311
- fix(auth): Passwort-Registrierung außerhalb der Tests sperren (#2299) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2312
- feat(server): reconcile paypal subscriptions daily (#2300) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2313
- fix(server): one invoice per PayPal charge, idempotent via sale id by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2316
- feat(frontend): add withdrawal notice and order button to checkout by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2315
- [P2/M] Rechnung: Gutschrift als PDF speichern und zustellen (#2303) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2318
- feat(server): add 312k BGB cancellation button and confirmation mail by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2319
- feat(server): add cancellation without login via website by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2321
- fix(frontend): import dark wordmark from src instead of public by @deleonio in https://github.com/deleonio/priority-pilot/pull/2325
- feat(frontend): remove rail planner page and transit proxy by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2339
- fix(ci): PR ohne Closing-Keyword finden und Closes ergänzen (#2163) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2343
- feat(frontend): connect ICS calendars and show events in week view by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2338
- feat(website): add image film to landing page by @deleonio in https://github.com/deleonio/priority-pilot/pull/2344
- docs(native): add upload key fingerprint to asset links by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2345

## v0.16 - 2026-10-06

_Enthält v0.16.0 – v0.16.37._

### 🎉 New Features

- feat(server): import templates as task packages (#1993) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2197
- feat(frontend): streak rest day and balanced weeks (#1971) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2215
- feat(frontend): add journal entries with optional pillar by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2216
- feat(frontend): add balamentum wrapped yearly recap card by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2219
- feat(frontend): add launch-phase feedback invitation banner (#2229) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2261

### 🐞 Bug Fixes

- fix(website): translate footer templates label, drop unused field by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2204
- fix(ci): require real verify run on head before gate merges (#2254) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2257

### 🚀 Improvements

- feat(server): apply plan changes only after payment confirmation by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2220

### 🔧 Engineering

- feat(frontend): make E2E suite weekday-independent by @deleonio in https://github.com/deleonio/priority-pilot/pull/2190
- feat(ci): add canonical models.json with cc/pi model adapter by @deleonio in https://github.com/deleonio/priority-pilot/pull/2203
- feat(ci): add impl provider override, budget watchdog and adapter smoke by @deleonio in https://github.com/deleonio/priority-pilot/pull/2208
- docs(skills): ticket-coordination learnings and ADR 0018 addendum by @deleonio in https://github.com/deleonio/priority-pilot/pull/2214
- docs(skills): add start dialog and instant questions to coordinator by @deleonio in https://github.com/deleonio/priority-pilot/pull/2217
- docs(skills): add ready-for-market mission to ticket-coordination by @deleonio in https://github.com/deleonio/priority-pilot/pull/2247
- chore: remove budget watchdog, budget control moves to coordinator by @deleonio in https://github.com/deleonio/priority-pilot/pull/2267

### Other Changes

- feat(frontend): dashboard and settings ux rework, oauth pillar seeding by @deleonio in https://github.com/deleonio/priority-pilot/pull/2192
- chore: key pipeline concurrency per ticket with issue and pr lanes by @deleonio in https://github.com/deleonio/priority-pilot/pull/2199
- feat(groups): add balance-ranked group challenge with share card by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2196
- feat(frontend): add balance duo card and invite flow (#1991) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2195
- fix(frontend): hide closed modal body in sync, stabilize e2e tab click by @deleonio in https://github.com/deleonio/priority-pilot/pull/2206
- feat(website): add account-free balance check (#1979) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2205
- docs: dedupe decision log and note removal of dead model vars by @deleonio in https://github.com/deleonio/priority-pilot/pull/2207
- feat(server): fetch and store calendar events from ICS address by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2218
- docs(website): clarify liability and AI suggestions in terms of use by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2228
- fix(server): invoice and renew only on PAYMENT.SALE.COMPLETED by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2245
- fix(server): unlock booked plan on first payment (#2231) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2248
- feat(server): invoice the charged PayPal amount and currency by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2249
- feat(frontend): snooze next-task suggestion for three hours by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2246
- fix(deps): update dependency nodemailer to v10 [security] by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1829
- feat(server): withdraw plan and cancel paypal sub after grace expiry by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2250
- fix(ci): pin valid actions/checkout sha in model-smoke and budget-watch by @deleonio in https://github.com/deleonio/priority-pilot/pull/2252
- fix(ci): Container-Ergebnis-Step robust (#2138) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2253
- fix(server): apply billing period change immediately with proration by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2256
- fix(billing): unicode invoice pdf font and atomic payment events by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2251
- chore: revert container result step from #2253 by @deleonio in https://github.com/deleonio/priority-pilot/pull/2258
- fix(ci): fix substring typo in container result step by @deleonio in https://github.com/deleonio/priority-pilot/pull/2259
- feat(frontend): journal statistics with entry counts and balance history by @deleonio in https://github.com/deleonio/priority-pilot/pull/2263
- test(frontend): give #1821 and keyboard-shortcuts specs own sessions by @deleonio in https://github.com/deleonio/priority-pilot/pull/2264
- fix(billing): discard open paypal checkout, no unpaid credit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2260
- fix(ci): keep container-result step from aborting on empty payload by @deleonio in https://github.com/deleonio/priority-pilot/pull/2268
- feat(server): issue invoice number only after successful pdf build by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2265

## v0.15 - 2026-10-05

_Enthält v0.15.0 – v0.15.22._

### 🎉 New Features

- feat(frontend): capture reason for "not now" care hint (#1977) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2187
- feat(server): add balance duo with shared streak for two (#1974) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2193

### 🐞 Bug Fixes

- docs: mark pillar-mode and single-column spec docs as superseded (#2153) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2174

### 🚀 Improvements

- feat(frontend): cards and accordions only on top level (#2015) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2170

### Other Changes

- docs(spec): sync spec documents to implemented state (2026-10-04) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2169
- feat(server): enforce share bounds and consolidate handover rows (#2152) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2172
- chore: document agent setup comparison and split llm concurrency by @deleonio in https://github.com/deleonio/priority-pilot/pull/2171
- refactor(server): use findCancelledWithRemaining in cancel route (F-35) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2175
- fix(frontend): e2e helper, rank-return notice, css tokens (#2154) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2176
- test(frontend): clean up remaining nits from leaf-review rounds (#2173) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2177
- feat(server): import tasks from todoist and csv (#1969) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2180
- feat(frontend): hide llm provider config behind advanced (#1970) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2178
- feat(frontend): shareable weekly balance card (#1968) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2179
- feat(server): anonymous KPI events and admin evaluation (#1989) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2183
- feat(frontend): import analysis report with duplicate merge (#1988) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2181
- feat(frontend): monthly balance recap (#1995) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2185
- chore(ci): remove ai:model label family and label-based model fallback by @deleonio in https://github.com/deleonio/priority-pilot/pull/2182
- docs(skills): escalation ladder for a stalling pipeline (ticket-coordination) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2189
- docs: add MCP guide page and README section (#1978) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2184
- feat(frontend): done action for missed tasks, archive view, forest fix by @deleonio in https://github.com/deleonio/priority-pilot/pull/2188
- [P2/S] Website: DACH-Vorlagenbibliothek mit SEO-Landingpages (#1976) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2194

## v0.14 - 2026-10-04

_Enthält v0.14.0 – v0.14.31._

### 🎉 New Features

- feat(frontend): add article-create skill and marketing articles by @deleonio in https://github.com/deleonio/priority-pilot/pull/2056
- feat(server): reached milestones never expire (#1965) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2148
- feat(server): store balance variant choice on the account (#2009) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2156
- feat(frontend): show done tasks on their due day in week view (#2012) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2158

### 🚀 Improvements

- perf(server): single ScoreEntry read per balance request (#2150) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2155
- feat(frontend): show categories as inline chips instead of card rows by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2161
- feat(frontend): clarify dashboard day/week view switcher labels (#2011) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2165
- feat(frontend): shorten delete button label for saved places (#2013) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2166

### Other Changes

- feat(frontend): onboarding rework from review #2087 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2120
- feat(frontend): rank pillars by tap order (50/20/15/10/5, full save) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2114
- fix(ci): move tailscale/dns network switch behind the runtime setup (#2091) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2122
- feat(frontend): progress state on subscription confirm buttons (#2105) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2123
- feat(ci): hard deadline around agent call keeps soft-abort alive by @deleonio in https://github.com/deleonio/priority-pilot/pull/2124
- docs: describe pillars as five fixed per-user copies (V-10, F-31) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2130
- docs(marketing): rewrite articles as long standalone platform versions by @deleonio in https://github.com/deleonio/priority-pilot/pull/2117
- feat(server): suggest share and confidence per pillar (#2076) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2131
- feat(ci): auto-merge mechanically solvable PR conflicts (#2099) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2125
- feat(ci): let container closing analysis act on its result (#2101) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2127
- fix(ci): fallback documenter no longer pins release:engineering (#2111) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2129
- feat(ci): defer pipeline starts in zai peak window via ZAI_PEAK_MODE by @deleonio in https://github.com/deleonio/priority-pilot/pull/2126
- docs(arc42): sync documentation to implementation state 2026-10-03 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2133
- chore(ci): connect tailscale exit node via oauth client with authkey fallback by @deleonio in https://github.com/deleonio/priority-pilot/pull/2128
- ci: documenter falls back to zai when pi openrouter aliases are missing by @deleonio in https://github.com/deleonio/priority-pilot/pull/2135
- ci: make phase label precheck parseable again by @deleonio in https://github.com/deleonio/priority-pilot/pull/2136
- ci: cache pi packages via scheduled warm-up run (#2092) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2134
- feat(ci): record runtime and configured model per cost entry (#2090) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2121
- feat(server): store only complete pillar distributions (5-80%, sum 100) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2132
- feat(tasks): missed area, postpone counter, archive (#1964) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2139
- feat(frontend): ai model distribution as adoptable suggestion (#2078) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2149
- feat(frontend): show install prompt after aha moment, explain PWA limits by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2151
- perf(server): compute streak once per balance request (#2157) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2160

## v0.13 - 2026-10-03

_Enthält v0.13.0 – v0.13.27._

### 🎉 New Features

- feat(pillars): add main pillar mode for pillar distribution (#1962) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2053

### 🔧 Engineering

- docs(skills): coordination pitfalls, -F body=@file for comment bodies by @deleonio in https://github.com/deleonio/priority-pilot/pull/2059
- feat(i18n): restrict app languages to de and en (#1966) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2058
- docs(skills): closing analysis for finished epics by @deleonio in https://github.com/deleonio/priority-pilot/pull/2061
- docs(skills): start epic closing analysis at once by @deleonio in https://github.com/deleonio/priority-pilot/pull/2062
- fix(ci): require pi openrouter aliases for documenter provider by @deleonio in https://github.com/deleonio/priority-pilot/pull/2064
- feat(frontend): gate expert sliders and weights behind a setting (#1984) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2065
- docs(skills): epic closing analysis may post drafts by @deleonio in https://github.com/deleonio/priority-pilot/pull/2066
- docs(skills): containers first in ticket coordination by @deleonio in https://github.com/deleonio/priority-pilot/pull/2067
- docs(skills): close fulfilled containers, split after job timeouts by @deleonio in https://github.com/deleonio/priority-pilot/pull/2072
- feat(frontend): localized care hint texts for de and en (#2063) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2071
- feat(server): suggest initial tasks from free text (#2068) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2079
- feat(frontend): german labels and unique download buttons (#2031) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2080
- feat(frontend): first-run flow steps 1-3 (free text, suggestions, apply) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2081
- feat(frontend): admin invoice list and download (#1958) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2084
- feat(admin): lock and cancel user subscriptions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2085
- feat(server): invoice payment status replaces fixed label (#2086) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2088
- feat(frontend): onboarding completion flow (weights, summary, examples) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2087
- docs: align historic price notes and test mocks with pro plan (#2033) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2089

### Other Changes

- fix(server): truncate LLM activity advice to task limits (#2010) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2103
- chore(ci): pull pi CLI unpinned at latest per run and drop the pi cache by @deleonio in https://github.com/deleonio/priority-pilot/pull/2108
- feat(server): rank rule mirror and full care suggestions (#2075) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2106
- feat(frontend): move geo range sliders and expert scope list behind expert mode (#1984) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2109
- fix(ci): wait for background gate runs instead of terminating them (#1952) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2112
- fix(ci): detect session-limit aborts only at the failing claude call by @deleonio in https://github.com/deleonio/priority-pilot/pull/2113
- test(frontend): stabilize pillar-recalc live-progress against CI load (#1953) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2115
- feat(frontend): align invoice amounts and style invoice lists (#2104) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2116

## v0.12 - 2026-10-02

_Enthält v0.12.0 – v0.12.26._

### 🎉 New Features

- feat(server): generate compliant PDF invoices and email them (#1955) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2025
- feat(server): limit access mails per user to 10 per 24h by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2046
- feat(billing): show cancelled subscription and reject re-cancel (#2048) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2052
- feat(frontend): show why-now reasons on the recommended task card by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2054

### 🐞 Bug Fixes

- docs(tailscale): document exit-node gating for zai on hosted runners by @deleonio in https://github.com/deleonio/priority-pilot/pull/2051

### 🚀 Improvements

- feat(server): shared five-factor scoring for /next and /suggestions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2045
- feat(frontend): login waitlist as own card with a11y and perf polish by @deleonio in https://github.com/deleonio/priority-pilot/pull/2055
- feat(billing): upgrade and resume a cancelled subscription by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2057

### 🔧 Engineering

- docs(skill): ticket-coordination theme scope and stale ai:needs-human by @deleonio in https://github.com/deleonio/priority-pilot/pull/2023
- docs(adr): store prices set to web prices (#1800) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2024
- docs(skill): ticket-coordination pitfall triage finds ticket already fulfilled by @deleonio in https://github.com/deleonio/priority-pilot/pull/2028
- docs(skill): pitfall for shared building block across two tickets by @deleonio in https://github.com/deleonio/priority-pilot/pull/2036
- docs(skill): ticket-coordination — leave conflicts to a queued fixup by @deleonio in https://github.com/deleonio/priority-pilot/pull/2038

### Other Changes

- fix(billing): PayPal-Paketwechsel, Kündigung abgebrochener Checkouts, Zeitraum-Persistenz by @deleonio in https://github.com/deleonio/priority-pilot/pull/1998
- feat(plans): lower pro prices to 8.99/24.27/86.30 eur by @deleonio in https://github.com/deleonio/priority-pilot/pull/2026
- docs(adr): add ADR 0019 waitlist launch access model (#1961) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2027
- docs(skill): ticket-coordination — check-in cadence while issue phases run by @deleonio in https://github.com/deleonio/priority-pilot/pull/2029
- feat(server,frontend): waitlist with referral rank (#1982) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2034
- chore: extend goal tracking in the cost report by @deleonio in https://github.com/deleonio/priority-pilot/pull/2037
- docs(skill): ticket-coordination conflict, quota and self-fix rules by @deleonio in https://github.com/deleonio/priority-pilot/pull/2039
- feat(server): auto-provision unknown invitee and delegation recipients by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2035
- fix(server): redeliver undelivered invoice mails (#2030) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2040
- feat(website,frontend): add medical-device disclaimer and crisis hotline hint by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2042
- docs(skill): add coordination pitfalls for split subs and re-triage by @deleonio in https://github.com/deleonio/priority-pilot/pull/2047
- feat(server): add score breakdown to /next, /suggestions and next_task by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2050

## v0.11 - 2026-09-30

_Enthält v0.11.0 – v0.11.31._

### 🎉 New Features

- feat(server): add pacing hint to MCP tool descriptions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1881
- feat(server): add evening streak reminder push (#1836) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1883
- feat(server): send care push in the user's app language (#1879) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1880
- docs(skills): add ticket-import skill for document-to-issue imports by @deleonio in https://github.com/deleonio/priority-pilot/pull/1905
- feat(server): add feedback_send mcp tool for app feedback by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1915
- feat(frontend): publish terms of use and link them in app help (#1891) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1918
- feat(server): credit remaining paypal term on upgrade invoice by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1917
- feat(server): remove user feedback from vault on account deletion by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1928

### 🐞 Bug Fixes

- docs(arc42): align package model with free/plus/pro and adr 0018 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1888
- fix(native): keep login after app restart by flushing cookies (#1900) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1909
- revert(ci): sign demo.apk with debug keystore again (#1779) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1910
- test(e2e): fix flaky confetti AK3 overlay count (#1924) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1950
- fix(e2e): bypass Node 26 V8 crash in Playwright Vite webServer by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1951

### 🚀 Improvements

- feat(server): allow editing completed tasks and recalculate score (#1821) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1886
- docs(ux): add rules for collapsible sections and nesting (#1893) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1907
- chore: rewrite website privacy policy per processing (#1892) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1916
- feat(frontend): show amount due before confirming plan change by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1925
- feat(frontend): merge access token tab into ai settings tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1921
- feat(frontend): order settings tabs by plan tier by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1930
- feat(frontend): show invoices to former subscribers by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1948
- feat(server): anchor feedback as plan-independent feature (#1927) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1946

### 🔧 Engineering

- chore(deps): update renovatebot/github-action action to v46.3.6 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1866

### Other Changes

- Säulenbeschreibungen erklären, wie die Balance zustande kommt (#1849) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1884
- feat(frontend): explain streak counting rule on streak card (#1819) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1885
- ci(deploy): demo.apk mit Produktionsschlüssel signieren (#1779) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1906
- feat(server): keep paid plan until period end on paypal cancel by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1908
- feat(frontend): move saved places into their own settings tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1911
- feat(frontend): show monthly equivalent of yearly price by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1914
- docs(skills): ticket-coordination resolves merge conflicts via subagent by @deleonio in https://github.com/deleonio/priority-pilot/pull/1920
- feat(frontend): merge plans and subscription into one settings tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1919
- feat(frontend): require terms and privacy consent after login by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1929
- feat(server): push nearby tasks only on entry, once per 24 h (#1926) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1945
- fix(ci): skip soft-abort labels on account limit (#1943) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1949
- refactor(frontend): remove unreachable ai badge and custom provider gate by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1947

## v0.10 - 2026-09-30

_Enthält v0.10.0 – v0.10.36._

### 💥 Breaking Changes

- feat(server): replace visible ai quota with fair-use throttling by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1868

### 🎉 New Features

- feat(server): add ai care suggestion for plus and pro (#1804) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1871

### 🚀 Improvements

- feat(website): show quarterly price and plus/pro pricing texts by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1872
- feat(server): resolve pillar texts and weekly target via stable key by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1877

### 🔧 Engineering

- fix(ci): give documenter its own openrouter concurrency group by @deleonio in https://github.com/deleonio/priority-pilot/pull/1835
- feat(server): expose care suggestions via mcp (#1796) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1842
- feat(frontend): fit dashboard balance card into short viewports by @deleonio in https://github.com/deleonio/priority-pilot/pull/1844
- ci: add weekly nit digest cron workflow by @deleonio in https://github.com/deleonio/priority-pilot/pull/1845
- ci(triage): park issues with open analysis questions as needs-human by @deleonio in https://github.com/deleonio/priority-pilot/pull/1846
- feat(frontend): show care hint with suggestion on the dashboard (#1793) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1843
- feat(server): measure care suggestion impact anonymously (#1798) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1847
- chore(deps): update gradle to v8.14.5 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1841
- fix(ci): 01-triage.yml wieder gültig (Expression-Limit) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1851
- docs(ci): switch documenter free model to laguna-s-2.1 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1852
- Säulen-Mindestanteil von 5 % auf allen Wegen erzwingen (#1822) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1853
- fix(server): show clear message for too-long task title (#1818) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1854
- chore(deps): update renovatebot/github-action action to v46.3.5 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1850
- test(frontend): locate title-limit message by text in e2e spec by @deleonio in https://github.com/deleonio/priority-pilot/pull/1858
- test(e2e): exempt kol-alert from #930 transparency check by @deleonio in https://github.com/deleonio/priority-pilot/pull/1859
- fix(server): count late completions for their due day in streak by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1856
- docs(agents): align e2e page.route rule with practice by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1860
- feat(server): suggest recovery on overload in care hint (#1795) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1861
- docs(adr): ADR 0018 Preismodell Free/Plus/Pro (#1803) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1863
- feat(ci): swap openrouter haiku model via set-agent-config by @deleonio in https://github.com/deleonio/priority-pilot/pull/1865
- fix(deps): update dependency com.android.tools.build:gradle to v8.13.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1855
- fix(ci): set ai:needs-human in triage without analysis block by @deleonio in https://github.com/deleonio/priority-pilot/pull/1876

### Other Changes

- test(frontend): add observable outcomes and tab-freedom checks by @deleonio in https://github.com/deleonio/priority-pilot/pull/1831
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1607
- feat(server): one care push max per day on deficit or overload (#1794) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1814
- chore(prompts): apply prompt-audit #1590 option 1 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1834
- chore: switch pipeline model to sonnet 5.5 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1833
- chore(gate): scope e2e to specs referencing changed texts and routes by @deleonio in https://github.com/deleonio/priority-pilot/pull/1837
- chore(skills): pre-push checks for doc drift and stale pr description by @deleonio in https://github.com/deleonio/priority-pilot/pull/1838
- chore(gate): single source for the local gate chain in AGENTS.md by @deleonio in https://github.com/deleonio/priority-pilot/pull/1839
- ci(review): rerun red e2e shards once before the review starts by @deleonio in https://github.com/deleonio/priority-pilot/pull/1840
- feat(server): switch plans to free, plus and pro (#1782) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1864
- feat(server): remove legacy max/ultimate plans, add migrateLegacyPlans by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1867
- test(server): cover mcp plan tiers plus read and pro write by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1870
- docs(skills): add ticket-coordination skill for epic processing by @deleonio in https://github.com/deleonio/priority-pilot/pull/1862
- feat(frontend): show plan hint at plan limits without dialog (#1787) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1875
- feat(frontend): show and label ai suggestion in care hint (#1873) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1874

## v0.9 - 2026-09-29

_Enthält v0.9.0 – v0.9.18._

### 🔧 Engineering

- feat(frontend): demote delete account in settings (#1802) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1809
- feat(server): suggest concrete tasks for a balance deficit (#1791) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1810

### Other Changes

- feat(server): care deficit, trend and overload per pillar (#1790) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1805
- docs: add care-tone guide with rules and sample texts in 10 languages by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1806
- docs(project): add website workspace to monorepo list by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1807
- ci: add signed test apk artifact until internal test track (#1801) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1808
- chore(ci): route documenter through openrouter free model by default by @deleonio in https://github.com/deleonio/priority-pilot/pull/1755
- chore: add n-way phase comparison charts to the focus report by @deleonio in https://github.com/deleonio/priority-pilot/pull/1811
- feat(frontend): enable balance sorting by default (#1792) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1812
- fix(report): render phase comparison bars side by side with average bar by @deleonio in https://github.com/deleonio/priority-pilot/pull/1813
- chore(ci): switch phase runners via vars.PHASE_RUNNER (pi5 rollout) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1817
- fix(report): render phase comparison bars side by side with average bar by @deleonio in https://github.com/deleonio/priority-pilot/pull/1815
- chore(ci): route all phase jobs via PHASE_RUNNER, split cache by pi5 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1825
- fix(ci): pass PI_MODEL_ALIASES to all pi-capable workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/1828
- fix(ci): stop review retrigger loop for already-reviewed head (#1824) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1830
- fix(server): scope scores to owner and block ssrf on llm endpoints by @deleonio in https://github.com/deleonio/priority-pilot/pull/1827

## v0.8 - 2026-09-27

_Enthält v0.8.0 – v0.8.17._

### 🎉 New Features

- feat(website): show balamentum wordmark in site header by @deleonio in https://github.com/deleonio/priority-pilot/pull/1770

### 🐞 Bug Fixes

- Revert "feat(frontend): restructure login card and add website link" by @deleonio in https://github.com/deleonio/priority-pilot/pull/1774

### 🔧 Engineering

- feat(frontend): restructure login card hierarchy and add website link by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1765

### Other Changes

- feat(ci): Fokus-Modus (--issues) und Top-10-Tabelle gegen Summary-Truncation by @deleonio in https://github.com/deleonio/priority-pilot/pull/1759
- feat(ci): Ampel-Trend je Phase (KW-Spalten) + Branch-Auswahl im Report-Dispatch by @deleonio in https://github.com/deleonio/priority-pilot/pull/1761
- docs(guide): Ist-Stand-Sync 2026-09-27 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1760
- Revert "feat(frontend): login card head, website link and german google button" by @deleonio in https://github.com/deleonio/priority-pilot/pull/1757
- docs: align arc42 error contract with code - no global express handler by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1762
- feat(frontend): restructure login card, german label, site link (#1753) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1763
- Revert "feat(frontend): restructure login card, german label, site link (#1753)" by @deleonio in https://github.com/deleonio/priority-pilot/pull/1764
- Revert "feat(frontend): restructure login card hierarchy and add website link" by @deleonio in https://github.com/deleonio/priority-pilot/pull/1771
- feat(native): show wordmark splash with mark above and name below by @deleonio in https://github.com/deleonio/priority-pilot/pull/1773
- feat(frontend): restructure login card and add website link by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1772
- feat(frontend): login card hierarchy, german texts, website back link by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1775
- Revert "feat(frontend): login card hierarchy, german texts, website back link" by @deleonio in https://github.com/deleonio/priority-pilot/pull/1776
- feat(frontend): restructure login card hierarchy and labels (#1769) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1777

## v0.7 - 2026-09-27

_Enthält v0.7.0 – v0.7.13._

### 🎉 New Features

- feat(deploy): Debug-APK als demo.apk ins Web-Root deployen by @deleonio in https://github.com/deleonio/priority-pilot/pull/1736

### Other Changes

- docs(auth): document magic-link rate limit and gmail alias pitfall by @deleonio in https://github.com/deleonio/priority-pilot/pull/1737
- chore(deploy): make SITE_URL mandatory by @deleonio in https://github.com/deleonio/priority-pilot/pull/1738
- fix(deploy): Capacitor-Sync direkt aus node_modules statt gefiltertem pnpm-Lauf by @deleonio in https://github.com/deleonio/priority-pilot/pull/1743
- feat(frontend): redesign login page with brand and website styling by @deleonio in https://github.com/deleonio/priority-pilot/pull/1740
- fix(website): apply landing audit fixes (polish, distill, harden) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1739
- docs: sync arc42 architecture doc to current state 2026-09-26 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1744
- fix(server): backfill subscriptions pendingPlan columns via startup migrator (#1742) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1746
- feat(frontend): show balamentum wordmark on the login page (#1741) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1747
- feat(frontend): pill radius on login input and toolbar gap polish (#1745) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1748
- feat(frontend): revert #1745 toolbar popover polish to stock kolibri by @deleonio in https://github.com/deleonio/priority-pilot/pull/1749
- fix(frontend): remove #1623 gap write for stock kol-toolbar by @deleonio in https://github.com/deleonio/priority-pilot/pull/1750
- feat(website): FAQ-Eintrag zur Demo-APK by @deleonio in https://github.com/deleonio/priority-pilot/pull/1754
- feat(frontend): login card head, website link and german google button by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1756
- ci: cost report reads main and lists excluded tickets individually by @deleonio in https://github.com/deleonio/priority-pilot/pull/1758

## v0.6 - 2026-09-26

_Enthält v0.6.0 – v0.6.15._

### Other Changes

- feat(server): accept google play purchases and unlock the plan by @deleonio in https://github.com/deleonio/priority-pilot/pull/1721
- feat(server): securely accept google play subscription events (rtdn) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1722
- feat(server): google play subscription states drive plan, grace and downgrade by @deleonio in https://github.com/deleonio/priority-pilot/pull/1723
- chore(renovate): enable automerge for pi and kolibri updates by @deleonio in https://github.com/deleonio/priority-pilot/pull/1724
- feat(server): at most one active subscription per user across providers by @deleonio in https://github.com/deleonio/priority-pilot/pull/1725
- chore: publish german privacy policy page at /datenschutz/ (#1672) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1727
- feat(server): apply pillar weights to cadence balance fill by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1728
- chore(deps): update node.js to v26.10.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1655
- feat(android): buy packages via google play by @deleonio in https://github.com/deleonio/priority-pilot/pull/1726
- feat(android): Käufe wiederherstellen und fremdverwaltetes Abo anzeigen by @deleonio in https://github.com/deleonio/priority-pilot/pull/1730
- feat(android): Paket über Google Play wechseln by @deleonio in https://github.com/deleonio/priority-pilot/pull/1731
- chore(deps): update pi (cli + erweiterungen) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1656
- fix(frontend): keep admin confirm dialog mounted across step change by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1732
- chore(deps): lock file maintenance by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1660
- fix(android): prevent crash when enabling push without firebase config by @deleonio in https://github.com/deleonio/priority-pilot/pull/1735

## v0.5 - 2026-09-25

_Enthält v0.5.0 – v0.5.32._

### Other Changes

- fix(frontend): access-token card never shows error and empty state together by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1652
- feat(ci): enforce pi tool tier restricted without bash (#1193) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1653
- feat(frontend): add landing shots, mcp chat, email login, app redirect by @deleonio in https://github.com/deleonio/priority-pilot/pull/1650
- fix(ci): hand already-done back to review once per HEAD by @deleonio in https://github.com/deleonio/priority-pilot/pull/1661
- fix(deps): update dependency react-i18next to v17.0.15 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1627
- chore(deps): update dependency undici@6 to v8.11.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1654
- feat(skills): add ticket-tree skill for solution plans and issue trees by @deleonio in https://github.com/deleonio/priority-pilot/pull/1698
- chore(deps): update github actions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1657
- docs(adr): add adr 0016 for native wrapper via capacitor remote mode by @deleonio in https://github.com/deleonio/priority-pilot/pull/1699
- chore: serve digital asset links for the android app by @deleonio in https://github.com/deleonio/priority-pilot/pull/1700
- feat(frontend): detect app channel and hide web prompts in native app by @deleonio in https://github.com/deleonio/priority-pilot/pull/1701
- feat(server): reject paypal checkout for store app channels by @deleonio in https://github.com/deleonio/priority-pilot/pull/1702
- feat(server): Google-Login der App mit Einmal-Code abschließen by @deleonio in https://github.com/deleonio/priority-pilot/pull/1703
- fix(push): warn on zero-device test push and resync subscription by @deleonio in https://github.com/deleonio/priority-pilot/pull/1704
- feat(server): store android app fcm device token by @deleonio in https://github.com/deleonio/priority-pilot/pull/1706
- fix(ci): LLM phases no longer wait for verify by @deleonio in https://github.com/deleonio/priority-pilot/pull/1705
- feat(server): allow users to delete their account with all personal data by @deleonio in https://github.com/deleonio/priority-pilot/pull/1707
- feat(native): scaffold android app in remote mode by @deleonio in https://github.com/deleonio/priority-pilot/pull/1708
- docs(adr): ADR 0017 Store-Billing über Google Play by @deleonio in https://github.com/deleonio/priority-pilot/pull/1709
- feat(server): Benachrichtigungen zusätzlich über FCM versenden by @deleonio in https://github.com/deleonio/priority-pilot/pull/1710
- feat(frontend): hide paypal purchase in android app plans view by @deleonio in https://github.com/deleonio/priority-pilot/pull/1711
- feat(frontend): Konto löschen in den Einstellungen mit sequenzieller Bestätigung by @deleonio in https://github.com/deleonio/priority-pilot/pull/1712
- feat(android): google and magic-link login returns to the app by @deleonio in https://github.com/deleonio/priority-pilot/pull/1713
- feat(android): voice input for quick capture via speech plugin by @deleonio in https://github.com/deleonio/priority-pilot/pull/1714
- ci(android): build a signed app bundle via workflow_dispatch by @deleonio in https://github.com/deleonio/priority-pilot/pull/1715
- feat(android): receive push notifications via FCM by @deleonio in https://github.com/deleonio/priority-pilot/pull/1716
- feat(website): account deletion page for the Play Store listing by @deleonio in https://github.com/deleonio/priority-pilot/pull/1717
- refactor(server): billing providers behind a shared interface by @deleonio in https://github.com/deleonio/priority-pilot/pull/1718
- feat(server): map plans to google play subscription products by @deleonio in https://github.com/deleonio/priority-pilot/pull/1719
- feat(server): verify and acknowledge google play purchases by @deleonio in https://github.com/deleonio/priority-pilot/pull/1720

## v0.4 - 2026-09-24

_Enthält v0.4.0 – v0.4.22._

### Other Changes

- fix(website): remove automatic pwa redirect to /app/ by @deleonio in https://github.com/deleonio/priority-pilot/pull/1624
- fix(frontend): keep header button focus outline within viewport by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1625
- docs(mobile-ui-rules): align checklist touch-target to 44px by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1626
- fix(pillars): resumable recalc with live progress and rate-limit retry by @deleonio in https://github.com/deleonio/priority-pilot/pull/1628
- feat(auth): add email magic link login alongside google by @deleonio in https://github.com/deleonio/priority-pilot/pull/1629
- fix(ci): fail open on mentor model when pr head lacks model-ids.json by @deleonio in https://github.com/deleonio/priority-pilot/pull/1631
- revert(ci): mentor fallback for missing model-ids.json (#1631) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1632
- fix(admin): resumable pillar batch with live progress and error reasons by @deleonio in https://github.com/deleonio/priority-pilot/pull/1630
- perf(frontend): precompress build output with brotli and zstd by @deleonio in https://github.com/deleonio/priority-pilot/pull/1634
- fix(server): keep 5% minimum share per pillar in recalculation by @deleonio in https://github.com/deleonio/priority-pilot/pull/1636
- refactor(frontend): share pillar recalculation run via useReassignRun hook by @deleonio in https://github.com/deleonio/priority-pilot/pull/1633
- feat(server): distribute confidence remainder evenly across pillars by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1637
- fix(e2e): await initAiEnabled to fix AK5 KI-aus race (#1408) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1640
- feat(server): measure balance pillars by cadence, not workload share by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1639
- feat(server): let task_create assign tasks to group members by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1643
- feat(server): withhold tasks with far-future deadlines from suggestions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1644
- feat(frontend): run pillar reassignment as server-side background job by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1645
- feat(server): add grandfathering CLI for legacy free accounts (#1463) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1649
- feat(frontend): rename Wald tab to Graph, sharpen USP messaging by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1647
- feat(frontend): add 8px gap between popover action buttons by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1648
- docs: add inline code documentation rule (jsdoc) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1651

## v0.3 - 2026-09-23

_Enthält v0.3.0 – v0.3.8._

### Other Changes

- refactor(server): extract shared recipient-authorization helper by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1612
- chore(deps): update github actions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1608
- chore(deps): update KoliBri to latest RC (4.5.0-rc.0) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1613
- feat(frontend): add tester role option to user management by @deleonio in https://github.com/deleonio/priority-pilot/pull/1616
- fix(server): reliable pillar recalculation with status filter by @deleonio in https://github.com/deleonio/priority-pilot/pull/1615
- fix(ci): bump version before build so deployed footer matches changelog by @deleonio in https://github.com/deleonio/priority-pilot/pull/1619
- feat(frontend): add week view to the daily plan (#1617) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1620
- feat(frontend): serve the app under /app/ and add a public website by @deleonio in https://github.com/deleonio/priority-pilot/pull/1621

## v0.2 - 2026-09-22

_Enthält v0.2.0 – v0.2.134._

### 🔧 Engineering

- fix(deps): update dependency connect-sqlite3 to v0.9.18 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1398
- chore(ci): wöchentliches UX-Team als cron-LLM-Lauf by @deleonio in https://github.com/deleonio/priority-pilot/pull/1433
- docs(guide): Ist-Stand-Sync 2026-09-20 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1591

### Other Changes

- fix(ci): drop the hand-maintained section guard from the guide sync by @deleonio in https://github.com/deleonio/priority-pilot/pull/1402
- docs(guide): sync user guide with current ui state by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1403
- docs(arc42): sync architecture docs with mcp endpoint and api tokens by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1404
- docs(guide): sync user guide with current app state by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1406
- chore(deps): lock file maintenance by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1332
- chore(deps): update pi (cli + erweiterungen) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1229
- chore(deps): update node.js to v26.8.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1327
- chore(deps): update pnpm to v11.26.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1329
- fix(renovate): group playwright npm package and docker image together by @deleonio in https://github.com/deleonio/priority-pilot/pull/1397
- fix(pipeline): never set phase labels on renovate prs by @deleonio in https://github.com/deleonio/priority-pilot/pull/1407
- feat(frontend): enable dark mode with KoliBri 4.4.1 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1405
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1173
- chore(deps): update pnpm to v12 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1331
- chore(deps): update github actions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1328
- chore(deps): lock file maintenance by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1411
- design(frontend): unify card spacing in settings tabs by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1415
- chore(deps): update playwright (npm + docker image) to v1.63.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1410
- chore(deps): lock file maintenance by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1416
- feat(server): accept api-key header as bearer token alternative by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1418
- docs(arc42): record header-only authentication as a risk in section 11 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1419
- feat(frontend): add icon-only copy buttons with visual feedback by @deleonio in https://github.com/deleonio/priority-pilot/pull/1422
- docs(spec): sync specs with implementation 2026-09-13 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1425
- docs(guide): sync user guide with current implementation state by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1427
- feat(frontend): convert name input fields to search type by @deleonio in https://github.com/deleonio/priority-pilot/pull/1421
- chore(deps): lock file maintenance by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1431
- feat(frontend): add changelog range selector and help page sidebar toc by @deleonio in https://github.com/deleonio/priority-pilot/pull/1432
- feat(frontend): add impressum tab and strip repo links from changelog by @deleonio in https://github.com/deleonio/priority-pilot/pull/1434
- feat(mcp): switch MCP server responses to English (#1370) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1437
- fix(frontend): refresh task list after generating series instances by @deleonio in https://github.com/deleonio/priority-pilot/pull/1439
- feat(frontend): add hint badge to task and series lists by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1442
- feat(server): track and surface auto-deleted missed tasks by @deleonio in https://github.com/deleonio/priority-pilot/pull/1440
- chore(ci): share one concurrency group across the ticket pipeline 01-06 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1453
- feat(server): balance_status mcp tool and GET /scores/balance (#1423) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1446
- feat(frontend): add edit button to dashboard next-task panel by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1450
- fix(prompts): harden the fixup loop contract and context hygiene by @deleonio in https://github.com/deleonio/priority-pilot/pull/1452
- feat(server): add SMTP mail channel alongside web push by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1441
- feat(server): block content edits on done tasks until reopened by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1444
- feat(server): commit app feedback to obsidian vault by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1443
- feat(server): allow autoDeleteAfterDeadline via MCP task tools by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1445
- fix(frontend): hide task id prefix in dashboard widget titles by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1451
- fix(frontend): dedup extractLeaves by node.id (#1449) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1464
- feat(ci): tägliches Code-Review-Team ersetzt nightly-arch-opt by @deleonio in https://github.com/deleonio/priority-pilot/pull/1468
- feat(server): send startup status mail with commit sha to admins by @deleonio in https://github.com/deleonio/priority-pilot/pull/1466
- fix(ci): scope guard opens .github/scripts, quality goals as yardstick by @deleonio in https://github.com/deleonio/priority-pilot/pull/1469
- feat(server): optional cc for status mail, new imprint contact by @deleonio in https://github.com/deleonio/priority-pilot/pull/1473
- refactor(server): ownerScope in logics statt express verlagern by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1470
- feat(frontend): hide task ids, add pillar badge, show feedback reason by @deleonio in https://github.com/deleonio/priority-pilot/pull/1472
- chore(deps): update renovatebot/github-action action to v46.3.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1477
- fix(server): log API-Token-Prüfung Fehler statt sie zu verschlucken by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1480
- docs: deduplicate a11y guidance and refresh spec naming convention by @deleonio in https://github.com/deleonio/priority-pilot/pull/1483
- feat(server): enforce dependency weight range 0.1-1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1482
- docs: sharpen the monetization concept against the code by @deleonio in https://github.com/deleonio/priority-pilot/pull/1485
- fix(server): mount rate limiters on their own paths only (#1479) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1481
- feat(server): add plan model and entitlement center (#1456) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1486
- feat(server): enforce plan feature gating across api and mcp by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1487
- feat(frontend): add plan context, badge, and upgrade offer dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1488
- feat(frontend): roll out plan badges to remaining touchpoints (#1484) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1489
- feat(server): meter ai assist quota on llm routes by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1490
- feat(server): cap MCP readwrite scope by plan (#1460) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1491
- docs(monetarisierung): Zahlungsweg als ADR 0013 festhalten (#1461) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1492
- Claude/peaceful goldberg zfdcng by @deleonio in https://github.com/deleonio/priority-pilot/pull/1493
- feat(server): add subscription model, cent pricing and quarterly tier by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1497
- fix(server): add .js extension to progress-metric test import by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1499
- feat(server): handle paypal webhooks and generate invoices by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1498
- fix(dashboard): score life balance imbalances honestly again by @deleonio in https://github.com/deleonio/priority-pilot/pull/1500
- chore: resolve the four open findings from review protocol #1471 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1503
- feat(server): process PayPal payment events and enforce grace period by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1508
- feat(frontend): add billing subscription management flow to settings by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1509
- feat(server): sync user plan on downgrade and cancellation (#1462) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1510
- chore(deps): bump @public-ui packages to 4.4.1 prerelease 7b9d0237 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1511
- feat(server): add MCP tools to create, update and delete categories by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1514
- feat(frontend): add archivo as primary font by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1516
- fix(frontend): enforce archivo font on all kolibri host elements by @deleonio in https://github.com/deleonio/priority-pilot/pull/1517
- feat(server): add pillar create/update/delete/weights MCP tools by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1515
- refactor(frontend): drop type assertion in address autocomplete keydown by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1519
- feat(server): add balance history endpoint and MCP tool by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1520
- feat(server): collapse series instances across lists and pushes by @deleonio in https://github.com/deleonio/priority-pilot/pull/1522
- chore(deps): update dependency brace-expansion@2 to v5.0.12 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1501
- docs(adr): record package boundaries without offer dialog (adr 0014) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1523
- feat(server): free voice input for all plans, gate mcp_read to max+ by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1533
- feat(frontend): split plans/subscription into settings tabs by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1534
- feat(frontend): add five selectable life balance dials to the dashboard by @deleonio in https://github.com/deleonio/priority-pilot/pull/1535
- feat(frontend): couple ai toggle to plan entitlement (#1525) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1536
- feat(server): send admin email notification on new feedback by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1538
- feat(frontend): gate access-token controls, rename tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1537
- feat(frontend): gate pillar advisor ui behind ai entitlement by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1539
- fix(server): use english error message in mcp readWeight validator by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1540
- feat(frontend): increase mobile element sizes by one pixel step by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1546
- feat(server): add group create, update and delete MCP tools (#1542) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1545
- fix(server): resolve review findings f-10, f-11, v-3 (#1471) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1550
- feat(server): scope llm providers to users via userId column (#1547) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1551
- feat(frontend): add bloom and crystal life balance dial variants by @deleonio in https://github.com/deleonio/priority-pilot/pull/1552
- feat(server): manage group members via mcp tools (#1543) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1553
- feat(frontend): allow admins to switch their own plan for free (#1556) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1563
- feat(frontend): hint on strongly unbalanced pillar weight distribution by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1562
- docs: align tdd-strategy test scope with adr 0004 and test:scripts by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1560
- feat(server): per-user llm provider selection, gate and quota bypass by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1557
- feat(server): manage invitations and invite links via mcp tools (#1544) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1558
- feat(frontend): replace offer dialog with labeled plan badge (#1528) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1564
- feat(server): balance score measures unweighted skew (#1474) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1568
- feat(frontend): consolidate feedback categories to three by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1569
- feat(frontend): move own-package switch into packages tab (#1565) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1570
- feat(frontend): add header position setting (top/bottom) (#1428) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1571
- chore(prompts): apply prompt-audit #1467 options 1-3 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1559
- feat(frontend): distinguish own and instance-wide llm providers (#1549) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1567
- feat(server): add tester role with admin access except user management by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1572
- feat(frontend): make header sticky with uniform padding by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1575
- fix(server): ungescopten Aufgabenwald beim Start nicht mehr in die Logs schreiben by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1579
- docs(arc42): sync architecture doc to current state 2026-09-19 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1580
- docs: canonical gate as verify mirror + prompt-audit coverage (#1576) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1581
- feat(frontend): confirm modal before saving unbalanced pillar weights by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1588
- feat(frontend): dry-run connection test in llm provider dialog (#1577) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1585
- docs(AGENTS.md): Align frontend test path with testing.md by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1592
- chore(deps): update pnpm to v12.5.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1541
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1476
- feat(frontend): Header bar full-width with continuous edge (#1587) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1589
- feat(server)!: lock pillar crud and restore five default pillars by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1586
- feat(frontend): tick off checklist items when marking task as done by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1593
- fix(frontend): task form fields no longer narrowed by plan hints by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1599
- feat(frontend): add segment and hand dials plus admin pillar batch by @deleonio in https://github.com/deleonio/priority-pilot/pull/1602
- feat(frontend): assign tasks to a whole group by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1603
- feat(frontend): add pin/unpin support for tasks by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1594
- ci: fix daily minor bump detection via tag patch component by @deleonio in https://github.com/deleonio/priority-pilot/pull/1605
- docs(mobile-ui-rules): align design token statement with ux-design.md by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1606
- feat(frontend): move pin action to toolbar, show pin state as badge by @deleonio in https://github.com/deleonio/priority-pilot/pull/1609
- feat(frontend): confirm before discarding unsaved task form changes by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1600
- feat(frontend)!: require a full pillar distribution with coupled sliders by @deleonio in https://github.com/deleonio/priority-pilot/pull/1604
- feat(place-favorites): save by address only, dedupe, and show errors by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1610
- feat(frontend): randbündige Kopfzeile + design-optimize folgt dem Audit by @deleonio in https://github.com/deleonio/priority-pilot/pull/1611

## v0.1 - 2026-09-12

_Enthält v0.1.683 – v0.1.836._

### 🎉 New Features

- feat(frontend): add groups tab with CRUD, roles and delete confirmation by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1214
- feat(frontend): show task dependencies as weighted graph instead of tree by @deleonio in https://github.com/deleonio/priority-pilot/pull/1309
- feat(frontend): toggle to show parent tasks in task list by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1388
- feat(header): make logo clickable and visually smaller by @deleonio in https://github.com/deleonio/priority-pilot/pull/1392

### 🚀 Improvements

- feat(server): replace geocode rate limiter with express-rate-limit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1283

### 🔧 Engineering

- fix(frontend): Empfänger-Auswahl liefert beim Clear keine gültige ID mehr by @deleonio in https://github.com/deleonio/priority-pilot/pull/1237

### Other Changes

- chore(deps): update dependency undici@6 to v8 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1191
- feat(frontend): fix clipped focus outline in task popover (#1186) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1189
- feat(frontend): master switch for animations (confetti default off) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1188
- fix(deps): update dependency redis to v6.2.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1172
- feat(frontend): surface OS reduced-motion state in app settings by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1195
- feat(ci): add turn-primary measurement report "Turn-Übersicht" (#1197) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1200
- feat(ci): Turn-Ökonomie im Prompt-Audit bewerten und fördern (#1198) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1199
- feat(ci): add pi as switchable agent runtime (pilot: triage) (#1184) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1192
- feat(frontend): disable animations switch under os reduced motion by @deleonio in https://github.com/deleonio/priority-pilot/pull/1201
- feat(frontend): changelog tab next to manual on help page (#1190) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1203
- feat(frontend): aggregate changelog by category with autolinks by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1207
- chore(deps): update github actions to v7 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1204
- fix(e2e): AK3 in issue-1186 per echter Tab-Navigation prüfen by @deleonio in https://github.com/deleonio/priority-pilot/pull/1208
- feat(server): add group invitations and membership management by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1215
- chore(deps): update pi (cli + erweiterungen) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1217
- feat(frontend): add heart-shaped life-balance widget to the dashboard by @deleonio in https://github.com/deleonio/priority-pilot/pull/1216
- feat(server): create tasks for group members (#1213) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1218
- feat(frontend): virtual balance prioritization for the task list (#1220) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1228
- Move animation sub-options into a KolDialog by @deleonio in https://github.com/deleonio/priority-pilot/pull/1234
- feat(frontend,server): session-expired dialog with silent re-login by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1232
- feat(frontend,server): editable display name in settings (#1219) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1233
- feat(frontend): use KolDetails for animation sub-options by @deleonio in https://github.com/deleonio/priority-pilot/pull/1235
- feat(server,frontend): change group member role (#1221) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1236
- feat(server): notify recipient when a task is created for them (#1224) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1240
- feat(frontend): list tasks created for fellow members (#1223) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1239
- fix(server): sync google display name into users on oauth login (#1238) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1241
- feat(server): create task series for a group member (#1222) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1242
- feat(frontend): apply master-detail settings pattern with KolDetails by @deleonio in https://github.com/deleonio/priority-pilot/pull/1243
- feat(frontend): separate balance switch from recompute button (#1220) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1244
- feat(server): join a group via invite link (#1226) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1246
- docs(guide): sync user guide with current app state (2026-09-06) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1248
- feat(groups): add group image via https url (#1225) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1245
- fix(server): creator read access ends with group membership (#1250) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1261
- fix(server): check pillar contributions against owning account (#1249) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1255
- feat(server): clean up invitations and rest cross-member series on group exit (#1251) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1263
- fix(server): return session user id in /auth/me response (#1262) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1264
- feat(server): transfer task or series to a group member on edit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1265
- feat(server): keep self-set display name across OAuth logins (#1256) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1266
- feat(server): notify owners of foreign-created series instances (#1253) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1267
- feat(frontend): list series created for other group members (#1254) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1268
- fix(ci): provider-aware subagent model resolution in setup-claude by @deleonio in https://github.com/deleonio/priority-pilot/pull/1270
- feat(ci): delegation metrics, review fan-out, kolibri-recherche role by @deleonio in https://github.com/deleonio/priority-pilot/pull/1271
- feat(frontend): collapse group detail sections, debounce user search by @deleonio in https://github.com/deleonio/priority-pilot/pull/1269
- feat(mobile): responsive completed tasks table and mobile layout for … by @deleonio in https://github.com/deleonio/priority-pilot/pull/1272
- feat(frontend): responsive series tree layout for mobile (#1259) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1275
- feat(frontend): pillar palette on 7 cvd-validated neon colors (#1273) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1276
- feat(frontend): collapse optional task form sections into accordions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1277
- feat(frontend): keep main tab bar on one line at 375px by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1278
- chore: implement prompt audit #1247 and shared llm concurrency group by @deleonio in https://github.com/deleonio/priority-pilot/pull/1279
- docs(review): canonical fixup findings table and adr 0011 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1286
- fix(frontend): align heart glass distribution bands with legend by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1287
- fix(ci): remove zai peak-time claude fallback, warn only by @deleonio in https://github.com/deleonio/priority-pilot/pull/1289
- feat(frontend): task form sections as uniform accordions (#1285) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1288
- design(frontend): dashboard-card-layout-gaps-responsive by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1290
- feat(frontend): pillar weight ranges in a single card by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1291
- design(frontend): dashboard-hero-lebensbalance-2-3 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1292
- feat(frontend): even accordion padding and section rhythm in task form by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1294
- feat(ci): arc42-sync LLM-basiert nach Guide-/Spec-Sync-Muster by @deleonio in https://github.com/deleonio/priority-pilot/pull/1293
- refactor(frontend): remove balance prioritization (#1220) from task list by @deleonio in https://github.com/deleonio/priority-pilot/pull/1295
- chore(ci): concurrency group per phase instead of global llm queue by @deleonio in https://github.com/deleonio/priority-pilot/pull/1301
- fix(server): handle oauth callback errors and lowercase email search by @deleonio in https://github.com/deleonio/priority-pilot/pull/1299
- feat(frontend): raise title limit to 65, cap description at 3000 chars by @deleonio in https://github.com/deleonio/priority-pilot/pull/1298
- feat(frontend): unify series tab badges and restore list gap rhythm by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1297
- docs(arc42): sync architecture overview to code state (2026-09-08) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1296
- feat(frontend): size heart segments by filled area, not width by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1305
- feat(server): add admin/member role system with user management by @deleonio in https://github.com/deleonio/priority-pilot/pull/1300
- feat(frontend): split pillars settings tab into management and weighting by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1306
- refactor(admin): apply review nits from PR #1300 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1307
- docs: document google login allowlist and first-login account creation by @deleonio in https://github.com/deleonio/priority-pilot/pull/1308
- feat(frontend): compact header bar and pillar metrics as value pairs by @deleonio in https://github.com/deleonio/priority-pilot/pull/1303
- feat(frontend): restore balance prioritization switch with live sorting by @deleonio in https://github.com/deleonio/priority-pilot/pull/1311
- feat(frontend): extract series, address, checklist from free text by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1312
- fix(ci): repair documenter artifact upload, /tmp write access, note gate by @deleonio in https://github.com/deleonio/priority-pilot/pull/1313
- fix(templates): remove duplicate field ids in ticket.yml by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1317
- feat(frontend): paginate forest tab by connected task tree (#1314) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1316
- feat(frontend): even out avatar spacing in the header bar by @deleonio in https://github.com/deleonio/priority-pilot/pull/1318
- chore(frontend): update kolibri to v4.4.0 and raise pwa cache limit by @deleonio in https://github.com/deleonio/priority-pilot/pull/1319
- chore: cost reports with cohorts, median, index and interventions by @deleonio in https://github.com/deleonio/priority-pilot/pull/1322
- feat(frontend): unify settings tabs with cards and accordions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1324
- fix(deps): pin dependency remark-gfm to 4.0.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1209
- feat(frontend): render settings and help as pages in the app shell by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1323
- feat(frontend): add categories as a thematic grouping layer by @deleonio in https://github.com/deleonio/priority-pilot/pull/1325
- feat(frontend): show task/series id in edit title and confirm dialogs by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1350
- feat(frontend): category badge below select, removable, sorted list by @deleonio in https://github.com/deleonio/priority-pilot/pull/1347
- feat(frontend): add i18next with language selection for ten locales by @deleonio in https://github.com/deleonio/priority-pilot/pull/1348
- feat(frontend): add focus ring for kol-tabs shadow-dom buttons by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1351
- feat(server): add personal api tokens with bearer auth by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1354
- feat(server): add mcp tools v1 for member role by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1355
- feat(server): add read/write scope toggle for api tokens by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1358
- fix(ci): review waits for all checks, e2e in 8 shards with path filter by @deleonio in https://github.com/deleonio/priority-pilot/pull/1364
- fix(mcp): restore connection for read-only api tokens by @deleonio in https://github.com/deleonio/priority-pilot/pull/1369
- feat(frontend): show streak of consecutive done-days on dashboard by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1365
- feat(frontend): merge quick capture and pillar advisor into one dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1366
- feat(frontend): add home icon to logo button for dashboard switch by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1371
- feat(frontend): add location favorites to address field and settings by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1367
- feat(server): add mcp tools for task dependency links by @deleonio in https://github.com/deleonio/priority-pilot/pull/1373
- feat(frontend): add day-done completion hint by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1375
- feat(server,frontend): require expiry date for api tokens by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1376
- feat(ci): generate CHANGELOG.md from GitHub releases (#1372) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1380
- fix(mcp): link tasks by id only and surface route error messages by @deleonio in https://github.com/deleonio/priority-pilot/pull/1378
- feat(frontend): move home switch into the header toolbar by @deleonio in https://github.com/deleonio/priority-pilot/pull/1383
- feat(mcp): accept pillars array in task_create/task_update by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1385
- ci: add daily minor version bump workflow by @deleonio in https://github.com/deleonio/priority-pilot/pull/1377
- feat(server): add group_list and group_members_list MCP tools by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1384
- feat(frontend): lay out forest dependency graph user-first on mobile by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1386
- feat(frontend): add milestone badges for streak and points by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1387
- feat(server): notify on milestone when completing a task by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1389
- fix(frontend): unify card and tab gaps on dashboard, settings and help by @deleonio in https://github.com/deleonio/priority-pilot/pull/1390
- chore(deps): update dependency undici@6 to v8.10.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1326
- fix(changelog): consolidate CHANGELOG.md blocks by minor version by @deleonio in https://github.com/deleonio/priority-pilot/pull/1393
- feat(frontend): notify task creator via push and toast when assigned task is completed by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1395
- feat(server): add task_delete mcp tool (#1396) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1400
- feat(frontend): reactivate dark mode by @deleonio in https://github.com/deleonio/priority-pilot/pull/1394
- fix(ci): daily-version Tages-Check nur bei (daily)-Tag greifen lassen by @deleonio in https://github.com/deleonio/priority-pilot/pull/1401

