# Cebolletas Copal gallery

The public gallery keeps six visible sections. Each section owns a folder under:

```text
copal/assets/gallery/
├── interior/
├── rest-area/
├── bedroom/
├── terrace/
├── outdoor-view/
└── landscape/
```

Each folder contains files named with this pattern:

```text
image-0001.jpeg
image-0002.jpeg
image-0003.webp
```

`image-0001` is the section cover used by the thumbnail strip and the large
feature image. The extension may be `.jpg`, `.jpeg`, `.png`, `.webp`, or
`.avif`, but lowercase extensions are recommended.

## Add a photograph

1. Copy the optimized image into the appropriate section folder.
2. Name it with the next four-digit consecutive number.
3. Commit and push the image.

The GitHub workflow runs `scripts/generate-gallery-manifest.mjs` and updates
`copal/gallery-manifest.js` automatically. There is no image array to edit by
hand. GitHub Pages remains a static site; folder discovery happens in the
repository workflow before the site is served.

To preview locally before pushing, regenerate the manifest once:

```bash
node scripts/generate-gallery-manifest.mjs
```

## Remove or reorder photographs

- To remove a photograph, delete the file.
- To change the viewing order, rename the numbered files.
- Keep numbering consecutive, beginning at `image-0001`.
- Do not use the same number twice in one section, even with different
  extensions.
- Every section must contain at least one valid image.

## Viewer behavior

- Selecting a thumbnail changes the active gallery section.
- Selecting the large feature image opens that section's viewer.
- The viewer supports its previous/next buttons, keyboard arrow keys, `Escape`
  to close, and horizontal swipe gestures on touch screens.
- Sections with one photograph open normally but hide previous/next controls.
- Labels and accessibility text follow the selected Spanish or English locale.

## Image preparation

For reasonable load times, use web-ready images rather than full camera files:

- Long edge: approximately 1600 to 2200 pixels.
- JPEG quality: approximately 75 to 85, or equivalent WebP quality.
- Use lowercase filenames without spaces or accented characters.
- Remove location metadata when it should not be public.
