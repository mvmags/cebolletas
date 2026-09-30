import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rulesPage = await readFile(new URL("../reglamento/reglamento.js", import.meta.url), "utf8");
const rulesHtml = await readFile(new URL("../reglamento/index.html", import.meta.url), "utf8");
const homePage = await readFile(new URL("../assets/js/script.js", import.meta.url), "utf8");
const homeHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");

for (const requiredSpanishText of [
  "Personas y visitas registradas",
  "Armas y dispositivos recreativos",
  "Puentes durante la noche",
  "productos de unicel, bolsas plásticas y envases desechables de PET",
  "Estrictamente prohibidos el alcohol y las drogas",
]) {
  assert.match(rulesPage, new RegExp(requiredSpanishText));
}

for (const requiredEnglishText of [
  "Registered visitors",
  "Weapons and recreational devices",
  "Bridges at night",
  "expanded polystyrene foam products, plastic bags and disposable PET containers",
  "Alcohol and drugs strictly prohibited",
]) {
  assert.match(rulesPage, new RegExp(requiredEnglishText));
}

assert.match(homePage, /estrictamente prohibidos el alcohol, las drogas recreativas o ilegales/);
assert.match(homePage, /Alcohol, recreational or illegal drugs, and other prohibited substances are strictly prohibited/);
assert.match(homePage, /rulesAction: "Consultar reglamento completo"/);
assert.match(homePage, /rulesAction: "Read the complete rules"/);
assert.match(homePage, /class="primary-link" href="\.\/reglamento\/"/);
assert.match(rulesHtml, /reglamento\.js\?v=10\.7\.2/);
assert.match(homeHtml, /assets\/js\/script\.js\?v=10\.7\.2/);

console.log("v10.7.2 bilingual rules content tests passed");
