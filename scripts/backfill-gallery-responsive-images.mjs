#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FULL_VARIANT = {
  maxEdge: 1800,
  minEdge: 1200,
  quality: 80,
  minQuality: 62,
  maxBytes: 500_000,
};
const THUMBNAIL_VARIANT = {
  maxEdge: 720,
  minEdge: 480,
  quality: 72,
  minQuality: 60,
  maxBytes: 100_000,
};
const TILE_VARIANT = {
  maxEdge: 480,
  minEdge: 320,
  quality: 68,
  minQuality: 56,
  maxBytes: 40_000,
};
const GALLERY_BUCKET = "copal-gallery";
const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const applyChanges = process.argv.includes("--apply");
const refreshAll = process.argv.includes("--refresh");
const refreshOversize = process.argv.includes("--oversize");

if ((refreshAll || refreshOversize) && !applyChanges) {
  throw new Error("--refresh and --oversize must be used together with --apply.");
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const copalRoot = path.join(repositoryRoot, "copal");
const galleryRoot = path.join(copalRoot, "assets", "gallery");

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required with --apply.`);
  return value.replace(/\/$/, "");
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    throw new Error(`${command} is required. Install ImageMagick and libwebp before running this script.`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function imageDimensions(sourcePath) {
  const output = run("magick", ["identify", "-format", "%w %h", sourcePath]);
  const [width, height] = output.split(/\s+/).map(Number);
  if (!(width > 0 && height > 0)) throw new Error(`Could not read dimensions for ${sourcePath}.`);
  return { width, height };
}

function boundedDimensions(width, height, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function createWebpVariant(sourcePath, destinationPath, sourceDimensions, options) {
  let edge = Math.min(options.maxEdge, Math.max(sourceDimensions.width, sourceDimensions.height));
  let quality = options.quality;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const dimensions = boundedDimensions(sourceDimensions.width, sourceDimensions.height, edge);
    run("cwebp", [
      "-quiet",
      "-mt",
      "-q",
      String(quality),
      "-resize",
      String(dimensions.width),
      String(dimensions.height),
      sourcePath,
      "-o",
      destinationPath,
    ]);
    const size = (await stat(destinationPath)).size;
    if (size <= options.maxBytes) return { ...dimensions, size, quality };

    if (quality - 6 >= options.minQuality) {
      quality -= 6;
      continue;
    }
    if (edge <= options.minEdge) break;
    edge = Math.max(options.minEdge, Math.round(edge * 0.84));
    quality = Math.max(options.minQuality, options.quality - 4);
  }
  throw new Error(
    `Could not reduce ${sourcePath} below ${Math.round(options.maxBytes / 1000)} KB.`
  );
}

async function localGalleryEntries() {
  const sectionNames = await readdir(galleryRoot);
  const entries = [];
  for (const sectionSlug of sectionNames.sort()) {
    const sectionPath = path.join(galleryRoot, sectionSlug);
    if (!(await stat(sectionPath)).isDirectory()) continue;
    const filenames = await readdir(sectionPath);
    for (const filename of filenames.sort()) {
      if (!SUPPORTED_EXTENSIONS.has(path.extname(filename).toLowerCase())) continue;
      entries.push({
        id: `${sectionSlug}-${path.parse(filename).name}`,
        section_slug: sectionSlug,
        legacy_path: path.posix.join("assets", "gallery", sectionSlug, filename),
      });
    }
  }
  return entries;
}

function encodedStoragePath(storagePath) {
  return storagePath.split("/").map(encodeURIComponent).join("/");
}

async function apiRequest(url, options, description) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`${description} failed (${response.status}): ${detail}`);
  }
  return response;
}

async function remoteGalleryEntries(supabaseUrl, serviceRoleKey) {
  const query = new URLSearchParams({
    select: "id,section_slug,storage_path,legacy_path,source_archive_path,thumbnail_storage_path,tile_storage_path,file_size_bytes,thumbnail_file_size_bytes,tile_file_size_bytes",
    order: "section_slug.asc,display_order.asc,created_at.asc",
  });
  if (refreshOversize) {
    query.set("or", "(file_size_bytes.gt.500000,thumbnail_file_size_bytes.gt.100000,tile_file_size_bytes.gt.40000)");
  } else if (!refreshAll) {
    query.set("or", "(thumbnail_storage_path.is.null,tile_storage_path.is.null)");
  }
  const response = await apiRequest(
    `${supabaseUrl}/rest/v1/gallery_photos?${query}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
    "Gallery catalog read"
  );
  return response.json();
}

async function downloadObject(supabaseUrl, serviceRoleKey, storagePath, destinationPath) {
  const response = await apiRequest(
    `${supabaseUrl}/storage/v1/object/${GALLERY_BUCKET}/${encodedStoragePath(storagePath)}`,
    {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
    `Storage download for ${storagePath}`
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destinationPath, buffer);
}

async function uploadObject(supabaseUrl, serviceRoleKey, storagePath, filePath) {
  await apiRequest(
    `${supabaseUrl}/storage/v1/object/${GALLERY_BUCKET}/${encodedStoragePath(storagePath)}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "image/webp",
        "Cache-Control": "max-age=31536000",
        "x-upsert": "true",
      },
      body: await readFile(filePath),
    },
    `Storage upload for ${storagePath}`
  );
}

async function removeObjects(supabaseUrl, serviceRoleKey, storagePaths) {
  if (!storagePaths.length) return;
  try {
    await apiRequest(
      `${supabaseUrl}/storage/v1/object/${GALLERY_BUCKET}`,
      {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prefixes: storagePaths }),
      },
      "Storage rollback"
    );
  } catch (error) {
    console.warn(`Warning: ${error.message}`);
  }
}

async function updateGalleryPhoto(supabaseUrl, serviceRoleKey, id, values) {
  const response = await apiRequest(
    `${supabaseUrl}/rest/v1/gallery_photos?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(values),
    },
    `Catalog update for ${id}`
  );
  const rows = await response.json();
  if (rows.length !== 1) throw new Error(`Catalog update for ${id} returned ${rows.length} rows.`);
}

function megabytes(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const supabaseUrl = applyChanges ? requiredEnvironment("SUPABASE_URL") : null;
const serviceRoleKey = applyChanges ? requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY") : null;
const entries = applyChanges
  ? await remoteGalleryEntries(supabaseUrl, serviceRoleKey)
  : await localGalleryEntries();

if (!entries.length) {
  console.log(applyChanges ? "No gallery rows remain to migrate." : "No local gallery images were found.");
  process.exit(0);
}

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "cebolletas-gallery-"));
let originalBytes = 0;
let fullBytes = 0;
let thumbnailBytes = 0;
let tileBytes = 0;
let largestFullBytes = 0;
let largestThumbnailBytes = 0;
let largestTileBytes = 0;
let completed = 0;

try {
  for (const [index, entry] of entries.entries()) {
    let sourcePath;
    const archivePath = entry.legacy_path || entry.source_archive_path;
    if (archivePath) {
      const originalSourcePath = path.resolve(copalRoot, archivePath);
      sourcePath = path.join(temporaryDirectory, `${entry.id}-oriented.png`);
      if (!originalSourcePath.startsWith(`${galleryRoot}${path.sep}`)) {
        throw new Error(`Unsafe source archive path: ${archivePath}`);
      }
      run("magick", [originalSourcePath, "-auto-orient", "-strip", sourcePath]);
    } else if (applyChanges && entry.storage_path) {
      sourcePath = path.join(temporaryDirectory, `${entry.id}-source.webp`);
      await downloadObject(supabaseUrl, serviceRoleKey, entry.storage_path, sourcePath);
    } else {
      throw new Error(`Gallery row ${entry.id} has no usable source.`);
    }
    let sourceBytes;
    if (archivePath) {
      const originalSourcePath = path.resolve(copalRoot, archivePath);
      sourceBytes = (await stat(originalSourcePath)).size;
    } else {
      sourceBytes = (await stat(sourcePath)).size;
    }
    const sourceStat = await stat(sourcePath);
    const sourceDimensions = imageDimensions(sourcePath);
    const fullPath = path.join(temporaryDirectory, `${entry.id}-full.webp`);
    const thumbnailPath = path.join(temporaryDirectory, `${entry.id}-thumbnail.webp`);
    const tilePath = path.join(temporaryDirectory, `${entry.id}-tile.webp`);
    const encodeFullImage = Boolean(archivePath || refreshAll || refreshOversize);
    const fullVariant = encodeFullImage
      ? await createWebpVariant(sourcePath, fullPath, sourceDimensions, FULL_VARIANT)
      : { ...sourceDimensions, size: sourceStat.size };
    const thumbnailVariant = await createWebpVariant(
      sourcePath,
      thumbnailPath,
      sourceDimensions,
      THUMBNAIL_VARIANT
    );
    const tileVariant = await createWebpVariant(
      sourcePath,
      tilePath,
      sourceDimensions,
      TILE_VARIANT
    );

    originalBytes += sourceBytes;
    fullBytes += fullVariant.size;
    thumbnailBytes += thumbnailVariant.size;
    tileBytes += tileVariant.size;
    largestFullBytes = Math.max(largestFullBytes, fullVariant.size);
    largestThumbnailBytes = Math.max(largestThumbnailBytes, thumbnailVariant.size);
    largestTileBytes = Math.max(largestTileBytes, tileVariant.size);

    if (applyChanges) {
      const fullStoragePath = entry.storage_path || `full/${entry.section_slug}/${entry.id}.webp`;
      const thumbnailStoragePath = entry.thumbnail_storage_path
        || `thumbnail/${entry.section_slug}/${entry.id}.webp`;
      const tileStoragePath = entry.tile_storage_path
        || `tile/${entry.section_slug}/${entry.id}.webp`;
      const rollbackPaths = [];
      try {
        if (encodeFullImage) {
          await uploadObject(supabaseUrl, serviceRoleKey, fullStoragePath, fullPath);
          if (!entry.storage_path) rollbackPaths.push(fullStoragePath);
        }
        await uploadObject(supabaseUrl, serviceRoleKey, thumbnailStoragePath, thumbnailPath);
        if (!entry.thumbnail_storage_path) rollbackPaths.push(thumbnailStoragePath);
        await uploadObject(supabaseUrl, serviceRoleKey, tileStoragePath, tilePath);
        if (!entry.tile_storage_path) rollbackPaths.push(tileStoragePath);
        const update = {
          thumbnail_storage_path: thumbnailStoragePath,
          thumbnail_width_px: thumbnailVariant.width,
          thumbnail_height_px: thumbnailVariant.height,
          thumbnail_file_size_bytes: thumbnailVariant.size,
          tile_storage_path: tileStoragePath,
          tile_width_px: tileVariant.width,
          tile_height_px: tileVariant.height,
          tile_file_size_bytes: tileVariant.size,
        };
        if (encodeFullImage) {
          Object.assign(update, {
            storage_path: fullStoragePath,
            width_px: fullVariant.width,
            height_px: fullVariant.height,
            file_size_bytes: fullVariant.size,
          });
        }
        if (entry.legacy_path) {
          update.source_archive_path = entry.legacy_path;
          update.legacy_path = null;
        }
        await updateGalleryPhoto(supabaseUrl, serviceRoleKey, entry.id, update);
      } catch (error) {
        await removeObjects(supabaseUrl, serviceRoleKey, rollbackPaths);
        throw error;
      }
    }

    completed += 1;
    console.log(
      `[${index + 1}/${entries.length}] ${archivePath || entry.storage_path}: ${megabytes(sourceBytes)} -> `
      + `${megabytes(fullVariant.size)} full + ${megabytes(thumbnailVariant.size)} thumbnail + ${megabytes(tileVariant.size)} tile`
    );
  }
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

const optimizedBytes = fullBytes + thumbnailBytes + tileBytes;
const reduction = originalBytes ? Math.round((1 - optimizedBytes / originalBytes) * 100) : 0;
const fullReduction = originalBytes ? Math.round((1 - fullBytes / originalBytes) * 100) : 0;
console.log("");
console.log(`${applyChanges ? "Migrated" : "Validated"} ${completed} gallery photos.`);
console.log(`Original assets: ${megabytes(originalBytes)}`);
console.log(`Responsive assets: ${megabytes(fullBytes)} full + ${megabytes(thumbnailBytes)} thumbnails + ${megabytes(tileBytes)} tiles`);
console.log(`Largest modal image: ${Math.round(largestFullBytes / 1000)} KB`);
console.log(`Largest thumbnail: ${Math.round(largestThumbnailBytes / 1000)} KB`);
console.log(`Largest landing tile: ${Math.round(largestTileBytes / 1000)} KB`);
console.log(
  refreshAll || refreshOversize
    ? `Full-image reduction for refreshed rows: ${fullReduction}%`
    : `Combined transfer-size reduction: ${reduction}%`
);
if (!applyChanges) {
  console.log("Dry run only. Apply the database migration, then rerun with --apply and Supabase credentials.");
}
