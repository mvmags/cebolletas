const content = {
  es: {
    nav: { intro: "Intro", redes: "Redes sociales", contacto: "Contáctanos" },
    menu: "Abrir menú",
    closeMenu: "Cerrar menú",
    heroEyebrow: "Rancho Privado",
    heroTitle: "Naturaleza",
    socialEyebrow: "Redes sociales", socialTitle: "Sigue lo que pasa en Cebolletas.",
    socialText: "Consulta nuestras publicaciones m\u00E1s recientes, cambios de horario, novedades y momentos compartidos desde Cebolletas.",
    instagramAction: "Ver perfil en Instagram", instagramProfile: "Perfil oficial", facebookAction: "Ver en Facebook",
    contactTitle: "Contáctanos",
    fields: { name: "Nombre", email: "Email", phone: "Celular", message: "Mensaje" },
    emailAction: "Enviar por email", whatsappAction: "Enviar por WhatsApp"
  },
  en: {
    nav: { intro: "Intro", redes: "Social media", contacto: "Contact" },
    menu: "Open menu",
    closeMenu: "Close menu",
    heroEyebrow: "Private Ranch",
    heroTitle: "Nature",
    socialEyebrow: "Social media", socialTitle: "Follow what is happening at Cebolletas.",
    socialText: "See our latest posts, schedule changes, news and moments shared from Cebolletas.",
    instagramAction: "View profile on Instagram", instagramProfile: "Official profile", facebookAction: "Open Facebook",
    contactTitle: "Contact us",
    fields: { name: "Name", email: "Email", phone: "Phone", message: "Message" },
    emailAction: "Send by email", whatsappAction: "Send by WhatsApp"
  }
};

let lang = localStorage.getItem("cebolletas-language");
if (!Object.hasOwn(content, lang)) lang = "es";
let activeSection = "intro";
let navigationTarget = null;
let navigationTimer;
let navigationSettleTimer;
let scrollFrame;
const region = document.querySelector(".content-region");
const nav = document.querySelector("nav");
const menuButton = document.querySelector(".menu-button");

function imageBrandLogo() {
  return `<img class="image-brand-logo hero-image-brand-logo" src="./images/cebolletas-rancho-privado-white.png" width="708" height="260" alt="Cebolletas Rancho Privado">`;
}

function renderNav() {
  const t = content[lang];
  nav.innerHTML = Object.entries(t.nav).map(([id, label]) => `<a href="#${id}" data-section="${id}" class="${id === activeSection ? "active" : ""}">${label}</a>`).join("");
  menuButton.setAttribute("aria-label", nav.classList.contains("open") ? t.closeMenu : t.menu);
  document.querySelectorAll("[data-lang]").forEach(button => button.classList.toggle("active", button.dataset.lang === lang));
}

function render() {
  const t = content[lang];
  document.documentElement.lang = lang;
  document.title = "Cebolletas Rancho Privado";
  renderNav();
  region.innerHTML = `
    <section class="hero" id="intro" aria-labelledby="hero-title">
      <img class="section-photo" src="./images/bg-1920x1080.webp" alt="Paisaje natural de Cebolletas">
      <div class="hero-copy"><p class="eyebrow">${t.heroEyebrow}</p><h1 id="hero-title">${t.heroTitle}</h1></div>
      ${imageBrandLogo()}
    </section>
    <section class="social-section" id="redes">
      <div class="social-intro"><p class="eyebrow">${t.socialEyebrow}</p><h2>${t.socialTitle}</h2><p class="lead">${t.socialText}</p></div>
      <div class="social-grid">
        <article class="social-feed instagram-feed">
          <div class="feed-heading"><strong>Instagram</strong></div>
          <a class="instagram-profile-card" href="https://www.instagram.com/cebolletascalvillooficial/" target="_blank" rel="noreferrer" aria-label="${t.instagramAction}">
            <span class="instagram-card-accent" aria-hidden="true"></span>
            <span class="instagram-avatar"><img src="./images/cebolletas-rancho-privado-white.png" width="708" height="260" alt="Cebolletas Rancho Privado"></span>
            <span class="instagram-profile-copy">
              <span class="instagram-profile-label">${t.instagramProfile}</span>
              <strong>@cebolletascalvillooficial</strong>
              <span class="instagram-profile-name">Cebolletas</span>
            </span>
            <span class="instagram-profile-action">${t.instagramAction}<span aria-hidden="true">&#x2197;</span></span>
          </a>
        </article>
        <article class="social-feed facebook-feed">
          <div class="feed-heading"><strong>Facebook</strong><a href="https://www.facebook.com/puentescolgantescebolletas" target="_blank" rel="noreferrer">${t.facebookAction}</a></div>
          <iframe title="Facebook Cebolletas" src="https://www.facebook.com/plugins/page.php?href=https%3A%2F%2Fwww.facebook.com%2Fpuentescolgantescebolletas&amp;tabs=timeline&amp;width=500&amp;height=620&amp;small_header=true&amp;adapt_container_width=true&amp;hide_cover=false&amp;show_facepile=false" width="500" height="620" scrolling="no" frameborder="0" allowfullscreen="true" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"></iframe>
        </article>
      </div>
    </section>
    <section class="contact-section" id="contacto">
      <div class="contact-intro"><h2>${t.contactTitle}</h2></div>
      <form class="contact-form" id="contact-form">
        <label><span>${t.fields.name}</span><input id="contact-name" required autocomplete="name"></label>
        <label><span>${t.fields.email}</span><input id="contact-email" type="email" autocomplete="email"></label>
        <label class="full"><span>${t.fields.phone}</span><input id="contact-phone" type="tel" autocomplete="tel"></label>
        <label class="full"><span>${t.fields.message}</span><textarea id="contact-message" required></textarea></label>
        <div class="contact-actions"><button type="button" data-contact="email">${t.emailAction}</button><button class="secondary" type="button" data-contact="whatsapp">${t.whatsappAction}</button></div>
      </form>
    </section>`;
  bindDynamicEvents();
  observeSections();
  requestAnimationFrame(() => scrollToHash("auto"));
}

function observeSections() {
  updateActiveFromScroll();
}

function updateActiveFromScroll() {
  if (navigationTarget) return;
  const sections = [...region.querySelectorAll(":scope > section[id]")];
  if (!sections.length) return;

  const regionTop = region.getBoundingClientRect().top;
  const activationLine = regionTop + Math.min(region.clientHeight * 0.35, 240);
  let current = sections[0];

  for (const section of sections) {
    if (section.getBoundingClientRect().top <= activationLine) current = section;
    else break;
  }

  setActiveSection(current.id);
  history.replaceState(null, "", `#${current.id}`);
}

function setActiveSection(id) {
  activeSection = id;
  nav.querySelectorAll("a").forEach(link => {
    const isActive = link.dataset.section === id;
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function scrollToHash(behavior = "smooth") {
  const requestedId = location.hash.slice(1);
  const id = Object.hasOwn(content[lang].nav, requestedId) ? requestedId : "intro";
  if (requestedId && requestedId !== id) history.replaceState(null, "", `#${id}`);
  setActiveSection(id);
  navigationTarget = behavior === "smooth" ? id : null;
  clearTimeout(navigationTimer);
  clearTimeout(navigationSettleTimer);
  if (navigationTarget) navigationTimer = setTimeout(() => releaseNavigationTarget(id), 2500);
  region.querySelector(`#${CSS.escape(id)}`)?.scrollIntoView({ behavior, block: "start" });
}

function releaseNavigationTarget(id) {
  if (navigationTarget !== id) return;
  setActiveSection(id);
  navigationTarget = null;
  clearTimeout(navigationTimer);
  updateActiveFromScroll();
}

region.addEventListener("scroll", () => {
  if (navigationTarget) {
    const id = navigationTarget;
    setActiveSection(id);
    clearTimeout(navigationSettleTimer);
    navigationSettleTimer = setTimeout(() => releaseNavigationTarget(id), 120);
    return;
  }

  if (scrollFrame) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null;
    updateActiveFromScroll();
  });
}, { passive: true });

function bindDynamicEvents() {
  region.querySelectorAll("[data-contact]").forEach(button => button.addEventListener("click", () => sendContact(button.dataset.contact)));
}

function sendContact(channel) {
  const name = document.querySelector("#contact-name").value.trim();
  const email = document.querySelector("#contact-email").value.trim();
  const phone = document.querySelector("#contact-phone").value.trim();
  const message = document.querySelector("#contact-message").value.trim();
  if (!name || !message) { document.querySelector("#contact-name").reportValidity(); document.querySelector("#contact-message").reportValidity(); return; }
  const body = `${lang === "es" ? "Nombre" : "Name"}: ${name}\nEmail: ${email}\n${lang === "es" ? "Celular" : "Phone"}: ${phone}\n\n${message}`;
  if (channel === "whatsapp") window.open(`https://wa.me/524491028878?text=${encodeURIComponent(body)}`, "_blank", "noopener");
  else location.href = `mailto:cebolletascalvillo@gmail.com?cc=elcrio88@gmail.com&subject=${encodeURIComponent(`Cebolletas | ${name}`)}&body=${encodeURIComponent(body)}`;
}

nav.addEventListener("click", event => {
  const link = event.target.closest("a[data-section]");
  if (!link) return;
  event.preventDefault(); history.pushState(null, "", link.hash); scrollToHash();
  closeMenu();
});
function closeMenu() {
  const focusWasInNav = nav.contains(document.activeElement);
  nav.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", content[lang].menu);
  if (focusWasInNav && menuButton.getClientRects().length) menuButton.focus();
}
menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? content[lang].closeMenu : content[lang].menu);
  if (open) nav.querySelector("a")?.focus();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && nav.classList.contains("open")) closeMenu();
});
document.addEventListener("click", event => {
  if (!event.target.closest(".site-header")) closeMenu();
});
const mobileMenu = window.matchMedia("(max-width: 800px)");
mobileMenu.addEventListener("change", () => closeMenu());
document.querySelectorAll("[data-lang]").forEach(button => button.addEventListener("click", () => {
  if (button.dataset.lang === lang) return;
  lang = button.dataset.lang; localStorage.setItem("cebolletas-language", lang); render();
}));
window.addEventListener("popstate", () => scrollToHash());
render();
