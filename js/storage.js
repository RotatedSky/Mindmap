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

  function importJSON(file) {
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

  const FILE_TYPES = [{ description: "\u601d\u7eea\u56fe\u6587\u4ef6", accept: { "application/json": [".mind", ".json"] } }];

  let fileHandle = null;
  let fileName = null;

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
    const json = JSON.stringify(M.Model.serialize());
    if (fileHandle) {
      return fileHandle.createWritable()
        .then((w) => w.write(json).then(() => w.close()))
        .then(() => { M.App.toast("\u5df2\u4fdd\u5b58 " + fileName); return true; })
        .catch(() => {
          fileHandle = null;
          M.App.toast("\u4fdd\u5b58\u5931\u8d25\uff0c\u5df2\u8f6c\u4e3a\u53e6\u5b58\u4e3a", true);
          return exportJSON();
        });
    }
    return exportJSON();
  }

  M.Storage = { save, flush, load, init, openFile, saveToFile, exportJSON, importJSON, KEY };
})();