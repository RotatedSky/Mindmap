(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const COLORS = ["#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c", "#3498db", "#2980b9", "#9b59b6", "#8e44ad", "#f39c12", "#95a5a6", "#16a085"];

  const ed = {
    wrap: null,
    svg: null,
    pointers: new Map(),
    mode: null,
    panStart: null,
    dragNodeId: null,
    dragStart: null,
    moved: false,
    pinchStart: null,
    editInput: null,
    editingNodeId: null,
    ctxNodeId: null,
    longPressTimer: null,
    isEditing: false,
    connectFrom: null,
    selectedRelId: null,
    selectedFrameId: null,
    dragRelId: null,
    relDragKind: null,
    relDragStart: null,
    relDragBasis: null,
    relCp1: null,
    relCp2: null,
    marqueeStart: null,
    marqueeEl: null,
    marqueeBase: null,
    marqueeHits: null
  };

  function isTypingTarget(t) {
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
  }

  function isOverlayOpen() {
    return !!document.querySelector(".modal-mask") ||
      (M.Search && M.Search.isOpen());
  }

  function init(wrap, svg) {
    ed.wrap = wrap;
    ed.svg = svg;

    svg.addEventListener("wheel", onWheel, { passive: false });
    svg.addEventListener("pointerdown", onPointerDown);
    svg.addEventListener("pointermove", onPointerMove);
    svg.addEventListener("pointerup", onPointerUp);
    svg.addEventListener("pointercancel", onPointerUp);
    svg.addEventListener("dblclick", onDblClick);
    svg.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", () => M.Render.fit());

    ed.editInput = document.getElementById("edit-overlay");
    ed.editInput.addEventListener("keydown", onEditKeyDown);
    ed.editInput.querySelector("textarea").addEventListener("blur", commitEdit);
    ed.editInput.querySelector("textarea").addEventListener("compositionend", onCompositionEnd);
  }

  function targetNode(e) {
    const n = e.target && e.target.closest ? e.target.closest(".node") : null;
    if (!n) return null;
    const id = n.getAttribute("data-id");
    return M.Model.find(M.Model.root, id);
  }

  function targetBtn(e, cls) {
    const el = e.target && e.target.closest ? e.target.closest("." + cls) : null;
    if (!el) return null;
    return M.Model.find(M.Model.root, el.getAttribute("data-id"));
  }

  function targetRel(e) {
    const el = e.target && e.target.closest ? e.target.closest(".rel-hit, .rel-label, .rel-handle") : null;
    if (!el) return null;
    const id = el.getAttribute("data-id");
    return M.Model.relations.find((r) => r.id === id) || null;
  }

  function targetFrame(e) {
    const el = e.target && e.target.closest ? e.target.closest(".frame-hit, .frame-label") : null;
    if (!el) return null;
    return M.Model.frames.find((f) => f.id === el.getAttribute("data-id")) || null;
  }

  function selectFrame(id) {
    ed.selectedFrameId = id;
    M.Render.render();
  }

  function hitNodeForRel(wx, wy, excludeId) {
    let best = null, bestArea = Infinity;
    for (const n of M.Model.visibleNodes(M.Model.root)) {
      if (n.id === excludeId) continue;
      if (Math.abs(wx - n.x) <= n.w / 2 && Math.abs(wy - n.y) <= n.h / 2) {
        const area = n.w * n.h;
        if (area < bestArea) { best = n; bestArea = area; }
      }
    }
    return best;
  }

  function selectRelation(id) {
    ed.selectedRelId = id;
    M.Render.render();
  }

  function startConnect(node) {
    ed.connectFrom = node.id;
    M.App.toast("\u70b9\u51fb\u76ee\u6807\u8282\u70b9\u5b8c\u6210\u8fde\u7ebf\uff0cEsc \u53d6\u6d88");
    const preview = document.getElementById("rel-preview");
    if (preview) {
      preview.setAttribute("d", "M " + node.x + " " + node.y + " L " + node.x + " " + node.y);
      preview.style.display = "block";
    }
  }

  function endConnect() {
    ed.connectFrom = null;
    const preview = document.getElementById("rel-preview");
    if (preview) preview.style.display = "none";
  }

  function updatePreview(toX, toY) {
    if (!ed.connectFrom) return;
    const node = M.Model.find(M.Model.root, ed.connectFrom);
    const preview = document.getElementById("rel-preview");
    if (node && preview) {
      preview.setAttribute("d", "M " + node.x + " " + node.y + " L " + toX + " " + toY);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = ed.svg.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    const v = M.Render.view;
    const pt = M.Render.screenToWorld(cx, cy);
    let s = v.s * Math.pow(1.0016, -e.deltaY);
    s = Math.max(0.05, Math.min(4, s));
    M.Render.setTransform(cx - pt.x * s, cy - pt.y * s, s);
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    if (ed.isEditing) {
      if (ed.editInput.contains(e.target)) return;
      commitEdit();
    }
    ed.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ed.pointers.size === 2) {
      startPinch();
      return;
    }

    const foldNode = targetBtn(e, "fold-btn");
    if (foldNode) {
      M.Model.change(() => {
        foldNode.collapsed = !foldNode.collapsed;
      });
      M.Model.selectNode(foldNode, false);
      M.Search && M.Search.refresh();
      return;
    }
    const linkNode = targetBtn(e, "link-btn");
    if (linkNode && linkNode.link) {
      window.open(linkNode.link, "_blank", "noopener");
      return;
    }
    const rel = targetRel(e);
    if (rel) {
      if (ed.connectFrom) endConnect();
      selectRelation(rel.id);
      ed.selectedFrameId = null;
      ed.mode = "relation";
      ed.dragRelId = rel.id;
      ed.relDragStart = { x: e.clientX, y: e.clientY };
      ed.moved = false;
      const rect = ed.svg.getBoundingClientRect();
      const w = M.Render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const geo = M.Render.relationGeometry(rel);
      if (!geo) { ed.mode = null; ed.dragRelId = null; return; }
      const grab = 20 / M.Render.view.s;
      if (Math.hypot(w.x - geo.pa.x, w.y - geo.pa.y) <= grab) ed.relDragKind = "from";
      else if (Math.hypot(w.x - geo.pb.x, w.y - geo.pb.y) <= grab) ed.relDragKind = "to";
      else if (Math.hypot(w.x - geo.c1.x, w.y - geo.c1.y) <= grab) ed.relDragKind = "1";
      else if (Math.hypot(w.x - geo.c2.x, w.y - geo.c2.y) <= grab) ed.relDragKind = "2";
      else ed.relDragKind = Math.hypot(w.x - geo.c1.x, w.y - geo.c1.y) <= Math.hypot(w.x - geo.c2.x, w.y - geo.c2.y) ? "1" : "2";
      ed.relDragBasis = { tx: geo.tx, ty: geo.ty, nx: geo.nx, ny: geo.ny };
      ed.relCp1 = {
        a: (geo.c1.x - geo.pa.x) * geo.tx + (geo.c1.y - geo.pa.y) * geo.ty,
        b: (geo.c1.x - geo.pa.x) * geo.nx + (geo.c1.y - geo.pa.y) * geo.ny
      };
      ed.relCp2 = {
        c: (geo.pb.x - geo.c2.x) * geo.tx + (geo.pb.y - geo.c2.y) * geo.ty,
        d: (geo.c2.x - geo.pb.x) * geo.nx + (geo.c2.y - geo.pb.y) * geo.ny
      };
      return;
    }
    const frame = targetFrame(e);
    if (frame) {
      if (ed.connectFrom) endConnect();
      selectFrame(frame.id);
      ed.mode = "frame";
      return;
    }
    const node = targetNode(e);
    if (node) {
      ed.selectedFrameId = null;
      if (ed.connectFrom) {
        if (node.id !== ed.connectFrom) {
          let created = null;
          M.Model.change(() => { created = M.Model.addRelation(ed.connectFrom, node.id); });
          if (created) M.App.toast("\u5df2\u521b\u5efa\u5173\u8054");
          else M.App.toast("\u5df2\u5b58\u5728\u76f8\u540c\u5173\u8054", true);
          endConnect();
        }
        return;
      }
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        M.Model.selectNode(node, true);
      } else if (!M.Model.selectedNodes().some((n) => n.id === node.id)) {
        M.Model.selectNode(node, false);
      }
      ed.mode = "node";
      ed.dragNodeId = node.id;
      ed.dragStart = { x: e.clientX, y: e.clientY };
      ed.moved = false;
      scheduleLongPress(e, node);
    } else {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        ed.mode = "marquee";
        ed.marqueeStart = { x: e.clientX, y: e.clientY };
        ed.marqueeBase = new Set(M.Model.selectedNodes().map((n) => n.id));
        return;
      }
      selectRelation(null);
      ed.selectedFrameId = null;
      ed.mode = "pan";
      ed.panStart = { x: e.clientX, y: e.clientY, tx: M.Render.view.tx, ty: M.Render.view.ty };
      ed.svg.classList.add("panning");
    }
  }

  function scheduleLongPress(e, node) {
    clearTimeout(ed.longPressTimer);
    ed.longPressTimer = setTimeout(() => {
      if (ed.mode === "node" && !ed.moved && ed.pointers.size === 1 && !ed.isEditing) {
        const rect = ed.svg.getBoundingClientRect();
        showContextMenu(e.clientX - rect.left, e.clientY - rect.top, node);
      }
    }, 550);
  }

  function startPinch() {
    const pts = [...ed.pointers.values()];
    ed.mode = "pinch";
    clearTimeout(ed.longPressTimer);
    const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
    ed.pinchStart = {
      dist: Math.hypot(dx, dy),
      midX: (pts[0].x + pts[1].x) / 2,
      midY: (pts[0].y + pts[1].y) / 2,
      tx: M.Render.view.tx,
      ty: M.Render.view.ty,
      s: M.Render.view.s
    };
  }

  function onPointerMove(e) {
    if (!ed.pointers.has(e.pointerId)) return;
    const prev = ed.pointers.get(e.pointerId);
    ed.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (ed.connectFrom) {
      const rect = ed.svg.getBoundingClientRect();
      const w = M.Render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      updatePreview(w.x, w.y);
      return;
    }

    if (ed.mode === "pinch" && ed.pointers.size === 2) {
      const pts = [...ed.pointers.values()];
      const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
      const rect = ed.svg.getBoundingClientRect();
      const cx = midX - rect.left, cy = midY - rect.top;
      const pt = M.Render.screenToWorld(cx, cy);
      let s = ed.pinchStart.s * (dist / ed.pinchStart.dist);
      s = Math.max(0.05, Math.min(4, s));
      M.Render.setTransform(cx - pt.x * s, cy - pt.y * s, s);
      return;
    }

    if (ed.mode === "pan") {
      const dx = e.clientX - ed.panStart.x, dy = e.clientY - ed.panStart.y;
      M.Render.setTransform(ed.panStart.tx + dx, ed.panStart.ty + dy, M.Render.view.s);
      return;
    }

    if (ed.mode === "marquee") {
      const ddx = e.clientX - ed.marqueeStart.x, ddy = e.clientY - ed.marqueeStart.y;
      if (!ed.moved && Math.hypot(ddx, ddy) < 4) return;
      if (!ed.moved) {
        ed.moved = true;
        ed.svg.setPointerCapture(e.pointerId);
      }
      const rect = ed.svg.getBoundingClientRect();
      const x1 = Math.min(ed.marqueeStart.x, e.clientX) - rect.left;
      const y1 = Math.min(ed.marqueeStart.y, e.clientY) - rect.top;
      const x2 = Math.max(ed.marqueeStart.x, e.clientX) - rect.left;
      const y2 = Math.max(ed.marqueeStart.y, e.clientY) - rect.top;
      const w1 = M.Render.screenToWorld(x1, y1);
      const w2 = M.Render.screenToWorld(x2, y2);
      if (!ed.marqueeEl) {
        ed.marqueeEl = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        ed.marqueeEl.setAttribute("class", "marquee");
        ed.svg.appendChild(ed.marqueeEl);
      }
      ed.marqueeEl.setAttribute("x", w1.x);
      ed.marqueeEl.setAttribute("y", w1.y);
      ed.marqueeEl.setAttribute("width", w2.x - w1.x);
      ed.marqueeEl.setAttribute("height", w2.y - w1.y);
      ed.marqueeHits = [];
      for (const n of M.Model.visibleNodes(M.Model.root)) {
        if (n.x - n.w / 2 <= w2.x && n.x + n.w / 2 >= w1.x &&
          n.y - n.h / 2 <= w2.y && n.y + n.h / 2 >= w1.y) {
          ed.marqueeHits.push(n.id);
        }
      }
      const sel = new Set(ed.marqueeBase);
      for (const id of ed.marqueeHits) sel.add(id);
      for (const [id, el] of M.Render.view.nodeEls) {
        el.classList.toggle("selected", sel.has(id));
      }
      return;
    }

    if (ed.mode === "relation" && ed.dragRelId) {
      const rel = M.Model.relations.find((r) => r.id === ed.dragRelId);
      if (!rel) return;
      const ddx = e.clientX - ed.relDragStart.x, ddy = e.clientY - ed.relDragStart.y;
      if (!ed.moved && Math.hypot(ddx, ddy) < 4) return;
      if (!ed.moved) {
        ed.moved = true;
        ed.svg.setPointerCapture(e.pointerId);
        if (ed.relDragKind !== "from" && ed.relDragKind !== "to") M.Model.record();
      }
      const rect = ed.svg.getBoundingClientRect();
      const v = M.Render.view;
      const w = M.Render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      if (ed.relDragKind === "1" || ed.relDragKind === "2") {
        const dx = ddx / v.s, dy = ddy / v.s;
        const da = dx * ed.relDragBasis.tx + dy * ed.relDragBasis.ty;
        const db = dx * ed.relDragBasis.nx + dy * ed.relDragBasis.ny;
        if (ed.relDragKind === "1") {
          rel.cp1 = { a: ed.relCp1.a + da, b: ed.relCp1.b + db };
          rel.cp2 = { c: ed.relCp2.c, d: ed.relCp2.d };
        } else {
          rel.cp2 = { c: ed.relCp2.c - da, d: ed.relCp2.d + db };
          rel.cp1 = { a: ed.relCp1.a, b: ed.relCp1.b };
        }
        M.Render.updateRelation(rel.id);
      } else {
        const keep = ed.relDragKind === "from" ? rel.to : rel.from;
        const target = hitNodeForRel(w.x, w.y, keep);
        for (const [id, el] of M.Render.view.nodeEls) {
          el.classList.toggle("drop-target", id === (target && target.id));
        }
        M.Render.updateRelation(rel.id, M.Render.relationGeometry(rel, null,
          ed.relDragKind === "from" ? { from: w } : { to: w }));
      }
      return;
    }

    if (ed.mode === "node" && ed.dragNodeId) {
      const dx = e.clientX - ed.dragStart.x, dy = e.clientY - ed.dragStart.y;
      if (Math.hypot(dx, dy) > 4) {
        ed.moved = true;
        clearTimeout(ed.longPressTimer);
        ed.svg.setPointerCapture(e.pointerId);
        const v = M.Render.view;
        v.oldT = { x: v.tx, y: v.ty };
        const node = M.Model.find(M.Model.root, ed.dragNodeId);
        if (!node) return;
        if (M.Model.settings.layoutMode === "free") {
          dragFreeMove(node, e.clientX - ed.dragStart.x, e.clientY - ed.dragStart.y);
        } else {
          dragTreePreview(e);
        }
      }
    }
  }

  function dragFreeMove(node, dx, dy) {
    const s = M.Render.view.s;
    const sel = M.Model.selectedNodes();
    if (!sel.some((n) => n.id === node.id)) return;
    if (!ed.freeDragRecorded) {
      M.Model.record();
      ed.freeDragRecorded = true;
      ed.freeLastDx = 0;
      ed.freeLastDy = 0;
    }
    const stepX = (dx - ed.freeLastDx) / s;
    const stepY = (dy - ed.freeLastDy) / s;
    ed.freeLastDx = dx;
    ed.freeLastDy = dy;
    const ids = [];
    for (const n of sel) {
      if (!n.freePos) n.freePos = { x: n.x, y: n.y };
      n.freePos.x += stepX;
      n.freePos.y += stepY;
      n.x = n.freePos.x;
      n.y = n.freePos.y;
      ids.push(n.id);
    }
    M.Render.updateFreeDrag(ids);
  }

  function dragTreePreview(e) {
    const rect = ed.svg.getBoundingClientRect();
    const w = M.Render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const node = M.Model.find(M.Model.root, ed.dragNodeId);
    const target = hitNodeAt(w.x, w.y, node);
    for (const [id, el] of M.Render.view.nodeEls) {
      el.classList.toggle("drop-target", id === (target && target.id));
    }
  }

  function hitNodeAt(wx, wy, self) {
    let best = null, bestArea = Infinity;
    for (const n of M.Model.visibleNodes(M.Model.root)) {
      if (n === self || M.Model.isDescendant(n, self)) continue;
      if (Math.abs(wx - n.x) <= n.w / 2 && Math.abs(wy - n.y) <= n.h / 2) {
        const area = n.w * n.h;
        if (area < bestArea) { best = n; bestArea = area; }
      }
    }
    return best;
  }

  function onPointerUp(e) {
    ed.pointers.delete(e.pointerId);
    clearTimeout(ed.longPressTimer);
    if (ed.mode === "pinch") {
      ed.mode = null;
      return;
    }
    if (ed.mode === "pan") {
      ed.svg.classList.remove("panning");
      ed.mode = null;
      return;
    }
    if (ed.mode === "marquee") {
      if (ed.moved) {
        const ids = new Set(ed.marqueeBase);
        for (const id of (ed.marqueeHits || [])) ids.add(id);
        ed.selectedFrameId = null;
        M.Model.setSelection(ids);
      }
      if (ed.marqueeEl) { ed.marqueeEl.remove(); ed.marqueeEl = null; }
      ed.marqueeStart = null;
      ed.marqueeBase = null;
      ed.marqueeHits = null;
      ed.moved = false;
      ed.mode = null;
      return;
    }
    if (ed.mode === "frame") {
      ed.mode = null;
      return;
    }
    if (ed.mode === "node") {
      const node = M.Model.find(M.Model.root, ed.dragNodeId);
      ed.dragNodeId = null;
      if (ed.moved) {
        if (M.Model.settings.layoutMode === "tree") {
          const rect = ed.svg.getBoundingClientRect();
          const w = M.Render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          const target = hitNodeAt(w.x, w.y, node);
          for (const el of M.Render.view.nodeEls.values()) el.classList.remove("drop-target");
          if (target && node) {
            M.Model.change(() => M.Model.moveNode(node, target));
          }
        } else if (ed.freeDragRecorded) {
          ed.freeDragRecorded = false;
          M.Model.touch();
        }
        M.Render.applySelectionClasses();
      }
      ed.mode = null;
      return;
    }
    if (ed.mode === "relation") {
      const rel = ed.dragRelId ? M.Model.relations.find((r) => r.id === ed.dragRelId) : null;
      if (rel && ed.moved) {
        if (ed.relDragKind !== "from" && ed.relDragKind !== "to") {
          M.Model.touch();
        } else {
          const rect = ed.svg.getBoundingClientRect();
          const w = M.Render.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          const keep = ed.relDragKind === "from" ? rel.to : rel.from;
          const target = hitNodeForRel(w.x, w.y, keep);
          if (target) {
            M.Model.change(() => {
              if (ed.relDragKind === "from") rel.from = target.id;
              else rel.to = target.id;
            });
            M.App.toast("\u5df2\u91cd\u65b0\u8fde\u63a5\u5173\u8054");
          }
          for (const el of M.Render.view.nodeEls.values()) el.classList.remove("drop-target");
        }
      }
      ed.dragRelId = null;
      ed.relDragKind = null;
      ed.moved = false;
      ed.mode = null;
      M.Render.render();
      return;
    }
    ed.mode = null;
  }

  function onDblClick(e) {
    const node = targetNode(e);
    if (node) beginEdit(node);
  }

  function onContextMenu(e) {
    e.preventDefault();
    const rect = ed.svg.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    const rel = targetRel(e);
    if (rel) {
      showRelMenu(x, y, rel);
      return;
    }
    const frame = targetFrame(e);
    if (frame) {
      showFrameMenu(x, y, frame);
      return;
    }
    const node = targetNode(e);
    showContextMenu(x, y, node);
  }

  function showFrameMenu(x, y, frame) {
    selectFrame(frame.id);
    hideContextMenu();
    const menu = document.getElementById("ctx-menu");
    menu.innerHTML = "";
    const add = (html, fn) => {
      const div = document.createElement("div");
      div.className = "ctx-item";
      div.innerHTML = html;
      div.addEventListener("click", (e) => { e.stopPropagation(); hideContextMenu(); fn(); });
      menu.appendChild(div);
    };
    add("\u270f\u2002\u7f16\u8f91\u6807\u7b7e\u2026", () => {
      M.App.modal({
        title: "\u5916\u6846\u6807\u7b7e",
        body: "<div class='m-row'><label>\u6807\u7b7e\u5185\u5bb9</label><input type='text' id='modal-frame-label' maxlength='30' placeholder='\u4f8b\u5982\uff1a\u7b2c\u4e00\u7ec4\u8282\u70b9' value='" + (frame.label || "") + "'></div>",
        ok: "\u4fdd\u5b58",
        onOk: (root) => {
          const v = root.querySelector("#modal-frame-label").value.trim();
          M.Model.change(() => M.Model.setFrameLabel(frame.id, v));
          return true;
        }
      });
    });
    add("\ud83d\uddd1\u2002\u5220\u9664\u5916\u6846", () => {
      M.Model.change(() => {
        M.Model.removeFrame(frame.id);
        if (ed.selectedFrameId === frame.id) ed.selectedFrameId = null;
      });
    });
    const rect = ed.svg.getBoundingClientRect();
    menu.style.display = "block";
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = ed.wrap.clientWidth, vh = ed.wrap.clientHeight;
    menu.style.left = Math.min(x, vw - mw - 6) + "px";
    menu.style.top = Math.min(y, vh - mh - 6) + "px";
  }

  function showRelMenu(x, y, rel) {
    selectRelation(rel.id);
    hideContextMenu();
    const menu = document.getElementById("ctx-menu");
    menu.innerHTML = "";
    const add = (html, fn) => {
      const div = document.createElement("div");
      div.className = "ctx-item";
      div.innerHTML = html;
      div.addEventListener("click", (e) => { e.stopPropagation(); hideContextMenu(); fn(); });
      menu.appendChild(div);
    };
    add("\u270f\u2002\u7f16\u8f91\u6ce8\u91ca\u2026", () => {
      M.App.modal({
        title: "\u5173\u8054\u6ce8\u91ca",
        body: "<div class='m-row'><label>\u6ce8\u91ca\u5185\u5bb9</label><input type='text' id='modal-rel-label' maxlength='60' placeholder='\u4f8b\u5982\uff1a\u4f9d\u8d56\u3001\u5173\u8054\u3001\u91cd\u8981' value='" + (rel.label || "") + "'></div>",
        ok: "\u4fdd\u5b58",
        onOk: (root) => {
          const v = root.querySelector("#modal-rel-label").value.trim();
          M.Model.change(() => M.Model.setRelationLabel(rel.id, v));
          return true;
        }
      });
    });
    add("\ud83d\uddd1\u2002\u5220\u9664\u5173\u8054", () => {
      M.Model.change(() => {
        M.Model.removeRelation(rel.id);
        if (ed.selectedRelId === rel.id) ed.selectedRelId = null;
      });
    });
    add("\u21c4\u2002\u53cd\u8f6c\u65b9\u5411", () => {
      M.Model.change(() => {
        const tmp = rel.from;
        rel.from = rel.to;
        rel.to = tmp;
      });
    });
    const rect = ed.svg.getBoundingClientRect();
    menu.style.display = "block";
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = ed.wrap.clientWidth, vh = ed.wrap.clientHeight;
    menu.style.left = Math.min(x, vw - mw - 6) + "px";
    menu.style.top = Math.min(y, vh - mh - 6) + "px";
  }

  function onDocPointerDown(e) {
    const menu = document.getElementById("ctx-menu");
    if (menu.style.display !== "none" && !menu.contains(e.target)) {
      hideContextMenu();
    }
    if (!ed.wrap.contains(e.target) && !isTypingTarget(e.target)) {
      hideContextMenu();
    }
  }

  function beginEdit(node) {
    if (ed.isEditing) return;
    ed.isEditing = true;
    ed.editingNodeId = node.id;
    M.Model.setPrimary(node.id);
    const input = ed.editInput.querySelector("textarea");
    input.value = node.text || "";
    input.style.textAlign = "center";
    const theme = M.Theme.get();
    const isRoot = node.depth === 0;
    const font = (isRoot ? 700 : 500) + " " + (isRoot ? theme.rootFs : theme.nodeFs) + "px " + theme.fontFamily;
    const wrapped = M.Layout.wrapText(input.value, M.Layout.MAX_W, font).length;
    input.rows = Math.max(1, Math.min(8, wrapped));
    input.style.fontSize = (isRoot ? theme.rootFs : theme.nodeFs) + "px";
    ed.editInput.style.display = "block";
    repositionEdit();
    input.focus();
    input.select();
  }

  function repositionEdit() {
    if (!ed.isEditing) return;
    const node = M.Model.find(M.Model.root, ed.editingNodeId);
    if (!node) return;
    const p = M.Render.worldToScreen(node.x, node.y);
    const s = M.Render.view.s;
    ed.editInput.style.left = p.x + "px";
    ed.editInput.style.top = p.y + "px";
    ed.editInput.style.width = Math.max(80, node.w * s + 6) + "px";
    ed.editInput.style.height = Math.max(28, node.h * s - 2) + "px";
  }

  function onEditKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.isComposing) {
        ed.imeEnterPending = true;
        return;
      }
      e.preventDefault();
      ed.imeEnterPending = false;
      commitEdit();
    } else if (e.key === "Escape") {
      cancelEdit();
    }
  }

  function onCompositionEnd() {
    if (ed.imeEnterPending) {
      ed.imeEnterPending = false;
      commitEdit();
    }
  }

  function currentEditText() {
    return ed.editInput.querySelector("textarea").value;
  }

  function commitEdit() {
    if (!ed.isEditing) return;
    const node = M.Model.find(M.Model.root, ed.editingNodeId);
    const text = currentEditText().trim();
    ed.isEditing = false;
    ed.editingNodeId = null;
    ed.editInput.style.display = "none";
    if (!node) return;
    if (!text) {
      M.Model.change(() => {
        if (node === M.Model.root) node.text = "\u672a\u547d\u540d";
        else M.Model.removeNode(node);
      });
    } else if (node.text !== text) {
      M.Model.change(() => { node.text = text; });
    }
    M.Render.render();
  }

  function cancelEdit() {
    ed.isEditing = false;
    ed.editingNodeId = null;
    ed.editInput.style.display = "none";
  }

  function deleteSelection() {
    const nodes = M.Model.selectedNodes();
    if (!nodes.length) return;
    M.Model.change(() => {
      for (const n of nodes) M.Model.removeNode(n);
    });
    M.Render.render();
  }

  function toggleCollapsePrimary() {
    const n = M.Model.primaryNode();
    if (!n) return;
    M.Model.change(() => { n.collapsed = !n.collapsed; });
    M.Search && M.Search.refresh();
    M.Render.render();
  }

  function setCollapsePrimary(collapsed) {
    const n = M.Model.primaryNode();
    if (!n) return;
    M.Model.change(() => { n.collapsed = collapsed; });
    M.Search && M.Search.refresh();
    M.Render.render();
  }

  function onKeyDown(e) {
    if (isTypingTarget(e.target) || ed.isEditing) {
      if (e.key === "Escape" && ed.isEditing) cancelEdit();
      return;
    }
    if (e.key === "Escape") {
      if (ed.connectFrom) {
        endConnect();
        M.App.toast("\u5df2\u53d6\u6d88\u8fde\u7ebf");
        return;
      }
      if (ed.selectedRelId) {
        selectRelation(null);
        return;
      }
      if (ed.selectedFrameId) {
        selectFrame(null);
        return;
      }
      const menu = document.getElementById("ctx-menu");
      if (menu.style.display !== "none") {
        hideContextMenu();
        return;
      }
      if (isOverlayOpen()) return;
      M.Model.clearSelection();
      M.Render.applySelectionClasses();
      return;
    }
    if (isOverlayOpen()) return;

    const ctrl = e.ctrlKey || e.metaKey;
    const key = e.key;

    if (ctrl && key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) M.Model.redo(); else M.Model.undo();
      return;
    }
    if (ctrl && key.toLowerCase() === "y") {
      e.preventDefault();
      M.Model.redo();
      return;
    }
    if (ctrl && key.toLowerCase() === "c") {
      if (M.Model.copySelection()) M.App.toast("\u5df2\u590d\u5236 " + M.Model.selectedNodes().length + " \u4e2a\u8282\u70b9");
      return;
    }
    if (ctrl && key.toLowerCase() === "x") {
      if (M.Model.copySelection()) {
        deleteSelection();
        M.App.toast("\u5df2\u526a\u5207\u8282\u70b9");
      }
      return;
    }
    if (ctrl && key.toLowerCase() === "v") {
      e.preventDefault();
      const target = M.Model.primaryNode() || M.Model.root;
      M.Model.change(() => M.Model.pasteInto(target));
      M.App.toast("\u5df2\u7c98\u8d34");
      return;
    }
    if (ctrl && key.toLowerCase() === "a") {
      e.preventDefault();
      const visible = M.Model.visibleNodes(M.Model.root);
      M.Model.change(() => {
        M.Model.clearSelection();
        visible.forEach((n) => M.Model.selectNode(n, true));
      });
      return;
    }
    if (ctrl && key.toLowerCase() === "f") {
      e.preventDefault();
      M.Search && M.Search.open();
      return;
    }
    if (key === "?") {
      e.preventDefault();
      M.App.showHelp();
      return;
    }

    const primary = M.Model.primaryNode();

    if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      if (ed.selectedRelId) {
        const id = ed.selectedRelId;
        M.Model.change(() => {
          M.Model.removeRelation(id);
          ed.selectedRelId = null;
        });
        return;
      }
      if (ed.selectedFrameId) {
        const id = ed.selectedFrameId;
        M.Model.change(() => {
          M.Model.removeFrame(id);
          ed.selectedFrameId = null;
        });
        return;
      }
      if (primary) deleteSelection();
      return;
    }
    if (!primary) return;

    if (key === "Tab") {
      e.preventDefault();
      M.Model.change(() => { M.Model.addChild(primary, "\u65b0\u8282\u70b9"); });
      const added = primary.children[primary.children.length - 1];
      M.Model.selectNode(added, false);
      beginEdit(added);
    } else if (key === "Enter") {
      e.preventDefault();
      let nb = null;
      M.Model.change(() => { nb = M.Model.addSibling(primary, "\u65b0\u8282\u70b9"); });
      M.Model.selectNode(nb, false);
      beginEdit(nb);
    } else if (key === "F2") {
      e.preventDefault();
      beginEdit(primary);
    } else if (key === " ") {
      e.preventDefault();
      toggleCollapsePrimary();
    } else if (key === "[") {
      setCollapsePrimary(true);
    } else if (key === "]") {
      setCollapsePrimary(false);
    }
  }

  function showContextMenu(x, y, node) {
    hideContextMenu();
    const menu = document.getElementById("ctx-menu");
    menu.innerHTML = "";
    const add = (html, fn) => {
      const div = document.createElement("div");
      div.className = "ctx-item";
      div.innerHTML = html;
      div.addEventListener("click", (e) => { e.stopPropagation(); hideContextMenu(); fn(); });
      menu.appendChild(div);
    };
    const sep = () => {
      const d = document.createElement("div");
      d.className = "ctx-sep";
      menu.appendChild(d);
    };

    if (node) {
      ed.ctxNodeId = node.id;
      const isRoot = node === M.Model.root;
      add("\u270f\u2002\u7f16\u8f91\u6587\u5b57", () => beginEdit(node));
      add("\u2795\u2002\u6dfb\u52a0\u5b50\u8282\u70b9", () => {
        M.Model.change(() => { M.Model.addChild(node, "\u65b0\u8282\u70b9"); });
        const added = node.children[node.children.length - 1];
        M.Model.selectNode(added, false);
        M.Render.render();
        beginEdit(added);
      });
      add("\u21a9\u2002\u6dfb\u52a0\u5144\u5f1f\u8282\u70b9", () => {
        let nb = null;
        M.Model.change(() => { nb = M.Model.addSibling(node, "\u65b0\u8282\u70b9"); });
        M.Model.selectNode(nb, false);
        M.Render.render();
        beginEdit(nb);
      });
      add(node.collapsed ? "\u25b6\u2002\u5c55\u5f00" : "\u25bc\u2002\u6536\u8d77", () => {
        M.Model.change(() => { node.collapsed = !node.collapsed; });
        M.Search && M.Search.refresh();
        M.Render.render();
      });
      if (!isRoot) add("\ud83d\udddd\u2002\u5220\u9664", () => {
        M.Model.change(() => M.Model.removeNode(node));
        M.Render.render();
      });
      sep();
      add("\ud83d\udd17\u2002\u5efa\u7acb\u5173\u8054\u2026", () => startConnect(node));
      sep();
      add("\ud83c\udfa8\u2002\u7740\u8272", () => showColorMenu(node));
      const selCount = M.Model.selectedNodes().length;
      if (selCount > 1) {
        add("\u2610\u2002\u6dfb\u52a0\u5916\u6846\uff08" + selCount + " \u4e2a\u8282\u70b9\uff09", () => toggleGroupFrame());
      } else {
        add(node.frame ? "\u274c\u2002\u79fb\u9664\u5916\u6846" : "\u2610\u2002\u6dfb\u52a0\u5916\u6846", () => {
          M.Model.change(() => { node.frame = !node.frame; });
          M.Render.render();
        });
      }      if (node.image) add("\ud83d\uddbc\u2002\u66ff\u6362\u56fe\u7247", () => pickImage(node));
      else add("\ud83d\uddbc\u2002\u6dfb\u52a0\u56fe\u7247", () => pickImage(node));
      if (node.image) add("\u274c\u2002\u79fb\u9664\u56fe\u7247", () => {
        M.Model.change(() => { node.image = null; });
        M.Render.render();
      });
      if (node.link) {
        add("\ud83d\udd17\u2002\u6253\u5f00\u94fe\u63a5", () => window.open(node.link, "_blank", "noopener"));
        add("\u274c\u2002\u79fb\u9664\u94fe\u63a5", () => {
          M.Model.change(() => { node.link = null; });
          M.Render.render();
        });
      }
      add("\ud83d\udd17\u2002\u8bbe\u7f6e\u94fe\u63a5\u2026", () => promptLink(node));
      add("\ud83d\udcdd\u2002\u5907\u6ce8\u2026", () => editNotes(node));
      sep();
      add("\u2702\u2002\u590d\u5236", () => {
        M.Model.selectNode(node, false);
        M.Model.copySelection();
        M.App.toast("\u5df2\u590d\u5236");
      });
      add("\u2702\u2002\u526a\u5207", () => {
        M.Model.selectNode(node, false);
        M.Model.copySelection();
        M.Model.change(() => M.Model.removeNode(node));
        M.App.toast("\u5df2\u526a\u5207");
      });
      add("\ud83d\udccb\u2002\u7c98\u8d34", () => {
        M.Model.selectNode(node, false);
        M.Model.change(() => M.Model.pasteInto(node));
        M.App.toast("\u5df2\u7c98\u8d34");
      });
    } else {
      add("\ud83d\udccb\u2002\u7c98\u8d34", () => {
        const target = M.Model.primaryNode() || M.Model.root;
        M.Model.change(() => M.Model.pasteInto(target));
        M.App.toast("\u5df2\u7c98\u8d34");
      });
      sep();
      add("\u25b6\u2002\u5168\u90e8\u5c55\u5f00", () => {
        M.Model.change(() => {
          M.Model.allNodes(M.Model.root).forEach((n) => { n.collapsed = false; });
        });
        M.Search && M.Search.refresh();
        M.Render.fit();
      });
      add("\u25bc\u2002\u5168\u90e8\u6536\u8d77", () => {
        M.Model.change(() => {
          M.Model.allNodes(M.Model.root).forEach((n) => { if (n !== M.Model.root) n.collapsed = true; });
        });
        M.Search && M.Search.refresh();
        M.Render.fit();
      });
      add("\u26f6\u2002\u9002\u5e94\u753b\u5e03", () => M.Render.fit());
    }

    const rect = ed.svg.getBoundingClientRect();
    menu.style.display = "block";
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    const vw = ed.wrap.clientWidth, vh = ed.wrap.clientHeight;
    menu.style.left = Math.min(x, vw - mw - 6) + "px";
    menu.style.top = Math.min(y, vh - mh - 6) + "px";
  }

  function hideContextMenu() {
    const menu = document.getElementById("ctx-menu");
    menu.style.display = "none";
    menu.innerHTML = "";
    ed.ctxNodeId = null;
  }

  function showColorMenu(node) {
    hideContextMenu();
    const menu = document.getElementById("ctx-menu");
    const row = document.createElement("div");
    row.className = "ctx-color-row";
    const swatch = (color) => {      const s = document.createElement("div");
      s.className = "sw";
      s.style.background = color;
      s.title = color;
      s.addEventListener("click", (e) => {
        e.stopPropagation();
        hideContextMenu();
        M.Model.change(() => { node.color = color; });
        M.Render.render();
      });
      row.appendChild(s);
    };
    const none = document.createElement("div");
    none.className = "sw";
    none.style.background = "repeating-conic-gradient(#ccc 0 25%, #fff 0 50%) 50%/8px 8px";
    none.title = "\u9ed8\u8ba4\uff08\u4e3b\u9898\u8272\uff09";
    none.addEventListener("click", (e) => {
      e.stopPropagation();
      hideContextMenu();
      M.Model.change(() => { node.color = null; });
      M.Render.render();
    });
    row.appendChild(none);
    COLORS.forEach(swatch);
    menu.appendChild(row);
    menu.style.display = "block";
    menu.style.left = "6px";
    menu.style.top = "6px";
  }

  function toggleGroupFrame() {
    const sel = M.Model.selectedNodes().map((n) => n.id);
    if (sel.length < 2) return;
    const existing = M.Model.frames.find((f) =>
      f.nodes.length === sel.length && f.nodes.every((id) => sel.includes(id)));
    if (existing) {
      M.Model.change(() => M.Model.removeFrame(existing.id));
      M.App.toast("\u5df2\u79fb\u9664\u5916\u6846");
    } else {
      M.Model.change(() => M.Model.addFrame(sel));
      M.App.toast("\u5df2\u4e3a " + sel.length + " \u4e2a\u8282\u70b9\u6dfb\u52a0\u5916\u6846");
    }
  }

  function pickImage(node) {
    const input = document.getElementById("image-input");
    input.value = "";
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        M.App.toast("\u56fe\u7247\u8d85\u8fc7 2MB\uff0c\u5efa\u8bae\u538b\u7f29\u540e\u518d\u6dfb\u52a0", true);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        M.Model.change(() => { node.image = reader.result; });
        M.Render.render();
        M.App.toast("\u56fe\u7247\u5df2\u6dfb\u52a0");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }

  function promptLink(node) {
    M.App.modal({
      title: "\u8bbe\u7f6e\u94fe\u63a5",
      body: "<div class='m-row'><label>\u94fe\u63a5\u5730\u5740</label><input type='url' id='modal-link' placeholder='https://\u2026'></div>",
      ok: "\u4fdd\u5b58",
      onOk: (root) => {
        const v = root.querySelector("#modal-link").value.trim();
        if (!v) return false;
        M.Model.change(() => { node.link = v; });
        M.Render.render();
        return true;
      }
    });
  }

  function editNotes(node) {
    M.App.modal({
      title: "\u8282\u70b9\u5907\u6ce8",
      body: "<div class='m-row'><label>\u5907\u6ce8\u5185\u5bb9</label></div><textarea id='modal-notes' placeholder='\u591a\u884c\u5907\u6ce8\u2026'>" + (node.notes || "") + "</textarea>",
      ok: "\u4fdd\u5b58",
      onOk: (root) => {
        const v = root.querySelector("#modal-notes").value;
        M.Model.change(() => { node.notes = v.trim() ? v : null; });
        M.Render.render();
        return true;
      }
    });
  }

  function zoomBy(factor) {
    const rect = ed.svg.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const v = M.Render.view;
    const pt = M.Render.screenToWorld(cx, cy);
    const s = Math.max(0.05, Math.min(4, v.s * factor));
    M.Render.setTransform(cx - pt.x * s, cy - pt.y * s, s);
  }

  M.Editor = {
    init, beginEdit, zoomBy, selectRelation, repositionEdit,
    selectedRelationId: () => ed.selectedRelId,
    selectedFrameId: () => ed.selectedFrameId,
    isConnecting: () => !!ed.connectFrom,
    get isEditing() { return ed.isEditing; }
  };
})();
