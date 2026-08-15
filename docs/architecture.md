# 思绪图工具 · 代码架构图（AI / 人可读）

本文档面向两类读者：

- **人**：快速建立全局心智模型，知道“改哪里、会波及哪里”。
- **AI（deepseek-v4-flash 等）**：提供结构化事实，便于在不读完全部源码的前提下安全修改与重构。

阅读顺序：先看“全局架构图”和“模块职责”，再按“常用修改速查表”定位文件。

---

## 1. 全局架构图

### 1.1 分层视图

```
┌────────────────────────────────────────────────────────────────────┐
│                           index.html                                │
│   按固定顺序加载 js/*.js（见 1.2），每个文件是 IIFE，挂到 window.MM  │
└────────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼───────────────────────────┐
        ▼                         ▼                           ▼
┌───────────────┐   ┌──────────────────────────┐   ┌───────────────────┐
│  交互 / UI 层  │   │      服务 / 算法层         │   │     持久化层       │
│  app.js       │   │  layout.js  render.js     │   │  storage.js       │
│  editor.js    │   │  math.js    exporter.js    │   │  (localStorage    │
│  search.js    │   │  markdown.js              │   │   + IndexedDB     │
│  outline.js   │   └──────────────────────────┘   │   + 本地文件)      │
│  notes.js     │              │                    └───────────────────┘
│  style.js     │              ▼                           ▲
│  minimap.js   │   ┌──────────────────────────┐           │
└───────────────┘   │      数据 / 状态层         │           │
        │           │  model.js                 │───────────┘
        └──────────▶│  state: root/relations/   │
                    │  frames/selection/undo/…  │
                    └──────────────────────────┘
```

- **数据层（model.js）** 是唯一事实源（single source of truth）：节点树、关联、外框、设置、选区、撤销栈都在这里。
- **服务层** 从数据层读取，输出计算结果（layout）或视图（render/exporter）。
- **交互层** 不直接改渲染，而是调用 `M.Model.change(...)` 修改数据，由 `onChange` 统一驱动刷新。
- **持久化层** 只做序列化/反序列化与文件读写，不参与布局和渲染逻辑。

### 1.2 脚本加载顺序（index.html 固定顺序）

```
js/model.js        ← 最先：定义 M.Model 与根状态
vendor/katex/katex.min.js
js/math.js         ← 依赖 KaTeX；不依赖 M.Model，只需要 window.MM 已存在
js/layout.js       ← 依赖 M.Math、M.Model
js/render.js       ← 依赖 M.Model、M.Layout、M.Math；同时导出 M.Theme
js/minimap.js      ← 依赖 M.Render、M.Model
js/editor.js       ← 依赖 M.Model、M.Render、M.Layout、M.Theme、M.App(运行时)
js/search.js       ← 依赖 M.Model、M.Render(运行时)
js/outline.js      ← 依赖 M.Model、M.Render(运行时)
js/notes.js        ← 依赖 M.Model、M.App(运行时)
js/style.js        ← 依赖 M.Model、M.Editor(运行时)
js/markdown.js     ← 依赖 M.Model
js/exporter.js     ← 依赖 M.Model、M.Render、M.Layout
js/storage.js      ← 依赖 M.Model、M.Exporter、M.App(运行时)
js/app.js          ← 最后：初始化所有模块并绑定工具栏
```

> AI 注意：加载顺序不等同于调用依赖。加载时模块之间只要求 `window.MM` 存在；运行时通过 `M.XXX` 调用彼此。修改模块时不要引入循环初始化依赖。

### 1.3 依赖关系图（运行时）

```mermaid
graph TD
  layout[layout.js 布局] --> model[model.js 数据/状态]
  layout --> math[math.js 公式]
  render[render.js 渲染] --> model
  render --> layout
  render --> math
  minimap[minimap.js 小地图] --> model
  minimap --> render
  editor[editor.js 交互] --> model
  editor --> render
  editor --> layout
  editor --> math
  search[search.js 搜索] --> model
  outline[outline.js 大纲] --> model
  notes[notes.js 备注] --> model
  style[style.js 样式面板] --> model
  style --> editor
  markdown[markdown.js Markdown] --> model
  exporter[exporter.js 导出] --> model
  exporter --> render
  exporter --> layout
  storage[storage.js 持久化] --> model
  storage --> exporter
  app[app.js 初始化/工具栏] --> model
  app --> layout
  app --> render
  app --> editor
  app --> search
  app --> outline
  app --> notes
  app --> style
  app --> minimap
  app --> markdown
  app --> exporter
  app --> storage
```

> 箭头方向：`A --> B` 表示 **A 依赖 B**（A 调用 B 的 API）。

---

## 2. 模块职责与公开 API

| 文件 | 职责 | 关键导出（window.MM 上的名字） | 一句话说明 |
|---|---|---|---|
| `js/model.js` | 节点树、关联、外框、选区、撤销/重做、模板、序列化 | `M.Model` | 唯一数据源，所有修改入口都应收敛到这里 |
| `js/math.js` | LaTeX 公式解析、尺寸测量、渲染 | `M.Math` | 封装 KaTeX；公式参与布局和 SVG 渲染 |
| `js/layout.js` | 树形/自由布局、换行、文本测量、外框避让 | `M.Layout` | 几何/测量计算（用 canvas 2D 测文本），不直接生成 SVG；输出 `x/y/w/h/subH/…` |
| `js/render.js` | SVG 画布渲染、主题、坐标变换、外框几何 | `M.Render`、`M.Theme` | 唯一画布渲染入口；导出也复用它 |
| `js/minimap.js` | 小地图缩略图与视野框 | `M.Minimap` | 监听渲染/变换后重绘 |
| `js/editor.js` | 指针/键盘/拖拽/右键菜单/编辑框 | `M.Editor` | 交互层，最复杂；只通过 `M.Model.change` 改数据 |
| `js/search.js` | 搜索定位 | `M.Search` | 匹配可见节点 |
| `js/outline.js` | 大纲面板 | `M.Outline` | 与树双向联动 |
| `js/notes.js` | 备注面板 | `M.Notes` | 编辑节点备注 |
| `js/style.js` | 节点/外框样式面板 | `M.Style` | 读写 `node.style` / `frame.style` |
| `js/markdown.js` | Markdown 导入导出 | `M.Markdown` | 缩进列表 ↔ 节点树 |
| `js/exporter.js` | PNG/JPEG/SVG/PDF 导出 | `M.Exporter` | 复用 `M.Render` 的 SVG 字符串 |
| `js/storage.js` | 自动保存、本地文件、JSON 导入导出 | `M.Storage` | localStorage 镜像 + IndexedDB + File System Access |
| `js/app.js` | 初始化、工具栏、对话框、欢迎页 | `M.App` | 组装所有模块并绑定全局 `onChange` |

---

## 3. 核心数据结构

### 3.1 节点 `node`（`M.Model.createNode()` 创建）

```js
{
  id: "n1_ab12cd",     // 唯一 id，uid() 生成
  text: "节点文字",
  children: [node],     // 子节点数组
  collapsed: false,     // 是否收起
  image: null,          // base64 图片
  link: null,           // 链接地址
  color: null,          // 节点着色
  notes: null,          // 备注
  frame: null,          // 旧版 node.frame 标记，加载时迁移为 frames
  freePos: null,        // 自由布局坐标 {x,y}
  style: null           // 节点自定义样式（背景/文字/边框/字号/加粗等）
}
```

布局后附加字段（由 `M.Layout` 写入，不序列化）：

```js
{
  parentKind: "root" | "node",
  depth: 0,             // 根为 0
  x, y,                 // 世界坐标（节点中心）
  w, h,                 // 节点宽高
  subH,                 // 子树总高（max(自身高, 子级总高)）
  ownHalf,              // subH / 2
  side: 1 | -1,         // 相对父节点的方向
  fmTop: Map,           // 帧成员/子成员外框的顶部相对本节点中心偏移
  fmBot: Map            // 帧成员/子成员外框的底部相对本节点中心偏移
}
```

### 3.2 关联 `relation`

```js
{ id, from, to, label, color, fromFrame?, toFrame?, fromPt?, toPt?, labelT? }
```

### 3.3 外框 `frame`

```js
{ id, nodes: [nodeId], label, style? }
```

- `nodes` 是成员节点 id；成员必须属于同一分支（同层兄弟或同一父子链）。
- 外框嵌套：`M.Layout.nestedFrames()` 判定包含关系。
- 外框几何：`M.Render.frameGeometry()`，外框间距规则在 `M.Layout.framePad*` 与 `boundaryGaps`。

### 3.4 全局状态 `state`（model.js 内部）

```js
{
  root,          // 根节点（撤销/重做、deserialize 会整体替换引用）
  seq,           // id 自增
  selection,     // 当前选中节点 id 集合
  primary,       // 主选中节点 id
  clipboard,     // 剪贴板（深拷贝的子树）
  undoStack,     // 快照栈，最多 100
  redoStack,
  relations,     // 关联数组
  frames,        // 外框数组
  settings,      // { theme, layoutMode, direction, lineStyle, bg }
  onChange       // 数据变更回调，由 app.js 注册
}
```

---

## 4. 核心流程

### 4.1 启动流程

```
document ready
  → M.App.init()
      → M.Render.init(canvas)
      → M.Search.init()
      → M.Outline.init()
      → M.Notes.init()
      → M.Style.init()
      → M.Editor.init(canvasWrap, canvas)
      → M.Minimap.init(minimap)
      → wireToolbar()
      → M.Storage.init().then(start)
          → syncControls()
          → M.Layout.layoutAll()
          → M.Render.render()
          → M.Render.fit()
          → M.Model.onChange = onModelChange
          → M.Math.fontsReady().then(...)   // 字体就绪后重新布局渲染
```

### 4.2 数据变更主循环（最重要）

```
用户操作（鼠标/键盘/菜单）
  → editor.js / app.js / panels
  → M.Model.change(fn)        // 或 record() 后手动改，再 touch()
      → 修改前 pushHistory()
      → 执行 fn()
      → notify() → M.Model.onChange()
  → app.onModelChange()
      → M.Layout.layoutAll()  // 重新计算全部坐标
      → M.Render.render()     // 重建 SVG
      → M.Outline.refresh()
      → M.Notes.refresh()
      → M.Style.refresh()
      → M.Storage.save()      // 400ms 防抖
      → updateEmptyHint()
```

> AI 注意：任何功能修改都应走 `M.Model.change()` 或 `M.Model.record() + M.Model.touch()`，这样撤销/重做、持久化、渲染刷新才会自动发生。

### 4.3 布局流程（treeLayout 两趟）

```
M.Layout.treeLayout(root, direction, theme)
  1. buildFrameIndex(root)   // 建立 节点→所属外框集合 的索引
  2. size(root, ...)         // 自底向上：测量节点、递归子树、计算 subH/fmTop/fmBot
       - frameOrder()        // 让外框成员在兄弟序列中连续
       - boundaryGaps()      // 计算兄弟子树之间的间距（含外框避让）
  3. place(root, ...)        // 自顶向下：分配 x/y/side
  4. root.x = 0, root.y = 0
```

自由布局 `freeLayout`：

```
M.Layout.freeLayout(root, theme)
  → 对每个可见节点测量 w/h
  → 若没有 freePos，则排到最右
  → 直接使用 freePos 作为坐标
```

### 4.4 外框避让关键规则（修改外框必读）

- 几何常量在 `js/layout.js` 顶部：`GAP_X/GAP_Y/FRAME_PAD/FRAME_MARGIN/FRAME_SPACING/FRAME_LABEL_TOP`。
- `boundaryGaps(order, frameIdx, ignore)` 计算相邻兄弟的间距，取以下约束的**最大值**：
  - 节点与节点：`GAP_Y`
  - 上侧外框与下侧节点：`FRAME_MARGIN + downO`
  - 上侧节点与下侧外框：`FRAME_MARGIN + upO`
  - 上侧外框与下侧外框：`FRAME_SPACING + downO + upO`
- `ignore` 集合存放“当前节点及其祖先已经作为成员的外框”，这些外框已覆盖整棵子树，不应再在子级边界重复加间距。
- `M.Render.frameGeometry()` 只做几何外扩；真正的避让发生在 `boundaryGaps`。

### 4.5 渲染流程（render / export 共用）

```
M.Render.render()
  → 清空 svg.el
  → 创建 world <g>
  → renderTreeInto(world)
      → 画关联线 connectors（先画，位于底层）
      → drawFrame() 画外框
      → buildNode() 画节点
      → drawRelation() 画关联线
  → 添加关联预览 path
  → setTransform()
  → applySelectionClasses()
  → M.Minimap.minimap()
```

导出复用：

```
M.Exporter.exportSVG / exportPNG / exportJPEG / exportPDF
  → 复用 M.Render.toSVGString(bounds, bg, scopeRoot)
  → PNG/JPEG 通过 canvas 绘制；PDF 原生写入
```

> 修改节点/外框/连线的视觉样式时，`renderTreeInto` 和 `toSVGString` 必须同步改，否则导出和画布不一致。

---

## 5. 持久化与撤销/重做

- **序列化**：`M.Model.serialize()` 返回 `{ version: 1, root, relations, frames, settings }`。
- **反序列化**：`M.Model.deserialize(obj)` 会替换 `state.root` 引用，并做向后兼容迁移（如旧 `node.frame` → `frames`）。
- **自动保存**：`M.Storage.save()` 防抖 400ms；同时写 localStorage 镜像和 IndexedDB；首次加载时 IndexedDB 优先，旧 localStorage 数据自动迁移。
- **撤销/重做**：`M.Model.change()` 在修改前对 `{root, relations, frames}` 做 JSON 快照入栈；`undo/redo` 用快照整体替换根引用。因此**断言或缓存节点引用前必须重新读取 `M.Model.root`**。

---

## 6. 测试与工具

```
test/
  helpers/shim.js     浏览器环境沙箱（VM + DOM/canvas/localStorage/IndexedDB 桩）
  *.test.js           各模块测试（每个用例 fresh() 独立沙箱）
  fuzz-frames.js      外框随机回归（2 seed × 5000 runs × 6 方向）
  repro.js            复现 fuzz 失败现场
tools/
  bench.js            性能基准（200–5000 节点）
  smoke_ui.py         Playwright 浏览器冒烟
  gen-icons.js        图标生成
```

运行方式见 `README.md` 和 `AGENTS.md`。本仓库测试常见坑（跨 realm 断言、文本测量桩、根引用过期等）见 `docs/development-workflow.md` 第 4 节。

---

## 7. 常用修改速查表

| 想做什么 | 先看 | 会波及 | 验证 |
|---|---|---|---|
| 修改节点字段/数据格式 | `js/model.js`（createNode/serialize/deserialize） | 存储兼容、撤销、剪贴板、模板 | `test/model.test.js` + 旧数据加载用例 |
| 调整布局/间距/换行 | `js/layout.js` | 渲染、导出、小地图 | `test/layout.test.js`、`test/frame.test.js`、`node test/fuzz-frames.js` |
| 调整外框避让 | `js/layout.js` 的 `boundaryGaps/frameOrder/framePad*` + `js/render.js` 的 `frameGeometry` | 外框嵌套、关联线锚点 | `test/frame.test.js` + fuzz |
| 修改节点/外框/连线样式 | `js/render.js`（buildNode/drawFrame/drawRelation） | 导出 SVG/PNG/PDF | `test/render.test.js`、`test/export.test.js` |
| 增加导出格式/选项 | `js/exporter.js` + `js/render.js` 的 `toSVGString` | 保存对话框、文件命名 | `test/export.test.js` |
| 增加快捷键/右键菜单 | `js/editor.js` | 移动端、搜索、样式面板 | `test/editor?`（暂无则补）+ 冒烟 |
| 改持久化/自动保存 | `js/storage.js` | 旧 localStorage 数据迁移 | `test/storage.test.js` |
| 改公式排版 | `js/math.js` + `js/layout.js` 测量 + `js/render.js` 绘制 | 节点尺寸、导出 | `test/math.test.js`、`test/layout.test.js` |
| 改 Markdown 导入导出 | `js/markdown.js` | 模板、备注/图片/链接 | `test/markdown.test.js` |
| 改初始化/工具栏/对话框 | `js/app.js` | 所有模块初始化顺序 | `test/template.test.js` + 冒烟 |

---

## 8. 重构安全清单（改代码前必读）

1. **零依赖**：不引入 npm 包；纯浏览器原生 API。
2. **IIFE 约定**：每个 `js/*.js` 是 `(function(){ ... })()`，通过 `const M = (window.MM = window.MM || {})` 挂载导出。
3. **相对路径**：代码中禁止绝对路径（`test/paths.test.js` 会检查）。
4. **数据格式向后兼容**：改 `serialize/deserialize` 必须保证旧 localStorage / 旧导出 JSON 可加载。
5. **修改共享对象**：`setup()` 返回的 `mm` 即沙箱内真实 `window.MM`，直接改会生效；不要在测试里创建副本再改。
6. **根引用过期**：撤销/重做、deserialize 会替换 `state.root`，断言前重新读 `M.Model.root`。
7. **文本测量桩**：ASCII 8px/字符，CJK 16px/字符；期望值按此推算。
8. **测试铁律**：禁止删除/弱化/跳过测试；最小复现优先用 node 沙箱。
9. **外框几何变更**：必须跑 `node test/fuzz-frames.js`。
10. **SVG/Canvas/文件交互变更**：必须跑浏览器冒烟 `python tools/smoke_ui.py`。

---

## 9. 当前重构主线（来自 roadmap）

- `R1` 拆分 `editor.js`（约 1400 行，过大）为指针、键盘、拖拽、菜单、面板等模块。
- `R2` 数据格式版本化 + 迁移框架。
- `R3` 渲染与布局解耦，关键函数纯化便于单测与性能优化。

详细计划见 `docs/roadmap.md`。
