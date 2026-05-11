const body = document.body;
const authOverlay = document.querySelector("[data-auth-overlay]");
const quickfindOverlay = document.querySelector("[data-quickfind-overlay]");
const spectrumOverlay = document.querySelector("[data-spectrum-overlay]");
const spectrumImage = document.querySelector("[data-spectrum-image]");
const spectrumHeading = document.querySelector("[data-spectrum-heading]");
const spectrumMeta = document.querySelector("[data-spectrum-meta]");
const spectrumStatus = document.querySelector("[data-spectrum-status]");
const guestPopup = document.querySelector("[data-guest-popup]");
const nextFields = Array.from(document.querySelectorAll("[data-next-field]"));
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authForms = Array.from(document.querySelectorAll("[data-auth-form]"));
let spectrumRequestId = 0;

function setNextTarget(target) {
  nextFields.forEach((input) => {
    input.value = target || input.value;
  });
}

function openAuth(mode = "login", nextTarget = window.location.pathname + window.location.search) {
  if (!authOverlay) return;
  setNextTarget(nextTarget);
  authOverlay.classList.add("is-visible");
  body.classList.add("auth-open");
  authTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.authTab === mode);
  });
  authForms.forEach((form) => {
    form.classList.toggle("is-active", form.dataset.authForm === mode);
  });
}

function closeAuth() {
  if (!authOverlay) return;
  authOverlay.classList.remove("is-visible");
  body.classList.remove("auth-open");
}

function openQuickfind() {
  if (!quickfindOverlay) return;
  quickfindOverlay.classList.add("is-visible");
  body.classList.add("auth-open");
}

function closeQuickfind() {
  if (!quickfindOverlay) return;
  quickfindOverlay.classList.remove("is-visible");
  body.classList.remove("auth-open");
}

function openSpectrum(button) {
  if (!spectrumOverlay || !spectrumImage || !button) return;
  const sourceUrl = button.dataset.spectrumSrc || "";
  const loadingText = button.dataset.spectrumLoading || "Loading spectrum...";
  const errorText = button.dataset.spectrumError || "Failed to render spectrum.";
  const requestId = ++spectrumRequestId;
  spectrumHeading.textContent = button.dataset.spectrumHeading || "Spectrum";
  spectrumMeta.textContent = button.dataset.spectrumMeta || "";
  spectrumImage.removeAttribute("src");
  spectrumImage.style.display = "none";
  if (spectrumStatus) {
    spectrumStatus.textContent = loadingText;
    spectrumStatus.classList.remove("is-error");
  }
  spectrumOverlay.classList.add("is-visible");
  body.classList.add("auth-open");
  if (!sourceUrl) {
    if (spectrumStatus) {
      spectrumStatus.textContent = errorText;
      spectrumStatus.classList.add("is-error");
    }
    return;
  }

  const probeImage = new Image();
  const finalUrl = `${sourceUrl}${sourceUrl.includes("?") ? "&" : "?"}ts=${Date.now()}`;
  probeImage.onload = () => {
    if (requestId !== spectrumRequestId) return;
    spectrumImage.src = finalUrl;
    spectrumImage.style.display = "block";
    if (spectrumStatus) {
      spectrumStatus.textContent = "";
      spectrumStatus.classList.remove("is-error");
    }
  };
  probeImage.onerror = () => {
    if (requestId !== spectrumRequestId) return;
    spectrumImage.removeAttribute("src");
    spectrumImage.style.display = "none";
    if (spectrumStatus) {
      spectrumStatus.textContent = errorText;
      spectrumStatus.classList.add("is-error");
    }
  };
  probeImage.src = finalUrl;
}

function closeSpectrum() {
  if (!spectrumOverlay) return;
  spectrumOverlay.classList.remove("is-visible");
  body.classList.remove("auth-open");
  spectrumRequestId += 1;
  if (spectrumImage) {
    spectrumImage.removeAttribute("src");
    spectrumImage.style.display = "none";
  }
  if (spectrumStatus) {
    spectrumStatus.textContent = "";
    spectrumStatus.classList.remove("is-error");
  }
}

document.querySelectorAll("[data-open-auth]").forEach((button) => {
  button.addEventListener("click", () => openAuth("login"));
});

document.querySelectorAll("[data-close-auth]").forEach((button) => {
  button.addEventListener("click", closeAuth);
});

document.querySelectorAll("[data-open-quickfind]").forEach((button) => {
  button.addEventListener("click", openQuickfind);
});

document.querySelectorAll("[data-close-quickfind]").forEach((button) => {
  button.addEventListener("click", closeQuickfind);
});

document.querySelectorAll("[data-open-spectrum]").forEach((button) => {
  button.addEventListener("click", () => openSpectrum(button));
});

document.querySelectorAll("[data-close-spectrum]").forEach((button) => {
  button.addEventListener("click", closeSpectrum);
});

document.querySelectorAll("[data-hide-guest]").forEach((button) => {
  button.addEventListener("click", () => {
    if (guestPopup) guestPopup.style.display = "none";
  });
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => openAuth(tab.dataset.authTab || "login"));
});

document.querySelectorAll("[data-requires-auth]").forEach((link) => {
  link.addEventListener("click", (event) => {
    if (body.dataset.userAuthenticated === "1") return;
    event.preventDefault();
    openAuth("login", link.getAttribute("href"));
  });
});

if (body.dataset.authOpen === "1") {
  openAuth(body.dataset.authMode || "login");
}

if (authOverlay) {
  authOverlay.addEventListener("click", (event) => {
    if (event.target === authOverlay) closeAuth();
  });
}

if (quickfindOverlay) {
  quickfindOverlay.addEventListener("click", (event) => {
    if (event.target === quickfindOverlay) closeQuickfind();
  });
}

if (spectrumOverlay) {
  spectrumOverlay.addEventListener("click", (event) => {
    if (event.target === spectrumOverlay) closeSpectrum();
  });
}
