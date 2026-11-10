# Hinweis zum Build-Bezug

- Gemessen gegen **`adb8222`** am 10.11.2026 (`https://www.h4ngelic.com`).
- `adb8222` ist nicht mehr der Live-Build. Live war beim Schreiben dieser Notiz
  **`9b6174ecc534`** (`9b6174e`, Merge `gate-registry-sync`, 11.11. 00:36).
- Danach folgten nur Doku- und Test-Commits; jeder Deploy trägt deshalb einen
  neuen Marker (`<meta name="h4-build">`). Der Code-Diff bleibt leer:
  `git diff adb8222 <marker> -- src index.html vite.config.js public api server package.json`.
- Website-Code unverändert, die Messwerte hier gelten für `adb8222` weiter.
