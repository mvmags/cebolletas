// =========================
// CONFIG
// =========================

/**
 * If a service has a quantity input and qty > 1, we must still send strings
 * because the API expects required_services: string[].
 *
 * Choose how to embed quantity into the string:
 * - "suffix":  "asador (x2)"
 * - "prefix":  "2 asador"
 */
const BOOKING_CONFIG = {
    quantityFormat: "suffix" // "suffix" | "prefix"
};

/**
 * IMPORTANT:
 * - `label` is exactly what your backend expects in required_services[].
 * - `defaultChecked` optionally starts the checkbox marked.
 * - `showQuantity` optionally shows a numeric input for that item.
 * - `defaultQty` optional default for quantity input.
 */
const BOOKING_SERVICES = [
    { id: "agua-potable", label: "agua potable", defaultChecked: true, showQuantity: true },
    { id: "cafetera", label: "cafetera para calentar agua (*)", defaultChecked: false, showQuantity: false },
    { id: "anafre", label: "anafre", defaultChecked: false,  showQuantity: false },
    { id: "lenia-atajo", label: "atajo de leña (*)", defaultChecked: false, showQuantity: true,  defaultQty: 1 },
    { id: "asador", label: "asador de gas portátil (*)", defaultChecked: false, showQuantity: false,  defaultQty: 1 },
    { id: "camastro", label: "camastro (*)", defaultChecked: false, showQuantity: true, defaultQty: 1 },
    { id: "casa2p", label: "casa de campaña para 2 personas (*)", defaultChecked: false, showQuantity: true },
    { id: "carbon", label: "carbon (*)", defaultChecked: false, showQuantity: true }
];

// =========================
// /CONFIG
// =========================

(function initBookingCard() {
    function getFormattedNowDate() {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
    }

    const servicesWrap = document.getElementById("br-services");
    const nameEl = document.getElementById("br-name");
    const msgEl = document.getElementById("br-msg");
    const alertEl = document.getElementById("br-alert");
    const selectedEl = document.getElementById("br-selected");
    const outputEl = document.getElementById("br-output");
    const copyHint = document.getElementById("br-copyhint");
    const dateEl = document.getElementById("br-date");
    const emailEl = document.getElementById("br-email");
    const cellEl = document.getElementById("br-cell");
    const whatsappBtn = document.getElementById("br-whatsapp");
    const sendEmailBtn = document.getElementById("br-send-email");
    const dateNow = getFormattedNowDate();

    // Optional: default date = today (local)
    if (dateEl && !dateEl.value) {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        dateEl.value = `${yyyy}-${mm}-${dd}`;
    }

    function showMsg(kind, text) {
        alertEl.style.display = "block";
        alertEl.className = "msg " + (kind === "ok" ? "ok" : "err");
        alertEl.textContent = text;
    }

    function clearMsg() {
        alertEl.style.display = "none";
        alertEl.className = "";
        alertEl.textContent = "";
    }

    function formatWithQty(label, qty) {
        if (!qty || qty <= 1) return label;
        if (BOOKING_CONFIG.quantityFormat === "prefix") return `${qty} ${label}`;
        return `${label} (x${qty})`; // suffix
    }

    function gather() {
        const name = (nameEl.value || "").trim();
        const date = (dateEl?.value || "").trim(); // "YYYY-MM-DD"
        const email = (emailEl?.value || "").trim();
        const cell = (cellEl?.value || "").trim();
        const msg = (msgEl?.value || "").trim();

        return {
            name,
            date,
            email,
            cell,
            msg
        };
    }
    // Whatsapp button --> start

    function buildWhatsAppMessageFromForm() {
        // expects these inputs exist (you added them earlier):
        // br-name, br-date, br-persons, br-email, br-cell, plus the selected services & output JSON
        const name = (document.getElementById("br-name")?.value || "").trim();
        // const date = (document.getElementById("br-date")?.value || "").trim();
        const date = getFormattedNowDate();
        const email = (document.getElementById("br-email")?.value || "").trim();
        const cell = (document.getElementById("br-cell")?.value || "").trim();
        const msg = (document.getElementById("br-msg")?.value || "").trim();

        // If JSON exists, use it; else try to generate a minimal one from current fields
        const json = (outputEl.value || "").trim();

        const header =
        `Nombre: ${name || "(sin nombre)"}\n` +
        `Fecha: ${date || "(sin fecha)"}\n` +
        `Email: ${email || "(sin email)"}\n` +
        `Cel: ${cell || "(sin cel)"}\n` +
        `Mensaje: ${msg}\n\n`;

        const jsonBlock = json
            ? `\n\nJSON:\n${json}`
            : "";

        // return header + jsonBlock;
        return header;
    }

    whatsappBtn.addEventListener("click", function () {
        // WhatsApp recipient (Mexico example would be 521 + 10 digits; use what you want)
        // If you want to send to your business number, set it here:
        const recipientPhoneE164 = "524491576284"; 
        // Leave empty to open WhatsApp without a fixed recipient (user picks contact).
        // If you set it, use digits only, no +. Example: "5214491234567"

        // Build message
        const msg = buildWhatsAppMessageFromForm();

        // IMPORTANT: wa.me uses URL-encoded text
        const text = encodeURIComponent(msg);

        // Build wa.me URL
        const url = recipientPhoneE164
            ? `https://wa.me/${recipientPhoneE164}?text=${text}`
            : `https://wa.me/?text=${text}`;

        // Open in new tab so the user doesn't lose the page
        console.info('>>> SENDING WHATSAAP MESSAGE')
        window.open(url, "_blank", "noopener,noreferrer");
        
    });
    // Whatsapp button --> end

    // send email buttion --> start
    sendEmailBtn.addEventListener('click', () => {
        const recipient = "cebolletascalvillo@gmail.com";
        const subjectRaw = buildSubjectFromForm();
        const subject = encodeURIComponent(subjectRaw);
        const msg = buildWhatsAppMessageFromForm();
        const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${encodeURIComponent(msg)}`;

        console.log('>>> Abriendo cliente de mensajeria');
        window.location.href = mailtoUrl;

    });
    // send email buttion --> end

    // Email button --> start
    // Put this INSIDE initBookingCard() (so it can access outputEl, copyHint, etc.)

    function safeFilePart(s) {
        return String(s || "")
        .trim()
        .replaceAll(/[^\w\-]+/g, "_")
        .replaceAll(/_+/g, "_")
        .replaceAll(/^_+|_+$/g, "")
        .slice(0, 60);
    }

    function buildSubjectFromForm() {
        // expects you already added br-date and br-name inputs (as in the previous step)
        const name = (document.getElementById("br-name")?.value || "").trim() || "booking";
        const date = getFormattedNowDate();
        return `${date} | Contacto - ${name}`;
    }
    // Email button --> end

    // helpers
    function escapeHtml(str) {
        return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
    function escapeAttr(str) {
        return escapeHtml(str).replaceAll("`", "&#096;");
    }
})();