const body = document.body;
const authOverlay = document.querySelector("[data-auth-overlay]");
const noticeOverlay = document.querySelector("[data-notice-overlay]");
const quickfindOverlay = document.querySelector("[data-quickfind-overlay]");
const spectrumOverlay = document.querySelector("[data-spectrum-overlay]");
const spectrumImage = document.querySelector("[data-spectrum-image]");
const spectrumHeading = document.querySelector("[data-spectrum-heading]");
const spectrumMeta = document.querySelector("[data-spectrum-meta]");
const spectrumStatus = document.querySelector("[data-spectrum-status]");
const playerOverlay = document.querySelector("[data-player-overlay]");
const playerAudio = document.querySelector("[data-player-audio]");
const playerHeading = document.querySelector("[data-player-heading]");
const playerMeta = document.querySelector("[data-player-meta]");
const guestPopup = document.querySelector("[data-guest-popup]");
const uploadProgress = document.querySelector("[data-upload-progress]");
const uploadProgressText = document.querySelector("[data-upload-progress-text]");
const uploadProgressFill = document.querySelector("[data-upload-progress-fill]");
const uploadProgressPercent = document.querySelector("[data-upload-progress-percent]");
const nextFields = Array.from(document.querySelectorAll("[data-next-field]"));
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authForms = Array.from(document.querySelectorAll("[data-auth-form]"));
const noticeButton = document.querySelector("[data-open-notice]");
const noticeLabel = document.querySelector("[data-notice-label]");
const chatLink = document.querySelector("[data-chat-link]");
const chatLabel = document.querySelector("[data-chat-label]");

let spectrumRequestId = 0;
let uploadInFlight = false;
let noticeReadSynced = false;
let chatPollTimer = 0;
function parseNullableInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const userBundleTrackLimit = parseNullableInt(body.dataset.userBundleTrackLimit);
const userUploadFileLimit = parseNullableInt(body.dataset.userUploadFileLimit);
const userUploadZipLimit = parseNullableInt(body.dataset.userUploadZipLimit);

// Track selection lives here, not only in the DOM. AJAX paging replaces the whole
// viewport (see replaceViewportFromHtml), which would otherwise discard every checked
// box; keeping the chosen ids in a Set lets selection survive page/tab switches and lets
// bundle/zip downloads span pages. Resets on a full reload, which is acceptable.
const selectedIds = new Set();

function currentTrackSelectBoxes() {
  return Array.from(document.querySelectorAll("[data-track-select]"));
}

function currentDownloadSelectedButtons() {
  return Array.from(document.querySelectorAll("[data-download-selected]"));
}

function currentDownloadZipButtons() {
  return Array.from(document.querySelectorAll("[data-download-zip]"));
}

function currentMobileSelectionDock() {
  return document.querySelector("[data-mobile-selection-dock]");
}

function currentMobileSelectionCount() {
  return document.querySelector("[data-mobile-selection-count]");
}

function currentUploadForm() {
  return document.querySelector("[data-upload-form]");
}

function primeSelectionLabels(root = document) {
  root.querySelectorAll("[data-download-selected], [data-download-zip]").forEach((button) => {
    if (!button.dataset.baseLabel) {
      button.dataset.baseLabel = button.textContent.trim();
    }
  });
}

function setNextTarget(target) {
  nextFields.forEach((input) => {
    input.value = target || input.value;
  });
}

function openOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.add("is-visible");
  body.classList.add("auth-open");
}

function closeOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.remove("is-visible");
  if (!document.querySelector(".auth-overlay.is-visible, .notice-overlay.is-visible, .quickfind-overlay.is-visible, .spectrum-overlay.is-visible, .player-overlay.is-visible")) {
    body.classList.remove("auth-open");
  }
}

function openAuth(mode = "login", nextTarget = window.location.pathname + window.location.search) {
  if (!authOverlay) return;
  setNextTarget(nextTarget);
  openOverlay(authOverlay);
  authTabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.authTab === mode);
  });
  authForms.forEach((form) => {
    form.classList.toggle("is-active", form.dataset.authForm === mode);
  });
}

function closeAuth() {
  closeOverlay(authOverlay);
}

function openNotice() {
  openOverlay(noticeOverlay);
  if (noticeReadSynced) return;
  if (!noticeButton || !noticeLabel) return;
  const csrfToken = body.dataset.csrfToken || "";
  if (!csrfToken) return;
  noticeReadSynced = true;
  const form = new FormData();
  form.append("csrf_token", csrfToken);
  fetch("/notices/mark-read", {
    method: "POST",
    body: form,
    credentials: "same-origin",
  })
    .then(() => {
      noticeButton.classList.remove("has-unread");
      const defaultLabel = noticeButton.dataset.noticeLabelDefault || noticeLabel.textContent || "";
      noticeLabel.textContent = defaultLabel;
    })
    .catch(() => {
      noticeReadSynced = false;
    });
}

function closeNotice() {
  closeOverlay(noticeOverlay);
}

function openQuickfind() {
  openOverlay(quickfindOverlay);
}

function closeQuickfind() {
  closeOverlay(quickfindOverlay);
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
  openOverlay(spectrumOverlay);
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
    if (spectrumStatus) spectrumStatus.textContent = "";
  };
  probeImage.onerror = () => {
    if (requestId !== spectrumRequestId) return;
    if (spectrumStatus) {
      spectrumStatus.textContent = errorText;
      spectrumStatus.classList.add("is-error");
    }
  };
  probeImage.src = finalUrl;
}

function closeSpectrum() {
  spectrumRequestId += 1;
  if (spectrumImage) {
    spectrumImage.removeAttribute("src");
    spectrumImage.style.display = "none";
  }
  if (spectrumStatus) {
    spectrumStatus.textContent = "";
    spectrumStatus.classList.remove("is-error");
  }
  closeOverlay(spectrumOverlay);
}

function openPlayer(button) {
  if (!playerOverlay || !playerAudio || !button) return;
  playerHeading.textContent = button.dataset.playerHeading || "Preview";
  playerMeta.textContent = button.dataset.playerMeta || "";
  playerAudio.pause();
  playerAudio.src = button.dataset.playerSrc || "";
  playerAudio.load();
  openOverlay(playerOverlay);
}

function closePlayer() {
  if (playerAudio) {
    playerAudio.pause();
    playerAudio.removeAttribute("src");
    playerAudio.load();
  }
  closeOverlay(playerOverlay);
}

function setUploadProgress(percent, text) {
  if (!uploadProgress || !uploadProgressFill || !uploadProgressPercent) return;
  const clamped = Math.max(0, Math.min(100, percent));
  uploadProgress.classList.add("is-visible");
  uploadProgressFill.style.width = `${clamped}%`;
  uploadProgressPercent.textContent = `${clamped}%`;
  if (uploadProgressText && text) {
    uploadProgressText.textContent = text;
  }
}

function hideUploadProgress() {
  if (!uploadProgress) return;
  uploadProgress.classList.remove("is-visible");
  if (uploadProgressFill) uploadProgressFill.style.width = "0";
  if (uploadProgressPercent) uploadProgressPercent.textContent = "0%";
}

function generateBatchId() {
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, "");
  }
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function selectedTrackIds() {
  return Array.from(selectedIds);
}

function setTrackSelected(trackId, checked) {
  if (checked) {
    selectedIds.add(trackId);
  } else {
    selectedIds.delete(trackId);
  }
}

function syncTrackSelection(trackId, checked, sourceBox) {
  setTrackSelected(trackId, checked);
  currentTrackSelectBoxes().forEach((box) => {
    if (box !== sourceBox && box.value === trackId) {
      box.checked = checked;
    }
  });
  markSelectedCards(document);
}

// Re-apply the selection Set onto freshly rendered checkboxes. Called after the viewport
// is swapped by AJAX paging so selections made on other pages stay visibly checked.
function applySelectionToDom(root = document) {
  root.querySelectorAll("[data-track-select]").forEach((box) => {
    box.checked = selectedIds.has(box.value);
  });
  markSelectedCards(root);
}

// Seed the Set from any server-rendered checked boxes (defensive: server does not
// pre-check today, but this keeps the Set authoritative if that ever changes).
function seedSelectionFromDom(root = document) {
  root.querySelectorAll("[data-track-select]").forEach((box) => {
    if (box.checked) selectedIds.add(box.value);
  });
}

// Mark the row/card that holds each track checkbox so chosen tracks are visually obvious
// (on mobile the library table reflows each <tr> into a card via CSS grid-areas).
function markSelectedCards(root = document) {
  root.querySelectorAll("[data-track-select]").forEach((box) => {
    const container = box.closest(".mobile-track-card, tr");
    if (container) container.classList.toggle("is-selected", selectedIds.has(box.value));
  });
}

function syncSelectionButtons() {
  const selectedCount = selectedTrackIds().length;
  const hasSelection = selectedCount > 0;
  [...currentDownloadSelectedButtons(), ...currentDownloadZipButtons()].forEach((button) => {
    if (!button) return;
    button.disabled = !hasSelection;
    button.classList.toggle("is-ready", hasSelection);
    const label = button.dataset.baseLabel || button.textContent.trim();
    button.textContent = hasSelection ? `${label} (${selectedCount})` : label;
  });
  const mobileSelectionDock = currentMobileSelectionDock();
  if (mobileSelectionDock) {
    mobileSelectionDock.classList.toggle("is-active", hasSelection);
  }
  const mobileSelectionCount = currentMobileSelectionCount();
  if (mobileSelectionCount) {
    mobileSelectionCount.textContent = String(selectedCount);
  }
  syncSelectPageToggle();
}

// Flip the "select page / deselect page" toggle label to match whether every rendered
// track box is already checked.
function syncSelectPageToggle() {
  const boxes = currentTrackSelectBoxes();
  const allChecked = boxes.length > 0 && boxes.every((box) => box.checked);
  document.querySelectorAll("[data-select-page]").forEach((toggle) => {
    const selectLabel = toggle.dataset.selectLabel || toggle.textContent.trim();
    const deselectLabel = toggle.dataset.deselectLabel || selectLabel;
    toggle.textContent = allChecked ? deselectLabel : selectLabel;
    toggle.disabled = boxes.length === 0;
  });
}

function createRequest(url, formData, batchId, onProgress, onDone, onFail) {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
  if (batchId) {
    xhr.setRequestHeader("X-Flacdium-Upload-Batch", batchId);
  }
  xhr.responseType = "text";
  xhr.timeout = 0;
  xhr.upload.addEventListener("progress", onProgress);
  xhr.addEventListener("load", () => onDone(xhr));
  xhr.addEventListener("error", onFail);
  xhr.addEventListener("abort", onFail);
  xhr.send(formData);
}

function parseJsonResponse(xhr) {
  try {
    return JSON.parse(xhr.responseText || "{}");
  } catch (error) {
    return {};
  }
}

function pollUploadStatus(statusUrl, resultUrl, processingText, errorText) {
  if (!statusUrl) {
    setUploadProgress(100, errorText);
    return;
  }

  const poll = () => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", statusUrl, true);
    xhr.responseType = "text";
    xhr.timeout = 0;
    xhr.addEventListener("load", () => {
      if (xhr.status < 200 || xhr.status >= 400) {
        setUploadProgress(100, errorText);
        uploadInFlight = false;
        if (uploadSubmit) uploadSubmit.disabled = false;
        return;
      }
      const payload = parseJsonResponse(xhr);
      const state = payload.status || "processing";
      if (payload.notice) {
        setUploadProgress(100, payload.notice);
      } else {
        setUploadProgress(100, processingText);
      }
      if (state === "queued" || state === "processing") {
        window.setTimeout(poll, 1000);
        return;
      }
      window.location = payload.result_url || resultUrl || window.location.pathname + window.location.search;
    });
    xhr.addEventListener("error", () => {
      window.setTimeout(poll, 1500);
    });
    xhr.send();
  };

  poll();
}

function replaceViewportFromHtml(html, href) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const nextViewport = doc.querySelector(".viewport-shell");
  const currentViewport = document.querySelector(".viewport-shell");
  if (!nextViewport || !currentViewport) return false;
  currentViewport.replaceWith(nextViewport);
  primeSelectionLabels(nextViewport);
  applySelectionToDom(nextViewport);
  syncSelectionButtons();
  window.history.replaceState({}, "", href);
  return true;
}

function replaceQuickfindFromHtml(html, href) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const nextCard = doc.querySelector("[data-quickfind-overlay] .quickfind-card");
  const currentCard = document.querySelector("[data-quickfind-overlay] .quickfind-card");
  if (!nextCard || !currentCard) return false;
  currentCard.replaceWith(nextCard);
  window.history.replaceState({}, "", href);
  openQuickfind();
  return true;
}

function fetchPagerContent(link) {
  const href = link.getAttribute("href");
  if (!href) return;
  const mode = link.dataset.ajaxPage || "viewport";
  fetch(href, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((html) => {
      const replaced = mode === "quickfind"
        ? replaceQuickfindFromHtml(html, href)
        : replaceViewportFromHtml(html, href);
      if (!replaced) {
        window.location.href = href;
      }
    })
    .catch(() => {
      window.location.href = href;
    });
}

function fetchQuickfindUrl(href) {
  if (!href) return;
  fetch(href, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then((html) => {
      const replaced = replaceQuickfindFromHtml(html, href);
      if (!replaced) window.location.href = href;
    })
    .catch(() => {
      window.location.href = href;
    });
}

function hrefFromForm(form) {
  const formData = new FormData(form);
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    const text = typeof value === "string" ? value.trim() : "";
    if (text !== "") params.set(key, text);
  });
  const href = `/?${params.toString()}`;
  return href;
}

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => openAuth(tab.dataset.authTab || "login"));
});

document.addEventListener("click", (event) => {
  const openAuthButton = event.target.closest("[data-open-auth]");
  if (openAuthButton) {
    event.preventDefault();
    openAuth("login");
    return;
  }

  const closeAuthButton = event.target.closest("[data-close-auth]");
  if (closeAuthButton) {
    event.preventDefault();
    closeAuth();
    return;
  }

  const openQuickfindButton = event.target.closest("[data-open-quickfind]");
  if (openQuickfindButton) {
    event.preventDefault();
    openQuickfind();
    return;
  }
  const openNoticeButton = event.target.closest("[data-open-notice]");
  if (openNoticeButton) {
    event.preventDefault();
    openNotice();
    return;
  }

  const closeQuickfindButton = event.target.closest("[data-close-quickfind]");
  if (closeQuickfindButton) {
    event.preventDefault();
    closeQuickfind();
    return;
  }
  const closeNoticeButton = event.target.closest("[data-close-notice]");
  if (closeNoticeButton) {
    event.preventDefault();
    closeNotice();
    return;
  }

  const openSpectrumButton = event.target.closest("[data-open-spectrum]");
  if (openSpectrumButton) {
    event.preventDefault();
    openSpectrum(openSpectrumButton);
    return;
  }

  const closeSpectrumButton = event.target.closest("[data-close-spectrum]");
  if (closeSpectrumButton) {
    event.preventDefault();
    closeSpectrum();
    return;
  }

  const openPlayerButton = event.target.closest("[data-open-player]");
  if (openPlayerButton) {
    event.preventDefault();
    openPlayer(openPlayerButton);
    return;
  }

  const closePlayerButton = event.target.closest("[data-close-player]");
  if (closePlayerButton) {
    event.preventDefault();
    closePlayer();
    return;
  }

  const hideGuestButton = event.target.closest("[data-hide-guest]");
  if (hideGuestButton) {
    event.preventDefault();
    const guestPopup = document.querySelector("[data-guest-popup]");
    if (guestPopup) guestPopup.style.display = "none";
    return;
  }

  const requiresAuthNode = event.target.closest("[data-requires-auth]");
  if (requiresAuthNode && body.dataset.userAuthenticated !== "1") {
    event.preventDefault();
    openAuth("login", window.location.pathname + window.location.search);
    return;
  }

  const pagerLink = event.target.closest("[data-ajax-page]");
  if (pagerLink) {
    event.preventDefault();
    fetchPagerContent(pagerLink);
    return;
  }

  const downloadSelectedButton = event.target.closest("[data-download-selected]");
  if (downloadSelectedButton) {
    event.preventDefault();
    const ids = selectedTrackIds();
    if (ids.length === 0) return;
    if (body.dataset.userAuthenticated !== "1") {
      openAuth("login");
      return;
    }
    if (userBundleTrackLimit !== null && ids.length > userBundleTrackLimit) {
      window.alert(downloadSelectedButton.dataset.downloadLimitMessage || `Max ${userBundleTrackLimit} files.`);
      return;
    }
    ids.forEach((trackId, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = `/download/${trackId}`;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 650);
    });
    return;
  }

  const downloadZipButton = event.target.closest("[data-download-zip]");
  if (downloadZipButton) {
    event.preventDefault();
    const ids = selectedTrackIds();
    if (ids.length === 0) return;
    if (body.dataset.userAuthenticated !== "1") {
      openAuth("login");
      return;
    }
    if (userBundleTrackLimit !== null && ids.length > userBundleTrackLimit) {
      window.alert(downloadZipButton.dataset.downloadLimitMessage || `Max ${userBundleTrackLimit} tracks.`);
      return;
    }
    window.location.href = `/download-bundle?ids=${encodeURIComponent(ids.join(","))}`;
  }
});

document.addEventListener("change", (event) => {
  const box = event.target.closest("[data-track-select]");
  if (!box) return;
  syncTrackSelection(box.value, box.checked, box);
  syncSelectionButtons();
});

// On mobile the library table reflows into cards; tapping a non-interactive part of a
// track row toggles its selection (a far larger touch target than the small checkbox).
// Scoped to mobile so desktop row clicks keep their normal behaviour.
document.addEventListener("click", (event) => {
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  if (event.target.closest("a, button, input, label, summary")) return;
  const row = event.target.closest(".library-table tbody tr");
  if (!row) return;
  const box = row.querySelector("[data-track-select]");
  if (!box) return;
  box.checked = !box.checked;
  syncTrackSelection(box.value, box.checked, box);
  syncSelectionButtons();
});

// "Select page" toggle in the mobile list: check/uncheck every rendered track box.
document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-select-page]");
  if (!toggle) return;
  event.preventDefault();
  const boxes = currentTrackSelectBoxes();
  const allChecked = boxes.length > 0 && boxes.every((box) => box.checked);
  boxes.forEach((box) => {
    box.checked = !allChecked;
    setTrackSelected(box.value, box.checked);
  });
  markSelectedCards(document);
  syncSelectionButtons();
});

let quickfindSearchDebounce = 0;
document.addEventListener("input", (event) => {
  const input = event.target.closest("[data-quickfind-live-search] input[type='text']");
  if (!input) return;
  const form = input.closest("[data-quickfind-live-search]");
  if (!form) return;
  window.clearTimeout(quickfindSearchDebounce);
  quickfindSearchDebounce = window.setTimeout(() => {
    fetchQuickfindUrl(hrefFromForm(form));
  }, 170);
});

document.addEventListener("click", (event) => {
  const letterButton = event.target.closest("[data-quickfind-letter]");
  if (letterButton) {
    const form = letterButton.closest("[data-quickfind-letters]");
    if (!form) return;
    const hidden = form.querySelector("[data-quickfind-letters-input]");
    if (!hidden) return;
    const value = (letterButton.dataset.quickfindLetter || "").trim().toUpperCase();
    if (!value) return;
    const current = hidden.value
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part);
    const next = current.includes(value)
      ? current.filter((part) => part !== value)
      : [...current, value];
    hidden.value = next.join(",");
    fetchQuickfindUrl(hrefFromForm(form));
    return;
  }

  const clearButton = event.target.closest("[data-quickfind-letter-clear]");
  if (clearButton) {
    const form = clearButton.closest("[data-quickfind-letters]");
    if (!form) return;
    const hidden = form.querySelector("[data-quickfind-letters-input]");
    if (!hidden) return;
    hidden.value = "";
    fetchQuickfindUrl(hrefFromForm(form));
  }
});

primeSelectionLabels();
seedSelectionFromDom();
markSelectedCards(document);
syncSelectionButtons();

document.querySelectorAll("[data-bulk-form]").forEach((form) => {
  const toggle = form.querySelector("[data-bulk-toggle]");
  const items = Array.from(form.querySelectorAll("[data-bulk-item]"));
  const buttons = Array.from(form.querySelectorAll("[data-bulk-action-button]"));
  if (items.length === 0) {
    buttons.forEach((button) => {
      button.disabled = true;
    });
    return;
  }

  const syncBulkForm = () => {
    const selectedCount = items.filter((item) => item.checked).length;
    const hasSelection = selectedCount > 0;
    buttons.forEach((button) => {
      button.disabled = !hasSelection;
      button.classList.toggle("is-ready", hasSelection);
    });
    if (toggle) {
      toggle.checked = selectedCount === items.length;
      toggle.indeterminate = selectedCount > 0 && selectedCount < items.length;
    }
  };

  if (toggle) {
    toggle.addEventListener("change", () => {
      items.forEach((item) => {
        item.checked = toggle.checked;
      });
      syncBulkForm();
    });
  }

  items.forEach((item) => {
    item.addEventListener("change", syncBulkForm);
  });

  syncBulkForm();
});

if (body.dataset.authOpen === "1") {
  openAuth(body.dataset.authMode || "login");
}
[authOverlay, noticeOverlay, quickfindOverlay, spectrumOverlay, playerOverlay].forEach((overlay) => {
  if (!overlay) return;
  overlay.addEventListener("click", (event) => {
    if (event.target !== overlay) return;
    if (overlay === authOverlay) closeAuth();
    if (overlay === noticeOverlay) closeNotice();
    if (overlay === quickfindOverlay) closeQuickfind();
    if (overlay === spectrumOverlay) closeSpectrum();
    if (overlay === playerOverlay) closePlayer();
  });
});

document.querySelectorAll("[data-editor-toolbar]").forEach((toolbar) => {
  const editorId = toolbar.dataset.editorTarget || "";
  const editor = document.getElementById(editorId);
  const hidden = document.querySelector(`[data-editor-hidden='${editorId}']`);
  if (!editor || !hidden) return;

  const syncEditor = () => {
    hidden.value = editor.innerHTML;
  };
  editor.addEventListener("input", syncEditor);
  syncEditor();

  toolbar.querySelectorAll("[data-editor-cmd]").forEach((button) => {
    button.addEventListener("click", () => {
      const cmd = button.dataset.editorCmd || "";
      const value = button.dataset.editorValue || "";
      editor.focus();
      document.execCommand(cmd, false, value);
      syncEditor();
    });
  });

  const linkButton = toolbar.querySelector("[data-editor-link]");
  if (linkButton) {
    linkButton.addEventListener("click", () => {
      const href = window.prompt("URL");
      if (!href) return;
      editor.focus();
      document.execCommand("createLink", false, href.trim());
      syncEditor();
    });
  }

  const imageInput = toolbar.querySelector("[data-editor-image-upload]");
  if (imageInput) {
    imageInput.addEventListener("change", async () => {
      const file = imageInput.files && imageInput.files[0];
      if (!file) return;
      const form = new FormData();
      const csrfInput = document.querySelector("input[name='csrf_token']");
      form.append("csrf_token", csrfInput ? csrfInput.value : "");
      form.append("image_file", file);
      try {
        const response = await fetch("/admin/notices/upload-image", {
          method: "POST",
          body: form,
          credentials: "same-origin",
        });
        const payload = await response.json();
        if (!response.ok || !payload.ok || !payload.url) throw new Error("upload failed");
        editor.focus();
        document.execCommand("insertImage", false, payload.url);
        syncEditor();
      } catch (_error) {
        window.alert("upload image failed");
      } finally {
        imageInput.value = "";
      }
    });
  }
});

const chatThread = document.querySelector("[data-chat-thread]");
const chatMissedContainer = document.querySelector("[data-chat-missed]");
const chatUserSearch = document.querySelector("[data-chat-user-search]");
const chatUserSuggest = document.querySelector("[data-chat-user-suggest]");
const chatPeerHidden = document.querySelector("[data-chat-peer-hidden]");
const chatMissedOverlay = document.querySelector("[data-chat-missed-overlay]");
const chatMissedBadge = document.querySelector("[data-chat-missed-badge]");
if (chatThread && chatLink && chatLabel) {
  let peer = chatThread.dataset.chatPeer || "";
  const renderChat = (payload) => {
    if (!payload || !payload.ok) return;
    const unread = Number(payload.unread || 0);
    if (unread > 0) {
      chatLink.classList.add("has-unread");
      const labelTemplate = chatLink.dataset.chatLabelNew || "new chatchit ({count})";
      chatLabel.textContent = labelTemplate.replace("{count}", String(unread));
    } else {
      chatLink.classList.remove("has-unread");
      chatLabel.textContent = chatLink.dataset.chatLabelDefault || "chatchit";
    }
    if (Array.isArray(payload.missed) && chatMissedContainer) {
      if (chatMissedBadge) {
        const missedCount = payload.missed.length;
        chatMissedBadge.textContent = String(missedCount);
        chatMissedBadge.classList.toggle("is-hidden", missedCount <= 0);
      }
      chatMissedContainer.innerHTML = payload.missed.length > 0
        ? payload.missed.map((item) => {
          const href = `/chatchit/thread/${encodeURIComponent(item.username)}`;
          return `<a href="${href}" class="chat-missed-item"><span>${item.username}</span><strong>${item.unread}</strong></a>`;
        }).join("")
        : '<div class="empty-row">no missed</div>';
    }
    if (Array.isArray(payload.messages)) {
      if (payload.messages.length === 0) {
        chatThread.innerHTML = '<div class="empty-row">no messages</div>';
        return;
      }
      chatThread.innerHTML = payload.messages.map((msg) => {
        const own = msg.own ? " is-own" : "";
        const who = msg.own ? "you" : msg.sender;
        return `<article class="chat-bubble${own}"><div class="chat-bubble-head"><strong>${who}</strong><span>${msg.created}</span></div><div class="chat-bubble-text"></div></article>`;
      }).join("");
      const bubbles = chatThread.querySelectorAll(".chat-bubble-text");
      payload.messages.forEach((msg, index) => {
        const node = bubbles[index];
        if (node) node.textContent = msg.text || "";
      });
      chatThread.scrollTop = chatThread.scrollHeight;
    }
  };
  const runSearch = () => {
    if (!chatUserSearch || !chatUserSuggest) return;
    const q = (chatUserSearch.value || "").trim();
    if (q.length < 4) {
      chatUserSuggest.classList.remove("is-open");
      chatUserSuggest.innerHTML = "";
      return;
    }
    fetch(`/chatchit/search-users?q=${encodeURIComponent(q)}`, {
      headers: {"X-Requested-With": "XMLHttpRequest"},
      credentials: "same-origin",
    })
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => {
        if (!payload || !payload.ok) return;
        const items = Array.isArray(payload.items) ? payload.items : [];
        if (items.length === 0) {
          chatUserSuggest.classList.remove("is-open");
          chatUserSuggest.innerHTML = "";
          return;
        }
        chatUserSuggest.classList.add("is-open");
        chatUserSuggest.innerHTML = items.map((item) => `<button type="button" class="chat-search-item" data-chat-select-user="${item.username}">${item.username}</button>`).join("");
      })
      .catch(() => {
        chatUserSuggest.classList.remove("is-open");
      });
  };
  if (chatUserSearch) {
    chatUserSearch.addEventListener("input", () => {
      window.setTimeout(runSearch, 120);
    });
  }
  document.addEventListener("click", (event) => {
    const openMissedButton = event.target.closest("[data-open-missed]");
    if (openMissedButton && chatMissedOverlay) {
      event.preventDefault();
      chatMissedOverlay.classList.add("is-visible");
      return;
    }
    const closeMissedButton = event.target.closest("[data-close-missed]");
    if (closeMissedButton && chatMissedOverlay) {
      event.preventDefault();
      chatMissedOverlay.classList.remove("is-visible");
      return;
    }
    if (chatMissedOverlay && event.target === chatMissedOverlay) {
      chatMissedOverlay.classList.remove("is-visible");
      return;
    }
    const selectUser = event.target.closest("[data-chat-select-user]");
    if (!selectUser) return;
    const username = selectUser.dataset.chatSelectUser || "";
    if (!username) return;
    window.location.href = `/chatchit/thread/${encodeURIComponent(username)}`;
  });
  const pollChat = () => {
    const targetPeer = (chatPeerHidden && chatPeerHidden.value) || peer || "";
    const query = targetPeer ? `?peer=${encodeURIComponent(targetPeer)}` : "";
    fetch(`/chatchit/poll${query}`, {
      headers: {"X-Requested-With": "XMLHttpRequest"},
      credentials: "same-origin",
    })
      .then((res) => res.ok ? res.json() : null)
      .then((payload) => {
        renderChat(payload);
      })
      .catch(() => {})
      .finally(() => {
        chatPollTimer = window.setTimeout(pollChat, 3000);
      });
  };
  pollChat();
}

if (window.XMLHttpRequest && window.FormData) {
  document.addEventListener("submit", (event) => {
    const quickJumpForm = event.target.closest("[data-quickfind-jump]");
    if (quickJumpForm) {
      event.preventDefault();
      fetchQuickfindUrl(hrefFromForm(quickJumpForm));
      return;
    }
    const viewportJumpForm = event.target.closest("[data-viewport-jump]");
    if (viewportJumpForm) {
      event.preventDefault();
      const href = `${hrefFromForm(viewportJumpForm)}#tracks-panel`;
      fetch(href, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "same-origin",
      })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        })
        .then((html) => {
          if (!replaceViewportFromHtml(html, href)) window.location.href = href;
        })
        .catch(() => {
          window.location.href = href;
        });
      return;
    }

    const uploadForm = event.target.closest("[data-upload-form]");
    if (!uploadForm) return;
    if (uploadInFlight) {
      event.preventDefault();
      return;
    }

    const uploadSubmit = uploadForm.querySelector("[data-upload-submit]");
    const uploadBatchField = uploadForm.querySelector("[data-upload-batch-id]");
    const uploadFilesInput = uploadForm.querySelector('input[name="files"]');
    const uploadZipInput = uploadForm.querySelector('input[name="zip_file"]');
    const rightsCheckbox = uploadForm.querySelector('input[name="rights_confirmed"]');
    const csrfField = uploadForm.querySelector('input[name="csrf_token"]');

    const directFiles = uploadFilesInput && uploadFilesInput.files ? Array.from(uploadFilesInput.files).filter((file) => file && file.name) : [];
    const zipFiles = uploadZipInput && uploadZipInput.files ? Array.from(uploadZipInput.files).filter((file) => file && file.name) : [];
    if (directFiles.length === 0 && zipFiles.length === 0) {
      return;
    }
    if (directFiles.length > 0 && zipFiles.length > 0) {
      event.preventDefault();
      window.alert(uploadForm.dataset.uploadMixedMessage || "Choose only one upload mode per batch.");
      return;
    }
    if (userUploadFileLimit !== null && directFiles.length > userUploadFileLimit) {
      event.preventDefault();
      window.alert(uploadForm.dataset.uploadFlacLimitMessage || `Max ${userUploadFileLimit} FLAC files per upload.`);
      return;
    }
    if (userUploadZipLimit !== null && zipFiles.length > userUploadZipLimit) {
      event.preventDefault();
      window.alert(uploadForm.dataset.uploadZipLimitMessage || "Only 1 ZIP file is allowed per upload.");
      return;
    }

    event.preventDefault();
    uploadInFlight = true;
    if (uploadSubmit) uploadSubmit.disabled = true;

    const uploadingText = uploadForm.dataset.uploadUploading || "Uploading files...";
    const processingText = uploadForm.dataset.uploadProcessing || "Upload finished, ingesting...";
    const errorText = uploadForm.dataset.uploadError || "Upload failed.";
    const batchId = generateBatchId();
    if (uploadBatchField) uploadBatchField.value = batchId;

    const tasks = [
      ...directFiles.map((file) => ({ kind: "file", file, size: file.size || 0 })),
      ...zipFiles.map((file) => ({ kind: "zip", file, size: file.size || 0 })),
    ];
    const totalBytes = tasks.reduce((sum, task) => sum + task.size, 0) || 1;
    const chunkSize = 4 * 1024 * 1024;
    const maxChunkRetries = 2;
    const maxFinalizeRetries = 2;
    let finishedBytes = 0;
    let currentIndex = 0;
    setUploadProgress(0, uploadingText);

    const failUpload = (message) => {
      uploadInFlight = false;
      if (uploadSubmit) uploadSubmit.disabled = false;
      setUploadProgress(100, message || errorText);
    };

    const finalizeUpload = () => {
      let finalizeAttempts = 0;
      const completeForm = new FormData();
      completeForm.set("csrf_token", csrfField ? csrfField.value : "");
      completeForm.set("rights_confirmed", rightsCheckbox && rightsCheckbox.checked ? "true" : "false");
      completeForm.set("upload_batch_id", batchId);
      const sendFinalize = () => {
        createRequest(
          "/upload/complete",
          completeForm,
          batchId,
          () => {},
          (xhr) => {
            if (xhr.status >= 200 && xhr.status < 400) {
              const payload = parseJsonResponse(xhr);
              if (payload.status_url) {
                setUploadProgress(100, processingText);
                pollUploadStatus(payload.status_url, payload.result_url || "", processingText, errorText);
                return;
              }
              if (typeof xhr.responseText === "string" && xhr.responseText) {
                uploadInFlight = false;
                setUploadProgress(100, processingText);
                document.open();
                document.write(xhr.responseText);
                document.close();
                return;
              }
            }
            if (xhr.status >= 500 && finalizeAttempts < maxFinalizeRetries) {
              finalizeAttempts += 1;
              window.setTimeout(sendFinalize, 1000 * finalizeAttempts);
              return;
            }
            const payload = parseJsonResponse(xhr);
            failUpload(payload.detail || errorText);
          },
          () => {
            if (finalizeAttempts < maxFinalizeRetries) {
              finalizeAttempts += 1;
              window.setTimeout(sendFinalize, 1000 * finalizeAttempts);
              return;
            }
            failUpload(errorText);
          },
        );
      };

      sendFinalize();
    };

    const uploadNextTask = () => {
      if (currentIndex >= tasks.length) {
        setUploadProgress(100, processingText);
        finalizeUpload();
        return;
      }

      const task = tasks[currentIndex];
      const token = `item-${currentIndex}`;
      let offset = 0;
      let chunkAttempts = 0;

      const uploadNextChunk = () => {
        if (offset >= task.size) {
          finishedBytes += task.size;
          currentIndex += 1;
          setUploadProgress(Math.round((finishedBytes / totalBytes) * 100), uploadingText);
          uploadNextTask();
          return;
        }

        const end = Math.min(offset + chunkSize, task.size);
        const chunkBlob = task.file.slice(offset, end);
        const chunkForm = new FormData();
        chunkForm.set("csrf_token", csrfField ? csrfField.value : "");
        chunkForm.set("upload_batch_id", batchId);
        chunkForm.set("upload_token", token);
        chunkForm.set("upload_name", task.file.name);
        chunkForm.set("upload_kind", task.kind);
        chunkForm.set("chunk_offset", String(offset));
        chunkForm.set("upload_size", String(task.size));
        chunkForm.append("chunk", chunkBlob, task.file.name);

        createRequest(
          "/upload/chunk",
          chunkForm,
          batchId,
          (progressEvent) => {
            const loaded = progressEvent.lengthComputable ? progressEvent.loaded : chunkBlob.size;
            const percent = Math.round(((finishedBytes + offset + loaded) / totalBytes) * 100);
            setUploadProgress(percent, uploadingText);
          },
          (xhr) => {
            if (xhr.status < 200 || xhr.status >= 400) {
              if (xhr.status >= 500 && chunkAttempts < maxChunkRetries) {
                chunkAttempts += 1;
                window.setTimeout(uploadNextChunk, 700 * chunkAttempts);
                return;
              }
              let detail = errorText;
              const payload = parseJsonResponse(xhr);
              if (payload.detail) detail = payload.detail;
              failUpload(detail);
              return;
            }
            chunkAttempts = 0;
            offset = end;
            uploadNextChunk();
          },
          () => {
            if (chunkAttempts < maxChunkRetries) {
              chunkAttempts += 1;
              window.setTimeout(uploadNextChunk, 700 * chunkAttempts);
              return;
            }
            failUpload(errorText);
          },
        );
      };

      uploadNextChunk();
    };

    uploadNextTask();
  });
} else {
  hideUploadProgress();
}
