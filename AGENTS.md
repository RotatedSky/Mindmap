# AGENTS.md

纯前端零依赖脑图工具（IIFE 模块挂载 `window.MM`）。功能开发必须遵循 `docs/development-workflow.md` 定义的工作流：方案设计 → 开发 → 测试 → 问题修改。

## 常用命令

- 测试：`npm test`（= `node --test "test/**/*.test.js"`，Node ≥ 18，零依赖）
- 语法检查：`node --check js/<file>.js`

## 关键约定

- 模块：每个 `js/*.js` 为 IIFE，导出到 `window.MM`（如 `M.Model`、`M.Layout`）
- 测试：`test/*.test.js` 通过 `test/helpers/shim.js` 的 `setup()` 在 VM 沙箱中加载模块；每个用例必须 `fresh()` 独立沙箱
- 跨 realm 断言：vm 沙箱内的对象不能用 `assert.deepEqual/strict` 比较，用 `sameJSON()`（shim 导出）或逐字段断言
- 文本测量桩：ASCII 8px/字符，CJK（码点 > U+2FFF）16px/字符；测试期望值按此推算
- 撤销/重做会替换根对象引用，断言前重新读取 `mm.Model.root`
- 存储防抖：`M.Storage.save()` 延迟 400ms，测试用 `timers.tick(400)`
- 数据格式变更须向后兼容（旧 localStorage / 导出 JSON 可加载）
- 禁止：为通过测试而删除断言、弱化断言或跳过测试
- 路径：代码中一律使用相对路径，禁止绝对路径（`test/paths.test.js` 会检查）

## 工作流入口

开始功能开发前先阅读 `docs/development-workflow.md`，并按其中的"完成标准"收尾。
