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

function publicStorageUrl(supabase, storagePath) {
  return supabase.storage.from("copal-gallery").getPublicUrl(storagePath).data.publicUrl;
}

async function loadGalleryManifest(supabase) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GALLERY_LOAD_TIMEOUT_MS);
  const query = supabase
    .from("gallery_photos")
    .select("id, section_slug, storage_path, legacy_path, display_order, alt_es, alt_en")
    .order("section_slug")
    .order("display_order")
    .order("created_at")
    .abortSignal(controller.signal);
  let result;
  try {
    result = await query;
  } finally {
    window.clearTimeout(timeoutId);
  }
  const { data, error } = result;
  if (error) throw error;

  const manifest = {};
  (data || []).forEach((photo) => {
    const source = photo.storage_path
      ? publicStorageUrl(supabase, photo.storage_path)
      : `./${photo.legacy_path}`;
    const image = {
      id: photo.id,
      src: source,
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
  const [{ createClient }, { default: config }] = await withTimeout(
    Promise.all([
      import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"),
      import("./config/environment.js"),
    ]),
    "Gallery dependencies timed out."
  );
  const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey);
  publishGalleryManifest(await loadGalleryManifest(supabase), "supabase");
} catch (error) {
  console.warn("Supabase gallery unavailable; gallery content is hidden.", error);
  publishGalleryManifest({}, "unavailable");
}
