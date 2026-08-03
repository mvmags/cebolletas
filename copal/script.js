const copy = {
  es: {
    eyebrow: "Glamping en Calvillo \u00b7 Aguascalientes, M\u00e9xico",
    title: "Descansa entre<br>\u00e1rboles,<br>senderos y cielo<br>abierto.",
    nav: { home: "Inicio", place: "El lugar", gallery: "Galer\u00eda", booking: "Reserva" },
    parent: "Es parte del desarrollo particular Cebolletas.",
    menu: "Abrir men\u00fa",
    placeEyebrow: "El lugar",
    placeTitle: "Lo esencial para disfrutar la naturaleza.",
    placeIntro: "Un espacio privado pensado para descansar, cocinar, convivir y explorar el entorno de Cebolletas con comodidad.",
    amenityGroups: [
      ["Entorno y aventura", "Puentes colgantes", "Senderos", "Vistas espectaculares", "\u00c1rea reservada", "Fogatero"],
      ["Descanso y convivencia", "Sof\u00e1 cama", "Rec\u00e1mara con cl\u00f3set", "Juegos de mesa", "Asador", "Mesas tipo picnic"],
      ["Comodidades", "Regadera caliente", "Cocina equipada", "Tetera, t\u00e9 y caf\u00e9", "Estacionamiento"]
    ],
    galleryEyebrow: "Galer\u00eda", galleryTitle: "Conoce cada rinc\u00f3n.",
    galleryIntro: "Im\u00e1genes temporales para definir la estructura de la galer\u00eda. Pr\u00f3ximamente ser\u00e1n reemplazadas por la sesi\u00f3n fotogr\u00e1fica final.",
    photoTour: "Recorrido fotogr\u00e1fico", temporary: "Fotograf\u00eda temporal",
    openAlbum: "Abrir galer\u00eda",
    closeAlbum: "Cerrar galer\u00eda",
    previousPhoto: "Fotograf\u00eda anterior",
    nextPhoto: "Fotograf\u00eda siguiente",
    albumSize: count => `${count} ${count === 1 ? "fotograf\u00eda" : "fotograf\u00edas"}`,
    bookingEyebrow: "Reserva", bookingTitle: "Cu\u00e9ntanos sobre tu visita.",
    bookingText: "Comparte tus datos y el plan que tienes en mente. Te contactaremos para revisar disponibilidad y ayudarte a preparar tu estancia.",
    fields: {
      checkin: "Fecha llegada",
      checkout: "Fecha salida",
      nights: "Noches",
      weekendNights: "Noches de fin de semana",
      weekdayNights: "Noches entre semana",
      adults: "Adultos",
      kids: "Ni\u00f1os",
      infants: "Menores de 3 a\u00f1os",
      name: "Nombre",
      email: "Email",
      cell: "Celular",
      otherDetails: "Preguntas o informaci\u00f3n adicional"
    },
    requestedInfo: "Selecciona un servicio",
    servicesLoading: "Cargando servicios disponibles\u2026",
    action: "Solicitar Informaci\u00f3n/Reservar",
    note: "Al continuar, guardaremos tu solicitud y te mostraremos el ID para dar seguimiento. Nos pondremos en contacto contigo a la brevedad."
  },
  en: {
    eyebrow: "Glamping in Calvillo \u00b7 Aguascalientes, Mexico",
    title: "Rest among<br>trees,<br>trails and open<br>skies.",
    nav: { home: "Home", place: "The place", gallery: "Gallery", booking: "Book" },
    parent: "Part of the private Cebolletas development.",
    menu: "Open menu",
    placeEyebrow: "The place", placeTitle: "Everything you need to enjoy nature.",
    placeIntro: "A private space designed for resting, cooking, sharing and exploring the Cebolletas landscape in comfort.",
    amenityGroups: [
      ["Nature and adventure", "Suspension bridges", "Trails", "Scenic views", "Private area", "Fire pit"],
      ["Rest and gathering", "Sofa bed", "Bedroom with closet", "Board games", "Grill", "Picnic tables"],
      ["Comforts", "Hot shower", "Equipped kitchen", "Kettle, tea and coffee", "Parking"]
    ],
    galleryEyebrow: "Gallery", galleryTitle: "Explore every corner.",
    galleryIntro: "Temporary images used to define the gallery structure. They will be replaced by the final photo session.",
    photoTour: "Photo tour", temporary: "Temporary photograph",
    openAlbum: "Open gallery",
    closeAlbum: "Close gallery",
    previousPhoto: "Previous photograph",
    nextPhoto: "Next photograph",
    albumSize: count => `${count} ${count === 1 ? "photograph" : "photographs"}`,
    bookingEyebrow: "Booking", bookingTitle: "Tell us about your visit.",
    bookingText: "Share your details and the experience you have in mind. We will contact you to review availability and help prepare your stay.",
    fields: {
      checkin: "Check-in",
      checkout: "Checkout",
      nights: "Nights",
      weekendNights: "Weekend nights",
      weekdayNights: "Weekday nights",
      adults: "Adults",
      kids: "Kids",
      infants: "Children under 3",
      name: "Name",
      email: "Email",
      cell: "Cellphone",
      otherDetails: "Questions or additional information"
    },
    requestedInfo: "Select one service",
    servicesLoading: "Loading available services\u2026",
    action: "Request Information/Book",
    note: "Continuing will save your request and display its ID for follow-up. We will contact you shortly."
  }
};

const gallerySectionDefinitions = [
{
    folder: "terrace",
    labels: { es: "Terraza", en: "Terrace" }
  },
  {
    folder: "landscape",
    labels: { es: "El paisaje", en: "The landscape" }
  },
  {
    folder: "interior",
    labels: { es: "Interior", en: "Interior" }
  },
  {
    folder: "bathroom",
    labels: { es: "Ba\u00F1o", en: "Ba\u00F1o" }
  },
  {
    folder: "bedroom",
    labels: { es: "Rec\u00e1mara", en: "Bedroom" }
  },
  {
      folder: "fire-pit",
      labels: { es: "Fogata", en: "Fire Pit" }
    }
];

const gallerySections = gallerySectionDefinitions.map(section => ({
  ...section,
  images: window.galleryImageManifest?.[section.folder] || []
})).filter(section => section.images.length > 0);

let lang = "es";
let activeView = "home";
let sectionObserver;
let activePhoto = 0;
let activeAlbumPhoto = 0;
let galleryReturnFocus = null;
let galleryTouchStartX = null;
const region = document.querySelector(".content-region");
const nav = document.querySelector("nav");
const menuButton = document.querySelector(".menu-button");

function renderNav() {
  const t = copy[lang];
  menuButton.setAttribute("aria-label", t.menu);
  nav.innerHTML = Object.entries(t.nav).map(([key, label]) =>
    `<a href="#${key}" data-view="${key}" class="${activeView === key ? "active" : ""}" ${activeView === key ? 'aria-current="page"' : ""}>${label}</a>`
  ).join("");
}

function setActiveView(nextView) {
  if (!copy[lang].nav[nextView] || nextView === activeView) return;
  activeView = nextView;
  nav.querySelectorAll("[data-view]").forEach(link => {
    const active = link.dataset.view === activeView;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function sectionFromHash() {
  const value = window.location.hash.slice(1);
  return copy[lang].nav[value] ? value : "home";
}

function scrollToSection(section, behavior = "smooth") {
  const target = region.querySelector(`#${section}`);
  if (!target) return;

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  target.scrollIntoView({
    behavior: reducedMotion ? "auto" : behavior,
    block: "start",
  });
}

function observeSections() {
  sectionObserver?.disconnect();
  const sections = region.querySelectorAll(":scope > [id]");
  sectionObserver = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    setActiveView(visible.target.id);
    const nextHash = `#${visible.target.id}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
  }, {
    root: region,
    rootMargin: "-20% 0px -55% 0px",
    threshold: [0, 0.1, 0.25, 0.5]
  });
  sections.forEach(section => sectionObserver.observe(section));
}

function home(t) {
  return `<div class="hero-frame" id="home"><section class="hero" aria-labelledby="hero-title">
    <img src="./assets/copal-hero.webp" alt="Cebolletas Copal y su entorno natural">
    <div class="hero-overlay"></div>
    <div class="hero-copy"><p>${t.eyebrow}</p><h1 id="hero-title">${t.title}</h1></div>
    <div class="hero-identity"><img src="./assets/logo-copal.png" alt="Cebolletas Copal"><p>${t.parent}</p></div>
  </section></div>`;
}

function place(t) {
  const groups = t.amenityGroups.map((group, i) => `<article class="amenity-group">
    <div class="group-heading"><span>0${i + 1}</span><h3>${group[0]}</h3></div>
    <ul>${group.slice(1).map(item => `<li>${item}</li>`).join("")}</ul>
  </article>`).join("");
  return `<section class="place-section" id="place" aria-labelledby="place-title">
    <div class="place-intro"><p class="section-label">${t.placeEyebrow}</p><h2 id="place-title">${t.placeTitle}</h2><p class="place-description">${t.placeIntro}</p></div>
    <div class="amenity-groups">${groups}</div>
  </section>`;
}

function gallery(t) {
  const thumbs = gallerySections.map((section, i) => `<button type="button" data-photo="${i}" class="${i === activePhoto ? "active" : ""}">
    <img src="${galleryImagePath(section, 0)}" alt=""><span>${section.labels[lang]}</span>
  </button>`).join("");
  const section = gallerySections[activePhoto];
  const sectionLabel = section.labels[lang];
  return `<section class="gallery-section" id="gallery" aria-labelledby="gallery-title">
    <div class="gallery-heading"><div><p class="section-label">${t.galleryEyebrow}</p><h2 id="gallery-title">${t.galleryTitle}</h2></div><p>${t.galleryIntro}</p></div>
    <div class="photo-tour"><h3>${t.photoTour}</h3><div class="thumbnail-strip">${thumbs}</div></div>
    <div class="gallery-feature"><div class="feature-caption"><p>${gallerySectionCounter()}</p><h3>${sectionLabel}</h3><span>${t.albumSize(section.images.length)}</span></div>
    <figure><button class="gallery-feature-button" type="button" data-open-gallery aria-label="${t.openAlbum}: ${sectionLabel}"><img src="${galleryImagePath(section, 0)}" alt="${sectionLabel}"></button></figure></div>
    ${galleryLightbox(t, section)}
  </section>`;
}

function galleryImagePath(section, imageIndex) {
  return `./assets/gallery/${section.folder}/${section.images[imageIndex]}`;
}

function gallerySectionCounter() {
  return `${String(activePhoto + 1).padStart(2, "0")} / ${String(gallerySections.length).padStart(2, "0")}`;
}

function galleryLightbox(t, section) {
  const label = section.labels[lang];
  return `<div class="gallery-lightbox" data-gallery-lightbox role="dialog" aria-modal="true" aria-labelledby="gallery-lightbox-title" hidden>
    <div class="gallery-lightbox-backdrop" data-close-gallery></div>
    <div class="gallery-lightbox-panel">
      <header class="gallery-lightbox-header"><div><h2 id="gallery-lightbox-title">${label}</h2><p data-gallery-count>01 / ${String(section.images.length).padStart(2, "0")}</p></div><button type="button" data-close-gallery aria-label="${t.closeAlbum}">×</button></header>
      <div class="gallery-lightbox-stage">
        <button class="gallery-lightbox-nav previous" type="button" data-gallery-previous aria-label="${t.previousPhoto}">‹</button>
        <figure><img data-gallery-image src="${galleryImagePath(section, 0)}" alt="${label}"></figure>
        <button class="gallery-lightbox-nav next" type="button" data-gallery-next aria-label="${t.nextPhoto}">›</button>
      </div>
    </div>
  </div>`;
}

function booking(t) {
  return `<section class="booking-section" id="booking" aria-labelledby="booking-title">
    <div class="booking-intro"><p class="section-label">${t.bookingEyebrow}</p><h2 id="booking-title">${t.bookingTitle}</h2><p>${t.bookingText}</p></div>
    <form class="booking-form" id="reserva-form" novalidate>
      <fieldset class="service-options full-field" id="br-service-options">
        <legend>${t.requestedInfo}</legend>
        <p class="service-loading">${t.servicesLoading}</p>
      </fieldset>
      <label><span>${t.fields.checkin}</span><input id="br-checkin" name="checkin" type="date" required></label>
      <label><span>${t.fields.checkout}</span><input id="br-checkout" name="checkout" type="date" required></label>
      <div class="stay-summary full-field" id="br-stay-summary" aria-live="polite" hidden>
        <div><span>${t.fields.nights}</span><strong id="br-nights">0</strong></div>
        <div><span>${t.fields.weekendNights}</span><strong id="br-weekend-nights">0</strong></div>
        <div><span>${t.fields.weekdayNights}</span><strong id="br-weekday-nights">0</strong></div>
      </div>
      <label><span>${t.fields.adults}</span><input id="br-adults" name="adults" type="number" min="1" max="20" step="1" value="1" inputmode="numeric" required></label>
      <label><span>${t.fields.kids}</span><input id="br-kids" name="kids" type="number" min="0" max="20" step="1" value="0" inputmode="numeric" required></label>
      <label class="full-field"><span>${t.fields.infants}</span><input id="br-infants" name="infants" type="number" min="0" max="20" step="1" value="0" inputmode="numeric" required></label>
      <label><span>${t.fields.name}</span><input id="br-name" name="name" type="text" placeholder="${t.fields.name}" autocomplete="name" minlength="5" maxlength="100" required></label>
      <label><span>${t.fields.email}</span><input id="br-email" name="email" type="email" placeholder="${t.fields.email}" autocomplete="email" maxlength="254" required></label>
      <label class="full-field"><span>${t.fields.cell}</span><input id="br-cell" name="cell" type="tel" placeholder="${t.fields.cell}" autocomplete="tel" inputmode="tel" maxlength="25" required></label>
      <aside class="quote-summary full-field" id="br-quote-summary" aria-live="polite">
        <p class="quote-summary-placeholder">Selecciona un servicio, fechas y hu\u00e9spedes para ver el total estimado.</p>
      </aside>
      <label class="other-details full-field"><span>${t.fields.otherDetails}</span><textarea id="br-other-details" name="otherDetails" rows="4" maxlength="1000" placeholder="${t.fields.otherDetails}"></textarea></label>
      <div class="booking-actions full-field">
        <button type="button" id="br-request-info">${t.action}</button>
      </div>
      <div class="booking-intro"><p>${t.note}</p></div>
    </form>
  </section>`;
}

function render() {
  const t = copy[lang];
  const requestedSection = sectionFromHash();
  activeView = requestedSection;
  renderNav();
  region.className = "content-region continuous-view";
  region.innerHTML = home(t) + place(t) + gallery(t) + booking(t);
  document.dispatchEvent(new CustomEvent("reserva:rendered"));
  observeSections();
  requestAnimationFrame(() => scrollToSection(requestedSection, "auto"));
}

function updateGallery() {
  const section = gallerySections[activePhoto];
  const sectionLabel = section.labels[lang];
  region.querySelectorAll("[data-photo]").forEach((button, index) => {
    button.classList.toggle("active", index === activePhoto);
  });
  const counter = region.querySelector(".feature-caption p");
  const title = region.querySelector(".feature-caption h3");
  const albumSize = region.querySelector(".feature-caption span");
  const openButton = region.querySelector("[data-open-gallery]");
  const lightboxTitle = region.querySelector("#gallery-lightbox-title");
  const image = region.querySelector(".gallery-feature figure img");
  if (counter) counter.textContent = gallerySectionCounter();
  if (title) title.textContent = sectionLabel;
  if (albumSize) albumSize.textContent = copy[lang].albumSize(section.images.length);
  if (openButton) openButton.setAttribute("aria-label", `${copy[lang].openAlbum}: ${sectionLabel}`);
  if (lightboxTitle) lightboxTitle.textContent = sectionLabel;
  if (image) {
    image.src = galleryImagePath(section, 0);
    image.alt = sectionLabel;
  }
}

function openGallery(trigger) {
  const lightbox = region.querySelector("[data-gallery-lightbox]");
  if (!lightbox) return;
  activeAlbumPhoto = 0;
  galleryReturnFocus = trigger;
  updateLightbox();
  lightbox.hidden = false;
  document.body.classList.add("gallery-open");
  lightbox.querySelector("[data-close-gallery]")?.focus();
}

function closeGallery() {
  const lightbox = region.querySelector("[data-gallery-lightbox]");
  if (!lightbox || lightbox.hidden) return;
  lightbox.hidden = true;
  document.body.classList.remove("gallery-open");
  galleryReturnFocus?.focus();
  galleryReturnFocus = null;
}

function moveGalleryPhoto(direction) {
  const imageCount = gallerySections[activePhoto].images.length;
  activeAlbumPhoto = (activeAlbumPhoto + direction + imageCount) % imageCount;
  updateLightbox();
}

function updateLightbox() {
  const section = gallerySections[activePhoto];
  const image = region.querySelector("[data-gallery-image]");
  const counter = region.querySelector("[data-gallery-count]");
  const multiplePhotos = section.images.length > 1;
  if (image) {
    image.src = galleryImagePath(section, activeAlbumPhoto);
    image.alt = `${section.labels[lang]} — ${activeAlbumPhoto + 1}`;
  }
  if (counter) counter.textContent = `${String(activeAlbumPhoto + 1).padStart(2, "0")} / ${String(section.images.length).padStart(2, "0")}`;
  region.querySelectorAll("[data-gallery-previous], [data-gallery-next]").forEach(button => {
    button.hidden = !multiplePhotos;
  });
  if (multiplePhotos) {
    const nextIndex = (activeAlbumPhoto + 1) % section.images.length;
    new Image().src = galleryImagePath(section, nextIndex);
  }
}

menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", event => {
  const link = event.target.closest("[data-view]");
  if (!link) return;
  event.preventDefault();
  const nextView = link.dataset.view;
  setActiveView(nextView);
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  history.pushState(null, "", `#${nextView}`);
  scrollToSection(nextView);
});

document.querySelector(".language").addEventListener("click", event => {
  const button = event.target.closest("[data-lang]");
  if (!button) return;
  const preservedSection = activeView;
  lang = button.dataset.lang;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang]").forEach(el => el.classList.toggle("active", el.dataset.lang === lang));
  history.replaceState(null, "", `#${preservedSection}`);
  render();
});

region.addEventListener("click", event => {
  const button = event.target.closest("[data-photo]");
  if (button) {
    activePhoto = Number(button.dataset.photo);
    activeAlbumPhoto = 0;
    updateGallery();
    return;
  }

  const openButton = event.target.closest("[data-open-gallery]");
  if (openButton) {
    openGallery(openButton);
    return;
  }

  if (event.target.closest("[data-close-gallery]")) closeGallery();
  else if (event.target.closest("[data-gallery-previous]")) moveGalleryPhoto(-1);
  else if (event.target.closest("[data-gallery-next]")) moveGalleryPhoto(1);
});

region.addEventListener("touchstart", event => {
  if (!event.target.closest("[data-gallery-lightbox]")) return;
  galleryTouchStartX = event.changedTouches[0]?.clientX ?? null;
}, { passive: true });

region.addEventListener("touchend", event => {
  if (galleryTouchStartX === null || !event.target.closest("[data-gallery-lightbox]")) return;
  const distance = (event.changedTouches[0]?.clientX ?? galleryTouchStartX) - galleryTouchStartX;
  galleryTouchStartX = null;
  if (Math.abs(distance) < 50 || gallerySections[activePhoto].images.length < 2) return;
  moveGalleryPhoto(distance > 0 ? -1 : 1);
}, { passive: true });

document.addEventListener("keydown", event => {
  const lightbox = region.querySelector("[data-gallery-lightbox]");
  if (!lightbox || lightbox.hidden) return;
  if (event.key === "Escape") closeGallery();
  else if (event.key === "ArrowLeft") moveGalleryPhoto(-1);
  else if (event.key === "ArrowRight") moveGalleryPhoto(1);
});

window.addEventListener("hashchange", () => {
  const nextView = sectionFromHash();
  setActiveView(nextView);
  scrollToSection(nextView);
});

render();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    document.dispatchEvent(new CustomEvent("reserva:rendered"));
  }, { once: true });
}
