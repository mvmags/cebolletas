import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import config from "./config/environment.js";

const fallbackManifest = window.galleryImageManifest || {};
const supabase = createClient(config.supabaseUrl, config.supabasePublishableKey);

function publicStorageUrl(storagePath) {
  return supabase.storage.from("copal-gallery").getPublicUrl(storagePath).data.publicUrl;
}

async function loadGalleryManifest() {
  const { data, error } = await supabase
    .from("gallery_photos")
    .select("id, section_slug, storage_path, legacy_path, display_order, alt_es, alt_en")
    .order("section_slug")
    .order("display_order")
    .order("created_at");

  if (error) throw error;

  const manifest = {};
  (data || []).forEach((photo) => {
    const source = photo.storage_path
      ? publicStorageUrl(photo.storage_path)
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

  window.galleryImageManifest = manifest;
  document.documentElement.dataset.gallerySource = "supabase";
}

try {
  await loadGalleryManifest();
} catch (error) {
  console.warn("Supabase gallery unavailable; using the bundled gallery.", error);
  window.galleryImageManifest = fallbackManifest;
  document.documentElement.dataset.gallerySource = "bundled";
}

await import("./script.js?v=10.5.0-1");
