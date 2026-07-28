const copy = {
  es: {
    eyebrow: "Glamping en Calvillo · Aguascalientes, México",
    title: "Descansa entre<br>árboles,<br>senderos y cielo<br>abierto.",
    nav: { home: "Inicio", place: "El lugar", gallery: "Galería", booking: "Reserva" },
    parent: "Es parte del desarrollo particular Cebolletas.",
    menu: "Abrir menú",
    placeEyebrow: "El lugar",
    placeTitle: "Lo esencial para disfrutar la naturaleza.",
    placeIntro: "Un espacio privado pensado para descansar, convivir y explorar el entorno de Cebolletas con comodidad.",
    amenityGroups: [
      ["Entorno y aventura", "Puentes colgantes", "Senderos", "Vistas espectaculares", "Área reservada", "Fogatero"],
      ["Descanso y convivencia", "Sofá cama", "Recámara con clóset", "Juegos de mesa", "Asador", "Mesas tipo picnic"],
      ["Comodidades", "Regadera caliente", "Cocina equipada", "Tetera, té y café", "Estacionamiento"]
    ],
    galleryEyebrow: "Galería", galleryTitle: "Conoce cada rincón.",
    galleryIntro: "Próximamente serán reemplazadas por la sesión fotográfica final.",
    photoTour: "Recorrido fotográfico", temporary: "",
    bookingEyebrow: "Reserva", bookingTitle: "Cuéntanos sobre tu visita.",
    bookingText: "Comparte tus datos y el plan que tienes en mente para revisar disponibilidad y ayudarte a preparar tu estancia.",
    fields: ["Nombre", "Email", "Celular", "Mensaje"],
    fieldsWithIds: [{label: "Nombre", id: "br-name"}, {label: "Email", id: "br-email"}, {label: "Celular", id: "br-cell"}, {label: "Mensaje", id: "br-msg"}],
    options: ["Hospedar en Copal", "Campamento", "Otro"],
    requestTypes: ["Envíame información a mi contacto", "Enviar mensaje"],
    actions: ["Solicitar", "Enviar"],
    note: "DESARROLLO EN PROGRESO... Se habilitarán próximamente. ENVIA WHATSAPP AL +52 449 102 8878 "
  },
  en: {
    eyebrow: "Glamping in Calvillo · Aguascalientes, Mexico",
    title: "Rest among<br>trees,<br>trails and open<br>skies.",
    nav: { home: "Home", place: "The place", gallery: "Gallery", booking: "Book" },
    parent: "Part of the private Cebolletas development.",
    menu: "Open menu",
    placeEyebrow: "The place", placeTitle: "Everything you need to enjoy nature.",
    placeIntro: "A private space designed for resting, sharing and exploring the Cebolletas landscape in comfort.",
    amenityGroups: [
      ["Nature and adventure", "Suspension bridges", "Trails", "Scenic views", "Private area", "Fire pit"],
      ["Rest and gathering", "Sofa bed", "Bedroom with closet", "Board games", "Grill", "Picnic tables"],
      ["Comforts", "Hot shower", "Equipped kitchen", "Kettle, tea and coffee", "Parking"]
    ],
    galleryEyebrow: "Gallery", galleryTitle: "Explore every corner.",
    galleryIntro: "They will be replaced by the final photo session.",
    photoTour: "Photo tour", temporary: "",
    bookingEyebrow: "Booking", bookingTitle: "Tell us about your visit.",
    bookingText: "Share your details and the experience you have in mind to review availability and help prepare your stay.",
    fields: ["Name", "Email", "Phone", "Message"],
    fieldsWithIds: [{label: "Name", id: "br-name"}, {label: "Email", id: "br-email"}, {label: "Phone", id: "br-cell"}, {label: "Message", id: "br-msg"}],
    options: ["Stay in Copal", "Camping", "Other"],
    requestTypes: ["Send me information", "Send a message"],
    actions: ["Request", "Send"],
    note: "It will be enabled soon."
  }
};

const photos = [
  ["interior-1.jpeg", "Interior", "Interior"],
  ["interior-2.jpeg", "Área de descanso", "Resting area"],
  ["interior-3.jpeg", "Recámara", "Bedroom"],
  ["terraza-1.jpeg", "Terraza", "Terrace"],
  ["terraza-2.jpeg", "Vista exterior", "Outdoor view"],
  ["paisaje.jpeg", "El paisaje", "The landscape"]
];

let lang = "es";
let view = "home";
let activePhoto = 0;
const region = document.querySelector(".content-region");
const nav = document.querySelector("nav");
const menuButton = document.querySelector(".menu-button");

function renderNav() {
  const t = copy[lang];
  menuButton.setAttribute("aria-label", t.menu);
  nav.innerHTML = Object.entries(t.nav).map(([key, label]) =>
    `<a href="#${key}" data-view="${key}" class="${view === key ? "active" : ""}" ${view === key ? 'aria-current="page"' : ""}>${label}</a>`
  ).join("");
}

function home(t) {
  return `<div class="hero-frame" id="home"><section class="hero" aria-labelledby="hero-title">
    <img src="./assets/copal-hero.webp" alt="Cebolletas Copal y su entorno natural">
    <div class="hero-overlay"></div>
    <div class="hero-copy"><p>${t.eyebrow}</p><h1 id="hero-title">${t.title}</h1></div>
    <div class="hero-identity"><img src="./assets/logo-copal_v2.png" alt="Cebolletas Copal"><p>${t.parent}</p></div>
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
    <div class="booking-intro">
        <p class="section-label">${t.bookingEyebrow}</p><h2 id="booking-title">${t.bookingTitle}</h2><p>${t.bookingText}</p>
    </div>
    <form class="booking-form">
      <label><span>${t.fieldsWithIds[0].label}</span><input type="text" placeholder="${t.fieldsWithIds[0].label}" id: "${t.fieldsWithIds[0].id}"></label>
      <label><span>${t.fieldsWithIds[1].label}</span><input type="email" placeholder="${t.fieldsWithIds[1].label}" id: "${t.fieldsWithIds[1].id}"></label>
      <label class="full-field"><span>${t.fieldsWithIds[2].label}</span><input type="tel" placeholder="${t.fieldsWithIds[2].label}" id: "${t.fieldsWithIds[2].id}"></label>
      <fieldset class="request-type full-field">
        <legend>Qu&eacute; info te interesa?</legend>
        <label><input type="radio" name="option-type" value="book" checked><span>${t.options[0]}</span></label>
        <label><input type="radio" name="option-type" value="camping"><span>${t.options[1]}</span></label>
        <label><input type="radio" name="option-type" value="other"><span>${t.options[2]}</span></label>
      </fieldset>
      <fieldset class="request-type full-field">
        <legend>${t.bookingEyebrow}</legend>
        <label><input type="radio" name="request-type" value="information" checked><span>${t.requestTypes[0]}</span></label>
        <label><input type="radio" name="request-type" value="message"><span>${t.requestTypes[1]}</span></label>
      </fieldset>
      <label class="message-field full-field" hidden><span>${t.fieldsWithIds[3].label}</span><textarea rows="5" placeholder="${t.fieldsWithIds[3].label}" id: "${t.fieldsWithIds[3].id}"></textarea></label>
      <div id="modal" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); z-index: 1000;">Opening email...</div>
      <div class="booking-actions full-field">
        <button type="button" data-booking-action="request" aria-disabled="true" id="br-request">${t.actions[0]}</button>
        <button type="button" data-booking-action="send" aria-disabled="true" hidden id="br-whatsapp">${t.actions[1]}</button>
      </div>
      <p class="form-note full-field">${t.note}</p>
    </form>
  </section>`;
}

function render() {
  const t = copy[lang];
  renderNav();
  region.className = `content-region ${view}-view`;
  region.innerHTML = ({ home, place, gallery, booking }[view])(t);
}

menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});

nav.addEventListener("click", event => {
  const link = event.target.closest("[data-view]");
  if (!link) return;
  event.preventDefault();
  view = link.dataset.view;
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  render();
});

document.querySelector(".language").addEventListener("click", event => {
  const button = event.target.closest("[data-lang]");
  if (!button) return;
  lang = button.dataset.lang;
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-lang]").forEach(el => el.classList.toggle("active", el.dataset.lang === lang));
  render();
});

region.addEventListener("click", event => {
  const button = event.target.closest("[data-photo]");
  if (!button) return;
  activePhoto = Number(button.dataset.photo);
  render();
});

region.addEventListener("change", event => {
  const option = event.target.closest('input[name="request-type"]');
  if (!option) return;

  const showMessage = option.value === "message";
  region.querySelector(".message-field").hidden = !showMessage;
  region.querySelector('[data-booking-action="request"]').hidden = showMessage;
  region.querySelector('[data-booking-action="send"]').hidden = !showMessage;
});

render();
