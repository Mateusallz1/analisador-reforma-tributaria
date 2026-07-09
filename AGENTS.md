# AGENTS.md

## Project handoff

Current project: analisador-reforma-tributaria

Original local folder before rename:
`C:\Users\danil\Documents\projects\analisador-nf-e-reforma-tributaria`

Target folder/repo name chosen by the user:
`analisador-reforma-tributaria`

If a future Codex session starts after the folder rename, use the new path as the workspace and do not assume the old accented folder path still exists.

## What the app does

This is a local React/Vite app for analyzing NF-e/NFC-e/NFS-e XML files in the context of Reforma Tributaria. It is an analyzer, not an official validator. Avoid wording that promises official validation.

Preferred product wording:
- Analisador da Reforma Tributaria

Preferred repository/folder name:
- `analisador-reforma-tributaria`

## Runtime and commands

Primary commands:

```powershell
npm run check
npm run dev
```

Deno tasks also exist:

```powershell
deno task lint
deno task test
deno task build
deno task clean
```

`npm run check` runs lint, browser-backed tests, and production build.

Last known validation before this handoff:
- `npm run check` passed.
- Tests passed: 5/5.
- Production build passed.
- Vite chunk warning above 500 kB was resolved with manual chunks.
- `deno task clean` was run after build; `dist` and `server.js` were removed.

The dev server was started at:
`http://localhost:3000`

Before renaming the folder, stop the dev server and close terminals/editors pointing at the old path.

## Important architecture notes

Fiscal parsing and validation:
- `src/utils/nfeParser.ts` parses XML files and orchestrates processing.
- `src/utils/taxValidation.ts` owns CST/cClassTrib compliance analysis.
- `src/utils/xmlHelpers.ts` contains shared XML helpers.
- `src/utils/resultFilters.ts` contains pure filtering/grouping logic for results.
- `src/utils/analysisStats.ts` contains item KPI and grouping stats.

Performance/build:
- `vite.config.ts` uses `manualChunks` to split React, icons, JSZip, and vendor chunks.
- `JSZip` is lazy-loaded in `processFiles` only when processing `.zip` uploads.

UI structure:
- `src/components/ResultsTable.tsx` now mainly orchestrates state and grouped sections.
- `src/components/results/ResultsFilters.tsx` contains search and dropdown filters.
- `src/components/results/ResultNotes.tsx` renders grouped note rows/cards.
- `src/components/results/IncompleteDocumentsSection.tsx` renders documents without focus CNPJ.
- `src/components/results/StatusBadges.tsx` contains status badges.
- `src/components/results/OperationBadge.tsx` contains entrada/saida badge UI.
- `src/components/results/DocumentIdentity.tsx` and `PartyInfo.tsx` reduce duplicated note/person display markup.
- `src/components/results/types.ts` centralizes UI-only result types.

Accessibility improvements already applied:
- Dropdown buttons have `aria-haspopup`, `aria-expanded`, and `aria-controls`.
- Group accordions and incomplete-document accordion use button controls with `aria-expanded` and `aria-controls`.
- Note item expansion buttons expose `aria-expanded`, `aria-controls`, and `aria-label`.
- Decorative icons are marked with `aria-hidden` where appropriate.

Tests:
- `tests/engine.test.ts` covers parser, KPIs, grouping, and result filtering.
- `tests/uiSmoke.test.tsx` renders `ResultsTable` in the browser and checks filters, groups, incomplete documents, and key accessibility attributes.
- `tests/browserRunner.ts` runs both engine and UI smoke tests.

## Current caveats

- There is no `.git` directory detected in this workspace at the time of this handoff; initialize Git after the folder rename if needed.
- `dev-server.log` and `dev-server.err.log` may exist locally from background Vite runs; `.gitignore` already ignores `*.log`.
- If the folder is renamed, reopen Codex in the new folder instead of continuing an old session bound to the old path.

## Suggested next work

Good next steps after the rename:
- Initialize Git and make a first clean commit.
- Update README title/name to match `analisador-reforma-tributaria` if desired.
- Run `npm run check` after opening the project in the renamed folder.
- Start local dev with `npm run dev` and verify `http://localhost:3000`.