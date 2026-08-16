(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const KEY = "mindmap.data.v1";
  const DB_NAME = "mindmap";
  const DB_STORE = "kv";
  const DB_RECORD = "data.v1";
  let dbPromise = null;
  let saveTimer = null;

  function idbSupported() {
    return typeof indexedDB !== "undefined";
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      if (!idbSupported()) return resolve(null);
      try {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const d = req.result;
          if (d && !d.objectStoreNames.contains(DB_STORE)) d.createObjectStore(DB_STORE);
        };
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
    return dbPromise;
  }

  function dbPut(json) {
    return openDB().then((d) => new Promise((resolve) => {
      if (!d) return resolve(false);
      try {
        const req = d.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(json, DB_RECORD);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
      } catch (err) { resolve(false); }
    }));
  }

  function dbGet() {
    return openDB().then((d) => new Promise((resolve) => {
      if (!d) return resolve(null);
      try {
        const req = d.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(DB_RECORD);
        req.onsuccess = () => resolve(req.result != null ? req.result : null);
        req.onerror = () => resolve(null);
      } catch (err) { resolve(null); }
    }));
  }

  function mirrorLocal(json) {
    try {
      localStorage.setItem(KEY, json);
    } catch (err) {
      if (err && err.name === "QuotaExceededError") {
        M.App.toast("\u6d4f\u89c8\u5668\u5b58\u50a8\u5df2\u6ee1\uff0c\u5927\u56fe\u7247\u5df2\u5165\u672c\u5730\u6570\u636e\u5e93\uff08IndexedDB\uff09", true);
      }
    }
  }

  function persist() {
    const json = JSON.stringify(M.Model.serialize());
    mirrorLocal(json);
    dbPut(json);
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 400);
  }

  function flush() {
    clearTimeout(saveTimer);
    const json = JSON.stringify(M.Model.serialize());
    mirrorLocal(json);
    dbPut(json);
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      return M.Model.deserialize(JSON.parse(raw));
    } catch (err) {
      return false;
    }
  }

  function init() {
    return dbGet().then((idbRaw) => {
      if (idbRaw) {
        try { return M.Model.deserialize(JSON.parse(idbRaw)); } catch (err) { /* 损坏回退 */ }
        return load();
      }
      const ok = load();
      if (ok) dbPut(JSON.stringify(M.Model.serialize()));
      return ok;
    }).catch(() => load());
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(M.Model.serialize())], { type: "application/json" });
    const title = String(M.Model.root.text || "").trim()
      .replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    return M.Exporter.saveBlob(blob, (title || "mindmap") + "-" + Date.now() + ".json", "application/json")
      .then((ok) => { if (ok) M.App.toast("\u5df2\u5bfc\u51fa JSON"); return ok; });
  }

  const FILE_TYPES = [{ description: "\u601d\u7eea\u56fe\u6587\u4ef6", accept: { "application/json": [".mind", ".json"] } }];

  let fileHandle = null;
  let fileName = null;
  let saveFormat = "json";

  function buildContent(format) {
    if (format === "md") return M.Markdown.serialize(M.Model.root);
    return JSON.stringify(M.Model.serialize());
  }

  function writeHandle(handle, content, name, format) {
    return handle.createWritable()
      .then((w) => w.write(content).then(() => w.close()))
      .then(() => {
        fileHandle = handle;
        fileName = name;
        saveFormat = format;
        M.App.toast("\u5df2\u4fdd\u5b58 " + name);
        return true;
      })
      .catch(() => {
        fileHandle = null;
        M.App.toast("\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u91cd\u65b0\u9009\u62e9\u4fdd\u5b58\u683c\u5f0f", true);
        return M.App.showSaveDialog();
      });
  }

  function parseAndLoad(text) {
    const obj = JSON.parse(text);
    if (!obj || !obj.root) throw new Error("bad");
    M.Model.deserialize(obj);
  }

  function openFile() {
    if (window.showOpenFilePicker) {
      return window.showOpenFilePicker({ types: FILE_TYPES, multiple: false })
        .then(([h]) => {
          fileHandle = h;
          return h.getFile().then((f) => f.text()).then((text) => {
            try {
              parseAndLoad(text);
              fileName = h.name;
              saveFormat = /\.md$/i.test(h.name) ? "md" : "json";
              M.App.toast("\u5df2\u6253\u5f00 " + h.name);
              return true;
            } catch (err) {
              fileHandle = null;
              M.App.toast("\u6587\u4ef6\u683c\u5f0f\u4e0d\u6b63\u786e", true);
              return false;
            }
          });
        })
        .catch((err) => {
          if (err && err.name === "AbortError") return false;
          throw err;
        });
    }
    return null;
  }

  function saveToFile() {
    if (fileHandle) {
      return writeHandle(fileHandle, buildContent(saveFormat), fileName, saveFormat);
    }
    return M.App.showSaveDialog();
  }

  function saveAs(format) {
    const content = buildContent(format);
    const ext = format === "md" ? "md" : format;
    const type = format === "md" ? "text/markdown" : "application/json";
    const title = String(M.Model.root.text || "").trim()
      .replace(/[\\/:*?"<>|\r\n]+/g, " ").replace(/\s+/g, " ").trim();
    const name = (title || "mindmap") + "." + ext;
    if (window.showSaveFilePicker) {
      return window.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: format === "md" ? "Markdown" : "\u601d\u7eea\u56fe\u6587\u4ef6", accept: { [type]: ["." + ext] } }]
      })
        .then((h) => writeHandle(h, content, h.name, format))
        .catch((err) => {
          if (err && err.name === "AbortError") return false;
          M.App.toast("\u4fdd\u5b58\u5931\u8d25\uff1a\u65e0\u6cd5\u5199\u5165\u6240\u9009\u6587\u4ef6", true);
          return false;
        });
    }
    const blob = new Blob([content], { type });
    return M.Exporter.saveBlob(blob, name, type)
      .then((ok) => { if (ok) M.App.toast("\u5df2\u4fdd\u5b58 " + name); return ok; });
  }

  function importJSON(file) {
    fileHandle = null;
    fileName = null;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || !obj.root) throw new Error("bad");
        M.Model.deserialize(obj);
        M.App.toast("\u5bfc\u5165\u6210\u529f");
      } catch (err) {
        M.App.toast("\u6587\u4ef6\u683c\u5f0f\u4e0d\u6b63\u786e", true);
      }
    };
    reader.readAsText(file);
  }

  function clearFile() {
    fileHandle = null;
    fileName = null;
    saveFormat = "json";
  }

  M.Storage = { save, flush, load, init, openFile, saveToFile, saveAs, exportJSON, importJSON, clearFile, KEY };
})();