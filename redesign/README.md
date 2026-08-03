# Cebolletas website redesign prototype

Self-contained static prototype for the proposed Cebolletas main-site redesign.

## Contents

- `index.html` — page shell
- `styles.css` — responsive layout and visual design
- `script.js` — bilingual content, navigation, FAQ, and contact actions
- `images/` — images currently used by the prototype

No Node.js, build step, database, or environment variables are required.

## Test locally

Opening `index.html` directly may work, but a local HTTP server is the reliable option.

### Option 1: Python 3

From inside the extracted folder:

```bash
python3 -m http.server 8080
```

Open: <http://localhost:8080>

### Option 2: Node.js

From inside the extracted folder:

```bash
npx serve .
```

Open the URL shown in the terminal, usually <http://localhost:3000>.

## Local test checklist

1. Test desktop and a narrow mobile viewport.
2. Confirm every navigation item scrolls to the expected section.
3. Switch between `ES` and `EN`, then refresh to verify the choice persists.
4. Open and close FAQ items.
5. Test the Google Maps link.
6. Complete the contact form and test both email and WhatsApp actions.
7. Check the browser console for errors and the Network panel for missing files.

## Deploy under `/redesign/` on the existing GitHub Pages site

1. Extract the ZIP.
2. In a clone of `git@github.com:mvmags/cebolletas.git`, create a branch:

```bash
git switch -c redesign-main-site
```

3. Copy the extracted bundle contents into a folder named `redesign` at the repository root. The expected result is:

```text
cebolletas/
  redesign/
    index.html
    styles.css
    script.js
    images/
```

4. Commit and push:

```bash
git add redesign
git commit -m "Add main site redesign prototype"
git push -u origin redesign-main-site
```

5. Open a pull request and merge it into the branch GitHub Pages deploys (currently expected to be the repository's default production branch).
6. After GitHub Pages finishes deploying, test:

```text
https://cebolletas.mx/redesign/
```

If the custom domain does not immediately show the update, also test the repository's `github.io` Pages URL and allow time for CDN/DNS caching.

## Replace the current root site after approval

Do not simply move the folder without reviewing relative paths. Because this bundle is self-contained, its four top-level items can be copied to the repository root after backing up or removing the old root-site files:

- `index.html`
- `styles.css`
- `script.js`
- `images/`

Before merging that replacement, verify that existing routes—especially `/copal/` and `/copal/manage/`—remain untouched and continue loading.

## Known temporary item

The bundle uses the existing `Logo_v6_290x65.png`. Replace `images/Logo_v6_290x65.png` or update the image path in `index.html` when the final black/white Neto logo files are available.
