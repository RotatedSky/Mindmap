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

  function sampleRoot() {
    const root = createNode("欢迎使用脑图工具");
    const n1 = createNode("快速上手");
    const n1a = createNode("点击节点或按 F2 编辑文字");
    const n1b = createNode("按 Tab 添加子节点，Enter 添加兄弟节点");
    const n1c = createNode("点击 −/+ 按钮展开或收起子树");
    n1.children.push(n1a, n1b, n1c);
    const n2 = createNode("导出与分享");
    const n2a = createNode("导出 PNG / JPEG / SVG / PDF");
    const n2b = createNode("多页 PDF 适合打印，单页海报适合分享");
    n2.children.push(n2a, n2b);
    const n3 = createNode("个性定制");
    const n3a = createNode("右上角切换 6 套主题");
    const n3b = createNode("节点右键可着色、加图片、加链接");
    n3.children.push(n3a, n3b);
    const n4 = createNode("数据安全");
    const n4a = createNode("自动保存到浏览器，也可导出 JSON 备份");
    const n4b = createNode("按 ? 查看全部快捷键");
    n4.children.push(n4a, n4b);
    root.children.push(n1, n2, n3, n4);
    return root;
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
