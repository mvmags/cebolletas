const copy = {
  es: {
    eyebrow: "Glamping en Calvillo · Aguascalientes, México",
    title: "Descansa entre<br>árboles,<br>senderos y cielo<br>abierto.",
    navPlace: "El lugar", navGallery: "Galería", navBooking: "Reserva",
    parent: "Es parte del desarrollo particular Cebolletas.", menu: "Abrir menú"
  },
  en: {
    eyebrow: "Glamping in Calvillo · Aguascalientes, Mexico",
    title: "Rest among<br>trees,<br>trails and open<br>skies.",
    navPlace: "The place", navGallery: "Gallery", navBooking: "Book",
    parent: "Part of the private Cebolletas development.", menu: "Open menu"
  }
};
const menuButton = document.querySelector(".menu-button");
const nav = document.querySelector("#main-nav");
const languageButtons = document.querySelectorAll("[data-lang]");
function setLanguage(lang) {
  const selected = copy[lang];
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-copy]").forEach((element) => {
    element.innerHTML = selected[element.dataset.copy];
  });
  languageButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.lang === lang);
  });
  menuButton.setAttribute("aria-label", selected.menu);
}
menuButton.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(open));
});
languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.lang));
});
