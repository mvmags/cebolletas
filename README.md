# Cebolletas v10.1.0 update bundle

Copy this bundle over the root of the existing `cebolletas` repository, preserving the included folder structure.

Included paths:

- `index.html`
- `assets/css/styles.css`
- `assets/js/script.js`
- `images/cebolletas-copal-construction.jpeg`

After copying, remove the obsolete root files and prototype directory:

```bash
git rm script.js styles.css
git rm -r redesign
```

Test locally from the repository root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080/` and verify the main site plus `http://localhost:8080/copal/`.

The bundle expects the existing `copal/assets/logo-xanadu.png` asset to remain in place.
