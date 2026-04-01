const els = {
  langCols: document.getElementById("langCols"),
  apiUrl: document.getElementById("apiUrl"),
  apiModel: document.getElementById("apiModel"),
  apiKey: document.getElementById("apiKey"),
  saveBtn: document.getElementById("saveBtn"),
  status: document.getElementById("status")
};

function setStatus(text, tone = "normal") {
  els.status.textContent = text || "";
  els.status.style.color =
    tone === "error" ? "#b91c1c" : tone === "ok" ? "#065f46" : "#374151";
}

function parseLanguages(input) {
  return String(input || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function storageSyncGet(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, (items) => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve(items);
    });
  });
}

function storageSyncSet(items) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      const err = chrome.runtime.lastError;
      if (err) reject(new Error(err.message));
      else resolve();
    });
  });
}

async function load() {
  const { languages, ocrApiUrl, ocrApiModel, ocrApiKey } = await storageSyncGet({ 
    languages: [],
    ocrApiUrl: "",
    ocrApiModel: "",
    ocrApiKey: ""
  });
  const langs = Array.isArray(languages) ? languages : [];
  els.langCols.value = langs.join(", ");
  els.apiUrl.value = ocrApiUrl || "";
  els.apiModel.value = ocrApiModel || "";
  els.apiKey.value = ocrApiKey || "";
}

els.saveBtn.addEventListener("click", async () => {
  setStatus("");
  els.saveBtn.disabled = true;
  try {
    const langs = parseLanguages(els.langCols.value);
    await storageSyncSet({ 
      languages: langs,
      ocrApiUrl: els.apiUrl.value.trim(),
      ocrApiModel: els.apiModel.value.trim(),
      ocrApiKey: els.apiKey.value.trim()
    });
    setStatus("设置已保存！未填写的项将使用插件内置的默认模型。", "ok");
  } catch (e) {
    setStatus(String(e && e.message ? e.message : e), "error");
  } finally {
    els.saveBtn.disabled = false;
  }
});

load();
