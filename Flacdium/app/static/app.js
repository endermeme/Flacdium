const body = document.body;
const authOverlay = document.querySelector("[data-auth-overlay]");
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
const uploadForm = document.querySelector("[data-upload-form]");
const uploadSubmit = document.querySelector("[data-upload-submit]");
const uploadProgress = document.querySelector("[data-upload-progress]");
const uploadProgressText = document.querySelector("[data-upload-progress-text]");
const uploadProgressFill = document.querySelector("[data-upload-progress-fill]");
const uploadProgressPercent = document.querySelector("[data-upload-progress-percent]");
const uploadBatchField = document.querySelector("[data-upload-batch-id]");
const uploadFilesInput = uploadForm ? uploadForm.querySelector('input[name="files"]') : null;
const uploadZipInput = uploadForm ? uploadForm.querySelector('input[name="zip_file"]') : null;
const rightsCheckbox = uploadForm ? uploadForm.querySelector('input[name="rights_confirmed"]') : null;
const csrfField = uploadForm ? uploadForm.querySelector('input[name="csrf_token"]') : null;
const downloadSelectedButtons = Array.from(document.querySelectorAll("[data-download-selected]"));
const downloadZipButtons = Array.from(document.querySelectorAll("[data-download-zip]"));
const trackSelectBoxes = Array.from(document.querySelectorAll("[data-track-select]"));
const mobileSelectionDock = document.querySelector("[data-mobile-selection-dock]");
const mobileSelectionCount = document.querySelector("[data-mobile-selection-count]");
const nextFields = Array.from(document.querySelectorAll("[data-next-field]"));
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authForms = Array.from(document.querySelectorAll("[data-auth-form]"));

let spectrumRequestId = 0;
let uploadInFlight = false;
function parseNullableInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

const userBundleTrackLimit = parseNullableInt(body.dataset.userBundleTrackLimit);
const userUploadFileLimit = parseNullableInt(body.dataset.userUploadFileLimit);
const userUploadZipLimit = parseNullableInt(body.dataset.userUploadZipLimit);
const trackSelectGroups = new Map();

[...downloadSelectedButtons, ...downloadZipButtons].forEach((button) => {
  if (!button.dataset.baseLabel) {
    button.dataset.baseLabel = button.textContent.trim();
  }
});

trackSelectBoxes.forEach((box) => {
  const group = trackSelectGroups.get(box.value) || [];
  group.push(box);
  trackSelectGroups.set(box.value, group);
});

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
  if (!document.querySelector(".auth-overlay.is-visible, .quickfind-overlay.is-visible, .spectrum-overlay.is-visible, .player-overlay.is-visible")) {
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
  return Array.from(new Set(trackSelectBoxes.filter((box) => box.checked).map((box) => box.value)));
}

function syncTrackSelection(trackId, checked, sourceBox) {
  (trackSelectGroups.get(trackId) || []).forEach((box) => {
    if (box !== sourceBox) {
      box.checked = checked;
    }
  });
}

function syncSelectionButtons() {
  const selectedCount = selectedTrackIds().length;
  const hasSelection = selectedCount > 0;
  [...downloadSelectedButtons, ...downloadZipButtons].forEach((button) => {
    if (!button) return;
    button.disabled = !hasSelection;
    button.classList.toggle("is-ready", hasSelection);
    const label = button.dataset.baseLabel || button.textContent.trim();
    button.textContent = hasSelection ? `${label} (${selectedCount})` : label;
  });
  if (mobileSelectionDock) {
    mobileSelectionDock.classList.toggle("is-active", hasSelection);
  }
  if (mobileSelectionCount) {
    mobileSelectionCount.textContent = String(selectedCount);
  }
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

document.querySelectorAll("[data-open-player]").forEach((button) => {
  button.addEventListener("click", () => openPlayer(button));
});

document.querySelectorAll("[data-close-player]").forEach((button) => {
  button.addEventListener("click", closePlayer);
});

document.querySelectorAll("[data-hide-guest]").forEach((button) => {
  button.addEventListener("click", () => {
    if (guestPopup) guestPopup.style.display = "none";
  });
});

authTabs.forEach((tab) => {
  tab.addEventListener("click", () => openAuth(tab.dataset.authTab || "login"));
});

document.querySelectorAll("[data-requires-auth]").forEach((node) => {
  node.addEventListener("click", (event) => {
    if (body.dataset.userAuthenticated === "1") return;
    event.preventDefault();
    openAuth("login", window.location.pathname + window.location.search);
  });
});

trackSelectBoxes.forEach((box) => {
  box.addEventListener("change", () => {
    syncTrackSelection(box.value, box.checked, box);
    syncSelectionButtons();
  });
});

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

[authOverlay, quickfindOverlay, spectrumOverlay, playerOverlay].forEach((overlay) => {
  if (!overlay) return;
  overlay.addEventListener("click", (event) => {
    if (event.target !== overlay) return;
    if (overlay === authOverlay) closeAuth();
    if (overlay === quickfindOverlay) closeQuickfind();
    if (overlay === spectrumOverlay) closeSpectrum();
    if (overlay === playerOverlay) closePlayer();
  });
});

if (uploadForm && window.XMLHttpRequest && window.FormData) {
  uploadForm.addEventListener("submit", (event) => {
    if (uploadInFlight) {
      event.preventDefault();
      return;
    }

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

downloadSelectedButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const ids = selectedTrackIds();
    if (ids.length === 0) return;
    if (body.dataset.userAuthenticated !== "1") {
      openAuth("login");
      return;
    }
    if (userBundleTrackLimit !== null && ids.length > userBundleTrackLimit) {
      window.alert(button.dataset.downloadLimitMessage || `Max ${userBundleTrackLimit} files.`);
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
  });
});

downloadZipButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const ids = selectedTrackIds();
    if (ids.length === 0) return;
    if (body.dataset.userAuthenticated !== "1") {
      openAuth("login");
      return;
    }
    if (userBundleTrackLimit !== null && ids.length > userBundleTrackLimit) {
      window.alert(button.dataset.downloadLimitMessage || `Max ${userBundleTrackLimit} tracks.`);
      return;
    }
    window.location.href = `/download-bundle?ids=${encodeURIComponent(ids.join(","))}`;
  });
});
