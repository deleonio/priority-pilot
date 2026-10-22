# Changelog

_Diese Datei wird automatisch aus den GitHub-Releases generiert — nicht von Hand bearbeiten. Ein Abschnitt fasst alle Releases derselben Minor-Version zusammen; neue Einträge entstehen über die `release:*`-Labels des PR-Documenters, s. CONTRIBUTING.md._

## v0.33 - 2026-10-22

_Enthält v0.33.0 – v0.33.10._

### 🎉 New Features

- feat(frontend): edit billing address without checkout flow by @deleonio in https://github.com/deleonio/priority-pilot/pull/2866
- feat(server): subscription and invoice service pushes (#2852) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2865

### 🐞 Bug Fixes

- feat(billing): recipient from billing address, account email, logo fix by @deleonio in https://github.com/deleonio/priority-pilot/pull/2862
- fix(billing): remove vat id line from invoice pdf by @deleonio in https://github.com/deleonio/priority-pilot/pull/2864
- fix(frontend): flex-wrap dashboard cards to remove empty cells by @deleonio in https://github.com/deleonio/priority-pilot/pull/2867

### 🔧 Engineering

- docs(skill): compact ticket-coordination with binding status block by @deleonio in https://github.com/deleonio/priority-pilot/pull/2863
- chore(deps): update dependency vite to v8.3.5 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2838

### Other Changes

- feat(server): existing push notifications open their topic (#2851) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2861
- feat(server): daily push budget and Dein Tag digest (#2853) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2860
- feat(push): per-topic push group switches (#2850) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2868
- feat(server): html email template for all user mails by @deleonio in https://github.com/deleonio/priority-pilot/pull/2870
- feat(server): group pushes for invitations, joins and challenges by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2872

## v0.32 - 2026-10-22

_Enthält v0.32.0 – v0.32.13._

### 🎉 New Features

- feat(frontend): land push targets on the right card anchor (#2848) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2859

### 🚀 Improvements

- feat(server): invoice pdf in the modevel.de template look by @deleonio in https://github.com/deleonio/priority-pilot/pull/2839
- feat(server): hourly scheduler delivers reminders in local windows by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2858

### 🔧 Engineering

- chore(deps): update playwright (npm + docker image) to v1.64.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2819
- chore(deps): update pi-erweiterungen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2821
- docs(adr): mariadb as production database (#2823) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2842

### Other Changes

- chore(deps): update pi-erweiterungen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2818
- fix(server): bind app tokens to mcp plan gates (#2816) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2820
- fix(ci): port hard deadline watchdog (#2097) to triage phase by @deleonio in https://github.com/deleonio/priority-pilot/pull/2840
- feat(billing): PayPal-Sandbox-Hinweis mit Testkonto im CheckoutDialog by @deleonio in https://github.com/deleonio/priority-pilot/pull/2843
- docs(push): goals, time windows, budget and new occasions (#2844) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2845
- docs: push concept with message targets, budget and switches (#2844) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2846

## v0.31 - 2026-10-21

_Enthält v0.31.0 – v0.31.21._

### 🎉 New Features

- feat(frontend): add withdrawal link, cancel page title in terms (#2776) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2792

### 🐞 Bug Fixes

- fix(ui): launch banner flush with tracking hint and cards by @deleonio in https://github.com/deleonio/priority-pilot/pull/2807
- feat(server): exempt admin role from mcp_read token gate (#2810) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2812

### 🚀 Improvements

- feat(frontend): switch-dependent accordions for ki tab lower sections by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2815

### 🔧 Engineering

- test(frontend): mirror parseColor and webgl2 context positively (#2777) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2793
- test(frontend): cover en privacy link on login page (#2796) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2800
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2801
- chore(deps): update node.js to v26.12.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2817

### Other Changes

- feat(frontend): consolidate legalLanguage and formatDate helpers (#2775) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2791
- docs: clarify ADR 0001 script-test carve-out via addendum (#2778) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2794
- chore(deps): update dependency undici@6 to v8.12.3 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2763
- ci: add monthly hacker-team run and solid yardstick to code review team by @deleonio in https://github.com/deleonio/priority-pilot/pull/2799
- fix(frontend): branch journalDate by format, not string length (#2797) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2803
- ci: select runner for manual dispatch runs (default, pi5, ubuntu-latest) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2805
- feat(server): waitlist double opt-in with mail confirmation and bot protection by @deleonio in https://github.com/deleonio/priority-pilot/pull/2804
- refactor(server): clean up three request-validation nits (#2798) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2808
- fix(website): name MLBF enforcement body in accessibility statement by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2802
- feat(frontend): unify dashboard card spacing rhythm by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2814
- chore: hacker team gains two attacker perspectives and chain method by @deleonio in https://github.com/deleonio/priority-pilot/pull/2811
- chore(deps): update github actions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2813

## v0.30 - 2026-10-20

_Enthält v0.30.0 – v0.30.28._

### 🎉 New Features

- feat(server): monthly cancellation for quarterly/yearly abos (#2745) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2750
- feat(frontend): price and renewal notice in checkout dialog (#2766) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2780

### 🐞 Bug Fixes

- build(frontend): fullscreen and dark manifest colors on android by @deleonio in https://github.com/deleonio/priority-pilot/pull/2749
- fix(ui): keep banner button labels unwrapped, fit invitation banner to content by @deleonio in https://github.com/deleonio/priority-pilot/pull/2760
- feat(server): allow removing a task deadline via mcp task_update null by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2762
- fix(server): series instances inherit series creator (#2757) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2779
- feat(server): propagate embedded provider errors at HTTP 200 (#2774) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2790

### 🚀 Improvements

- feat(frontend): add checklist entries via Enter key (#2771) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2785
- feat(frontend): add waitlist privacy section and login privacy hint by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2789

### 🔧 Engineering

- refactor(server): consolidate von/bis guard into requestvalidation by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2752

### Other Changes

- chore: rework terms of use on liability, renewal, withdrawal and account by @deleonio in https://github.com/deleonio/priority-pilot/pull/2748
- docs(website): add storage-on-your-device section to privacy policy by @deleonio in https://github.com/deleonio/priority-pilot/pull/2746
- docs(mcp): add guide for setting up the admin MCP endpoint by @deleonio in https://github.com/deleonio/priority-pilot/pull/2747
- ci: shorten rechts-team label description to 100 characters by @deleonio in https://github.com/deleonio/priority-pilot/pull/2759
- fix(deps): update kolibri (@public-ui) to v4.5.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2743
- feat(server): include creator name in write responses (#2755) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2764
- feat(frontend): clear done-task feedback after reopen (#2767) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2781
- feat(server): mark system-created tasks as "Balamentum" (#2758) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2782
- feat(website): accessibility statement per bfsg (#2769) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2783
- feat(frontend): balance status timeout and webgl context restore by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2784
- feat(server): centralize request validation, close array gaps (#2772) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2786
- feat(server): complete creator names for series and system tasks (#2787) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2788

## v0.29 - 2026-10-19

_Enthält v0.29.0 – v0.29.34._

### 🚀 Improvements

- docs(guide): sync user guide to current app state 2026-10-18 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2705
- feat(frontend): brand elements on all shareable cards by @deleonio in https://github.com/deleonio/priority-pilot/pull/2707
- feat(server): log failed ai budget refunds instead of swallowing them by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2710
- feat(frontend): simplify category assignment to a plain single-select by @deleonio in https://github.com/deleonio/priority-pilot/pull/2721
- docs: add successor issue number to ADR 0025 (#2732) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2738
- feat(frontend): matomo channel, login funnel, geo push deep link by @deleonio in https://github.com/deleonio/priority-pilot/pull/2739
- feat(frontend): show balance dial instantly from cached device mirror by @deleonio in https://github.com/deleonio/priority-pilot/pull/2740

### 🔧 Engineering

- docs(spec): sync spec status to implementation state (2026-10-18) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2704
- refactor(server): centralize effort conversion in logics/effort.ts by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2708
- test(server): assert template apply counts as fixed literals (#2692) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2711
- test(frontend): make WeekView unit test timezone-independent (#2730) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2736
- fix(deps): update dependency react-i18next to v17.1.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2680

### Other Changes

- docs: add ADR 0025 on shared logic as duplicate with mirror tests by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2703
- feat(server): move score recap logic from routes into logics (#2689) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2706
- feat(frontend): add tenth dial Bahnen with comets on elliptical orbits by @deleonio in https://github.com/deleonio/priority-pilot/pull/2712
- feat(server): merge request validation of tasks and series (#2691) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2709
- feat(server): pin pillar share logic with mirror tests (ADR 0025) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2714
- feat(server): share email parsing and normalization once (#2693) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2713
- fix(push): reason-specific push failure message in the android app by @deleonio in https://github.com/deleonio/priority-pilot/pull/2719
- refactor(frontend): share webgl dial-figure stage in one module (#2696) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2718
- fix(frontend): onboarding actions without sticky or own background by @deleonio in https://github.com/deleonio/priority-pilot/pull/2720
- refactor(frontend): merge balance card share logic into one hook (#2695) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2717
- feat(frontend): voice search no longer sets category filter (#2716) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2724
- feat(frontend): pause and resume series (#2715) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2722
- refactor(frontend): drop dead export isGeolocationSupported (#2697) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2726
- feat(frontend): complete the orbit family with meteors and pendulum by @deleonio in https://github.com/deleonio/priority-pilot/pull/2727
- docs(matomo): runbook for the self-hosted matomo instance by @deleonio in https://github.com/deleonio/priority-pilot/pull/2728
- docs: narrow e2e run commands in testing.md to pnpm filter calls (#2698) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2729
- docs(matomo): document working config:set syntax for trusted_hosts by @deleonio in https://github.com/deleonio/priority-pilot/pull/2733
- fix(ci): replace mapfile with while-read for macOS bash 3.2 (#2731) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2735
- feat(frontend): count matomo route changes (404, heartbeat, title, ids) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2737
- feat(frontend): move help and logout into avatar popover menu (#2723) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2725
- feat(frontend): show avatar menu as dropdown card with single toolbar by @deleonio in https://github.com/deleonio/priority-pilot/pull/2741
- fix(frontend): align tracking notice placement in app shell by @deleonio in https://github.com/deleonio/priority-pilot/pull/2742
- feat(mcp): separater, nur lesender Admin-MCP-Endpunkt /mcp/admin/v1 (#1338) by @deleonio in https://github.com/deleonio/priority-pilot/pull/2744

## v0.28 - 2026-10-18

_Enthält v0.28.0 – v0.28.15._

### 🐞 Bug Fixes

- fix(server): strip query strings from error logs so tokens stay out by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2674
- fix(frontend): release dial intro, hide display until real value by @deleonio in https://github.com/deleonio/priority-pilot/pull/2679
- fix(frontend): persist launch banner dismissal across sessions by @deleonio in https://github.com/deleonio/priority-pilot/pull/2677
- feat(server): reject unresolvable hosts in endpoint guard (#2685) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2700

### 🚀 Improvements

- feat(server): log errors when loading free time slots (#2686) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2701

### Other Changes

- fix(frontend): keep task list popover button right-aligned on mobile by @deleonio in https://github.com/deleonio/priority-pilot/pull/2669
- fix(frontend): start balance dial rise only with the real server value by @deleonio in https://github.com/deleonio/priority-pilot/pull/2676
- docs(arc42): sync architecture doc to current state 2026-10-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2678
- feat(frontend): checkout dialog with address and withdrawal consent by @deleonio in https://github.com/deleonio/priority-pilot/pull/2673
- fix(deps): update dependency i18next to v26.4.7 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2648
- ci(cron): prompt audit weekly on friday evening instead of daily by @deleonio in https://github.com/deleonio/priority-pilot/pull/2681
- fix(android): embed native debug symbols in the release aab by @deleonio in https://github.com/deleonio/priority-pilot/pull/2682
- fix(llm): add top_p 1 for greedy sampling and surface embedded 200 errors by @deleonio in https://github.com/deleonio/priority-pilot/pull/2683
- fix(server): raise llm test timeout to 30s and surface body-read timeouts by @deleonio in https://github.com/deleonio/priority-pilot/pull/2699
- feat(server): log swallowed db errors in provider resolution (#2687) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2702

## v0.27 - 2026-10-17

_Enthält v0.27.0 – v0.27.11._

### 🐞 Bug Fixes

- fix(frontend): keep task list popover button right-aligned by @deleonio in https://github.com/deleonio/priority-pilot/pull/2663

### 🚀 Improvements

- docs(skill): disambiguate ticket-coordination progress counting (#2644) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2657

### 🔧 Engineering

- docs: fix broken ADR 0024 link to ux-design.md (#2622) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2668
- feat(server): derive e2e overload seed threshold from constant (#2623) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2666

### Other Changes

- docs: unify formatting and cross-references (#2642) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2654
- ci(workbench): add kill grace period to chromium install timeout (#2643) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2655
- docs: fix dead links in ADR 0004 (#2638) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2656
- docs: align outdated code comments with current behavior (#2640) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2660
- test(frontend): show blossom instead of heart in promo shots (#2641) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2658
- refactor(frontend): consolidate badge colors in one source (#2637) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2653
- test: strengthen assertions and silence expected errors (#2639) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2659
- chore: remove grandfather rule for legacy accounts (#2646) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2662
- feat(billing): require billing address before subscription checkout by @deleonio in https://github.com/deleonio/priority-pilot/pull/2664
- feat(frontend): reserve dashboard card heights to avoid layout shift by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2667
- refactor(server): resolve app language via shared helper by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2665

## v0.26 - 2026-10-15

_Enthält v0.26.0 – v0.26.21._

### 🎉 New Features

- feat(frontend): show 28-day balance history card on dashboard by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2621

### 🐞 Bug Fixes

- ci: align token report legend with code (#2562) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2614
- feat(frontend): refresh streak instantly after task completion (#2632) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2649

### 🚀 Improvements

- refactor(frontend): use BADGE_COLOR in milestone badges by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2619
- feat(frontend): judge balance only from minimum completions (#2645) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2651

### 🔧 Engineering

- test(e2e): set expired subscription fixtures to a future date by @deleonio in https://github.com/deleonio/priority-pilot/pull/2607
- docs: align pnpm runtime version with packageManager pin (V-20) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2613
- feat(frontend): standardize mobile e2e viewport to 375x812 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2616
- test(server): add schema snapshot test for column migrations (#2609) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2615
- docs(tdd-strategy): fix stale workflow links and phase number (V-21) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2626

### Other Changes

- feat(server): remove dead module and history comments (#2557) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2605
- feat(server): dedupe push notifications via shared helper (#2551) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2598
- test(frontend): e2e paypal deferred alert + non-empty guards (#2558) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2610
- docs: align arc42 IF-07 and ADR 0017 with current state (#2561) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2611
- feat(server): validate reverse-geocode coordinates via parseCoordinate by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2612
- refactor(frontend): use badge color constant, debounce observer (#2560) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2617
- Server: Fehlgeschlagene PayPal-Kündigung im Kulanzfrist-Sweep wird später erneut versucht (#2606) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2620
- fix(deps): update dependency i18next to v26.4.5 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2602
- chore(deps): update pi-erweiterungen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2627
- feat(server): expose balance window count and minimum threshold (#2633) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2647
- feat(frontend): clarify overdue task completion dialog (#2635) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2650
- fix(frontend): stable position label for series checklist (#2636) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2652

## v0.25 - 2026-10-15

_Enthält v0.25.0 – v0.25.19._

### 🐞 Bug Fixes

- fix(server): block geocode rate limit header bypass by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2587
- feat(server): cancel pending PayPal checkouts before delete (#2547) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2592
- fix(server): return 400 for invalid path ids instead of 500 (#2548) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2595
- feat(server): abort paypal requests after a fixed timeout (#2546) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2594
- feat(server): per-job error labels in interval scheduler (#2550) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2596

### 🚀 Improvements

- feat(server): unified error contract and global error handler (#2549) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2597

### 🔧 Engineering

- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2567

### Other Changes

- docs(arc42): add ADR 0024 to decision table (V-19) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2582
- docs(skills): german-only chat and full-queue status for coordinator by @deleonio in https://github.com/deleonio/priority-pilot/pull/2583
- [P0/S] Server: CSRF-Schutz greift, sobald die Anmeldung aktiv ist (#2540) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2584
- fix(server): user search with literal wildcards and result limit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2585
- fix(server): book llm provider test against ai quota and throttle it (#2542) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2586
- fix(server): log invoice delivery errors after commit, don't throw by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2588
- feat(server): count task effort once per subtree, ending cycles and N+1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2589
- feat(server): handle missing paypal credentials explicitly (#2545) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2591
- ci(triage): read container result from both sources (#2590) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2593
- refactor(server): unify first-cycle credit coverage rule (#2556) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2599
- refactor(server): column migrations via shared helper (#2552) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2600
- fix(server): consolidate coordinate parsing into one validated helper by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2601
- fix(server): replace type assertions with runtime checks (#2554) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2603
- test(ci): cover ticket-quality gate decision logic with tests (#2555) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2604

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

_Enthält v0.11.14 – v0.11.31._

### 🎉 New Features

- feat(frontend): publish terms of use and link them in app help (#1891) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1918
- feat(server): credit remaining paypal term on upgrade invoice by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1917
- feat(server): remove user feedback from vault on account deletion by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1928

### 🐞 Bug Fixes

- test(e2e): fix flaky confetti AK3 overlay count (#1924) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1950
- fix(e2e): bypass Node 26 V8 crash in Playwright Vite webServer by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1951

### 🚀 Improvements

- chore: rewrite website privacy policy per processing (#1892) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1916
- feat(frontend): show amount due before confirming plan change by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1925
- feat(frontend): merge access token tab into ai settings tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1921
- feat(frontend): order settings tabs by plan tier by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1930
- feat(frontend): show invoices to former subscribers by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1948
- feat(server): anchor feedback as plan-independent feature (#1927) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1946

### Other Changes

- feat(frontend): show monthly equivalent of yearly price by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1914
- docs(skills): ticket-coordination resolves merge conflicts via subagent by @deleonio in https://github.com/deleonio/priority-pilot/pull/1920
- feat(frontend): merge plans and subscription into one settings tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1919
- feat(frontend): require terms and privacy consent after login by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1929
- feat(server): push nearby tasks only on entry, once per 24 h (#1926) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1945
- fix(ci): skip soft-abort labels on account limit (#1943) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1949
- refactor(frontend): remove unreachable ai badge and custom provider gate by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1947

