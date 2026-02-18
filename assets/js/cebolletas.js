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

    // Whatsapp button --> start

    function buildWhatsAppMessageFromForm() {
        // expects these inputs exist (you added them earlier):
        // br-name, br-date, br-persons, br-email, br-cell, plus the selected services & output JSON
        const name = (document.getElementById("br-name")?.value || "").trim();
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

    function clearForm() {
        if (nameEl) nameEl.value = "";
        if (dateEl) dateEl.value = getFormattedNowDate(); // Reset to today
        if (emailEl) emailEl.value = "";
        if (cellEl) cellEl.value = "";
        if (msgEl) msgEl.value = "";
        
        // Clear output/selected displays if they exist:
        if (outputEl) outputEl.value = "";
        if (selectedEl) selectedEl.textContent = "";
    }

    function showModalWindow(message) {
        // Create overlay
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0,0,0,0.4)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "1000";

        // Create modal
        const modal = document.createElement("div");
        modal.style.width = "130px";
        modal.style.height = "100px";
        modal.style.backgroundColor = "white";
        modal.style.display = "flex";
        modal.style.justifyContent = "center";
        modal.style.alignItems = "center";
        modal.style.fontSize = "14px";
        modal.style.borderRadius = "6px";
        modal.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";

        modal.textContent = message;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Auto close after 3 seconds
        setTimeout(() => {
            document.body.removeChild(overlay);
        }, 3000);
    }

    // Show error under a specific input field
    function showFieldError(inputEl, errorMessage) {
        if (!inputEl) return;
        
        // Remove existing error if present
        clearFieldError(inputEl);
        
        // Create error element
        const errorEl = document.createElement("div");
        errorEl.className = "field-error";
        errorEl.style.backgroundColor = "#ffffe6";
        errorEl.style.color = "#d32f2f";
        errorEl.style.padding = "6px 8px";
        errorEl.style.marginTop = "4px";
        errorEl.style.fontSize = "12px";
        errorEl.style.borderRadius = "4px";
        errorEl.style.fontWeight = "bold";
        errorEl.style.display = "block";
        errorEl.textContent = errorMessage;
        
        // Insert after the input
        inputEl.insertAdjacentElement("afterend", errorEl);
        
        // Add focus listener to clear error on focus
        inputEl.addEventListener("focus", () => clearFieldError(inputEl), { once: true });
    }

    // Clear error under a specific input field
    function clearFieldError(inputEl) {
        if (!inputEl) return;
        const errorEl = inputEl.nextElementSibling;
        if (errorEl && errorEl.classList.contains("field-error")) {
            errorEl.remove();
        }
    }

    // Clear all field errors
    function clearAllFieldErrors() {
        document.querySelectorAll(".field-error").forEach(el => el.remove());
    }

    // Updated validation that shows field-specific errors
    function validateAndSanitizeFormWithFieldErrors() {
        const fieldErrors = {};
        const sanitize = (str) => escapeHtml(str).trim();
        
        // Clear previous errors
        clearAllFieldErrors();
        
        // Validate name
        const name = (nameEl?.value || "").trim();

        if (!name) {
            fieldErrors.name = "El Nombre es requerido.";
            showFieldError(nameEl, fieldErrors.name);
        } else if (name.length < 2) {
            fieldErrors.name = "Nombre debe ser de al menos 2 caracteres.";
            showFieldError(nameEl, fieldErrors.name);
        } else if (name.length > 100) {
            fieldErrors.name = "El nombre es demasiado largo (max 100 caracteres).";
            showFieldError(nameEl, fieldErrors.name);
        }
        
        // Validate date
        const date = (dateEl?.value || "").trim();

        if (!date) {
            fieldErrors.date = "La fecha es requerida";
            showFieldError(dateEl, fieldErrors.date);
        } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            fieldErrors.date = "Formato de fecha inválido (YYYY-MM-DD).";
            showFieldError(dateEl, fieldErrors.date);
        }
        
        // Validate email (optional but if provided, must be valid)
        const email = (emailEl?.value || "").trim();

        if (!email) {
            fieldErrors.email = "El email es requerido";
            showFieldError(emailEl, fieldErrors.email);
        } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            fieldErrors.email = "Formato de email inválido";
            showFieldError(emailEl, fieldErrors.email);
        }
        
        // Validate phone (optional but if provided, basic check)
        const cell = (cellEl?.value || "").trim();

        if (!cell) {
            fieldErrors.cell = "El teléfono es requerido";
            showFieldError(cellEl, fieldErrors.cell);
        } else if (cell && !/^[\d\s\-\+\(\)]+$/.test(cell)) {
            fieldErrors.cell = "Formato de teléfono inválido.";
            showFieldError(cellEl, fieldErrors.cell);
        }
        
        // Validate message length (optional field)
        const msg = (msgEl?.value || "").trim();

        if (!msg) {
            fieldErrors.msg = "El mensaje es requerido";
            showFieldError(msgEl, fieldErrors.msg);
        } else if (msg && msg.length < 10) {
            fieldErrors.msg = "El mensaje es muy corto (mínimo 20 caracteres).";
            showFieldError(msgEl, fieldErrors.msg);
        } else if (msg && msg.length > 1000) {
            fieldErrors.msg = "El mensaje es demasiado largo (max 1000 caracteres).";
            showFieldError(msgEl, fieldErrors.msg);
        }
        
        return {
            isValid: Object.keys(fieldErrors).length === 0,
            errors: fieldErrors,
            data: {
                name: sanitize(name),
                date: date,
                email: sanitize(email),
                cell: sanitize(cell),
                msg: sanitize(msg)
            }
        };
    }

    whatsappBtn.addEventListener("click", () => {
        const validation = validateAndSanitizeFormWithFieldErrors();
        
        if (!validation.isValid) {
            return; // Errors are displayed under each field
        }
        
        /* 
        WhatsApp recipient (Mexico example would be 521 + 10 digits; use what you want)
        If you want to send to your business number, set it here:
        */

        // Marco's number for testing: 524491576284
        // const recipientPhoneE164 = "524491576284"; 

        // Neto's number
        const recipientPhoneE164 = "524491028878"; 

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
        console.info('>>> SENDING WHATSAAP MESSAGE');
        showModalWindow("Sending whatsapp message...");
        window.open(url, "_blank", "noopener,noreferrer");
        clearForm();
    });
    // Whatsapp button --> end

    // send email button ---> start
    sendEmailBtn.addEventListener("click", function () {
        const validation = validateAndSanitizeFormWithFieldErrors();
        
        if (!validation.isValid) {
            return; // Errors are displayed under each field
        }

        showModalWindow("Abriendo email...");

        const recipient = "cebolletascalvillo@gmail.com";
        const recipient2 = "elcrio88@gmail.com";
        const subjectRaw = buildSubjectFromForm();
        const subject = encodeURIComponent(subjectRaw);
        const msg = encodeURIComponent(buildWhatsAppMessageFromForm());
        const mailtoUrl = `mailto:${recipient}?cc=${recipient2}&subject=${subject}&body=${msg}`;

        window.open(mailtoUrl, "_blank", "noopener,noreferrer");

        clearForm();

    });
    // send email buttion --> end

    // Put this INSIDE initBookingCard() (so it can access outputEl, copyHint, etc.)
    function buildSubjectFromForm() {
        // expects you already added br-date and br-name inputs (as in the previous step)
        const name = (document.getElementById("br-name")?.value || "").trim() || "booking";
        const date = getFormattedNowDate();
        return `${date} | Contacto - ${name}`;
    }

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