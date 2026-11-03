# Sogang QMPL website: Codex handoff

## Project and publication

- Canonical repository: https://github.com/SogangQMPL/sogangqmpl.github.io
- Production: https://sogangqmpl.github.io/
- Production branch: `main`. A push to `main` runs **Publish lab website** in GitHub Actions and deploys GitHub Pages. A branch or pull request is not live until merged into `main` and deployed.
- Read `README.md`, `관리안내.md`, and the relevant existing implementation before changing anything. This repository carries the project context; the previous Codex chat is not required.
- At the start, inspect `git status`, branch, and remote. Preserve local edits and incorporate the latest remote changes without overwriting another maintainer's work. Use `codex/` branches for isolated work.

## First run on another computer

- Clone the canonical repository, rather than creating a new website or repository. If a clone is already present, reuse it.
- Use Node.js 22 or later for local work; the current CI uses Node 22. Normal site checks and builds need no external npm packages.
- Codex login, a browser's GitHub login, and Git push authentication are separate. Verify the intended GitHub identity and repository write access before promising publication. A public clone working does not prove push access.
- Default handoff assumption: the browser is signed into the shared Google account only, with no GitHub or command-line Git session yet. If an approved browser-control tool is connected, use GitHub's ordinary **Continue with Google** sign-in flow with that already-linked identity. Reuse an existing `SogangQMPL` GitHub session when present. Verify the resulting username is `SogangQMPL` and repository write access is available; public read access is insufficient.
- Authorized publication can use GitHub's normal web file-upload/commit/PR UI through that browser session; this does not configure command-line Git authentication. Reuse working Git credentials if already available. Preserve file paths, verify uploaded source against reviewed local changes, and fetch/reconcile the local clone after a web commit without discarding local work.
- Follow tool approval requirements. Involve the operator only for required verification/permissions, first-time identity linking, ambiguous Google account selection, or browser connection steps. Do not sign up a new GitHub account, alter account security, or extract browser cookies/tokens to manufacture Git credentials. Keep passwords, access tokens, authentication caches, and OAuth secrets out of chat, repository files, and handoff archives.
- Read `Codex-시작요청.txt` for the operator-facing setup and editing prompts.

## Files to edit

| Task | Canonical source |
| --- | --- |
| Announcements, people, publications, news, research, contact | `content/site.json` |
| Page markup and shared rendering | `renderer.js` |
| Layout, fonts, responsive styling | `styles.css` |
| Menu, filters, figure viewer and public-page interactions | `app.js` |
| HTML wrapper and build | `template.html`, `scripts/build.mjs` |
| Images and fonts | `assets/` |
| Visual editor frontend | `admin/visual*` |

`dist/` contains generated output: edit the sources and rebuild. Do not upload `dist/` as source or replace the existing framework-free site with a new template.

## Existing design and content conventions

- Keep the established Wix-related visual identity: white background, navy footer, purple accent, Quicksand brand/navigation and hero, compact academic content. Make focused changes requested by the operator.
- Check desktop and mobile. The mobile menu is a right-side drawer. Shared header alignment, page margins and footer layout must remain consistent.
- Home shows its announcement, latest three News items and three Publications. Member opens Professor; Highlights opens News. Students remain in the maintained order, three columns on wide screens.
- Preserve verified publication spelling, chemical subscripts, title italics, author symbols and full lab-member names. Lab members are bold and underlined. Number papers within each displayed year group; only 2010–2017 is grouped. Keep Under review separate.
- Research has three areas and five topics, with papers attached to topics. Related papers remain visible; research details can expand. Preserve the verified original material and its source records.
- Use original research figures and photographs. Keep scientific data, people, names and dates accurate. Check the relevant `docs/` source records before replacing an asset.
- Portrait `imageDisplay` metadata selects antialiased files by screen size/density. It is valid only while `imageDisplay.source === image`. On photo replacement, the renderer must use the new photo instead of stale derivatives. See `docs/portrait-display-sources.json`; regenerating derivatives is optional and requires `sharp`, while the normal site build does not.
- Keep unknown JSON metadata when changing records. The visual editor depends on stable IDs and the shared renderer.

## Verify and publish the requested work

1. Run `node scripts/check.mjs` and `node scripts/build.mjs`.
2. For visible changes, run `node scripts/serve.mjs` and inspect the affected PC and mobile pages. Default local address: http://127.0.0.1:4173/.
3. For editor behavior changes, also run the relevant `scripts/check-visual-*.mjs` checks.
4. When publication is requested, commit the reviewed source and assets, push to `main` or merge the prepared branch, then verify **Actions → Publish lab website** succeeded. Check the actual public page. Report the live URL and what was verified; do not call a local preview or a Git commit a completed publication.
5. If a Pages deployment fails during artifact lookup, inspect the actual error. A fresh **Run workflow** on `main` can recover a transient failure. Re-running a failed run can create duplicate `github-pages` artifacts; do not delete artifacts or reset Pages as a routine workaround.

## Separate hosted visual editor

- Editor URL: https://sogang-qmpl-editor.qmplqmpl-ai.chatgpt.site/
- It reads website content from the GitHub repository. Content-only changes to `content/site.json` become available there without rebuilding its server.
- Its frontend code/styles are embedded in a separate Sites deployment. Changes to `renderer.js`, `styles.css`, `app.js`, or `admin/visual*` need a host sync/redeployment for its preview to match the public site.
- Host source is maintained separately as sibling `qmp-editor-host`; it is not part of this repository. It has its own `.openai/hosting.json` and requires authorized access to the existing Sites project. GitHub repository access alone does not grant that hosting access.
- If authorized host source/access is available: build this site first; in the host run `npm run sync`, `npm run build`, `npm run validate`, and the relevant tests, then follow the Sites skill for the existing project and audience. Preserve its runtime configuration.
- If host source/access is unavailable, complete the authorized GitHub website work and clearly report that the hosted editor's embedded preview has not been updated. Do not create a replacement host, new OAuth app, or credentials merely to update the website.
