const MESSAGE_URL = "content/message.enc.json";

/* ---------- Ekran hasła: pokaż/ukryj ---------- */

function wirePasswordToggle() {
  const toggle = document.getElementById("gate-toggle");
  const input = document.getElementById("gate-password");
  if (!toggle || !input) return;

  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(show));
    toggle.setAttribute("aria-label", show ? "Ukryj hasło" : "Pokaż hasło");
    input.focus();
  });
}

/* ---------- Dyplom: odpowiedź i druk ---------- */

function wireReplyForm() {
  const box = document.querySelector(".reply-box");
  const sendButton = document.getElementById("reply-send");
  const textarea = document.getElementById("reply-text");
  const hint = document.getElementById("reply-hint");
  if (!box || !sendButton || !textarea) return;

  const email = box.dataset.email || "";
  const signature = box.dataset.signature || "";

  sendButton.addEventListener("click", () => {
    const message = textarea.value.trim();
    if (!message) {
      textarea.focus();
      return;
    }

    const subject = encodeURIComponent("Odpowiedź na Order Uśmiechu");
    const body = encodeURIComponent(signature ? `${message}\n\n— ${signature}` : message);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    if (hint) hint.hidden = false;
  });
}

function wirePrintButton() {
  const printButton = document.getElementById("print-diploma");
  if (!printButton) return;
  printButton.addEventListener("click", () => window.print());
}

/* ---------- Konfetti ---------- */

function fireConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.getElementById("confetti-canvas");
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const colors = ["#c9a24a", "#e9cf8a", "#a4402f", "#7f2e22", "#fbf5ea", "#9a7828"];

  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  canvas.hidden = false;

  const pieces = Array.from({ length: 140 }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight * 0.5,
    w: 6 + Math.random() * 6,
    h: 3 + Math.random() * 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: 1.8 + Math.random() * 3,
    vx: -1.2 + Math.random() * 2.4,
    rot: Math.random() * Math.PI,
    vr: -0.12 + Math.random() * 0.24,
    sway: Math.random() * Math.PI * 2,
  }));

  const duration = 3000;
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    const fade = elapsed > duration - 600 ? Math.max(0, (duration - elapsed) / 600) : 1;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.globalAlpha = fade;

    pieces.forEach((p) => {
      p.sway += 0.05;
      p.x += p.vx + Math.sin(p.sway) * 0.6;
      p.y += p.vy;
      p.rot += p.vr;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (elapsed < duration) {
      requestAnimationFrame(frame);
    } else {
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      canvas.hidden = true;
    }
  }

  requestAnimationFrame(frame);
}

/* ---------- Pokazanie dyplomu ---------- */

function showContent(html, { celebrate }) {
  const gate = document.getElementById("gate");
  const content = document.getElementById("content");

  content.innerHTML = html;
  gate.hidden = true;
  content.hidden = false;
  content.focus({ preventScroll: true });

  wireReplyForm();
  wirePrintButton();
  if (celebrate) fireConfetti();
}

function showError(text) {
  const error = document.getElementById("gate-error");
  error.textContent = text;
  error.hidden = false;
}

/* ---------- Start ---------- */

wirePasswordToggle();

const gateForm = document.getElementById("gate-form");
const passwordInput = document.getElementById("gate-password");
const submitButton = gateForm.querySelector("button[type=submit]");

async function tryUnlock(password, { celebrate }) {
  if (!OrderCrypto.isSupported()) {
    showError(
      "Twoja przeglądarka nie obsługuje potrzebnej funkcji. Otwórz stronę przez https (nie z pliku lokalnego) lub w innej przeglądarce."
    );
    return false;
  }

  try {
    const html = await OrderCrypto.decryptFile(MESSAGE_URL, password);
    OrderCrypto.rememberPassword(password);
    showContent(html, { celebrate });
    return true;
  } catch (err) {
    if (err && err.message && err.message.startsWith("HTTP")) {
      showError("Nie udało się wczytać treści. Odśwież stronę albo otwórz ją przez internet, nie z pliku.");
    } else if (err && err.name === "OperationError") {
      showError("Niepoprawne hasło. Spróbuj jeszcze raz.");
    } else {
      showError("Coś poszło nie tak. Odśwież stronę i spróbuj ponownie.");
    }
    return false;
  }
}

// Odświeżenie w tej samej sesji: odszyfruj ponownie bez pytania o hasło.
const remembered = OrderCrypto.storedPassword();
if (remembered) {
  tryUnlock(remembered, { celebrate: false }).then((ok) => {
    if (!ok) OrderCrypto.forget();
  });
}

gateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const error = document.getElementById("gate-error");
  error.hidden = true;

  submitButton.disabled = true;
  submitButton.textContent = "Otwieranie…";
  try {
    const ok = await tryUnlock(passwordInput.value.trim(), { celebrate: true });
    if (!ok) {
      passwordInput.value = "";
      passwordInput.focus();
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Otwórz";
  }
});
