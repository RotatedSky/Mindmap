(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const KEY = "mindmap.data.v1";
  let saveTimer = null;

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(M.Model.serialize()));
      } catch (err) {
        if (err && err.name === "QuotaExceededError") {
          M.App.toast("\u6d4f\u89c8\u5668\u5b58\u50a8\u5df2\u6ee1\uff0c\u5efa\u8bae\u5bfc\u51fa JSON \u5907\u4efd\u5e76\u5220\u9664\u8d85\u5927\u56fe\u7247", true);
        }
      }
    }, 400);
  }

  function flush() {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(KEY, JSON.stringify(M.Model.serialize()));
    } catch (err) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      const obj = JSON.parse(raw);
      return M.Model.deserialize(obj);
    } catch (err) {
      return false;
    }
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(M.Model.serialize())], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mindmap-" + Date.now() + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    M.App.toast("\u5df2\u5bfc\u51fa JSON");
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

  M.Storage = { save, flush, load, exportJSON, importJSON, KEY };
})();
