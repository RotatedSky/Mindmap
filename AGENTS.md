# AGENTS.md

纯前端零依赖思绪图工具（IIFE 模块挂载 `window.MM`）。功能开发必须遵循 `docs/development-workflow.md` 定义的工作流：方案设计 → 开发 → 测试 → 问题修改。

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
问题定位遵守该文档"调试纪律"：脚本约 30s 无进展立即停止换路径；最小复现先用 node 沙箱（最便宜环境），能复现就不上浏览器。

## Windows 环境约定（本机 PowerShell 5.1）

- 凡 python 命令含中文输出，一律前缀 `$env:PYTHONIOENCODING='utf-8'`；否则 GBK 控制台抛 `UnicodeEncodeError`
- bash 工具多行输出会被截断只显示首行：一次命令只验证一个信息点，或多值合并为单行打印（如 `'|'.join(...)`）；打印结果若与预期不符，重跑同一命令一次再下结论（截断可能产生误报）
- 文件真实内容以 python 单行读取为准（read/grep 工具在个别大文件上出现过显示损坏，属显示 bug，文件本身完好）
- git 提交中文 commit message 禁止走管道（`$msg | git commit -F -` 会 GBK 损坏）：先 `[IO.File]::WriteAllText("<tmp>", $msg, [System.Text.UTF8Encoding]::new($false))` 再 `git commit -F "<tmp>"`；控制台显示乱码不代表存储乱码，用 `git log -1 --format=%B` 经 python `decode('utf-8')` 验证
- 交互断言前显式初始化状态（如 `M.Style.setOpen(false)`）：toggle 类按钮会被前置步骤"恰好打开"而误判；冒烟失败直接在冒烟脚本内插状态打印重跑定位，不另起复现脚本

## 提交规范

本仓库所有提交必须使用 `docs/commit-message-template.md` 中定义的 commit message 模板（格式说明见该文件，已配置为仓库 `commit.template`，`git commit` 自动载入）。仅在提交前已完成测试与验证时提交。
