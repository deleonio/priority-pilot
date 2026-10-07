# Spec #2365 — versionCode ohne Überlauf

## Ziel

Der Android-`versionCode` steigt für jede höhere semver-Version streng monoton; Überlauf fällt beim Build auf.

## Regeln

- Formel: `major * 10000000 + minor * 10000 + patch` (TS: `native/src/version-code.ts`, Spiegel: `native/android/app/build.gradle`).
- Grenzen: `minor <= 999`, `patch <= 9999`, `major <= 209` (Maximum 2.099.999.999 < Play-Obergrenze 2.100.000.000).
- Außerhalb der Grenzen wirft `versionCodeFrom` einen Fehler, Gradle bricht mit `GradleException` ab.
- 0.18.0 ergibt 180000 und liegt über allen bisherigen Codes (~1800).

## Erwartetes Ergebnis

- 0.18.99 < 0.18.100 < 0.19.0 und 0.99.5 < 0.100.0 < 1.0.0 (streng steigend).
- `209.999.9999` < 2100000000; `0.1000.0`, `0.0.10000`, `210.0.0` werfen.
- build.gradle trägt Formel und Grenzen 999/9999/209.
