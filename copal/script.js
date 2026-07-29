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
    action: "Solicitar Informaci\u00f3n",
    note: "Al continuar, guardaremos tu solicitud y se abrir\u00e1n WhatsApp (+52 449 102 8878) y tu aplicaci\u00f3n de correo con la informaci\u00f3n preparada. T\u00fa confirmar\u00e1s cada env\u00edo."
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
    action: "Request info",
    note: "Continuing will save your request and open WhatsApp and your email application with the prepared information. You will confirm each send."
  }
};

const photos = [
  ["interior-1.jpeg", "Interior", "Interior"],
  ["interior-2.jpeg", "\u00c1rea de descanso", "Resting area"],
  ["interior-3.jpeg", "Rec\u00e1mara", "Bedroom"],
  ["terraza-1.jpeg", "Terraza", "Terrace"],
  ["terraza-2.jpeg", "Vista exterior", "Outdoor view"],
  ["paisaje.jpeg", "El paisaje", "The landscape"]
];

let lang = "es";
let activeView = "home";
let sectionObserver;
let activePhoto = 0;
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
  const thumbs = photos.map((p, i) => `<button type="button" data-photo="${i}" class="${i === activePhoto ? "active" : ""}">
    <img src="./assets/${p[0]}" alt=""><span>${p[lang === "es" ? 1 : 2]}</span>
  </button>`).join("");
  const p = photos[activePhoto];
  return `<section class="gallery-section" id="gallery" aria-labelledby="gallery-title">
    <div class="gallery-heading"><div><p class="section-label">${t.galleryEyebrow}</p><h2 id="gallery-title">${t.galleryTitle}</h2></div><p>${t.galleryIntro}</p></div>
    <div class="photo-tour"><h3>${t.photoTour}</h3><div class="thumbnail-strip">${thumbs}</div></div>
    <div class="gallery-feature"><div class="feature-caption"><p>${String(activePhoto + 1).padStart(2, "0")} / 06</p><h3>${p[lang === "es" ? 1 : 2]}</h3><span>${t.temporary}</span></div>
    <figure><img src="./assets/${p[0]}" alt="${p[lang === "es" ? 1 : 2]}"></figure></div>
  </section>`;
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
  const p = photos[activePhoto];
  region.querySelectorAll("[data-photo]").forEach((button, index) => {
    button.classList.toggle("active", index === activePhoto);
  });
  const counter = region.querySelector(".feature-caption p");
  const title = region.querySelector(".feature-caption h3");
  const image = region.querySelector(".gallery-feature figure img");
  if (counter) counter.textContent = `${String(activePhoto + 1).padStart(2, "0")} / 06`;
  if (title) title.textContent = p[lang === "es" ? 1 : 2];
  if (image) {
    image.src = `./assets/${p[0]}`;
    image.alt = p[lang === "es" ? 1 : 2];
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
  if (!button) return;
  activePhoto = Number(button.dataset.photo);
  updateGallery();
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
