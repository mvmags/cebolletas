const GALLERY_LOAD_TIMEOUT_MS = 6000;

function withTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(message)), GALLERY_LOAD_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

function publishGalleryManifest(manifest, source) {
  window.galleryImageManifest = manifest;
  document.documentElement.dataset.gallerySource = source;
  window.dispatchEvent(new CustomEvent("gallery:manifest-loaded"));
}

function publicStorageUrl(config, storagePath, updatedAt) {
  const encodedPath = storagePath.split("/").map(encodeURIComponent).join("/");
  const version = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
  return `${config.supabaseUrl}/storage/v1/object/public/copal-gallery/${encodedPath}${version}`;
}

async function loadGalleryManifest(config) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GALLERY_LOAD_TIMEOUT_MS);
  const query = new URLSearchParams({
    select: "id,section_slug,storage_path,thumbnail_storage_path,tile_storage_path,legacy_path,display_order,alt_es,alt_en,width_px,height_px,thumbnail_width_px,thumbnail_height_px,tile_width_px,tile_height_px,updated_at",
    order: "section_slug.asc,display_order.asc,created_at.asc",
  });
  let response;
  try {
    response = await fetch(`${config.supabaseUrl}/rest/v1/gallery_photos?${query}`, {
      headers: {
        apikey: config.supabasePublishableKey,
        Authorization: `Bearer ${config.supabasePublishableKey}`,
      },
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!response.ok) throw new Error(`Gallery catalog request failed (${response.status}).`);
  const data = await response.json();

  const manifest = {};
  (data || []).forEach((photo) => {
    const source = photo.storage_path
      ? publicStorageUrl(config, photo.storage_path, photo.updated_at)
      : `./${photo.legacy_path}`;
    const thumbnailSource = photo.thumbnail_storage_path
      ? publicStorageUrl(config, photo.thumbnail_storage_path, photo.updated_at)
      : source;
    const tileSource = photo.tile_storage_path
      ? publicStorageUrl(config, photo.tile_storage_path, photo.updated_at)
      : thumbnailSource;
    const image = {
      id: photo.id,
      src: source,
      thumbnailSrc: thumbnailSource,
      tileSrc: tileSource,
      width: photo.width_px,
      height: photo.height_px,
      thumbnailWidth: photo.thumbnail_width_px || photo.width_px,
      thumbnailHeight: photo.thumbnail_height_px || photo.height_px,
      tileWidth: photo.tile_width_px || photo.thumbnail_width_px || photo.width_px,
      tileHeight: photo.tile_height_px || photo.thumbnail_height_px || photo.height_px,
      alt: {
        es: photo.alt_es || "",
        en: photo.alt_en || "",
      },
    };
    (manifest[photo.section_slug] ||= []).push(image);
  });
  return manifest;
}

document.documentElement.dataset.gallerySource = "loading";
try {
  const { default: config } = await withTimeout(
    import("./config/environment.js"),
    "Gallery dependencies timed out."
  );
  publishGalleryManifest(await loadGalleryManifest(config), "supabase");
} catch (error) {
  console.warn("Supabase gallery unavailable; gallery content is hidden.", error);
  publishGalleryManifest({}, "unavailable");
}
