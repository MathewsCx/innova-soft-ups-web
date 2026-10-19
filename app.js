const menuToggle = document.querySelector("#menu-toggle");
const mainNav = document.querySelector("#main-nav");
const contactForm = document.querySelector("#contact-form");

function setMenuOpen(isOpen) {
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    mainNav.classList.toggle("is-open", isOpen);
}

menuToggle.addEventListener("click", () => {
    setMenuOpen(menuToggle.getAttribute("aria-expanded") !== "true");
});

mainNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        menuToggle.focus();
    }
});

window.matchMedia("(min-width: 720px)").addEventListener("change", (event) => {
    if (event.matches) setMenuOpen(false);
});

function showFieldError(input, errorElement, message) {
    input.setAttribute("aria-invalid", String(Boolean(message)));
    errorElement.textContent = message;
    return message ? input : null;
}

contactForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const nameInput = contactForm.elements.namedItem("nombre");
    const emailInput = contactForm.elements.namedItem("correo");
    const messageInput = contactForm.elements.namedItem("mensaje");
    const status = document.querySelector("#form-status");
    const errors = [
        [nameInput, "#error-nombre", nameInput.value.trim() ? "" : "Escribe tu nombre completo."],
        [emailInput, "#error-correo", !emailInput.value.trim() ? "Escribe tu correo electrónico." : emailInput.checkValidity() ? "" : "Revisa el formato del correo electrónico."],
        [messageInput, "#error-mensaje", messageInput.value.trim() ? "" : "Cuéntanos brevemente tu propuesta."]
    ];
    const invalidFields = [];

    errors.forEach(([input, selector, message]) => {
        const invalidField = showFieldError(input, document.querySelector(selector), message);
        if (invalidField) invalidFields.push(invalidField);
    });

    status.textContent = "";
    if (invalidFields.length > 0) {
        invalidFields[0].focus();
        return;
    }

    status.textContent = "Datos validados en esta demostración. No se enviaron a un servidor.";
});

contactForm.querySelectorAll("input, textarea").forEach((input) => {
    input.addEventListener("input", () => {
        if (input.getAttribute("aria-invalid") !== "true") return;
        input.removeAttribute("aria-invalid");
        document.querySelector(`#error-${input.name}`).textContent = "";
    });
});