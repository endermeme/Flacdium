const body = document.body;
const authOverlay = document.querySelector("[data-auth-overlay]");
const quickfindOverlay = document.querySelector("[data-quickfind-overlay]");
const spectrumOverlay = document.querySelector("[data-spectrum-overlay]");
const spectrumImage = document.querySelector("[data-spectrum-image]");
const spectrumHeading = document.querySelector("[data-spectrum-heading]");
const spectrumMeta = document.querySelector("[data-spectrum-meta]");
const spectrumStatus = document.querySelector("[data-spectrum-status]");
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
const langField = uploadForm ? uploadForm.querySelector('input[name="lang"]') : null;
const nextFields = Array.from(document.querySelectorAll("[data-next-field]"));
const authTabs = Array.from(document.querySelectorAll("[data-auth-tab]"));
const authForms = Array.from(document.querySelectorAll("[data-auth-form]"));
let spectrumRequestId = 0;
let uploadInFlight = false;

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

function createUploadRequest(formData, batchId, onProgress, onDone, onFail) {
  const xhr = new XMLHttpRequest();
  xhr.open(uploadForm.method || "POST", uploadForm.action, true);
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

if (uploadForm && window.XMLHttpRequest && window.FormData) {
  uploadForm.addEventListener("submit", (event) => {
    if (uploadInFlight) {
      event.preventDefault();
      return;
    }

    const formData = new FormData(uploadForm);
    const flacFiles = formData.getAll("files").filter((value) => value instanceof File && value.name);
    const zipFile = formData.get("zip_file");
    if (flacFiles.length === 0 && (!(zipFile instanceof File) || !zipFile.name)) {
      return;
    }

    event.preventDefault();
    uploadInFlight = true;
    if (uploadSubmit) uploadSubmit.disabled = true;

    const uploadingText = uploadForm.dataset.uploadUploading || "Uploading files...";
    const processingText = uploadForm.dataset.uploadProcessing || "Upload finished, ingesting...";
    const errorText = uploadForm.dataset.uploadError || "Upload failed.";
    setUploadProgress(0, uploadingText);
    const directFiles = uploadFilesInput && uploadFilesInput.files ? Array.from(uploadFilesInput.files).filter((file) => file && file.name) : [];
    const zipFiles = uploadZipInput && uploadZipInput.files ? Array.from(uploadZipInput.files).filter((file) => file && file.name) : [];
    const useSequentialMode = directFiles.length + zipFiles.length > 1;
    const batchId = generateBatchId();
    if (uploadBatchField) {
      uploadBatchField.value = batchId;
    }

    if (!useSequentialMode) {
      if (uploadBatchField) {
        formData.set("upload_batch_id", batchId);
      }
      createUploadRequest(
        formData,
        batchId,
        (progressEvent) => {
          if (!progressEvent.lengthComputable) {
            setUploadProgress(0, uploadingText);
            return;
          }
          const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(percent, uploadingText);
        },
        (xhr) => {
          uploadInFlight = false;
          if (xhr.status >= 200 && xhr.status < 400 && typeof xhr.responseText === "string" && xhr.responseText) {
            setUploadProgress(100, processingText);
            document.open();
            document.write(xhr.responseText);
            document.close();
            return;
          }
          if (uploadSubmit) uploadSubmit.disabled = false;
          setUploadProgress(100, errorText);
        },
        () => {
          uploadInFlight = false;
          if (uploadSubmit) uploadSubmit.disabled = false;
          setUploadProgress(100, errorText);
        },
      );
      return;
    }

    const tasks = [];
    directFiles.forEach((file) => {
      tasks.push({ kind: "file", file, size: file.size || 0 });
    });
    zipFiles.forEach((file) => {
      tasks.push({ kind: "zip", file, size: file.size || 0 });
    });
    const totalBytes = tasks.reduce((sum, task) => sum + task.size, 0) || 1;
    let finishedBytes = 0;
    let currentIndex = 0;

    const runNextTask = () => {
      if (currentIndex >= tasks.length) {
        setUploadProgress(100, processingText);
        window.location.reload();
        return;
      }

      const task = tasks[currentIndex];
      const taskForm = new FormData();
      taskForm.set("csrf_token", csrfField ? csrfField.value : "");
      taskForm.set("lang", langField ? langField.value : "");
      taskForm.set("upload_batch_id", batchId);
      if (rightsCheckbox && rightsCheckbox.checked) {
        taskForm.set("rights_confirmed", "true");
      }
      if (task.kind === "file") {
        taskForm.append("files", task.file, task.file.name);
      } else {
        taskForm.append("zip_file", task.file, task.file.name);
      }

      createUploadRequest(
        taskForm,
        batchId,
        (progressEvent) => {
          if (!progressEvent.lengthComputable) {
            setUploadProgress(Math.round((finishedBytes / totalBytes) * 100), uploadingText);
            return;
          }
          const percent = Math.round(((finishedBytes + progressEvent.loaded) / totalBytes) * 100);
          setUploadProgress(percent, uploadingText);
        },
        (xhr) => {
          if (xhr.status < 200 || xhr.status >= 400) {
            uploadInFlight = false;
            if (uploadSubmit) uploadSubmit.disabled = false;
            setUploadProgress(100, errorText);
            return;
          }
          finishedBytes += task.size;
          currentIndex += 1;
          setUploadProgress(Math.round((finishedBytes / totalBytes) * 100), processingText);
          runNextTask();
        },
        () => {
          uploadInFlight = false;
          if (uploadSubmit) uploadSubmit.disabled = false;
          setUploadProgress(100, errorText);
        },
      );
    };

    runNextTask();
  });
} else {
  hideUploadProgress();
}
