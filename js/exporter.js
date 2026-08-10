(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const PX_PER_PT = 96 / 72;

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const EXT_BY_TYPE = {
    "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg",
    "application/pdf": "pdf", "text/markdown": "md", "application/json": "json"
  };

  async function saveBlob(blob, name, type) {
    if (window.showSaveFilePicker) {
      try {
        const ext = EXT_BY_TYPE[type] || String(name).split(".").pop();
        const handle = await window.showSaveFilePicker({
          suggestedName: name,
          types: [{ description: type, accept: { [type]: ["." + ext] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      } catch (err) {
        if (err && err.name === "AbortError") return false;
      }
    }
    download(blob, name);
    return true;
  }

  function buildSVG(bg) {
    const visible = M.Model.visibleNodes(M.Model.root);
    const bounds = M.Layout.bounds(visible);
    return M.Render.toSVGString(bounds, bg);
  }

  function svgToCanvas(svgStr, scale) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
    });
  }

  async function exportPNG(opts) {
    try {
      const svgStr = buildSVG(opts.bg);
      const canvas = await svgToCanvas(svgStr, opts.scale || 2);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const ok = await saveBlob(blob, "mindmap-" + stamp() + ".png", "image/png");
      if (ok) M.App.toast("\u5df2\u5bfc\u51fa PNG");
    } catch (err) {
      M.App.toast("\u5bfc\u51fa\u5931\u8d25\uff1a" + (err && err.message ? err.message : err), true);
    }
  }

  async function exportJPEG(opts) {
    try {
      const svgStr = buildSVG("white");
      const canvas = await svgToCanvas(svgStr, opts.scale || 2);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      const ok = await saveBlob(blob, "mindmap-" + stamp() + ".jpg", "image/jpeg");
      if (ok) M.App.toast("\u5df2\u5bfc\u51fa JPEG");
    } catch (err) {
      M.App.toast("\u5bfc\u51fa\u5931\u8d25\uff1a" + (err && err.message ? err.message : err), true);
    }
  }

  function exportSVG(opts) {
    try {
      const svgStr = buildSVG(opts.bg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      saveBlob(blob, "mindmap-" + stamp() + ".svg", "image/svg+xml")
        .then((ok) => { if (ok) M.App.toast("\u5df2\u5bfc\u51fa SVG"); });
    } catch (err) {
      M.App.toast("\u5bfc\u51fa\u5931\u8d25\uff1a" + (err && err.message ? err.message : err), true);
    }
  }

  function dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.split(",")[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function strToBytes(s) {
    const bytes = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
    return bytes;
  }

  function buildPDF(pages) {
    const toPt = (v) => v / PX_PER_PT;
    let out = "%PDF-1.4\n";
    const offsets = [];

    function addObject(body) {
      offsets.push(out.length);
      out += body + "\n";
    }

    addObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

    const kids = [];
    for (let i = 0; i < pages.length; i++) kids.push(3 + i * 3 + " 0 R");
    addObject("2 0 obj\n<< /Type /Pages /Kids [" + kids.join(" ") + "] /Count " + pages.length + " >>\nendobj");

    const imageObjs = [];
    pages.forEach((page, i) => {
      const pageNum = 3 + i * 3;
      const contentNum = pageNum + 1;
      const imageNum = pageNum + 2;
      const imgBytes = dataUrlToBytes(page.jpeg);

      const content = "q\n" + toPt(page.draw.w).toFixed(2) + " 0 0 " + toPt(page.draw.h).toFixed(2) +
        " " + toPt(page.draw.x).toFixed(2) + " " + toPt(page.draw.y).toFixed(2) + " cm\n/Im0 Do\nQ";
      const pageDict = pageNum + " 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
        page.w.toFixed(2) + " " + page.h.toFixed(2) + "] /Resources << /XObject << /Im0 " +
        imageNum + " 0 R >> >> /Contents " + contentNum + " 0 R >>\nendobj";
      addObject(pageDict);

      addObject(contentNum + " 0 obj\n<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream\nendobj");

      const imgDict = imageNum + " 0 obj\n<< /Type /XObject /Subtype /Image /Width " + page.imgW +
        " /Height " + page.imgH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
        imgBytes.length + " >>\nstream\n";
      offsets.push(out.length);
      out += imgDict;
      for (let i2 = 0; i2 < imgBytes.length; i2 += 30000) {
        out += String.fromCharCode.apply(null, imgBytes.subarray(i2, Math.min(i2 + 30000, imgBytes.length)));
      }
      out += "\nendstream\nendobj\n";
    });

    const xrefPos = out.length;
    out += "xref\n0 " + (offsets.length + 1) + "\n";
    out += "0000000000 65535 f \n";
    for (const off of offsets) {
      out += String(off).padStart(10, "0") + " 00000 n \n";
    }
    out += "trailer\n<< /Size " + (offsets.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefPos + "\n%%EOF";
    return out;
  }

  async function exportPDFSingle(opts) {
    try {
      const svgStr = buildSVG(opts.bg);
      const canvas = await svgToCanvas(svgStr, opts.scale || 2);
      const jpeg = canvas.toDataURL("image/jpeg", 0.92);
      const wPt = canvas.width / PX_PER_PT, hPt = canvas.height / PX_PER_PT;
      const pdf = buildPDF([{
        w: wPt, h: hPt,
        jpeg,
        imgW: canvas.width, imgH: canvas.height,
        draw: { x: 0, y: 0, w: canvas.width, h: canvas.height }
      }]);
      const ok = await saveBlob(new Blob([strToBytes(pdf)], { type: "application/pdf" }), "mindmap-" + stamp() + ".pdf", "application/pdf");
      if (ok) M.App.toast("\u5df2\u5bfc\u51fa PDF\uff08\u5355\u9875\uff09");
    } catch (err) {
      M.App.toast("\u5bfc\u51fa\u5931\u8d25\uff1a" + (err && err.message ? err.message : err), true);
    }
  }

  async function exportPDFMultipage(opts) {
    try {
      const svgStr = buildSVG("white");
      const canvas = await svgToCanvas(svgStr, Math.min(opts.scale || 2, 3));
    const A4W = Math.round(210 * PX_PER_PT);
    const A4H = Math.round(297 * PX_PER_PT);
    const MARGIN = 32;
    const cols = Math.max(1, Math.ceil(canvas.width / A4W));
    const rows = Math.max(1, Math.ceil(canvas.height / A4H));
    const pages = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const sx = c * A4W, sy = r * A4H;
        const sw = Math.min(A4W, canvas.width - sx);
        const sh = Math.min(A4H, canvas.height - sy);
        const tile = document.createElement("canvas");
        tile.width = sw; tile.height = sh;
        const tctx = tile.getContext("2d");
        tctx.fillStyle = "#ffffff";
        tctx.fillRect(0, 0, sw, sh);
        tctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
        const availW = A4W - MARGIN * 2, availH = A4H - MARGIN * 2;
        const scale = Math.min(availW / sw, availH / sh, 1);
        const dw = sw * scale, dh = sh * scale;
        const dx = (A4W - dw) / 2, dy = (A4H - dh) / 2;
        pages.push({
          w: A4W / PX_PER_PT, h: A4H / PX_PER_PT,
          jpeg: tile.toDataURL("image/jpeg", 0.9),
          imgW: sw, imgH: sh,
          draw: { x: dx, y: dy, w: dw, h: dh }
        });
      }
    }
    const pdf = buildPDF(pages);
    const ok = await saveBlob(new Blob([strToBytes(pdf)], { type: "application/pdf" }), "mindmap-" + stamp() + "-print.pdf", "application/pdf");
    if (ok) M.App.toast("\u5df2\u5bfc\u51fa PDF\uff08" + pages.length + " \u9875\uff09");
    } catch (err) {
      M.App.toast("\u5bfc\u51fa\u5931\u8d25\uff1a" + (err && err.message ? err.message : err), true);
    }
  }

  async function exportPDF(opts) {
    if (opts.multipage) await exportPDFMultipage(opts);
    else await exportPDFSingle(opts);
  }

  M.Exporter = { exportPNG, exportJPEG, exportSVG, exportPDF, saveBlob };
})();
