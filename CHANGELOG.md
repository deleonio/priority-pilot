# Changelog

_Diese Datei wird automatisch aus den GitHub-Releases generiert — nicht von Hand bearbeiten. Ein Abschnitt fasst alle Releases derselben Minor-Version zusammen; neue Einträge entstehen über die `release:*`-Labels des PR-Documenters, s. CONTRIBUTING.md._

## v0.16 - 2026-10-05

_Enthält v0.16.0 – v0.16.2._

### 🎉 New Features

- feat(server): import templates as task packages (#1993) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/2197

### Other Changes

- feat(frontend): dashboard and settings ux rework, oauth pillar seeding by @deleonio in https://github.com/deleonio/priority-pilot/pull/2192
- chore: key pipeline concurrency per ticket with issue and pr lanes by @deleonio in https://github.com/deleonio/priority-pilot/pull/2199

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

_Enthält v0.1.336 – v0.1.836._

### 💥 Breaking Changes

- fix(ci): ensure release:* labels exist before Phase 5 sets them by @deleonio in https://github.com/deleonio/priority-pilot/pull/543
- ci!: pro-Issue Claude-Memory-Persistenz + ADR 0001 (.github-Tests entfernt) by @deleonio in https://github.com/deleonio/priority-pilot/pull/593

### 🎉 New Features

- feat(ci): aST-Neufassung des Suite-Analyzers + Dedup + Contract-Tests by @deleonio in https://github.com/deleonio/priority-pilot/pull/505
- feat: automatisches Löschen bei verpasster Deadline — rote Spec-Tests by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/524
- feat(series): Bearbeiten & Löschen mit Kaskade auf Instanzen (#553) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/554
- feat(#566): Black-Box-Verhaltenstests für User Journeys by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/592
- feat(ci): Fortschrittsmetrik für CI-Läufe by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/615
- feat(issue-618): Health-Endpoint extern erreichbar machen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/622
- feat(issue-638): LLM Provider Interface - Rote Tests by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/642
- feat(issue-619): Startup-Error-Handling implementieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/623
- feat(issue-638): LLM-Kaskade Mistral → OpenRouter-Verfeinerung by @deleonio in https://github.com/deleonio/priority-pilot/pull/643
- feat(ci): enable LLM egress via tailscale exit node by @deleonio in https://github.com/deleonio/priority-pilot/pull/650
- feat(llm): OpenRouter-Endpoint über ENV konfigurierbar by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/651
- feat(llm): LLM provider configuration backend API and UI by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/652
- feat(issue-656): Nightly SQLite backup with cleanup by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/661
- feat(issue-657): rollen-konzept für agentic workflow by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/663
- feat(issue-660): Cloud/Local-Betrieb und Übergangspfad dokumentieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/665
- feat/issue-658: Label-Chain und Übergaberegeln definieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/666
- feat(issue-659): GitHub Actions Workflow Trigger skizzieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/667
- feat(lektorat): Lektorat-Button für Input/Textarea-Felder by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/682
- feat(issue-687): Lektorat mit Diff-Modal by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/688
- feat(dx): Browser-MCP für visuelle Prüfung der laufenden App by @deleonio in https://github.com/deleonio/priority-pilot/pull/698
- feat(679): kolInput zeichenzähler basierend auf KolInputText/KolTextarea by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/681
- feat(issue-704): Aufgabenbaum-Layout sauber darstellen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/706
- feat(llm): add LLM provider toggles for Mistral and OpenRouter by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/765
- feat(frontend): add groups tab with CRUD, roles and delete confirmation by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1214
- feat(frontend): show task dependencies as weighted graph instead of tree by @deleonio in https://github.com/deleonio/priority-pilot/pull/1309
- feat(frontend): toggle to show parent tasks in task list by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1388
- feat(header): make logo clickable and visually smaller by @deleonio in https://github.com/deleonio/priority-pilot/pull/1392

### 🐞 Bug Fixes

- fix: implement-Label auch bei cancelled Claude-Schritt setzen by @deleonio in https://github.com/deleonio/priority-pilot/pull/503
- fix: fix/workflow details by @deleonio in https://github.com/deleonio/priority-pilot/pull/506
- fix: rote Spec-Tests für #504 (Push: nur EINE Benachrichtigung) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/509
- fix: rote Spec-Tests für #511 (pro-Phase Claude-Modell) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/514
- fix(server/src/index.ts): rote Spec-Tests für #518 (tägliche Top-3-Push um 6 Uhr) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/520
- fix: rote Spec-Tests für #519 (Documenter exit code 1) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/521
- fix: rote Spec-Tests für #513 (Phase 6 PR-Documenter) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/516
- fix(frontend/src/app.css): rote Spec-Tests für #510 (Aufgabenliste mobilfähig – einheitliche... by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/512
- fix(ci): rote Spec-Tests für #515 (Pro-Ticket Token-/Kostenerfassung) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/517
- fix(ci): stoppe Review↔Fixup-Label-Endlosloop (No-Progress-Re-Arm) by @deleonio in https://github.com/deleonio/priority-pilot/pull/525
- fix: needs-human-Verdict für nicht-automatisierbare Findings by @deleonio in https://github.com/deleonio/priority-pilot/pull/527
- fix(ci): härtet Review-ARTIFACTS_OK-Marker-Check (Retry + Verdict-Fallback) by @deleonio in https://github.com/deleonio/priority-pilot/pull/528
- fix: rote Spec für #530 — Review-Marker Create-or-Update by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/532
- fix: rote Spec-Tests für #531 (Checklisten-Feld in Tasks) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/533
- fix(components): rote Spec-Tests für 534 (Auto-Löschen an Deadline koppeln + für Serien) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/535
- fix: rote Spec-Tests für #536 (ai:needs-review vor Neu-Setzen entfernen) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/539
- fix: rote Spec-Tests für #538 (ai:spec-ready nur bei 🟢) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/540
- fix(ci): optimize PR Post-Merge Documenter workflow by @deleonio in https://github.com/deleonio/priority-pilot/pull/542
- fix: spec-Tests – ai:needs-human blockiert Workflows by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/545
- fix(series): erledigte Instanzen bei Serien-Kaskade schonen (#555) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/556
- fix(workflows): portables VERDICT-Parsing (grep -oP → sed, BSD-/GNU-grep) by @deleonio in https://github.com/deleonio/priority-pilot/pull/571
- fix(ci): Ticket-Pipeline — Fixup-Deadlock, Guard-Fragilität, Doku-Drift by @deleonio in https://github.com/deleonio/priority-pilot/pull/574
- fix(ci): verdikt-parser streift markdown-dekoration (**…**) by @deleonio in https://github.com/deleonio/priority-pilot/pull/584
- fix(ci): PR-Detektion mit Body-Fallback härten (Issue #585) by @deleonio in https://github.com/deleonio/priority-pilot/pull/586
- fix(tasks/series): titel-länge auf 30 zeichen begrenzt by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/585
- fix(ci): Spec-Crash + Triage-Ticket-Memory + Permission-Test reparieren by @deleonio in https://github.com/deleonio/priority-pilot/pull/588
- fix(ci): Memory-Save via vertrauenswürdigen workflow_run-Trigger by @deleonio in https://github.com/deleonio/priority-pilot/pull/599
- fix(ci): Shell-Discipline-Querschnitt härten (#595) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/601
- fix(ci): Triage-Ziel-Anker + Marker-Pflicht für Sub-Issues by @deleonio in https://github.com/deleonio/priority-pilot/pull/605
- fix(ci): label-race-conditions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/614
- fix(issue-620): Frontend-Error-Handling für LLM-Calls bei Mistral-Ausfall/Timeout by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/624
- fix(ci): issue-memory reparieren (checkpoints + restore-verifikation) by @deleonio in https://github.com/deleonio/priority-pilot/pull/626
- fix(ci): expliziter permissions-Block für claude-memory-save (Warnung aufheben) by @deleonio in https://github.com/deleonio/priority-pilot/pull/627
- fix(push): observable outcomes in push tests ergänzt by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/634
- fix(issue-630): Test-Cleanup - leeres Duplikat entfernt by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/644
- fix(e2e): Tab-Freiheits-Checks für Fokus-Verträge (#629) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/635
- fix(issue-668): Tab-Heuristik auf Datei-Ebene erweitern by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/677
- fix(issue-669): Redundanz-Signatur um describe-Kette erweitern by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/673
- feat/issue-671-behavior-assertion-detection by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/674
- fix(672): parseNameArg Robustheit bei Template-Literalen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/676
- fix(ci): Fair-Usage-Check schlug im Normalfall fehl (invertierte Logik) by @deleonio in https://github.com/deleonio/priority-pilot/pull/683
- fix(e2e): Tab-Freiheit in Löschdialogen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/685
- fix(ci): claude-memory persistiert wieder — Artefakte statt schreib-toter Cache by @deleonio in https://github.com/deleonio/priority-pilot/pull/690
- fix(issue-697): Auth Field-Mismatch — AuthUser.name vs displayName by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/699
- fix(frontend): shorten Aufgabenwald tab label to Wald by @deleonio in https://github.com/deleonio/priority-pilot/pull/725
- fix(787): make header single-line and model-selector a11y-compliant by @deleonio in https://github.com/deleonio/priority-pilot/pull/847
- fix(setup-claude): use npm root -g for postinstall + cache v4 by @deleonio in https://github.com/deleonio/priority-pilot/pull/923
- fix(e2e): fix AK2 contrast test for kol-badge and kol-heading (#930) by @deleonio in https://github.com/deleonio/priority-pilot/pull/942
- fix(settings): make 'Push testen' button inline (Closes #932) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/947
- fix(pillars): give description textarea 4 rows in pillar form dialog by @deleonio in https://github.com/deleonio/priority-pilot/pull/982

### 🚀 Improvements

- perf(#546): Auto-Löschen auf KolInputCheckbox + KolAlert umgestellt by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/547
- perf(task-list): flache Blatt-Liste statt Aufgabenbaum (#537) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/541
- perf(ci): pro-Phase Modell-Defaults (Vars als Override) by @deleonio in https://github.com/deleonio/priority-pilot/pull/580
- perf(ci): Review — erstes Review als Kreuzverhör, Folge als Fixup-Nachweis by @deleonio in https://github.com/deleonio/priority-pilot/pull/578
- perf(env): reduce API timeout and streamline settings by @deleonio in https://github.com/deleonio/priority-pilot/pull/583
- perf(spec-prompt): Spec-First-Workflow in Spec-Routine verankern by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/594
- perf(ci): Phasen-Serialisierung + Label-Pre-Check by @deleonio in https://github.com/deleonio/priority-pilot/pull/678
- fix(ci): CodeQL auf Schedule-only + Cache-Cleanup um ticket-* erweitert by @deleonio in https://github.com/deleonio/priority-pilot/pull/684
- perf(frontend): App-Shell für Mobile optimieren (einzeiliger Header, Safe-Area) by @deleonio in https://github.com/deleonio/priority-pilot/pull/686
- perf(dashboard): Mobile-Layout optimiert — 3er-Kachelreihe, Vorschlags-Panel, Guthaben-Zeilen by @deleonio in https://github.com/deleonio/priority-pilot/pull/689
- perf/#692: Serien-Alert Layout-Verbesserung by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/693
- feat(ci): add ZAI→Claude fallback for 08:00-12:00 Europe/Berlin by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/896
- feat(frontend): Make "Push testen" button inline instead of full-width by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/946
- feat(frontend): display tab bars horizontally on all viewports by @deleonio in https://github.com/deleonio/priority-pilot/pull/978
- feat(server): replace geocode rate limiter with express-rate-limit by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1283

### 🔧 Engineering

- test(507): rote Spec-Tests für tautologische Push-Tests (TF4) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/508
- chore(components): focus-Trap-Specs für markierte Dialog-Lücken by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/526
- chore(documenter): als LLM-Phase 6 neu gebaut (Single-PR statt Batch) by @deleonio in https://github.com/deleonio/priority-pilot/pull/548
- test(#549): Roter Spec-Test für Testkonzept (docs/testing.md) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/550
- docs(ux): sequenzielle Bestätigung Pattern-Seite by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/558
- chore(spec): Doku-Tickets ausnehmen — keine String-Match-Tests by @deleonio in https://github.com/deleonio/priority-pilot/pull/559
- chore(ux): Sequenzielle-Bestaetigung-Pattern in Workflow-Phasen verankert (#557) by @deleonio in https://github.com/deleonio/priority-pilot/pull/560
- test: entferne UX-Pattern-Change-Detector (sinnlos laut Testkonzept) by @deleonio in https://github.com/deleonio/priority-pilot/pull/562
- chore(quarantine): alte Testsuite in Quarantäne verschieben by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/573
- chore(ci): Triage erstellt+verknüpft Sub-Issues wieder by @deleonio in https://github.com/deleonio/priority-pilot/pull/575
- fix(ci): Spec berücksichtigt Test-Konzept (nur nützliche Tests, Docs-Carve-out) by @deleonio in https://github.com/deleonio/priority-pilot/pull/576
- docs(testkonzept): ADR 0001 — GitHub-Workflows bleiben ungetestet (#567) by @deleonio in https://github.com/deleonio/priority-pilot/pull/577
- refactor(ci): Spec-Prompt nach .github/prompts/spec.md ausgelagert (Prototyp) by @deleonio in https://github.com/deleonio/priority-pilot/pull/579
- docs(spec): User Journeys für Kern-Workflows dokumentieren (#565) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/581
- fix(ci): ticket-Memory-Pipeline absichern (Sentinel, Write-Recht, Documenter-Teardown) by @deleonio in https://github.com/deleonio/priority-pilot/pull/587
- chore(settings): update Claude configuration by @deleonio in https://github.com/deleonio/priority-pilot/pull/590
- chore(docs): Spec-First documentation and tests for Issue 568 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/589
- chore(ci): cache-Sub-Actions auf v6.1.0 + stale Save-Kommentar by @deleonio in https://github.com/deleonio/priority-pilot/pull/600
- chore(test): nur Anwendungscode testen, Nicht-App-Tests & Templates entfernt by @deleonio in https://github.com/deleonio/priority-pilot/pull/603
- chore(docs): entferne verwaiste CI-Artefakt- und Plan-Notizen by @deleonio in https://github.com/deleonio/priority-pilot/pull/604
- chore: blende vendored data/templates via .gitignore aus by @deleonio in https://github.com/deleonio/priority-pilot/pull/606
- docs: entsorge erledigte Pläne, Spike und Migrations-Checkliste by @deleonio in https://github.com/deleonio/priority-pilot/pull/608
- docs: bereinige abgelöste Deployment-Doku by @deleonio in https://github.com/deleonio/priority-pilot/pull/609
- docs(ai-knowledge): konsolidiere Wissensbasis-Duplikate by @deleonio in https://github.com/deleonio/priority-pilot/pull/610
- chore: binde verwaiste wertvolle Seiten ein by @deleonio in https://github.com/deleonio/priority-pilot/pull/607
- chore(ci): 6 Pipeline-Phasen als 1/6–6/6 durchnummeriert by @deleonio in https://github.com/deleonio/priority-pilot/pull/616
- fix(issue-630): remove 14 redundant tests by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/636
- test(Issue 687): Dedup-Nachweis - alle AK bereits durch existierende Tests abgedeckt by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/695
- chore(ci): nächtlichen Spec-Sync-Workflow ergänzen by @deleonio in https://github.com/deleonio/priority-pilot/pull/700
- test(e2e): Serien-Cleanup und Doku für #692-Alert-Spec nachziehen by @deleonio in https://github.com/deleonio/priority-pilot/pull/707
- chore(spec-sync): arc42-Entfernungs-Mandat + Per-Datei-Draft-PRs in die Pipeline by @deleonio in https://github.com/deleonio/priority-pilot/pull/710
- chore(knip): Knip-Config Cleanup by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/709
- chore(skills): add knowledge-graph skill for repo doc graph by @deleonio in https://github.com/deleonio/priority-pilot/pull/867
- chore(ci): validate GitHub Actions schemas in CI and pre-commit by @deleonio in https://github.com/deleonio/priority-pilot/pull/897
- fix(ci): Menschen-Parker-Guard — ai:needs-human wird nie mehr kollateral entfernt by @deleonio in https://github.com/deleonio/priority-pilot/pull/908
- fix(frontend): restore all theme options as disabled ui by @deleonio in https://github.com/deleonio/priority-pilot/pull/906
- fix(frontend): restore header avatar and keep full name removed by @deleonio in https://github.com/deleonio/priority-pilot/pull/905
- fix(setup-claude): use model alias instead of native ID for zai/openrouter by @deleonio in https://github.com/deleonio/priority-pilot/pull/910
- fix(setup-claude): OpenRouter Model-Enforcement ausschalten by @deleonio in https://github.com/deleonio/priority-pilot/pull/920
- Fix/tailscale provider specific by @deleonio in https://github.com/deleonio/priority-pilot/pull/919
- Fix/openrouter model enforcement by @deleonio in https://github.com/deleonio/priority-pilot/pull/922
- fix(harness): stop parking PRs without analysis provenance by @deleonio in https://github.com/deleonio/priority-pilot/pull/916
- fix(harness): Phasen-Absturz sichtbar machen + Kontingent-Check auf 1310 by @deleonio in https://github.com/deleonio/priority-pilot/pull/921
- refactor(harness): merge fixup and implementation into single phase (step 4, ADR 0005) by @deleonio in https://github.com/deleonio/priority-pilot/pull/927
- docs(spec): sync specs to implementation state 2026-08-21 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/943
- docs(guide): sync user guide to implementation state 2026-08-21 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/944
- fix(docs): Prettier-Formatierung für Kosten-Reports korrigieren by @deleonio in https://github.com/deleonio/priority-pilot/pull/1045
- fix(frontend): Empfänger-Auswahl liefert beim Clear keine gültige ID mehr by @deleonio in https://github.com/deleonio/priority-pilot/pull/1237

### Other Changes

- Vorschlags-Engine: Balance-Korrektur & Überlastungsschutz (#122) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/137
- Auto-Merge bei grüner CI + ai:ready-to-merge (#139) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/143
- Spike: Agent-SDK-Prototyp fuer einen Workflow-Schritt (#114) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/140
- Serienaufgaben (Habits): rote Spec-Tests (#120) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/136
- Serienaufgaben: Backend-Vertikale — rote Spec-Tests (#141) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/144
- Serienaufgaben: Frontend (Serien-CRUD + Kennzeichnung von Instanzen) (#142) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/145
- Schema-Migration fuer Serien-Spalten (no such column: seriesId) (#146) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/147
- Modell-Router (Sonnet): Komplexitaet einschaetzen → Ausfuehrungsmodell waehlen (#149) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/151
- Modell-Router als echten CI-Baustein liefern (#153) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/154
- KI-Workflows auf den Modell-Router umstellen + Routing dokumentieren (#150) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/155
- Deployment vereinfachen: main → Build → rsync (rote Spec-Tests) (#152) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/156
- fix: Series-API CRUD-Abdeckung und Fehlerbehandlung (#158) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/159
- Triage: Issue autonom schliessen wenn Anforderungen erfuellt (#157) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/160
- fix: Series-Tabelle Migration für Bestands-DBs (#163) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/164
- fix: Format/Lint-Gate als CI-Spiegel verankern (#161) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/162
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/167
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/168
- feat: Personalisierte Dashboard-Begrüßung (#169) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/170
- feat: Lefthook + Knip als pre-commit-Hooks einrichten (#165) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/166
- feat: API-Proxy auf /api/v1-Präfix umstellen (#171) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/172
- fix: lefthook in CI-Workflows aktiv schalten (#173) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/174
- feat: Kreuzverhoer-Agent anlegen (#175) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/176
- feat: Kreuzverhoer-Agent Modell-Delegation & Doku (#177) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/178
- feat: ENV-Konfiguration beim Serverstart loggen (#180) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/181
- fix: Fokus nach Task-Löschen (Issue #182) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/183
- feat: Dashboard-Widget Gesamtguthaben (Gamification-Balance) (#184) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/185
- refactor(ci): merge gate+automerge into one workflow, drop release infra by @deleonio in https://github.com/deleonio/priority-pilot/pull/188
- feat: Google OAuth Single-User-Gate (#186) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/187
- feat: Logout-Button in Navigation (#191) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/195
- Deploy Workflow wiederherstellen (#196) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/198
- feat: Login Page/Maske – Google OAuth (#190) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/197
- feat: User Info Display – Aktuelle Benutzerinformationen anzeigen (#192) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/199
- feat: Multi-User OAuth Support – Mehrere erlaubte E-Mail-Adressen (#193) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/201
- feat(workflows): GLM (Z.ai) als dritten KI-Agenten hinzufügen (#200) by @deleonio in https://github.com/deleonio/priority-pilot/pull/202
- feat: Session Persistence – Migration zu Redis/SQLite (#194) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/203
- Demo-Alert "Hallo, Christian!" auf Startseite (#204) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/205
- feat: Logout-Button in Toolbar (rechts oben) (#209) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/211
- chore: optimize repo by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/210
- feat: Backend-Passwort-Authentifizierung (#206) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/212
- feat: Frontend-Auth — Login/Register-Seiten, Auth-Context, Route-Guard (#208) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/213
- feat: Nach Logout zur Login-Seite weiterleiten (#214) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/216
- feat: API-Schutz & Datenisolation — Endpunkte absichern + User-ID-Bindung (#207) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/215
- Avatar mit Google Profilbild (#217) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/218
- feat: Meter zeigt Ist-Anteil erledigter Tasks statt Zielgewichtung (#219) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/220
- Backend: CORS-Proxy für Transitous/MOTIS-API (#224) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/227
- Frontend: Öffentliche Route /bahn mit Routenplaner-UI (#225) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/226
- Gestalte den App-Header homogener (#222) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/223
- ci(gate): fehlende App-Permission (Actions: Read) rot melden statt stillem No-op by @deleonio in https://github.com/deleonio/priority-pilot/pull/230
- Standard-Theme auf Light Mode setzen (#231) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/232
- fix(auth): Google-Login auf Android/PWA reparieren — SW-Fallback und Auth-Pfad vereinheitlichen by @deleonio in https://github.com/deleonio/priority-pilot/pull/233
- feat: LLM-Parsing-Endpoint POST /tasks/parse-text (#235) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/237
- feat: Aufgaben-Übersicht von Table zu List (#238) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/240
- feat: Fortschrittsanzeige pro Task inkl. Unter-Tasks (#241) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/242
- feat: Schnellerfassungs-UI für Tasks (#236) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/239
- feat: Unteraufgaben-Done-Guard (#246) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/249
- feat: Strg+Enter-Shortcut fuer CTA-Buttons (243) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/248
- Autofokus Textarea beim Öffnen des QuickCapture-Modals (#250) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/252
- feat: Nutzerhandbuch docs/user-guide.md (#255) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/258
- feat: In-App-Hilfe-Seite mit Markdown-Renderer und Header-Button (#256) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/259
- fix: GraphQL addSubIssue als Pflichtschritt in Triage (#261) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/262
- feat: Audio-Transkription für Task-Erstellung via Web Speech API (#251) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/257
- Feature: UI-Button zum Generieren fälliger Serien-Instanzen (#244) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/263
- feat: Triage- und Re-Triage-Workflows fest auf Opus mit --effort max verdrahten by @deleonio in https://github.com/deleonio/priority-pilot/pull/265
- Re-Triage-Workflow bei Entfernen von ai:to-big-issue auslösen (#253) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/267
- feat: Audio-Transkription bei allen Textareas und Text-Inputs (#264) by @deleonio in https://github.com/deleonio/priority-pilot/pull/268
- Settings-Seite: KolTabs Allgemein + Säulen (#271) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/273
- Allgemein-Einstellung: Auto-Sprachaufnahme im ersten Eingabefeld (#272) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/276
- Merge-Konflikte mit main auflösen: Settings-Route (#270) mit Settings-Tabs (#271) und Voice-Autostart (#272) zusammenführen by @deleonio in https://github.com/deleonio/priority-pilot/pull/278
- Einstellungen: Popover durch Zahnrad-Toolbar-Button und Route /settings/pillars ersetzen (#270) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/274
- Workflow: Merge-Konflikte in PRs erkennen und per Coding-Agent auflösen (#277) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/280
- Tabelle für die abgearbeiteten Tasks (#228) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/279
- feat: Voice-Autostart im Schnellerfassungs-Textfeld (#281) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/282
- fix: Audio-Texterfassung — Aufnahme-Lebenslauf härten, kein stiller Transkript-Verlust (#283) by @deleonio in https://github.com/deleonio/priority-pilot/pull/284
- feat: Version nach Deployment automatisch inkrementieren (#286) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/288
- Header-Toolbar kompakter (Icon-Buttons) und Dark-Mode-Schalter in die Einstellungen (#285) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/289
- feat: App-Version in der Fußzeile anzeigen (#290) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/291
- „Aktualisieren"-Schalter aus Header-Toolbar entfernen (#298) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/299
- feat: InputNumber → InputRange für Priorität, Aufwand & Gewicht (#287) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/292
- A1 #294: Series-Felder umbenennen (defaultPriority/defaultEstimatedEffort → priority/estimatedEffort) (#300) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/303
- A2 #294: Series um description erweitern (#301) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/304
- feat: "Bearbeiten" und "Wieder öffnen" als Icon-Buttons in Toolbar (#307) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/308
- ci: shard e2e tests across 4 runners, skip CI on draft PRs by @deleonio in https://github.com/deleonio/priority-pilot/pull/310
- feat: Auto-Trigger Saeulen vorschlagen bei neuem Task (#305) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/309
- A3 #294: series_pillars-Vorlage + geteilte Pillar-Validierung (#302) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/306
- Sub-B #293: generateDueInstances überträgt description + Pillars (#295) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/311
- feat: Toolbar-Reihenfolge und Zahnrad-Icon für Einstellungen (#312) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/313
- Allow trusted App-bot to re-trigger triage on ai:analyzed removal by @deleonio in https://github.com/deleonio/priority-pilot/pull/314
- fix(#315): CI-e2e-Fehler in PR #317 behoben — Strict-Mode-Duplikate + toBeDisabled am Erledigt-Toggle by @deleonio in https://github.com/deleonio/priority-pilot/pull/318
- Sub-C1 #296: Status aus TaskForm entfernen + binärer Erledigt-Toggle in TaskTree (#315) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/317
- Sub-C2 #296: TaskForm Task/Serie-Umschalter + Serienfelder; Speichern verzweigt (#316) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/319
- feat: Säulen-Berater — Mistral-gestützter Aktivitäten-Ratgeber by @deleonio in https://github.com/deleonio/priority-pilot/pull/320
- Sub-D #293: Alten Serien-Erstell-/Bearbeiten-Pfad (SeriesFormModal) ablösen (#297) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/321
- fix: Settings-Tab bleibt nach Toggle-Interaktion stabil (#323) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/325
- feat: Spracheingabe im Säulen-Berater-Fragefeld + Voice-Autostart by @deleonio in https://github.com/deleonio/priority-pilot/pull/324
- fix: Mic-Button im Berater-Fragefeld sauber positionieren (#326) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/331
- Berater-Vorschlag in Quick Capture übernehmen (#327) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/329
- Task- und Serien-Anlegen vereinheitlichen: Schnellerfassung als gemeinsamer Einstieg (#330) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/332
- feat: Säulen-Aufmerksamkeits-Score + UI-Hinweis (#328) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/333
- fix: Unterversorgungs-Signal relativ normieren (#337) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/341
- Serien-Verwaltung als eigenen Tab statt Modal (#335) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/338
- fix: Säulenzuordnung bei Serien-Edit erhalten (#343) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/344
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/346
- fix(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/347
- feat: Berater nutzt Client-Säulenverteilung, priorisiert schwächste S… by @deleonio in https://github.com/deleonio/priority-pilot/pull/345
- chore(deps): update github actions (major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/350
- fix(deps): update dependency @anthropic-ai/claude-agent-sdk to v0.3.201 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/349
- chore(deps): lock file maintenance by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/351
- feat(pwa): Installer-Erlebnis (Manifest, beforeinstallprompt, UI) by @deleonio in https://github.com/deleonio/priority-pilot/pull/356
- chore(deps): lock file maintenance by @deleonio in https://github.com/deleonio/priority-pilot/pull/354
- chore(deps): update devdependencies (non-major) by @deleonio in https://github.com/deleonio/priority-pilot/pull/357
- feat: Switch statt Button-Paar + dynamische Dialogtitel (#334) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/342
- PWA: Update-Fluss (registerType: prompt, Update-Prompt) (#353) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/358
- fix(tasks): Erledigt-Guard & Aufgabenwald an reale „Unteraufgabe anlegen"-Richtung angleichen (#336) by @deleonio in https://github.com/deleonio/priority-pilot/pull/359
- feat: Aufgabenbaum-Darstellung invertieren (#363) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/364
- fix(icons): leere PNG-Platzhalter aus Git entfernen (manueller Todo PR #360) by @deleonio in https://github.com/deleonio/priority-pilot/pull/366
- feat(push): Web-Push-Opt-in-Infrastruktur (Backend + Frontend) für #355 by @deleonio in https://github.com/deleonio/priority-pilot/pull/365
- Merge-Konflikte von #362 gelöst (Popover-Aktionen + invertierter Baum) by @deleonio in https://github.com/deleonio/priority-pilot/pull/367
- Sekundäre Aktionen der Aufgabenliste ins Popover verschieben (#361) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/362
- feat: Neues App-Icon mit Säulen-Balance + Kompass/Pilot Design by @deleonio in https://github.com/deleonio/priority-pilot/pull/360
- feat(push): fachlichen Trigger für fällige Aufgaben umsetzen (#355) by @deleonio in https://github.com/deleonio/priority-pilot/pull/372
- feat: Entfernen-Icon-Button im Abhängigkeits-Editor (#368) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/371
- feat: Update-/Offline-Hinweise als KoliBri-Card am unteren Bildschirmrand fixieren (#373) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/375
- fix(popover): Popover-Panel viewport-sicher linksbündig ausrichten (#369) by @deleonio in https://github.com/deleonio/priority-pilot/pull/374
- refactor(mobile): Review-Findings zu #377 beheben — Toggle-Breite & Viewport-Maß entkoppeln by @deleonio in https://github.com/deleonio/priority-pilot/pull/378
- fix(mobile): Aufgabenliste bei 360px responsiv stabilisieren (#376) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/377
- fix: Allgemein-Tab als Default beim Öffnen der Einstellungen (#382) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/383
- Auto-Audio-Record ohne Spracheingabe zeigt keine Fehlermeldung (#379) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/384
- test: Popover öffnet links vom Trigger — rote Spec-Tests (#380) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/385
- feat: Push-Test-Button mit zufaelligen Zitaten (#386) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/389
- Mobile: Erledigt-Toggle in die Toolbar (#387) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/388
- feat: Kachel In Bearbeitung aus Dashboard entfernen (390) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/391
- Klickbare Bild-Marke im Header (#395) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/397
- feat: System-Notification bei SW-Update (#394) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/398
- Aufgabenliste: abgehakte Aufgaben nach 5 s automatisch ausblenden (#392) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/393
- App-Icons mit transparentem Hintergrund (#400) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/401
- Wort-Bildmarke im Header ohne Vanille-Hintergrund (#402) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/404
- feat(ci): z.ai-Backend pro Issue-Label umschaltbar (ai:use-zai) (#403) by @deleonio in https://github.com/deleonio/priority-pilot/pull/405
- Wort-Bild-Marke vergrößern + App-Namen-H1 entfernen (#406) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/407
- feat: skip superseded runs and add outcome annotations to workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/409
- feat: Aufgaben und erledigte Aufgaben zusammenführen (#399) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/408
- Spec: Saeulen-Meter optimieren (#410) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/411
- fix(ci): 0-Commit-Loop-Bremse + Marker-Reset härten (Split aus #414) by @deleonio in https://github.com/deleonio/priority-pilot/pull/416
- Spec: #413 - Erledigt-Schalter nur bei Leaf Tasks aktiv by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/414
- fix(ci): Session-Archiv von Actions-Cache auf Workflow-Artefakte umstellen by @deleonio in https://github.com/deleonio/priority-pilot/pull/418
- Git-Hook: gestagte Dateien automatisch formatieren (#417) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/419
- feat: Säulen pro Nutzer – Datenmodell & Migration (Teil 1, #421) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/426
- Säulen pro Nutzer — Datenmodell & Migration (#427) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/432
- Backend-API — Säulen-CRUD + Nutzer-Scoping (#428) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/433
- Backend-API: Säulen-CRUD + Nutzer-Scoping (Teil 2, Epic #420) (#422) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/434
- Spec: Dynamischer Säulen-Faktor (rote Tests, #423) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/435
- KI-Klassifikation & Säulen-Berater mit nutzerdefinierten Säulen (#424) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/436
- fix(hermes): Agenten beginnen sofort mit Arbeit statt auf Deadline zu warten by @deleonio in https://github.com/deleonio/priority-pilot/pull/442
- feat: Add Mistral Vibe Coding Agent workflows as alternative to Hermes by @deleonio in https://github.com/deleonio/priority-pilot/pull/444
- Fix: Remove duplicate MISTRAL_API_KEY in vibe workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/447
- feat: Provider-specific concurrency for Claude workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/448
- fix: Mistral as default provider for Vibe workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/449
- Fix: Add PATH for vibe CLI in all vibe workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/450
- Fix: Add complete PATH to all AI workflows for command availability by @deleonio in https://github.com/deleonio/priority-pilot/pull/451
- chore: Workflow Cleanup — stale refs entfernen, VERDICT in Fixup, Skill v2.0.0 by @deleonio in https://github.com/deleonio/priority-pilot/pull/456
- Säulen-CRUD: OpenAPI-Spec + API-Client (createPillar/updatePillar/deletePillar) (#438) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/441
- Empty-States und dynamische Grenzfälle: 0 oder viele Säulen (#440) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/458
- chore(deps): update github actions (major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/459
- fix(deps): pin dependency react-markdown to 10.1.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/446
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/453
- feat: Serien-Aufgaben nur zukünftig generieren by @deleonio in https://github.com/deleonio/priority-pilot/pull/460
- chore(deps): update dependency brace-expansion@2 to v2.1.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/452
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/445
- Säulen-Verwaltungs-UI im Einstellungen-Tab (anlegen/umbenennen/löschen) (#439) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/457
- fix(ci): Soft-Deadline + Cache-Permissions korrigiert by @deleonio in https://github.com/deleonio/priority-pilot/pull/461
- test: rote Spec-Tests für #429 — Säulen-Faktor auf beliebige Säulenzahl by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/462
- test: rote Spec-Tests für nutzerdefinierte Säulen (#430) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/464
- refactor: Säulen-Verwaltung auf KoliBri-Dialoge umgestellt by @deleonio in https://github.com/deleonio/priority-pilot/pull/465
- Update descriptions of the 5 default pillars by @deleonio in https://github.com/deleonio/priority-pilot/pull/463
- refactor(frontend): Browser-Notification bei PWA-Update entfernen by @deleonio in https://github.com/deleonio/priority-pilot/pull/466
- docs: GLM-Modellkonfiguration (Status Quo z.ai) dokumentieren by @deleonio in https://github.com/deleonio/priority-pilot/pull/471
- fix(ci): Workflow setzt Labels via App-Token (force-set) — Agent nur VERDICT by @deleonio in https://github.com/deleonio/priority-pilot/pull/473
- Rote Spec-Tests für #431 (Säulen-Verwaltung + dynamische Grenzfälle) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/468
- test: rote Spec-Tests für #467 (wochentag-basierte Rhythmen) — PARTIAL by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/475
- feat(#472): Initialfokus auf „Abbrechen“ in Lösch-Dialogen + Serien-Bestätigungsdialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/474
- Doku: Säulen als nutzerdefiniert dokumentieren (#476) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/478
- test: rote Spec-Tests für #470 — Serien-Rhythmen Frontend by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/477
- ci(hermes): Failure-Rauschen senken + Test-Pflege-Bedarf gegen Add-only by @deleonio in https://github.com/deleonio/priority-pilot/pull/481
- spec: Kein sichtbarer Fokus-Sprung auf destruktiven Button in Löschen-Dialogen (#479) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/480
- chore: update public-ui dependencies to 4.3 by @deleonio in https://github.com/deleonio/priority-pilot/pull/484
- chore(deps): update dependency brace-expansion@2 to v2.1.4 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/483
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/482
- ci: Pipeline auf Claude Code only umstellen + hermes-* → claude-* umbenennen by @deleonio in https://github.com/deleonio/priority-pilot/pull/486
- ci: 5 Pipeline-Workflows mit Phasen-Nummer prefixen (01–05) by @deleonio in https://github.com/deleonio/priority-pilot/pull/488
- fix(spec): ai:ready wurde nie gesetzt — gh jq-Parse-Fehler im Artefakt-Check by @deleonio in https://github.com/deleonio/priority-pilot/pull/489
- Feat/issue 485 followup spec cleanup by @deleonio in https://github.com/deleonio/priority-pilot/pull/492
- test: rote Spec-Tests für Header-Optimierung — Icon-Logo, Avatar, eine Ebene (#485) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/491
- ci: Skip-Guard für Implement + Spec (läuft bereits → skip statt warten) by @deleonio in https://github.com/deleonio/priority-pilot/pull/490
- ci: Skip-Guard-Folgefindings aus PR #490 (Review-Runde 8) by @deleonio in https://github.com/deleonio/priority-pilot/pull/493
- feat: Claude Code Memory-Persistenz für ticketspezifische Workflows by @deleonio in https://github.com/deleonio/priority-pilot/pull/494
- fix: PR Post-Merge Documentation nur nach echtem Merge triggern (#496) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/498
- fix(ci): fix 3 critical bugs in post-merge PR documentation workflow by @deleonio in https://github.com/deleonio/priority-pilot/pull/495
- fix(ci): Claude-Phasen pushen zuverlässig als App (Contents:Write) by @deleonio in https://github.com/deleonio/priority-pilot/pull/501
- test: rote Spec-Tests für Permission-/Tier-Modell (#497) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/499
- fix(ci): Documenter-Token-Fix + Ticket-Memory-Abbau by @deleonio in https://github.com/deleonio/priority-pilot/pull/502
- feat(#396): Automatisches Login (Session-Persistenz + stiller Google-Login) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/500
- feat(issue-645): LLM-Lektorat-Funktion zum Kürzen und Lektorieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/647
- docs(issue-645): Spec-Doc für LLM-Lektorat-Funktion by @deleonio in https://github.com/deleonio/priority-pilot/pull/648
- docs(tailscale): Exit-Node-Doku + Workflow-Action v2->v4 by @deleonio in https://github.com/deleonio/priority-pilot/pull/649
- docs(llm): Multi-Provider-Setup-Guide auf Kaskade + Settings-UI aktualisieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/654
- feat(ci): documenter facts/llm/render split + release chain by @deleonio in https://github.com/deleonio/priority-pilot/pull/711
- docs(spec): Ist-Stand-Sync 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/708
- chore(ci): nächtlichen Guide-Sync für das In-App-Handbuch ergänzen by @deleonio in https://github.com/deleonio/priority-pilot/pull/701
- test(e2e): header consistency across viewports (red spec tests for #691) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/694
- docs(spec): issue-618 — Ist-Stand-Sync 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/712
- docs(spec): issue-640 — Ist-Stand-Sync 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/713
- docs(spec): issue-645 — sync current status 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/714
- docs(spec): issue-697 — spec state sync 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/717
- docs(spec): remove issue-696 — Ist-Stand-Sync 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/716
- docs(spec): issue-687 — Ist-Stand-Sync 2026-08-16 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/715
- feat(issue-718): restore avatar on mobile by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/719
- docs(guide): sync user guide to current implementation by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/721
- feat(frontend): focus-tab-trap-checks for lektorat-diff-modal by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/722
- fix: lektorat-trigger-buttons-as-icon-only-toggles by @deleonio in https://github.com/deleonio/priority-pilot/pull/724
- fix(ci): doppelte YAML-Keys im Documenter-Workflow entfernen by @deleonio in https://github.com/deleonio/priority-pilot/pull/726
- feat(frontend): tabs responsive for mobile viewports by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/705
- test: rote Spec-Tests für 727 (Range-Inputs Layout) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/732
- docs(issue-731): spec for memory artifact verification by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/741
- feat(issue-728): Checklist-Abstandsoptimierung by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/737
- ci(spec-sync): create non-draft PRs with ai:needs-review via app token by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/739
- feat(ux): ux-beratung als phase 2b by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/740
- feat(issue-734): UI-Bezug Klassifizierung im Triage-Workflow by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/744
- feat(issue-735): UX-Phase in Phasen-Workflow integrieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/745
- docs(issue-736): UX-Phase in Doku integrieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/746
- docs(issue-738): add verification and migration runbook by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/747
- fix(ci): load issue memory in triage and let review write memory notes by @deleonio in https://github.com/deleonio/priority-pilot/pull/748
- feat(frontend): add free models selection component by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/743
- feat(issue-750): seven sequential pipeline phases, optional ux before spec by @deleonio in https://github.com/deleonio/priority-pilot/pull/759
- docs(guide): Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/760
- chore(spec): remove obsolete issue-638 spec by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/766
- docs(spec): issue-639 — Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/767
- docs(spec): remove issue-641 spec — sync resolved tickets 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/768
- docs(spec): issue-656 entfernen — Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/769
- docs(spec): remove issue-659 spec — ist-stand-sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/770
- docs(spec): remove issue-669 spec — 2026-08-17 sync by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/771
- docs(spec): remove issue-671 spec after implementation merged by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/772
- docs(spec): remove issue-672 — status sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/773
- docs(spec): issue-679 — Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/774
- docs(spec): issue-692 — Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/775
- docs(spec): issue-703 — Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/776
- docs(spec): issue-718 — status-sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/778
- docs(spec): issue-733 — Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/782
- docs(spec): issue-735 — nightly spec sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/783
- test: In-Flight-Guard auf 4 Labels erweitern (Issue #818) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/821
- docs: mobile-ui-ruleset as binding reference in ux and implementation by @deleonio in https://github.com/deleonio/priority-pilot/pull/825
- fix(issue-813): mermaid syntax fix in pipeline-flow.md by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/815
- docs(guide): Ist-Stand-Sync 2026-08-17 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/814
- feat(ci): add structured decision-findings to ai:needs-human comments by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/830
- feat(llm): compact LLM settings menu with inline delete buttons by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/810
- chore: integrate impeccable design skill into CI phases by @deleonio in https://github.com/deleonio/priority-pilot/pull/829
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/811
- chore(deps): update dependency flatted to v3.4.4 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/812
- feat(issue-824): kolibri-test-guard by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/826
- chore(workflows): switch spec-sync to guide-sync delivery model by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/820
- docs(ci-arch): Spec-Sync-Mechanik auf Sammel-PR-Modell umgestellt by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/836
- feat(issue-823): kolibri-mcp and playwright layout integration by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/837
- feat(issue-763): implement responsive layout for pillar weights by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/789
- fix(ci): dead pnpm filter to server in CI workflows by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/841
- feat(issue-761): layout optimization title/description/actions by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/790
- feat(issue-845): implement geolocation tracking with 5-minute interval and settings toggle by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/846
- docs(ci-architecture): clarify spec-sync replaced earlier file-based model by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/849
- feat(issue-831): KoliBri-MCP in UX-Phase integrieren by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/835
- fix(frontend): right-align actions and fill field widths by @deleonio in https://github.com/deleonio/priority-pilot/pull/850
- feat(787): header layout and model selector in toolbar by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/809
- test(e2e): Fokus-Lande-Erkennung der Lösch-Dialog-Tab-Tests fixen by @deleonio in https://github.com/deleonio/priority-pilot/pull/864
- chore(ci): run e2e jobs in Playwright docker image by @deleonio in https://github.com/deleonio/priority-pilot/pull/859
- refactor(ci): unify pipeline labels to ai:needs-* triggers and ai:<past> done labels by @deleonio in https://github.com/deleonio/priority-pilot/pull/858
- feat(866): Reverse geocoding for geo-location setting by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/868
- feat(861): OpenRouter context length integration by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/863
- chore(skills): move PR review kreuzverhoer into skill by @deleonio in https://github.com/deleonio/priority-pilot/pull/869
- feat(ci): require verifiable explanation comments before ai:needs-human by @deleonio in https://github.com/deleonio/priority-pilot/pull/872
- refactor(ci): remove unused Done-Labels, consolidate phase triggers by @deleonio in https://github.com/deleonio/priority-pilot/pull/875
- fix(docs): update all references from priority-pilot to server by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/842
- docs(spec): spec sync - cleanup completed specs and update user journeys by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/877
- fix(issue-843): settings screen layout spacing and typography by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/844
- feat(issue-862): model and context size in ModelSelectionDialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/870
- chore(guide-sync): Vermenschlichen-Schreibregeln in Claude-Prompt aufnehmen by @deleonio in https://github.com/deleonio/priority-pilot/pull/876
- fix(ci): retry mergeable-unknown in gate and add hourly gate sweep by @deleonio in https://github.com/deleonio/priority-pilot/pull/880
- feat(issue-862): deliver contextLength and modelSize from free-models API by @deleonio in https://github.com/deleonio/priority-pilot/pull/881
- docs(issue-840): fix stale priority-pilot references in comments by @deleonio in https://github.com/deleonio/priority-pilot/pull/882
- feat(ci): structured decision template with stable option IDs by @deleonio in https://github.com/deleonio/priority-pilot/pull/884
- feat(ci): trigger re-triage on ai:analysed label removal by @deleonio in https://github.com/deleonio/priority-pilot/pull/885
- chore(ci): always merge target branch into PR branch before fixup runs by @deleonio in https://github.com/deleonio/priority-pilot/pull/878
- feat(ux): Design language 'Cockpit' as token layer + UX-first audit by @deleonio in https://github.com/deleonio/priority-pilot/pull/848
- feat(issue-865): remove avatar and user full name by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/871
- chore(ci): remove documenter sweep by @deleonio in https://github.com/deleonio/priority-pilot/pull/889
- test(frontend): assert observable outcomes in useGeolocation tests by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/891
- chore(ci): start triage only via ai:needs-analyse label by @deleonio in https://github.com/deleonio/priority-pilot/pull/898
- fix(ci): Label-Races der PR-Pipeline via atomarer Transition schließen by @deleonio in https://github.com/deleonio/priority-pilot/pull/899
- fix(settings): keep save button inside viewport on llm settings tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/890
- fix(ci): move target-merge before start-consume in fixup-phase-6 by @deleonio in https://github.com/deleonio/priority-pilot/pull/901
- feat(ci): zai-timeout-fallback 08-12 berlin by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/895
- feat(issue-894): Continue-Sweep – hängende Pipeline-Phasen alle 6h fortführen (00:05/06:05/12:05/18:05 Berlin) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/900
- feat(agents): check the persistent agent memory into Git by @deleonio in https://github.com/deleonio/priority-pilot/pull/907
- feat(harness): Kosten-Baseline + Modellwahl je Subtask (Schritt 0 & 1) by @deleonio in https://github.com/deleonio/priority-pilot/pull/911
- feat(harness): Analyse liefert Umsetzungskontext + Hard Stop bei Uneindeutigkeit (Schritt 2) by @deleonio in https://github.com/deleonio/priority-pilot/pull/913
- feat(harness): Spec-Phase überspringbar, wo sie keinen Vertrag liefern kann (Schritt 3) by @deleonio in https://github.com/deleonio/priority-pilot/pull/914
- docs(adr): ADR 0004 — Analyse-getriebenes Routing by @deleonio in https://github.com/deleonio/priority-pilot/pull/915
- fix(setup-claude): Tailscale Exit-Node nur für zai/openrouter by @deleonio in https://github.com/deleonio/priority-pilot/pull/918
- fix(ci): Claude-CLI-Bereitstellung verifizieren statt Cache vertrauen by @deleonio in https://github.com/deleonio/priority-pilot/pull/924
- fix(harness): pr-for-issue-Fallback verlangt ein Closing-Keyword statt Volltextsuche by @deleonio in https://github.com/deleonio/priority-pilot/pull/925
- feat(frontend): Avatar im Header ganz rechts positionieren (#912) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/926
- docs(guide): sync user guide to current implementation 2026-08-20 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/928
- docs(guide): sync user guide with current implementation 2026-08-20 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/937
- feat(harness): Kosten-Baseline eines Tickets aus den Artefakten aggregieren by @deleonio in https://github.com/deleonio/priority-pilot/pull/939
- docs: record cost baseline of reference run #912 by @deleonio in https://github.com/deleonio/priority-pilot/pull/940
- feat(frontend): make kolibri host backgrounds transparent by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/938
- feat(frontend): manual geolocation refresh with address timestamp by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/958
- feat(frontend): integrate model selector into toolbar by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/957
- feat(frontend): fix desktop column widths of completed tasks table by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/964
- feat(frontend): icon-only model button, always visible, third in toolbar by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/966
- feat(frontend): use textarea for pillar description and cap name at 30 chars by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/963
- fix(frontend): distinguish session 401 from ai config 401 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/959
- feat(tests): integrate @axe-core/playwright for E2E accessibility tests by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/903
- feat(ci): auto re-arm transient fixup crash exactly once (issue 960) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/967
- test: rote Spec-Tests für #968 — Tab-Leisten nebeneinander (auch mobil) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/973
- docs(spec): sync specs to implemented state 2026-08-24 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/975
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/976
- chore(deps): update dependency js-yaml@4 to v4.3.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/977
- feat(harness): add already-done fixup verdict to return finished PRs to review by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/970
- docs(guide): sync user guide with implementation state 2026-08-24 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/979
- fix(frontend): symmetric horizontal padding on settings general tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/974
- fix(ci): filter unrecognized_model noise from needs-human logtail by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/980
- feat(llm)!: single active llm provider with radio button selection by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/953
- chore(ci): issue storage via state branches instead of artifacts by @deleonio in https://github.com/deleonio/priority-pilot/pull/981
- fix(e2e): limit ak2 error-code assertion to the kol alert by @deleonio in https://github.com/deleonio/priority-pilot/pull/986
- feat(harness): provider-agnostic cost valuation via model classes + turn tracking by @deleonio in https://github.com/deleonio/priority-pilot/pull/985
- feat(harness): seal per-ticket costs into repo via documenter by @deleonio in https://github.com/deleonio/priority-pilot/pull/987
- feat(frontend): switch row layout in settings general tab by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/983
- feat(frontend): #972 unify LLM tab layout and KolIcon key-clear button by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/988
- feat(frontend): min 300px input range width, dedupe pillar description by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/989
- fix(harness): cost seal via contents api and standalone catch-up job by @deleonio in https://github.com/deleonio/priority-pilot/pull/990
- fix(ci): use state==MERGED in catch-up guard since merged is no gh json field by @deleonio in https://github.com/deleonio/priority-pilot/pull/991
- feat(harness): Kosten-Übersicht — repo-weiter Report aus .costs/ by @deleonio in https://github.com/deleonio/priority-pilot/pull/992
- feat(llm): configurable llm providers with fixed built-ins by @deleonio in https://github.com/deleonio/priority-pilot/pull/994
- feat(harness): cap fixup rounds at 3 before escalating to human by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/995
- feat(css): mobile layout für pillar-row (Issue #996) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/998
- fix(frontend): repair pillar-row e2e setup and dead css selector by @deleonio in https://github.com/deleonio/priority-pilot/pull/1001
- fix(ux): replace broken icon and add consistent alignment for lectorate buttons (#997) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1000
- feat(llm): mistral fallback catalog, required custom model, radio labels by @deleonio in https://github.com/deleonio/priority-pilot/pull/999
- test: useGeolocation #933-AK3 auf Observable Outcomes umstellen (1003) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1006
- fix(ci): move agent memory out of .claude/ and repair prompt placeholders by @deleonio in https://github.com/deleonio/priority-pilot/pull/1005
- test(1004): E2E #930 AK2 um Keyboard-Tab-Fokus-Probe erweitern by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1007
- fix(ci): use FETCH_HEAD as base for state.json merge by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1011
- feat(llm): add per-provider test prompt and diagnosable upstream errors by @deleonio in https://github.com/deleonio/priority-pilot/pull/1012
- fix(ci): count only new/changed notes + documenter note post-assertion by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1014
- docs(spec): sync specs to actual state 2026-08-25 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1013
- docs(guide): sync user guide to current app state 2026-08-25 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1015
- feat(llm): surface provider cause and test status in readiness hint by @deleonio in https://github.com/deleonio/priority-pilot/pull/1016
- feat(frontend): unify push test and geolocation action buttons by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1018
- fix(ci): make VERDICT parser ignore prose after token by @deleonio in https://github.com/deleonio/priority-pilot/pull/1019
- fix(ci): Expression-Limit im Fixup-Label-Post-Step (Workflow galt bei jedem Push als ungültig) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1022
- feat(ci): remove images from PRs and issues in documenter by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1023
- refactor(prompts): dedupe phase prompts against knowledge base by @deleonio in https://github.com/deleonio/priority-pilot/pull/1026
- feat(frontend): rebuild completed tasks table as KolTableStateful (#1020) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1024
- Spec #1027: Vertikaler Abstand der Wald-Cards (rote Tests) (#1027) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1029
- feat(frontend): padding and radius for kol-alert host (#1028) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1030
- feat(frontend): improve pwa update/offline prompt tap targets and copy by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1035
- feat(costs): price z.ai runs, sharpen turn-bundling rule by @deleonio in https://github.com/deleonio/priority-pilot/pull/1036
- fix(frontend): make llm-provider action buttons responsive (#1037) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1038
- docs(costs): Kosten-Report für Ticket #1037 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1039
- docs(costs): Kosten-Report für Ticket #1034 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1040
- docs(costs): Kosten-Optimierungsplan zur Senkung der LLM-Kosten um 50-66% by @deleonio in https://github.com/deleonio/priority-pilot/pull/1041
- fix(ci): drei vorbestehende main-CI-Brüche beheben (Prettier, Spec-Skip-Fixture, Workflow-Name) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1046
- fix(frontend): make dashboard start-task button content-width on desktop by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1044
- ci(image-strip): add backfill for historical issues and prs by @deleonio in https://github.com/deleonio/priority-pilot/pull/1043
- chore: translate agent harness instructions from german to english by @deleonio in https://github.com/deleonio/priority-pilot/pull/1050
- feat(frontend): add search button with voice input to header toolbar by @deleonio in https://github.com/deleonio/priority-pilot/pull/1048
- docs(spec): sync specs to current implementation state 2026-08-27 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1053
- docs: sync user guide with the actual app state (2026-08-27) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1052
- ci(review): review.md auf SKILL.md-Referenzen trimmen by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1057
- fix(frontend): unify header toolbar buttons and align mic button in search dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1054
- docs(spec): Ist-Stand-Sync 2026-08-27 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1056
- feat(frontend): auto-start voice recognition in search dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1059
- feat(server): add task address field with forward geocoding search by @deleonio in https://github.com/deleonio/priority-pilot/pull/1061
- feat(server): use mistral-small-latest as mistral default model by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1062
- feat(server): add series address field and geo badges in lists by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1064
- chore(ci): spec draft PR titles follow the issue title by @deleonio in https://github.com/deleonio/priority-pilot/pull/1065
- feat(search): Fokus nach Suche im Filterfeld des Aufgaben-Tabs (#1067) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1069
- ci(costs): add KPI header, weekly trend, share bars, direction table by @deleonio in https://github.com/deleonio/priority-pilot/pull/1068
- chore(ci): move pipeline protocol from skills to .github/prompts by @deleonio in https://github.com/deleonio/priority-pilot/pull/1075
- feat(frontend): show geo badge in task list (#1063) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1070
- feat(frontend): group deadline fields in task form (#1072) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1074
- feat(frontend): show address instead of raw coordinates in footer by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1076
- feat(frontend): align update prompt bottom right on desktop (#1077) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1078
- ci: harness-branch issue storage (ADR 0007) + adr-sync workflow by @deleonio in https://github.com/deleonio/priority-pilot/pull/1081
- feat(frontend): make ai features disableable (#1080) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1082
- feat(frontend): add nearby card with geo-distance task list by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1071
- fix(#1085): disable quick-capture switch when ai is disabled by @deleonio in https://github.com/deleonio/priority-pilot/pull/1087
- docs(spec): sync specs to current state 2026-08-28 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1088
- ci(#1084): slim phase prompts via skill references (audit option 1) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1089
- feat(frontend): fuzzy address search via photon, nominatim fallback by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1086
- ci(prompts): remove skill duplicates from phase prompts (#1090) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1094
- test(frontend): assert state in useAddressSearch debounce test by @deleonio in https://github.com/deleonio/priority-pilot/pull/1093
- ci(prompts): Prompt-Audit auf Netto-Effizienz erweitern by @deleonio in https://github.com/deleonio/priority-pilot/pull/1096
- fix(frontend): guarantee reload after PWA update confirmation (#1095) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1097
- chore: add template-structure post-check after triage analysis by @deleonio in https://github.com/deleonio/priority-pilot/pull/1100
- fix(security): rate limiting, csrf protection, workflow permissions by @deleonio in https://github.com/deleonio/priority-pilot/pull/1079
- feat(frontend): server-side geo config, alarm distance, interval (#1098) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1103
- refactor(frontend): unify delete dialogs in ConfirmDeleteDialog (#1106) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1108
- feat(frontend): app routes for all menus via react router (#1105) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1107
- docs: stub superseded adr 0006 in 2026-08-29 consolidation sync by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1109
- fix(ci): gate-merge accepts skipping review checks by @deleonio in https://github.com/deleonio/priority-pilot/pull/1112
- feat(server): notify users about nearby tasks via push (#1101) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1102
- feat(frontend): show resolved coordinates in the task form (#1111) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1113
- feat(frontend): nearby radius title and real distances (#1110) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1114
- feat(ci): squash-merge pull requests in the auto-merge gate by @deleonio in https://github.com/deleonio/priority-pilot/pull/1115
- feat(frontend): render dashboard sections as equal-height Kolibri cards by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1120
- ci(pipeline): phase outputs live in the harness marker comment by @deleonio in https://github.com/deleonio/priority-pilot/pull/1122
- feat(frontend): move geo badge next to task title (#1121) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1123
- test(frontend): assert observable outcomes in useGeolocation (#1119) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1124
- docs(spec): Ist-Stand-Sync 2026-08-30 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1128
- refactor(server): central http error contract in one module (#1130) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1131
- docs: sync user guide with implemented state (2026-08-30) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1129
- refactor(frontend): drop legacy outer sections around dashboard widget cards by @deleonio in https://github.com/deleonio/priority-pilot/pull/1125
- chore(ci): consolidate phase prompts per prompt audit (#1127) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1132
- Ai/harness/1127 by @deleonio in https://github.com/deleonio/priority-pilot/pull/1133
- chore: reorganize scheduled workflows into cron.* groups by @deleonio in https://github.com/deleonio/priority-pilot/pull/1134
- chore: rename all workflows with descriptive names by @deleonio in https://github.com/deleonio/priority-pilot/pull/1135
- docs(guide): sync user guide with actual app behavior (2026-08-31) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1139
- chore(fixup): close fixup loop gap for ambiguous findings (#1137) by @deleonio in https://github.com/deleonio/priority-pilot/pull/1138
- fix(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1140
- chore(deps): update dependency js-yaml@4 to v4.3.2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1141
- chore(deps): update github actions (major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1147
- fix(deps): update dependency connect-redis to v10 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1148
- chore(deps): update dependency knip to v6 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1145
- refactor(server): central auth and request test helpers (#1142) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1150
- fix(auth): end endless spinner after Google authentication (#1136) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1149
- feat(frontend): own standort tab for geo settings (#1151) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1152
- docs(spec): sync specs to implemented state 2026-09-01 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1154
- docs(guide): sync user guide to current app state (2026-09-01) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1155
- ci(prompts): add thread-resolve command, label ban, and trim ux sources by @deleonio in https://github.com/deleonio/priority-pilot/pull/1156
- fix(server): scope series routes to owner (data isolation) (#1157) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1158
- chore(deps): update dependency tar to v7.5.22 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1163
- chore(deps): pin dependencies by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1162
- feat(frontend): add three-tier hierarchy to task form (#1159) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1160
- chore(deps): update devdependencies (non-major) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1164
- chore(deps): update dependency undici@6 to v6.28.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1165
- chore(deps): update node.js to v26.8.1 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1166
- feat(frontend): replace dashboard start button with done dialog by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1170
- chore(deps): update pnpm to v11.25.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1167
- chore(deps): update dependency @evilmartians/lefthook to v2 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1174
- fix(deps): update dependency express-rate-limit to v8.7.0 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1171
- chore(deps): update dependency @testing-library/jest-dom to v7 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1175
- chore(deps): update dependency @tootallnate/once to v3 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1176
- chore(deps): update dependency brace-expansion@2 to v5 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1178
- feat(frontend): add confetti success feedback on task completion by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1177
- chore(deps): update dependency picomatch@2 to v4 by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1180
- feat(frontend): confetti when completing via dashboard signal panel (#1182) by @my-github-action-bot[bot] in https://github.com/deleonio/priority-pilot/pull/1185
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

## v1.0 - 2026-06-24

_Keine für Nutzer sichtbaren Änderungen._

