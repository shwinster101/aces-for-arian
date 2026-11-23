# Architecture diagrams

| Diagram | Shows | Files |
|---|---|---|
| System | Users, apps, APIs, stores and outside services, and how they connect | `aces.png` · `aces.svg` · `aces.excalidraw` |
| Data model | What each store holds: tables/columns, KV key patterns or sheet tabs, and how records relate | `aces-data.png` · `aces-data.svg` · `aces-data.excalidraw` |
| Code map | Folders and key files, scripts, tests and build/deploy, and what calls what | `aces-code.png` · `aces-code.svg` · `aces-code.excalidraw` |

- `.excalidraw` files are editable at https://excalidraw.com (File → Open).
- `*.ir.json` is the source for each diagram; regenerate with the excalidraw plugin's `generate.mjs` and `export.mjs`.
- Drawn 2026-11-23 from the code (migrations, KV key strings, sheet headers, folder layout), not from a check of live deployments.
  Update the matching `.ir.json` when a migration, key family, script or service is added or removed.
