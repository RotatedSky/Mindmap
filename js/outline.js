(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  let panel = null, body = null, open = false;

  function init() {
    panel = document.getElementById("outline-panel");
    body = panel.querySelector(".panel-body");
    panel.querySelector(".panel-close").addEventListener("click", () => setOpen(false));
  }

  function setOpen(v) {
    open = v;
    panel.style.display = v ? "flex" : "none";
    if (v) refresh();
  }

  function isOpen() {
    return open;
  }

  function refresh() {
    if (!open) return;
    body.innerHTML = "";
    const root = M.Model.root;
    const ul = document.createElement("ul");
    ul.className = "outline-list";
    buildItem(root, ul);
    body.appendChild(ul);
  }

  function buildItem(node, parentUl) {
    const li = document.createElement("li");
    li.dataset.id = node.id;
    const hasKids = node.children.length > 0;

    const toggle = document.createElement("span");
    toggle.className = "outline-toggle";
    if (hasKids) {
      toggle.textContent = node.collapsed ? "\u25b6" : "\u25bc";
      toggle.title = node.collapsed ? "\u5c55\u5f00" : "\u6536\u8d77";
      toggle.addEventListener("click", (e) => {
        e.stopPropagation();
        M.Model.change(() => { node.collapsed = !node.collapsed; });
        M.Search && M.Search.refresh();
        refresh();
      });
    } else {
      toggle.textContent = "\u00b7";
      toggle.style.color = "transparent";
    }
    li.appendChild(toggle);

    const text = document.createElement("span");
    text.className = "outline-text";
    text.textContent = node.text || "\uff08\u7a7a\uff09";
    text.title = node.notes || node.text;
    li.appendChild(text);

    if (node.link) {
      const a = document.createElement("a");
      a.className = "outline-link";
      a.textContent = "\ud83d\udd17";
      a.href = node.link;
      a.target = "_blank";
      a.rel = "noopener";
      a.title = node.link;
      a.addEventListener("click", (e) => e.stopPropagation());
      li.appendChild(a);
    }

    const addBtn = document.createElement("span");
    addBtn.className = "outline-li";
    addBtn.textContent = "+";
    addBtn.title = "\u6dfb\u52a0\u5b50\u8282\u70b9";
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      M.Model.change(() => { M.Model.addChild(node, "\u65b0\u8282\u70b9"); });
      refresh();
    });
    li.appendChild(addBtn);

    const delBtn = document.createElement("span");
    delBtn.className = "outline-li";
    delBtn.textContent = "\u2715";
    delBtn.title = "\u5220\u9664";
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      M.Model.change(() => M.Model.removeNode(node));
      refresh();
    });
    li.appendChild(delBtn);

    li.addEventListener("click", () => {
      M.Model.selectNode(node, false);
      M.Render.centerOn(node);
    });
    li.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      renameInline(node, text);
    });

    parentUl.appendChild(li);

    if (hasKids) {
      const sub = document.createElement("ul");
      sub.className = "outline-list";
      for (const c of node.children) buildItem(c, sub);
      if (node.collapsed) sub.style.display = "none";
      parentUl.appendChild(sub);
    }
  }

  function renameInline(node, el) {
    const input = document.createElement("input");
    input.className = "outline-rename";
    input.value = node.text || "";
    el.replaceWith(input);
    input.focus();
    input.select();
    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const v = input.value.trim();
      if (!v) {
        M.Model.change(() => M.Model.removeNode(node));
      } else if (v !== node.text) {
        M.Model.change(() => { node.text = v; });
      }
      refresh();
    };
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { done = true; refresh(); }
    });
  }

  M.Outline = { init, refresh, setOpen, isOpen };
})();
