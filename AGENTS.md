# Sogang QMPL website: Codex handoff

## Project and publication

- Canonical repository: https://github.com/SogangQMPL/sogangqmpl.github.io
- Production: https://sogangqmpl.github.io/
- Production branch: `main`. A push to `main` runs **Publish lab website** in GitHub Actions and deploys GitHub Pages. A branch or pull request is not live until merged into `main` and deployed.
- Read `README.md`, `관리안내.md`, and the relevant existing implementation before changing anything. This repository carries the project context; the previous Codex chat is not required.
- At the start, inspect `git status`, branch, and remote. Preserve local edits and incorporate the latest remote changes without overwriting another maintainer's work. Use `codex/` branches for isolated work.

## First run on another computer

- Use a local Codex session with a writable project folder and shell execution. This bootstrap cannot install tools or edit local files from an ordinary web chat alone. The Chrome extension is optional; its absence must not block repository setup, edits, or CLI publication.
- Inspect the current folder, Git state, branch and remote first. Reuse the canonical clone or clone it into a new subfolder; never replace another project or discard local work. Read `Codex-시작요청.txt` for the operator-facing workflow.
- Check Git, Node.js 22 or later, and GitHub CLI (`gh`). Reuse suitable installed tools and working Git authentication. Install only missing required tools through official downloads or supported package sources, within the current approval policy. On Windows, common WinGet IDs are `Git.Git`, `GitHub.cli`, and `OpenJS.NodeJS.LTS`; confirm package identity/version before installing. Recheck executable paths after installation because the current shell's PATH may be stale. Normal site checks/builds need no external npm packages.
- Codex login, browser Google/GitHub sessions, and Git push authentication are separate. A Google account already signed into Chrome does not authenticate Git or prove publication access. Do not require Google-session inspection or Chrome setup before proceeding with the CLI path.
- Prefer an existing authenticated CLI path for the intended account. For GitHub CLI, inspect `gh auth status --hostname github.com` without token-display options. If authentication is missing, run `gh auth login --hostname github.com --git-protocol https --web --clipboard` in an interactive session. This opens the ordinary browser and copies a one-time device code; no browser extension or browser-control tool is required. If the browser does not open, give the operator the displayed verification URL and code. If interactive login asks "Authenticate Git with your GitHub credentials?", choose **No** and use the scoped helper after verification. The operator completes login, authorization, CAPTCHA or additional verification as required; never bypass it. GitHub may offer **Continue with Google** if login is needed, but do not assume a particular browser profile is signed in.
- Check only the presence of `GH_TOKEN` and `GITHUB_TOKEN`, never their values: these environment variables can override stored GitHub CLI authentication. Verify the identity of the credentials actually used. If an overriding token belongs to another account and blocks login, omit it only from this command process while preserving user/system environment settings. Explicitly target github.com for authentication, API and repository checks; do not let a pre-existing GH_HOST redirect this task to another host. After authentication, verify `gh api --hostname github.com user --jq .login` returns `SogangQMPL`, and verify `gh api --hostname github.com repos/SogangQMPL/sogangqmpl.github.io --jq '{repository: .full_name, push: .permissions.push}'` reports the canonical repository with `push: true`. Public clone/read success is insufficient. Do not create a test commit to check permissions. If another account is active, preserve it; reuse or normally authenticate the intended account rather than deleting another person's credentials. First-time linking or missing repository permission needs the operator's intervention.
- Configure Git to use the verified credentials only when needed, preferring repository- or command-scoped credential-helper settings. `gh auth setup-git` writes global configuration and must not be the default bootstrap step. Do not overwrite global Git identity/authentication or unrelated project settings as a routine bootstrap step. Reuse working Git credentials. A successful browser login alone does not configure Git push authentication.
- Never print or extract access tokens, browser cookies, passwords or OAuth secrets. Do not use `gh auth token`, token-display flags, or `--insecure-storage`. GitHub CLI normally uses the OS credential store but can fall back to plaintext; check the reported storage mode/location without opening credential files and do not silently accept a fallback. Keep credentials and authentication caches out of prompts, source files, logs and handoff archives. The shared startup file contains no password.
- Continue independent clone/check/build/edit work while waiting for authentication. For visual validation, use an available built-in/local preview or approved browser tool; Chrome is not a prerequisite for publishing. If no suitable visual tool is available, report PC/mobile display verification as incomplete rather than claiming screenshots were checked. Do not promise completely unattended setup on every PC: the first normal login/authorization, installer permission, or managed-device restriction can require operator action.
- Once authentication and the requested edits/checks are complete, publish with Git, then verify the corresponding **Publish lab website** run and the actual public result. Follow branch protection/review requirements. If no specific change was supplied, prepare the project/preview and ask what to edit; do not invent or publish a change.

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
- Preserve verified publication spelling, chemical subscripts, title italics and author symbols. Use each paper's verified full published author names, including coauthors; retain published middle initials and never guess ambiguous given names. Lab members are bold and underlined. Number papers within each displayed year group; only 2010–2017 is grouped. Keep Under review separate.
- Research has three areas and five topics, with papers attached to topics. Related papers remain visible; research details can expand. Preserve the verified original material and its source records.
- Use original research figures and photographs. Keep scientific data, people, names and dates accurate. Check the relevant `docs/` source records before replacing an asset.
- For every new or edited News, Awards, Conferences and Activities post, use a consistent **4:3 photo thumbnail** on desktop and mobile. The shared `.highlight-image` frame applies this automatically, including when the first body photo is used as the cover. Adjust the crop composition when needed without stretching the image. Keep cropped cover assets/metadata separate from body photos: `content[].src` must show the complete, uncropped photograph, and `fullSrc` must link to its original when a smaller uncropped display copy is used. Never substitute cover thumbnails for body images or overwrite originals with crops.
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
