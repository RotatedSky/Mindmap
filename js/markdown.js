(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  function parseLine(line) {
    const indentMatch = line.match(/^(\s*)(.*)$/);
    const raw = indentMatch[2];
    const indent = indentMatch[1].replace(/\t/g, "  ").length;
    let depth = Math.round(indent / 2);
    let content = raw;
    const hm = raw.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      depth = hm[1].length - 1;
      content = hm[2];
    } else {
      content = raw.replace(/^([-*+]|\d+[.)])\s+/, "");
    }
    if (content.startsWith(">")) {
      return { note: content.replace(/^>\s?/, ""), depth };
    }
    const list = /^([-*+]|\d+[.)])\s+/.test(raw);
    const out = { depth, text: content, link: null, image: null, list, heading: !!hm };
    const imgMatch = content.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (imgMatch) {
      out.image = imgMatch[2];
      out.text = content.replace(imgMatch[0], "").trim();
    }
    const linkMatch = out.text.match(/\[([^\]]*)\]\(([^)]+)\)/);
    if (linkMatch) {
      out.link = linkMatch[2];
      out.text = out.text.replace(linkMatch[0], linkMatch[1]).trim();
    }
    return out;
  }

  function parse(text) {
    const root = M.Model.createNode("");
    const stack = [{ depth: -1, node: root }];
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trimEnd();
      if (!line.trim()) continue;
      const item = parseLine(line);
      if (item.note !== undefined) {
        const last = stack[stack.length - 1].node;
        last.notes = last.notes ? last.notes + "\n" + item.note : item.note;
        continue;
      }
      if (!item.list && !item.heading && stack.length > 1) {
        const prev = stack[stack.length - 1].node;
        prev.text = (prev.text ? prev.text + "\n" : "") + item.text;
        continue;
      }
      while (stack.length > 1 && stack[stack.length - 1].depth >= item.depth) stack.pop();
      const parent = stack[stack.length - 1].node;
      const node = M.Model.createNode(item.text);
      node.link = item.link;
      node.image = item.image;
      parent.children.push(node);
      stack.push({ depth: item.depth, node });
    }
    if (!root.text && root.children.length) {
      const first = root.children[0];
      root.text = first.text;
      root.link = first.link;
      root.image = first.image;
      root.children = first.children.concat(root.children.slice(1));
      root.notes = first.notes;
      root.collapsed = false;
    }
    if (!root.text) root.text = "\u65b0\u8111\u56fe";
    return root;
  }

  function serialize(root) {
    const lines = [];
    function walk(node, depth) {
      const ind = "  ".repeat(depth);
      const segs = String(node.text || "").split("\n");
      let text = segs.shift();
      if (node.link) text = "[" + text + "](" + node.link + ")";
      const line = ind + "- " + (node.image ? "![](" + node.image + ") " : "") + text;
      lines.push(line);
      for (const seg of segs) {
        lines.push(ind + "  " + seg);
      }
      if (node.notes) {
        for (const n of node.notes.split("\n")) {
          lines.push(ind + "  > " + n);
        }
      }
      for (const c of node.children) walk(c, depth + 1);
    }
    walk(root, 0);
    return lines.join("\n");
  }

  M.Markdown = { parse, serialize };
})();
