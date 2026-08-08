(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const state = {
    root: null,
    seq: 1,
    selection: new Set(),
    primary: null,
    clipboard: null,
    undoStack: [],
    redoStack: [],
    relations: [],
    frames: [],
    settings: { theme: "blue", layoutMode: "tree", direction: "right" },
    onChange: null
  };

  function uid(prefix) {
    return (prefix || "n") + (state.seq++) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function createNode(text) {
    return {
      id: uid(),
      text: text || "",
      children: [],
      collapsed: false,
      image: null,
      link: null,
      color: null,
      notes: null,
      frame: null,
      freePos: null
    };
  }

  const TEMPLATES = [
    {
      id: "sample",
      name: "\u793a\u4f8b\u6a21\u677f",
      desc: "\u5168\u529f\u80fd\u5c55\u793a\uff1a\u516c\u5f0f\u3001\u94fe\u63a5\u3001\u5907\u6ce8\u3001\u5916\u6846\u4e0e\u5173\u8054\u7ebf",
      build() {
        const root = createNode("\u6b22\u8fce\u4f7f\u7528\u8111\u56fe\u5de5\u5177");
        const n1 = createNode("\u5feb\u901f\u4e0a\u624b");
        const n1a = createNode("\u70b9\u51fb\u8282\u70b9\u6216\u6309 F2 \u7f16\u8f91\u6587\u5b57");
        n1a.notes = "\u53cc\u51fb\u8282\u70b9\u4e5f\u53ef\u4ee5\u8fdb\u5165\u7f16\u8f91\uff0c\u652f\u6301\u591a\u884c\u6587\u672c\u3002";
        const n1b = createNode("\u6309 Tab \u6dfb\u52a0\u5b50\u8282\u70b9\uff0cEnter \u6dfb\u52a0\u5144\u5f1f\u8282\u70b9");
        const n1c = createNode("\u70b9\u51fb \u2212/+ \u6309\u94ae\u5c55\u5f00\u6216\u6536\u8d77\u5b50\u6811");
        const n1d = createNode("\u652f\u6301\u516c\u5f0f $x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$");
        n1.children.push(n1a, n1b, n1c, n1d);
        n1.color = "#2e6fb0";
        const n2 = createNode("\u5bfc\u51fa\u4e0e\u5206\u4eab");
        const n2a = createNode("\u5bfc\u51fa PNG / JPEG / SVG / PDF");
        const n2b = createNode("\u591a\u9875 PDF \u9002\u5408\u6253\u5370\uff0c\u5355\u9875\u6d77\u62a5\u9002\u5408\u5206\u4eab");
        const n2c = createNode("\u8fdc\u7a0b\u56fe\u7247\u4e0d\u80fd\u4fdd\u8bc1\u8fdb\u5165\u5bfc\u51fa\u6587\u4ef6");
        n2c.image = "https://picsum.photos/seed/mindmap/96/60";
        n2.children.push(n2a, n2b, n2c);
        const n3 = createNode("\u4e2a\u6027\u5b9a\u5236");
        const n3a = createNode("\u53f3\u4e0a\u89d2\u5207\u6362 6 \u5957\u4e3b\u9898");
        const n3b = createNode("\u8282\u70b9\u53f3\u952e\u53ef\u7740\u8272\u3001\u52a0\u56fe\u7247\u3001\u52a0\u94fe\u63a5");
        n3b.link = "https://example.com";
        const n3c = createNode("\u7ed9\u91cd\u70b9\u8282\u70b9\u52a0\u5916\u6846\uff08\u672c\u5206\u652f\u5c31\u662f\u4e00\u4e2a\u5916\u6846\uff09");
        n3.children.push(n3a, n3b, n3c);
        const n4 = createNode("\u6570\u636e\u5b89\u5168");
        const n4a = createNode("\u81ea\u52a8\u4fdd\u5b58\u5230\u6d4f\u89c8\u5668\uff0c\u4e5f\u53ef\u5bfc\u51fa JSON \u5907\u4efd");
        const n4b = createNode("\u6309 ? \u67e5\u770b\u5168\u90e8\u5feb\u6377\u952e");
        const n4c = createNode("\u6309 Ctrl+Z \u53ef\u64a4\u9500\u4efb\u610f\u64cd\u4f5c");
        n4.children.push(n4a, n4b, n4c);
        root.children.push(n1, n2, n3, n4);
        const relations = [
          { id: uid("r"), from: n4.id, to: n2.id, label: "\u4e92\u8865", color: null }
        ];
        const frames = [
          { id: uid("f"), nodes: [n2.id, n3.id, n4.id], label: "\u5de5\u4f5c\u6d41" }
        ];
        return { root, relations, frames };
      }
    },
    {
      id: "meeting",
      name: "\u4f1a\u8bae\u7eaa\u8981",
      desc: "\u8bae\u9898\u3001\u7ed3\u8bba\u4e0e\u5f85\u529e\u4e8b\u9879\uff0c\u5408\u9002\u8bb0\u5f55\u4f1a\u8bae\u7cbe\u8981",
      build() {
        const root = createNode("\u4f1a\u8bae\u7eaa\u8981");
        const n1 = createNode("\u4f1a\u8bae\u4fe1\u606f");
        n1.children.push(
          createNode("\u65f6\u95f4\uff1a2026-08-07 14:00"),
          createNode("\u53c2\u4f1a\u4eba\uff1a\u5f20\u4e09 / \u674e\u56db / \u738b\u4e94"),
          createNode("\u8bb0\u5f55\u4eba\uff1a\u5f20\u4e09")
        );
        const n2 = createNode("\u8bae\u9898");
        const t1 = createNode("\u8bae\u9898\u4e00\uff1a\u4ea7\u54c1\u8def\u7ebf\u56fe");
        t1.children.push(
          createNode("\u8ba8\u8bba\u8981\u70b9\uff1a\u4e0b\u5b63\u5ea6\u4f18\u5148\u7ea7\u4e0e\u8d44\u6e90\u6295\u5165"),
          createNode("\u7ed3\u8bba\uff1a\u786e\u8ba4\u5148\u505a\u79fb\u52a8\u7aef\u8c03\u6574")
        );
        const t2 = createNode("\u8bae\u9898\u4e8c\uff1aQ3 \u76ee\u6807\u62c6\u89e3");
        t2.children.push(
          createNode("\u786e\u8ba4\u5173\u952e\u7ed3\u679c OKR \u53ca\u8003\u6838\u8282\u70b9")
        );
        n2.children.push(t1, t2);
        const n3 = createNode("\u5f85\u529e\u4e8b\u9879");
        const d1 = createNode("[P0] \u5f20\u4e09\uff1a\u5b8c\u6210\u539f\u578b\u8bc4\u5ba1");
        const d2 = createNode("[P1] \u674e\u56db\uff1a\u6574\u7406\u7528\u6237\u53cd\u9988");
        const d3 = createNode("[P1] \u738b\u4e94\uff1a\u8f93\u51fa\u6392\u671f\u8868");
        n3.children.push(d1, d2, d3);
        const n4 = createNode("\u98ce\u9669\u4e0e\u5f85\u89c2\u5bdf");
        n4.children.push(
          createNode("\u98ce\u9669\uff1a\u539f\u578b\u8bc4\u5ba1\u62d6\u5ef6\u53ef\u80fd\u5f71\u54cd\u6392\u671f"),
          createNode("\u5f85\u89c2\u5bdf\uff1a\u7ade\u54c1\u52a8\u5411\u4e0b\u5468\u8ddf\u8fdb")
        );
        root.children.push(n1, n2, n3, n4);
        const relations = [
          { id: uid("r"), from: n4.id, to: t1.id, label: "\u5173\u8054", color: null }
        ];
        const frames = [
          { id: uid("f"), nodes: [d1.id, d2.id, d3.id], label: "\u672c\u5468\u5f85\u529e" }
        ];
        return { root, relations, frames };
      }
    },
    {
      id: "reading",
      name: "\u8bfb\u4e66\u7b14\u8bb0",
      desc: "\u4e66\u7c4d\u4fe1\u606f\u3001\u6838\u5fc3\u89c2\u70b9\u4e0e\u91d1\u53e5\u6458\u5f55\uff0c\u642d\u914d\u884c\u52a8\u6e05\u5355",
      build() {
        const root = createNode("\u8bfb\u4e66\u7b14\u8bb0");
        const n1 = createNode("\u4e66\u7c4d\u4fe1\u606f");
        const b1 = createNode("\u4e66\u540d\uff1a\u300a\u8ba4\u77e5\u89c9\u9192\u300b");
        const b2 = createNode("\u4f5c\u8005\uff1a\u5468\u5cad");
        const b3 = createNode("\u9605\u8bfb\u8fdb\u5ea6\uff1a\u7b2c 3 \u7ae0");
        b3.notes = "\u8bb0\u5f97\u5728\u6bcf\u7ae0\u7ed3\u675f\u540e\u66f4\u65b0\u8fdb\u5ea6\u3002";
        n1.children.push(b1, b2, b3);
        const n2 = createNode("\u6838\u5fc3\u89c2\u70b9");
        n2.children.push(
          createNode("\u5143\u8ba4\u77e5\uff1a\u5bf9\u601d\u8003\u7684\u601d\u8003"),
          createNode("\u8212\u9002\u533a\u8fb9\u7f18\u7406\u8bba\uff1a\u5728\u80fd\u529b\u8fb9\u754c\u9644\u8fd1\u7ec3\u4e60\u624d\u589e\u957f"),
          createNode("\u805a\u7126\u4e0e\u53cd\u601d\u662f\u6709\u6548\u5b66\u4e60\u7684\u4e24\u4e2a\u9a71\u52a8\u529b")
        );
        const n3 = createNode("\u91d1\u53e5\u6458\u5f55");
        const q1 = createNode("\u201c\u8ba4\u77e5\u7b49\u7ea7\u4e0d\u9ad8\u7684\u52aa\u529b\u662f\u65e0\u6548\u52aa\u529b\u201d");
        q1.notes = "\u7b2c 32 \u9875";
        const q2 = createNode("\u201c\u6211\u4eec\u7684\u7b14\u8bb0\u4e0d\u662f\u4e3a\u4e86\u8bb0\u5f55\uff0c\u800c\u662f\u4e3a\u4e86\u601d\u8003\u201d");
        q2.notes = "\u7b2c 88 \u9875";
        n3.children.push(q1, q2);
        const n4 = createNode("\u884c\u52a8\u6e05\u5355");
        n4.children.push(
          createNode("\u6bcf\u665a\u5361\u70b9\u5f52\u7eb3\u5f53\u5929\u60f3\u6cd5"),
          createNode("\u7b2c\u4e8c\u5929\u91cd\u8bfb\u91d1\u53e5\u5e76\u5199\u4e00\u6bb5\u53cd\u601d")
        );
        root.children.push(n1, n2, n3, n4);
        const frames = [
          { id: uid("f"), nodes: [q1.id, q2.id], label: "\u503c\u5f97\u53cd\u590d\u54c1\u3002\u5f55\u53e5" }
        ];
        return { root, relations: [], frames };
      }
    },
    {
      id: "project",
      name: "\u9879\u76ee\u89c4\u5212",
      desc: "\u76ee\u6807\u3001\u4efb\u52a1\u62c6\u89e3\u4e0e\u56e2\u961f\u5206\u5de5\uff0c\u8986\u76d6\u9879\u76ee\u5168\u5468\u671f",
      build() {
        const root = createNode("\u9879\u76ee\u89c4\u5212");
        const n1 = createNode("\u76ee\u6807\u4e0e\u613f\u666f");
        n1.children.push(
          createNode("\u5317\u6781\u661f\u6307\u6807\uff1a\u65b0\u7528\u6237 7 \u65e5\u7559\u5b58\u7387\u63d0\u5347 15%"),
          createNode("\u91cc\u7a0b\u7891\u8282\u70b9\uff1aM1 \u539f\u578b / M2 \u5185\u6d4b / M3 \u4e0a\u7ebf")
        );
        const n2 = createNode("\u4efb\u52a1\u62c6\u89e3");
        const t1 = createNode("\u9700\u6c42\u5206\u6790");
        const t2 = createNode("\u65b9\u6848\u8bbe\u8ba1");
        const t3 = createNode("\u5f00\u53d1\u5b9e\u73b0");
        const t4 = createNode("\u6d4b\u8bd5\u4e0a\u7ebf");
        n2.children.push(t1, t2, t3, t4);
        const n3 = createNode("\u56e2\u961f\u5206\u5de5");
        n3.children.push(
          createNode("\u524d\u7aef\uff1a\u4ea4\u4e92\u4e0e\u53ef\u89c6\u5316"),
          createNode("\u540e\u7aef\uff1a\u63a5\u53e3\u4e0e\u6570\u636e\u5e93"),
          createNode("\u6d4b\u8bd5\uff1a\u7528\u4f8b\u8bbe\u8ba1\u4e0e\u8d28\u91cf\u62a5\u544a")
        );
        const n4 = createNode("\u98ce\u9669\u7ba1\u7406");
        n4.children.push(
          createNode("\u6280\u672f\u98ce\u9669\uff1a\u9ad8\u5e76\u53d1\u573a\u666f\u6027\u80fd\u4f18\u5316"),
          createNode("\u8d44\u6e90\u98ce\u9669\uff1a\u5173\u952e\u4eba\u5458\u526f\u672c\u4efd")
        );
        root.children.push(n1, n2, n3, n4);
        const relations = [
          { id: uid("r"), from: n4.id, to: t3.id, label: "\u5f71\u54cd", color: null }
        ];
        const frames = [
          { id: uid("f"), nodes: [t1.id, t2.id, t3.id, t4.id], label: "\u62c5\u5f53" }
        ];
        return { root, relations, frames };
      }
    },
    {
      id: "brainstorm",
      name: "\u601d\u7ef4\u53d1\u6563",
      desc: "\u81ea\u7531\u5e03\u5c40\u540e\u7acb\u5373\u521b\u5efa\uff0c\u9002\u5408\u804a\u7cbe\u5934\u98ce\u66b4\u4e0e\u8bae\u9898\u5c55\u5f00",
      build() {
        const root = createNode("\u601d\u7ef4\u53d1\u6563");
        const kids = [
          createNode("\u7075\u611f A"),
          createNode("\u7075\u611f B"),
          createNode("\u7075\u611f C"),
          createNode("\u7075\u611f D")
        ];
        const spots = [
          { x: 340, y: -220 },
          { x: 340, y: 220 },
          { x: -340, y: -220 },
          { x: -340, y: 220 }
        ];
        kids.forEach((k, i) => {
          k.freePos = { x: spots[i].x, y: spots[i].y };
          root.children.push(k);
        });
        return {
          root,
          relations: [],
          frames: [],
          settings: { layoutMode: "free", direction: "right" }
        };
      }
    }
  ];

  function sampleRoot() {
    return TEMPLATES[0].build().root;
  }

  function applyTemplate(id) {
    const tpl = TEMPLATES.find((t) => t.id === id);
    if (!tpl) return false;
    const built = tpl.build();
    replaceRoot(built.root);
    state.relations = built.relations || [];
    state.frames = built.frames || [];
    if (built.settings) Object.assign(state.settings, built.settings);
    notify();
    return true;
  }

  function cloneNode(n) {
    return JSON.parse(JSON.stringify(n));
  }

  function notify() {
    if (state.onChange) state.onChange();
  }

  function snapshot() {
    return JSON.stringify({ root: state.root, relations: state.relations, frames: state.frames });
  }

  function restore(json) {
    const obj = JSON.parse(json);
    state.root = obj.root;
    state.relations = obj.relations || [];
    state.frames = obj.frames || [];
    state.selection = new Set();
    state.primary = null;
  }

  function pushHistory() {
    state.undoStack.push(snapshot());
    if (state.undoStack.length > 100) state.undoStack.shift();
    state.redoStack.length = 0;
  }

  function record() {
    pushHistory();
  }

  function touch() {
    notify();
  }

  function change(fn) {
    pushHistory();
    fn();
    notify();
  }

  function undo() {
    if (!state.undoStack.length) return false;
    state.redoStack.push(snapshot());
    restore(state.undoStack.pop());
    notify();
    return true;
  }

  function redo() {
    if (!state.redoStack.length) return false;
    state.undoStack.push(snapshot());
    restore(state.redoStack.pop());
    notify();
    return true;
  }

  function find(root, id) {
    if (root.id === id) return root;
    for (const c of root.children) {
      const r = find(c, id);
      if (r) return r;
    }
    return null;
  }

  function findParent(root, id, parent) {
    if (root.id === id) return parent || null;
    for (const c of root.children) {
      const r = findParent(c, id, root);
      if (r) return r;
    }
    return null;
  }

  function isDescendant(ancestor, node) {
    let cur = node;
    while (cur) {
      if (cur === ancestor) return true;
      cur = findParent(state.root, cur.id);
    }
    return false;
  }

  function visibleNodes(root, out) {
    out = out || [];
    out.push(root);
    if (!root.collapsed) {
      for (const c of root.children) visibleNodes(c, out);
    }
    return out;
  }

  function allNodes(root, out) {
    out = out || [];
    out.push(root);
    for (const c of root.children) allNodes(c, out);
    return out;
  }

  function addChild(parent, text, index) {
    const n = createNode(text);
    if (index === undefined) parent.children.push(n);
    else parent.children.splice(index, 0, n);
    parent.collapsed = false;
    return n;
  }

  function addSibling(node, text) {
    const parent = findParent(state.root, node.id);
    if (!parent) {
      const n = addChild(state.root, text);
      return n;
    }
    const idx = parent.children.indexOf(node);
    return addChild(parent, text, idx + 1);
  }

  function removeNode(node) {
    if (node === state.root) {
      state.root.text = "";
      state.root.children = [];
      state.root.image = null;
      state.root.link = null;
      state.root.color = null;
      state.root.notes = null;
      state.root.frame = null;
      state.root.collapsed = false;
      state.root.freePos = null;
      state.selection.clear();
      state.primary = null;
      return;
    }
    const parent = findParent(state.root, node.id);
    if (!parent) return;
    const idx = parent.children.indexOf(node);
    if (idx >= 0) parent.children.splice(idx, 1);
    state.selection.delete(node.id);
    if (state.primary === node.id) state.primary = null;
    const subtree = new Set(allNodes(node).map((n) => n.id));
    state.relations = state.relations.filter((r) => !subtree.has(r.from) && !subtree.has(r.to));
    for (const f of state.frames) {
      f.nodes = f.nodes.filter((id) => !subtree.has(id));
    }
    state.frames = state.frames.filter((f) => f.nodes.length > 0);
  }

  function moveNode(node, newParent) {
    if (node === state.root || newParent === node || isDescendant(node, newParent)) return false;
    const parent = findParent(state.root, node.id);
    if (!parent) return false;
    const idx = parent.children.indexOf(node);
    parent.children.splice(idx, 1);
    newParent.children.push(node);
    newParent.collapsed = false;
    return true;
  }

  function selectNode(node, additive) {
    if (!additive) {
      state.selection.clear();
      state.selection.add(node.id);
      state.primary = node.id;
    } else {
      if (state.selection.has(node.id)) {
        state.selection.delete(node.id);
        if (state.primary === node.id) {
          state.primary = state.selection.size ? state.selection.values().next().value : null;
        }
      } else {
        state.selection.add(node.id);
        state.primary = node.id;
      }
    }
    notify();
  }

  function setSelection(ids, primaryId) {
    state.selection = new Set(ids);
    state.primary = primaryId || (state.selection.size ? state.selection.values().next().value : null);
    notify();
  }

  function clearSelection() {
    if (!state.selection.size && !state.primary) return;
    state.selection.clear();
    state.primary = null;
    notify();
  }

  function setPrimary(id) {
    state.primary = id;
  }

  function selectedNodes() {
    const out = [];
    if (!state.root) return out;
    for (const id of state.selection) {
      const n = find(state.root, id);
      if (n) out.push(n);
    }
    return out;
  }

  function primaryNode() {
    if (!state.root || !state.primary) return null;
    return find(state.root, state.primary);
  }

  function addRelation(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return null;
    if (state.relations.some((r) => (r.from === fromId && r.to === toId))) return null;
    const rel = { id: uid("r"), from: fromId, to: toId, label: null, color: null };
    state.relations.push(rel);
    return rel;
  }

  function removeRelation(id) {
    const i = state.relations.findIndex((r) => r.id === id);
    if (i < 0) return false;
    state.relations.splice(i, 1);
    return true;
  }

  function setRelationLabel(id, label) {
    const rel = state.relations.find((r) => r.id === id);
    if (!rel) return;
    rel.label = label ? label : null;
  }

  function relationsFor(nodeId) {
    return state.relations.filter((r) => r.from === nodeId || r.to === nodeId);
  }

  function addFrame(nodeIds) {
    const f = { id: uid("f"), nodes: nodeIds.slice(), label: null };
    state.frames.push(f);
    return f;
  }

  function removeFrame(id) {
    const i = state.frames.findIndex((f) => f.id === id);
    if (i < 0) return false;
    state.frames.splice(i, 1);
    return true;
  }

  function setFrameLabel(id, label) {
    const f = state.frames.find((fr) => fr.id === id);
    if (!f) return;
    f.label = label ? label : null;
  }

  function clearRelations() {
    state.relations = [];
  }

  function copySelection() {
    const nodes = selectedNodes();
    if (!nodes.length) return false;
    state.clipboard = nodes.map(cloneNode);
    return true;
  }

  function pasteInto(target, mode) {
    if (!state.clipboard || !state.clipboard.length) return false;
    const clones = state.clipboard.map(cloneNode);
    const remap = new Map();
    function reId(n) {
      const old = n.id;
      n.id = uid();
      remap.set(old, n.id);
      n.freePos = null;
      if (n.children) n.children.forEach(reId);
    }
    clones.forEach(reId);
    for (const c of clones) target.children.push(c);
    target.collapsed = false;
    for (const rel of state.relations) {
      if (remap.has(rel.from) && remap.has(rel.to)) {
        state.relations.push({
          id: uid("r"),
          from: remap.get(rel.from),
          to: remap.get(rel.to),
          label: rel.label,
          color: rel.color
        });
      }
    }
    for (const f of state.frames) {
      if (f.nodes.every((id) => remap.has(id))) {
        state.frames.push({ id: uid("f"), nodes: f.nodes.map((id) => remap.get(id)), label: f.label });
      }
    }
    return true;
  }

  function serialize() {
    return { version: 1, root: state.root, relations: state.relations, frames: state.frames, settings: state.settings };
  }

  function deserialize(obj) {
    if (!obj || !obj.root) return false;
    state.root = obj.root;
    state.relations = obj.relations || [];
    state.frames = obj.frames || [];
    state.selection = new Set();
    state.primary = null;
    if (obj.settings) Object.assign(state.settings, obj.settings);
    notify();
    return true;
  }

  function reset() {
    state.root = sampleRoot();
    state.relations = [];
    state.frames = [];
    state.selection = new Set();
    state.primary = null;
    state.undoStack = [];
    state.redoStack = [];
    notify();
  }

  function replaceRoot(newRoot) {
    state.root = newRoot;
    state.relations = [];
    state.frames = [];
    state.selection = new Set();
    state.primary = null;
    state.undoStack = [];
    state.redoStack = [];
    notify();
  }

  function setSettings(patch) {
    Object.assign(state.settings, patch);
  }

  state.root = sampleRoot();

  M.Model = {
    get root() { return state.root; },
    get settings() { return state.settings; },
    get relations() { return state.relations; },
    get frames() { return state.frames; },
    get onChange() { return state.onChange; },
    set onChange(fn) { state.onChange = fn; },
    uid, createNode, sampleRoot, cloneNode,
    templates: TEMPLATES, applyTemplate,
    change, record, touch, undo, redo,
    find, findParent, isDescendant,
    visibleNodes, allNodes,
    addChild, addSibling, removeNode, moveNode,
    selectNode, clearSelection, setPrimary,
    selectedNodes, primaryNode, setSelection,
    copySelection, pasteInto,
    addRelation, removeRelation, setRelationLabel, relationsFor, clearRelations,
    addFrame, removeFrame, setFrameLabel,
    serialize, deserialize, reset, replaceRoot, setSettings
  };
})();
