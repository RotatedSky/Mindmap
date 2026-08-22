(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const MAX_INPUT_BYTES = 50 * 1024 * 1024;
  const RAW_LIMIT = 2 * 1024 * 1024;
  const MAX_DIM = 1600;
  const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
  const JPEG_QUALITY = 0.85;

  function isImageFile(file) {
    return !!file && /^image\//i.test(file.type || "");
  }

  function imageFileFromDataTransfer(dt) {
    if (!dt) return null;
    const items = Array.from(dt.items || []);
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile ? item.getAsFile() : null;
      if (isImageFile(file)) return file;
    }
    const files = Array.from(dt.files || []);
    return files.find(isImageFile) || null;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error("read-error"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("load-error"));
      img.src = src;
    });
  }

  function scaleSize(width, height, maxDim) {
    const max = Math.max(Number(width) || 0, Number(height) || 0);
    if (!max || max <= maxDim) {
      return { width: Math.max(1, Number(width) || 1), height: Math.max(1, Number(height) || 1), scale: 1 };
    }
    const scale = maxDim / max;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      scale
    };
  }

  function shouldCompress(file, width, height) {
    if (!file || /^image\/svg\+xml/i.test(file.type || "")) return false;
    if ((file.size || 0) > RAW_LIMIT) return true;
    return Math.max(Number(width) || 0, Number(height) || 0) > MAX_DIM;
  }

  function encodeCanvas(canvas, type, quality) {
    try {
      return canvas.toDataURL(type, quality);
    } catch (err) {
      return null;
    }
  }

  function compressRaster(img, file, opts) {
    const maxDim = (opts && opts.maxDim) || MAX_DIM;
    let quality = (opts && opts.quality) || JPEG_QUALITY;
    const isPng = /^image\/png/i.test(file && file.type ? file.type : "");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let dataUrl = null;
    let outW = 0;
    let outH = 0;
    let size = scaleSize(img.width, img.height, maxDim);
    let width = size.width;
    let height = size.height;

    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      if (isPng) {
        dataUrl = encodeCanvas(canvas, "image/png");
        if (dataUrl && dataUrl.length <= MAX_OUTPUT_BYTES * 1.34) {
          outW = width;
          outH = height;
          break;
        }
      }
      dataUrl = encodeCanvas(canvas, "image/jpeg", quality);
      if (dataUrl && dataUrl.length <= MAX_OUTPUT_BYTES * 1.34) {
        outW = width;
        outH = height;
        break;
      }
      width = Math.max(1, Math.round(width * 0.75));
      height = Math.max(1, Math.round(height * 0.75));
      quality = Math.max(0.6, quality - 0.08);
    }

    if (!dataUrl) dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return { dataUrl, width: outW || canvas.width, height: outH || canvas.height, compressed: true };
  }

  function readImageFile(file, opts) {
    if (!isImageFile(file)) return Promise.reject(new Error("not-image"));
    const maxInput = (opts && opts.maxInputBytes) || MAX_INPUT_BYTES;
    if ((file.size || 0) > maxInput) return Promise.reject(new Error("too-large"));
    return readFileAsDataURL(file).then((dataUrl) => {
      if (/^image\/svg\+xml/i.test(file.type || "")) {
        return { dataUrl, width: 0, height: 0, compressed: false };
      }
      return loadImage(dataUrl).then((img) => {
        if (!shouldCompress(file, img.width, img.height)) {
          return { dataUrl, width: img.width, height: img.height, compressed: false };
        }
        return compressRaster(img, file, opts);
      });
    });
  }

  M.Image = {
    isImageFile,
    imageFileFromDataTransfer,
    readImageFile,
    scaleSize,
    shouldCompress,
    compressRaster,
    MAX_INPUT_BYTES,
    RAW_LIMIT,
    MAX_DIM,
    MAX_OUTPUT_BYTES
  };
})();
