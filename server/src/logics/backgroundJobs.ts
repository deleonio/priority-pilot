/**
 * Master-Schalter für alle Hintergrund-Jobs (#2831): Scheduler-Timer, Push-Versand und
 * Startup-Einmaläufe mit Schreibzugriff. Default-on — nur der exakte Wert `=false` deaktiviert
 * (konsistent mit `AUTO_DELETE_AFTER_DEADLINE_ENABLED`); gedacht für Staging-Instanzen gegen eine
 * Datenbank-Kopie, die weder Timer registrieren noch schreiben oder versenden dürfen. Bewusst in
 * `logics/` abgelegt: `push.ts` und `scheduler/index.ts` importieren ihn hier, ohne einen
 * Import-Zyklus zu erzeugen.
 */
export const isBackgroundJobsEnabled = (): boolean => process.env.BACKGROUND_JOBS_ENABLED !== 'false';
