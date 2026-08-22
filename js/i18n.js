(function () {
  "use strict";

  const M = (window.MM = window.MM || {});

  const STORAGE_KEY = "mm.lang";
  const EN = {
    "思绪图工具": "Mind Map Tool",
    "思绪图": "Mind Map",
    "新建思绪图": "New Mind Map",
    "新建": "New",
    "撤销": "Undo",
    "重做": "Redo",
    "主题": "Theme",
    "连线层级配色": "Line Colors",
    "画布背景色": "Canvas Background",
    "恢复主题背景色": "Reset Theme Background",
    "布局模式": "Layout Mode",
    "树形布局": "Tree Layout",
    "自由布局": "Free Layout",
    "树形布局方向": "Tree Direction",
    "右向": "Right",
    "左右平衡": "Balanced",
    "左向": "Left",
    "全部展开": "Expand All",
    "全部收起": "Collapse All",
    "搜索": "Search",
    "大纲视图": "Outline View",
    "大纲": "Outline",
    "节点备注": "Node Notes",
    "备注": "Notes",
    "节点样式": "Node Style",
    "样式": "Style",
    "导入 JSON 文件 / Markdown 大纲": "Import JSON / Markdown Outline",
    "导入": "Import",
    "保存": "Save",
    "保存（Ctrl+S）：.mind/.json 文件直接回写，其他格式选择保存类型": "Save (Ctrl+S): write back to .mind/.json files, choose type for other formats",
    "导出": "Export",
    "快捷键帮助": "Keyboard Shortcuts Help",
    "搜索节点…": "Search nodes…",
    "上一个": "Previous",
    "下一个": "Next",
    "关闭": "Close",
    "空白思绪图": "Blank Mind Map",
    "Tab / 右键节点 → 添加子节点": "Tab / right-click a node → add child",
    "双击 / F2 → 编辑文字": "Double-click / F2 → edit text",
    "拖动空白区域 → 平移画布，滚轮缩放": "Drag empty area → pan canvas, scroll to zoom",
    "右键 → 更多操作（着色、外框、链接…）": "Right-click → more actions (color, frame, link…)",
    "放大": "Zoom In",
    "缩小": "Zoom Out",
    "适应画布": "Fit Canvas",
    "小地图（点击跳转）": "Minimap (click to jump)",
    "选中一个节点后在此编辑备注": "Select a node to edit its notes here",
    "在此输入该节点的备注内容…": "Enter notes for this node…",
    "选中一个节点后在此调整样式": "Select a node to adjust its style here",
    "背景色": "Background",
    "文字颜色": "Text Color",
    "边框颜色": "Border Color",
    "边框粗细": "Border Width",
    "圆角": "Corner Radius",
    "虚线框": "Dashed Frame",
    "字号": "Font Size",
    "加粗": "Bold",
    "恢复默认": "Reset Default",
    "语言 / Language": "Language / 语言",
    "切换语言 / Switch language": "Switch language / 切换语言",
    "跟随系统": "System",
    "经典蓝": "Classic Blue",
    "清新绿": "Fresh Green",
    "中国红": "China Red",
    "日落暖色": "Sunset Warm",
    "梦幻紫": "Dream Purple",
    "海洋青": "Ocean Cyan",
    "暖纸米黄": "Warm Paper",
    "深色夜间": "Dark Night",
    "简约黑白": "Minimal Black & White",
    "莫兰迪": "Morandi",
    "取消": "Cancel",
    "确定": "OK",
    "编辑节点文字": "Edit node text",
    "添加子节点": "Add child node",
    "添加兄弟节点": "Add sibling node",
    "删除节点（含子树）": "Delete node (with subtree)",
    "空格": "Space",
    "收起 / 展开当前节点": "Collapse / expand current node",
    "撤销 / 重做": "Undo / Redo",
    "复制 / 剪切 / 粘贴节点子树": "Copy / cut / paste node subtree",
    "全选可见节点": "Select all visible nodes",
    "搜索节点": "Search nodes",
    "保存（.mind / .json 回写原文件，其他格式选择保存类型）": "Save (write back .mind / .json, choose type for others)",
    "查看快捷键说明": "View keyboard shortcuts",
    "点击节点": "click node",
    "加选 / 减选节点": "Add / remove node selection",
    "拖动空白区": "drag empty area",
    "框选多个节点": "Box-select multiple nodes",
    "拖动节点到目标": "Drag node to target",
    "调整父子关系（树形模式）": "Reparent node (tree mode)",
    "滚轮 / 双指缩放": "Scroll / pinch to zoom",
    "缩放画布": "Zoom canvas",
    "拖动空白区域": "Drag empty area",
    "平移画布": "Pan canvas",
    "右键 / 长按": "Right-click / long press",
    "查看节点操作菜单": "Open node context menu",
    "右键节点": "Right-click node",
    "建立关联": "Create relation",
    "点击另一个节点完成连线": "Click another node to finish the line",
    "右键关联线": "Right-click relation line",
    "编辑注释 / 删除 / 反转方向": "Edit label / delete / reverse direction",
    "取消编辑 / 取消连线 / 关闭对话框": "Cancel editing / cancel line / close dialog",
    "快捷键说明": "Keyboard Shortcuts",
    "仅根节点，从零开始绘制": "Root only, start from scratch",
    "根节点": "Root",
    "将替换当前思绪图内容，此操作不可撤销。": "This will replace the current mind map and cannot be undone.",
    "欢迎使用思绪图工具": "Welcome to Mind Map Tool",
    "选择一个模板开始，或直接创建空白思绪图。向上拖动空白区域可平移画布，滚轮可缩放。右键节点可添加外框分组，点击外框可调整其样式。": "Choose a template to start, or create a blank mind map. Drag the empty area to pan, scroll to zoom. Right-click a node to add frames, click a frame to adjust its style.",
    "暂不，先看看示例": "Not now, show me the sample",
    "打开 .mind / .json 文件（可回写保存）": "Open .mind / .json file (can write back)",
    "从 JSON 文件导入": "Import from JSON file",
    "从 Markdown 文本导入": "Import from Markdown text",
    "保存思绪图": "Save Mind Map",
    "当前内容无可回写的 .mind / .json 文件，请选择保存格式：": "No .mind / .json file to write back. Choose a save format:",
    "思绪图文件（.mind）": "Mind Map File (.mind)",
    "JSON 备份（.json）": "JSON Backup (.json)",
    "Markdown 大纲（.md）": "Markdown Outline (.md)",
    "格式": "Format",
    "分辨率": "Resolution",
    "2x（推荐）": "2x (recommended)",
    "背景": "Background",
    "主题背景": "Theme Background",
    "白色": "White",
    "透明（PNG/SVG）": "Transparent (PNG/SVG)",
    "A4 分页打印版（多页）": "A4 multi-page print version",
    "范围": "Scope",
    "整张思绪图": "Entire Mind Map",
    "仅选中节点分支": "Selected Branch Only",
    "图片/文档导出效果跟随当前主题与展开状态；远程图片不能保证进入导出文件。": "Exported images/docs follow the current theme and expanded state; remote images may not be included.",
    "从 Markdown 导入": "Import from Markdown",
    "例如：": "Example:",
    "中心主题": "Central Topic",
    "分支一": "Branch One",
    "分支二": "Branch Two",
    "子节点": "Child Node",
    "支持缩进列表（- * + 数字）、# 标题、[文字](链接) 、![图](地址)、> 备注": "Supports indented lists (- * + numbers), # headings, [text](link), ![image](url), > notes",
    "导入并覆盖当前思绪图": "Import and Replace Current Mind Map",
    "导入成功，Ctrl+Z 可撤销": "Imported. Ctrl+Z to undo",
    "已导出 Markdown": "Exported Markdown",
    "（分支）": " (branch)",
    "已导出 JSON": "Exported JSON",
    "已导出 PNG": "Exported PNG",
    "已导出 JPEG": "Exported JPEG",
    "已导出 SVG": "Exported SVG",
    "已导出 PDF（单页）": "Exported PDF (single page)",
    "已导出 PDF（": "Exported PDF (",
    " 页）": " pages)",
    "导出失败：": "Export failed: ",
    "点击目标节点或外框完成连线，Esc 取消": "Click a target node or frame to finish the relation; Esc to cancel",
    "已创建关联": "Relation created",
    "已存在相同关联": "Relation already exists",
    "已重新连接关联": "Relation reconnected",
    "已取消连线": "Line cancelled",
    "已复制 ": "Copied ",
    " 个节点": " nodes",
    "已剪切节点": "Node cut",
    "已粘贴": "Pasted",
    "已复制": "Copied",
    "已剪切": "Cut",
    "已移除外框": "Frame removed",
    "已为 ": "Added frame for ",
    " 个节点添加外框": " nodes",
    "外框成员必须为同一分支的节点（可多选同层兄弟或父子链上的节点）": "Frame members must be on the same branch (select siblings or a parent-child chain)",
    "图片过大，已自动压缩": "Large image compressed automatically",
    "图片超过 50MB，无法添加": "Image exceeds 50MB and cannot be added",
    "图片读取失败": "Failed to read image",
    "请将图片拖到节点上": "Drop the image onto a node",
    "图片已添加": "Image added",
    "编辑标签…": "Edit label…",
    "建立关联…": "Create relation…",
    "删除外框": "Delete Frame",
    "编辑注释…": "Edit label…",
    "删除关联": "Delete Relation",
    "反转方向": "Reverse Direction",
    "编辑": "Edit",
    "编辑文字": "Edit text",
    "展开": "Expand",
    "收起": "Collapse",
    "删除": "Delete",
    "关联": "Relation",
    "样式与内容": "Style & Content",
    "着色": "Color",
    "添加外框（": "Add Frame (",
    " 个节点）": " nodes)",
    "添加外框": "Add Frame",
    "移除外框": "Remove Frame",
    "替换图片": "Replace Image",
    "添加图片": "Add Image",
    "移除图片": "Remove Image",
    "打开链接": "Open Link",
    "移除链接": "Remove Link",
    "设置链接…": "Set Link…",
    "备注…": "Notes…",
    "剪贴板": "Clipboard",
    "复制": "Copy",
    "剪切": "Cut",
    "粘贴": "Paste",
    "视图": "View",
    "默认（主题色）": "Default (theme color)",
    "设置链接": "Set Link",
    "链接地址": "URL",
    "节点备注": "Node Notes",
    "备注内容": "Notes",
    "多行备注…": "Multi-line notes…",
    "新节点": "New Node",
    "未命名": "Untitled",
    "（空）": "(empty)",
    "外框样式": "Frame Style",
    "浏览器存储已满，大图片已入本地数据库（IndexedDB）": "Browser storage is full. Large images were moved to IndexedDB",
    "思绪图文件": "Mind Map File",
    "已保存 ": "Saved ",
    "保存失败，请重新选择保存格式": "Save failed. Please choose a save format again",
    "已打开 ": "Opened ",
    "文件格式不正确": "Invalid file format",
    "保存失败：无法写入所选文件": "Save failed: cannot write to the selected file",
    "导入成功": "Imported successfully",
    "默认单色": "Default Solid",
    "彩虹": "Rainbow",
    "冷色": "Cool",
    "暖色": "Warm",
    "黑白灰": "Black & White Gray"
  };

  let lang = "zh";

  function normalize(l) {
    return l === "en" ? "en" : "zh";
  }

  function tr(text) {
    if (!text || lang === "zh") return String(text);
    let s = String(text);
    const keys = Object.keys(EN).sort((a, b) => b.length - a.length);
    for (const zh of keys) {
      if (s.indexOf(zh) !== -1) s = s.split(zh).join(EN[zh]);
    }
    return s;
  }

  function translateAttributes(el) {
    if (!el._i18nAttr) el._i18nAttr = {};
    for (const attr of ["title", "placeholder", "aria-label"]) {
      const v = el.getAttribute && el.getAttribute(attr);
      if (v == null) continue;
      if (!(attr in el._i18nAttr)) el._i18nAttr[attr] = v;
      const orig = el._i18nAttr[attr];
      el.setAttribute(attr, lang === "zh" ? orig : tr(orig));
    }
  }

  function apply(root) {
    root = root || document;
    if (!root) return;
    const isText = root.nodeType === 3;
    if (isText) {
      if (root._i18nOrig === undefined) root._i18nOrig = root.textContent;
      root.textContent = lang === "zh" ? root._i18nOrig : tr(root._i18nOrig);
      return;
    }
    const isElement = root.nodeType === 1 || root.nodeType === 9 || root.nodeType === 11 ||
      (root.tagName && root.nodeType == null);
    if (!isElement) return;
    const children = root.childNodes || root.children || [];
    if (root.nodeType !== 9 && root.nodeType !== 11) {
      translateAttributes(root);
    }
    if (root.tagName !== "TEXTAREA" && root.tagName !== "SCRIPT" && root.tagName !== "STYLE") {
      for (const child of Array.from(children)) apply(child);
    }
  }

  const STATIC_SELECTORS = [
    "#toolbar", "#outline-panel", "#notes-panel", "#style-panel",
    "#search-bar", "#empty-hint", "#zoom-ui", "#minimap"
  ];

  function applyStatic() {
    for (const sel of STATIC_SELECTORS) {
      const el = document.querySelector(sel);
      if (el) apply(el);
    }
    const title = document.title;
    if (title) document.title = tr(title);
    if (document.documentElement && document.documentElement.setAttribute) document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
  }

  function setLang(next) {
    const l = normalize(next);
    lang = l;
    try { localStorage.setItem(STORAGE_KEY, l); } catch (err) {}
    applyStatic();
    const sel = document.getElementById && document.getElementById("lang-select");
    if (sel) sel.value = lang;
    if (M.Style && M.Style.refresh) M.Style.refresh();
    if (M.Outline && M.Outline.refresh) M.Outline.refresh();
    if (M.Notes && M.Notes.refresh) M.Notes.refresh();
    return lang;
  }

  function getLang() {
    return lang;
  }

  function init() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (err) {}
    lang = normalize(stored);
    applyStatic();
    return lang;
  }

  M.I18n = { tr, apply, applyStatic, setLang, getLang, init };
})();
