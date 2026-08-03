# Cebolletas Copal gallery maintenance

This directory is the source of the public photo gallery shown at
`/copal/#gallery`.

The gallery is a static-site feature. The visitor's browser does **not** read
directories directly. Instead, the repository script
`scripts/generate-gallery-manifest.mjs` scans these folders and generates
`copal/gallery-manifest.js`. The public gallery reads that generated manifest.

## Current structure

```text
copal/assets/gallery/
├── README.md
├── interior/
│   ├── image-0001.jpeg
│   ├── image-0002.jpeg
│   └── ...
├── rest-area/
├── bedroom/
├── terrace/
├── outdoor-view/
└── landscape/
```

Each folder represents one gallery section. Each image belongs to exactly one
section.

The visible section names and their order are currently defined in
`copal/script.js`, inside `gallerySectionDefinitions`:

| Folder | Spanish label | English label |
| --- | --- | --- |
| `interior` | Interior | Interior |
| `rest-area` | Área de descanso | Resting area |
| `bedroom` | Recámara | Bedroom |
| `terrace` | Terraza | Terrace |
| `outdoor-view` | Vista exterior | Outdoor view |
| `landscape` | El paisaje | The landscape |

> Important: images inside an existing section are discovered automatically.
> A new folder is included in the generated manifest, but it will not appear as
> a public gallery section until it is also added to
> `gallerySectionDefinitions`.

## Filename rules

Every public gallery image must use this exact pattern:

```text
image-0001.jpeg
image-0002.jpeg
image-0003.webp
```

Rules:

- Use `image-` followed by exactly four digits.
- Begin every folder at `image-0001`.
- Keep the sequence consecutive; do not leave gaps.
- Do not repeat a number with a different extension.
- Supported extensions are `.jpg`, `.jpeg`, `.png`, `.webp`, and `.avif`.
- Lowercase extensions are recommended.
- Do not use spaces, accents, descriptions, dates, or camera filenames.
- Each visible section must contain at least `image-0001`.

`image-0001` is special: it is the section cover displayed in the thumbnail
strip and as the large feature image. The remaining files appear in numerical
order inside the modal viewer.

## Routine: add photos to an existing section

1. Select the correct folder.
2. Prepare the new images for the web; see [Image preparation](#image-preparation).
3. Inspect the existing filenames and identify the next available number.
4. Copy the new files into the folder using consecutive names.
5. Regenerate the gallery manifest.
6. Validate locally.
7. Commit the images and generated manifest together.
8. Push the branch, open a pull request, and verify the deployed gallery after
   the change is merged.

Example: if `terrace/` ends at `image-0003.jpeg`, add the next two photos as:

```text
copal/assets/gallery/terrace/image-0004.jpeg
copal/assets/gallery/terrace/image-0005.webp
```

From the repository root, regenerate the manifest:

```bash
node scripts/generate-gallery-manifest.mjs
```

Expected output resembles:

```text
Generated copal/gallery-manifest.js with 6 sections.
```

The generator will stop with an error if a folder is empty or its numbering is
not consecutive.

## Routine: remove photos

1. Delete the unwanted file.
2. Rename every later image so the sequence remains consecutive.
3. Regenerate `copal/gallery-manifest.js`.
4. Validate the section locally.

Example: to remove `image-0002.jpeg` from a four-photo section:

```text
Delete: image-0002.jpeg
Rename: image-0003.jpeg -> image-0002.jpeg
Rename: image-0004.jpeg -> image-0003.jpeg
```

Do not leave `image-0001`, `image-0003`, `image-0004`. The generator rejects
that sequence because `image-0002` is missing.

If the removed file is `image-0001`, choose the desired new cover and rename it
to `image-0001`; then renumber the remaining photos.

## Routine: change a section cover

The cover is always `image-0001`, regardless of its extension.

To promote another image to the cover:

1. Temporarily move or rename the current `image-0001`.
2. Rename the desired cover to `image-0001`.
3. Rename the old cover and any affected images so the full sequence remains
   consecutive.
4. Regenerate the manifest and preview the gallery.

Do not keep both `image-0001.jpeg` and `image-0001.webp` in the same folder.

## Routine: reorder photos

Photo order is controlled only by the four-digit number. Rename the files to
the desired sequence, keeping the numbers consecutive from `0001` onward.

Use temporary filenames while swapping two files so one does not overwrite the
other. For example:

```text
image-0002.jpeg -> image-temp.jpeg
image-0003.jpeg -> image-0002.jpeg
image-temp.jpeg -> image-0003.jpeg
```

Then regenerate the manifest.

## Routine: add a new gallery section

Adding a folder alone is not enough in the current implementation.

1. Create a lowercase, hyphenated folder under `copal/assets/gallery/`, for
   example `fire-pit/`.
2. Add at least `image-0001` and keep all filenames consecutive.
3. Open `copal/script.js`.
4. Add the folder and bilingual labels to `gallerySectionDefinitions` at the
   position where the new section should appear:

```js
{
  folder: "fire-pit",
  labels: { es: "Fogatero", en: "Fire pit" }
},
```

5. Regenerate `copal/gallery-manifest.js`.
6. Preview both Spanish and English versions.
7. Verify the new section's cover, image count, modal navigation, keyboard
   controls, and mobile swipe behavior.

The `folder` value must exactly match the directory name, including hyphens and
letter case.

## Routine: rename a gallery section

There are two different operations:

### Change only the displayed label

Keep the folder unchanged and edit only the `labels.es` and/or `labels.en`
values in `gallerySectionDefinitions` inside `copal/script.js`.

### Change the folder name

1. Rename the directory.
2. Update the matching `folder` value in `gallerySectionDefinitions`.
3. Regenerate the manifest.
4. Search the repository for the old folder name and correct any remaining
   references.
5. Validate both languages.

## Routine: remove a gallery section

1. Remove the section entry from `gallerySectionDefinitions` in
   `copal/script.js`.
2. Delete its folder from `copal/assets/gallery/`.
3. Regenerate the manifest.
4. Confirm that the remaining section counter and order are correct.

Removing only the folder currently hides the section because the UI filters
definitions with no images, but leaving the stale definition is poor
maintenance and can cause the section to reappear unexpectedly later.

## Image preparation

Do not publish full-resolution camera files directly. Large photos slow the
gallery, consume mobile data, and make modal navigation feel unresponsive.

Recommended targets:

- Long edge: approximately 1600–2200 pixels.
- JPEG/WebP quality: approximately 75–85.
- File size: preferably below 500 KB; use up to roughly 1 MB only when visible
  quality requires it.
- Color profile: sRGB.
- Orientation: apply the EXIF rotation before publishing.
- Metadata: remove GPS/location metadata and other private EXIF data.
- Format: use WebP or AVIF when browser-tested; JPEG is acceptable for photos.
- Avoid PNG for ordinary photographs because it is usually much larger.

Before publishing, check that:

- The image is sharp at the displayed size.
- People shown in the image may be published.
- No license plates, phone numbers, tools, trash, or unfinished details are
  visible unless intentional.
- The photo accurately represents the current state of Cebolletas Copal.

## Local validation

Run these commands from the repository root:

```bash
node scripts/generate-gallery-manifest.mjs
node --check copal/gallery-manifest.js
node --check copal/script.js
git diff --check
git status --short
```

Then preview the site through a local web server. Do not open `copal/index.html`
directly with a `file://` URL.

One simple option is:

```bash
python3 -m http.server 8080
```

Open:

```text
http://localhost:8080/copal/
```

### Browser checklist

Test at desktop and mobile widths:

- Every expected section is visible once and in the correct order.
- Every thumbnail loads.
- `image-0001` is the intended cover for each section.
- The large image changes when another section is selected.
- The “click/tap to enlarge” cue is visible.
- Clicking or tapping the large image opens the correct album.
- Previous/next navigation follows numerical filename order.
- The counter shows the correct position and album size.
- Arrow keys navigate the modal on desktop.
- `Escape` closes the modal.
- Swipe navigation works on touch screens.
- A one-photo section hides previous/next controls.
- Spanish and English section labels are correct.
- There are no broken images or browser-console errors.
- Reserva and `/copal/manage/` still behave normally.

## Commit and pull-request workflow

Review the change before committing:

```bash
git diff -- copal/gallery-manifest.js copal/script.js
git status --short
```

A typical existing-section update should include only:

- Added, deleted, or renamed files under `copal/assets/gallery/<section>/`.
- The regenerated `copal/gallery-manifest.js`.
- This README only when the maintenance process itself changes.

Adding, renaming, reordering, or removing a section also changes
`copal/script.js`.

Suggested commit messages:

```text
content(copal): update terrace gallery photos
content(copal): add fire pit gallery section
content(copal): remove outdated bedroom photo
```

Do not commit camera originals, temporary files, duplicate exports, or operating
system files such as `.DS_Store`.

## Automatic manifest update in GitHub

`.github/workflows/update-gallery-manifest.yml` runs when files under
`copal/assets/gallery/**` are pushed to `main`. It regenerates
`copal/gallery-manifest.js` and commits the result if it changed.

This automation is a safety net, not a substitute for local validation.
Regenerating and committing the manifest in the pull request makes the actual
deployed result reviewable before merge.

If the workflow fails:

1. Open the failed **Update gallery manifest** run in GitHub Actions.
2. Read the **Generate gallery manifest** error.
3. Correct the reported folder or filename sequence locally.
4. Regenerate the manifest.
5. Commit and push the correction.

Do not manually edit `copal/gallery-manifest.js`; it is generated code and the
next successful run will overwrite manual changes.

## Production verification

After merging and deployment:

1. Wait for GitHub Pages deployment to complete.
2. Open `https://cebolletas.mx/copal/` in a private browser window.
3. Hard-refresh the page to avoid a cached manifest or image.
4. Repeat the browser checklist for the sections that changed.
5. Check one desktop browser and one real mobile device.
6. Confirm the live site displays the same photo count and order as the local
   preview.

Do not remove the feature branch or create the release tag until production
verification passes.

## Troubleshooting

### A new photo does not appear

- Confirm the filename matches `image-0000.ext` with exactly four digits.
- Confirm the extension is supported.
- Confirm numbering begins at `0001` and has no gaps.
- Regenerate `copal/gallery-manifest.js`.
- Confirm the filename appears in the generated manifest.
- Hard-refresh or use a private window.

### A new folder does not appear as a section

Add its matching entry to `gallerySectionDefinitions` in `copal/script.js`, then
regenerate and preview. Folder discovery alone does not currently create the
visible section definition.

### The generator reports an expected filename

The folder contains a gap or starts at the wrong number. Rename its files to a
continuous sequence beginning with `image-0001`.

### The wrong image is used as the cover

Rename the intended cover to `image-0001` and renumber the other files.

### An image is rotated incorrectly

Apply the orientation during export instead of depending on EXIF orientation,
then replace the file and retest it in the browser.

### The image works locally but not in production

- Check filename capitalization; production paths are case-sensitive.
- Confirm the image was committed and pushed.
- Confirm `copal/gallery-manifest.js` contains the exact filename.
- Check the GitHub Actions and Pages deployment results.
- Hard-refresh after deployment.

### The modal count is wrong

Regenerate the manifest and confirm that the affected folder contains only the
intended consecutively numbered public images. Unsupported files are ignored.

## Rollback

If a gallery update causes a production problem, revert the gallery commit
through Git rather than manually editing the deployed site. Regenerate the
manifest after restoring the previous folder contents, validate, push the
rollback, and verify production again.

## Update record

For every gallery release, record in the pull request:

- Sections changed.
- Photos added, removed, replaced, or reordered.
- Whether a cover changed.
- Whether bilingual labels changed.
- Local validation completed.
- Production verification completed.
- Release version or tag, when applicable.

Keeping this record makes photo regressions and content rollbacks traceable.
