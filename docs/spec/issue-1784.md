# Spec #1784 — MCP-Paketstufen Plus/Pro

**Ziel:** Free kein MCP, Plus nur lesend, Pro lesend und schreibend (`plans.ts`: `mcp_read` plus/pro, `mcp_readwrite` pro).

| Paket | Aktion                             | Erwartet                                                        |
| ----- | ---------------------------------- | --------------------------------------------------------------- |
| free  | Token, `task_list`                 | Paket-Fehler mit `mcp_read` und „plus" (AK4)                    |
| plus  | Token, `task_list`                 | Ergebnis (AK1)                                                  |
| plus  | readwrite-Token, `task_create`     | Paket-Fehler mit `mcp_readwrite` und „pro", keine Aufgabe (AK2) |
| pro   | readwrite-Token, `task_create`     | Aufgabe angelegt (AK3)                                          |
| plus  | Token-Einstellungen, Rechte-Regler | deaktiviert, Hinweis „Pro", kein PATCH (AK5)                    |

AK6: Kommentar in `apiTokens.ts` nennt kein „Max" mehr (Sichtprüfung, kein Test).
