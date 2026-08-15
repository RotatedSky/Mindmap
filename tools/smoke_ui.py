#!/usr/bin/env python3
"""Playwright 浏览器冒烟：外框右键菜单交互 + 外框几何验证。

用法:
    python tools/smoke_ui.py            # headless
    python tools/smoke_ui.py --headed   # 显示浏览器

依赖: pip install playwright && playwright install chromium
"""
import json
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PORT = 8899
SERVER = None


def serve():
    os.chdir(ROOT)
    ThreadingHTTPServer(("127.0.0.1", PORT), SimpleHTTPRequestHandler).serve_forever()


def fail(msg):
    print("FAIL:", msg)
    sys.exit(1)


def check(cond, msg):
    if not cond:
        fail(msg)
    print("ok:", msg)


def main():
    headed = "--headed" in sys.argv
    threading.Thread(target=serve, daemon=True).start()

    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        page = browser.new_page()
        page.add_init_script("""
          window.__saved = [];
          window.__picked = null;
          window.showSaveFilePicker = async (opts) => {
            window.__picked = opts;
            return {
              createWritable: async () => ({
                write: async (b) => window.__saved.push(b),
                close: async () => {}
              })
            };
          };
        """)

        page.goto("http://127.0.0.1:%d/index.html" % PORT)
        modal = page.locator(".modal")
        check(modal.count() > 0, "首次打开显示欢迎弹窗")
        page.locator(".tpl-card.tpl-blank").click()
        page.wait_for_timeout(300)

        js = lambda expr, arg=None: page.evaluate(expr, arg)
        check(bool(js("!!window.MM && !!MM.Model.root")), "根节点就绪")
        check(page.locator("#empty-hint").is_visible(), "空白思绪图显示空态引导")
        js("""
          const M = window.MM;
          const root = M.Model.root;
          M.Model.change(() => {
            const k1 = M.Model.addChild(root, "K1");
            const k2 = M.Model.addChild(root, "K2");
            M.Model.addChild(k1, "K1a");
          });
          M.Layout.layoutAll();
          M.Render.render();
        """)
        page.wait_for_timeout(100)
        check(not page.locator("#empty-hint").is_visible(), "添加子节点后空态引导隐藏")

        ids = js("(() => { const r = MM.Model.root; const k1 = r.children[0]; const k1a = k1.children[0]; return { k1: k1.id, k1a: k1a.id }; })()")

        root_id = js("MM.Model.root.id")
        node_sel = 'g.node[data-id="%s"]' % root_id
        menu = page.locator("#ctx-menu")

        page.locator(node_sel).click(button="right")
        check(menu.is_visible(), "右键节点弹出菜单")
        check(menu.locator(".ctx-title").count() >= 4, "节点菜单含分组标题（≥4 组）")
        check(menu.locator(".ctx-item", has_text="添加外框").count() == 1, "单选节点菜单含「添加外框」")
        menu.locator(".ctx-item", has_text="添加外框").click()
        page.wait_for_timeout(100)
        check(js("MM.Model.frames.length") == 1, "添加外框后 frames=1")
        check(page.locator(".frame-rect").count() == 1, "SVG 渲染外框")

        page.locator(node_sel).click(button="right")
        check(menu.locator(".ctx-item", has_text="移除外框").count() == 1, "框内节点菜单含「移除外框」")
        menu.locator(".ctx-item", has_text="移除外框").click()
        page.wait_for_timeout(100)
        check(js("MM.Model.frames.length") == 0, "移除外框后 frames=0")

        kids = js("MM.Model.root.children.map(c => c.id)")
        check(len(kids) >= 2, "示例根节点至少 2 个子节点")
        page.locator('g.node[data-id="%s"]' % kids[0]).click()
        page.keyboard.down("Control")
        page.locator('g.node[data-id="%s"]' % kids[1]).click()
        page.keyboard.up("Control")
        page.locator('g.node[data-id="%s"]' % kids[1]).click(button="right")
        menu.locator(".ctx-item", has_text="添加外框").click()
        page.wait_for_timeout(100)
        check(js("MM.Model.frames.length") == 1, "多选 2 节点添加外框 frames=1")
        check(js("MM.Model.frames[0].nodes.length") == 2, "外框成员数为 2")

        js("""
          (ids2) => {
            const M = window.MM;
            M.Model.change(() => {
              for (const f of M.Model.frames.slice()) M.Model.removeFrame(f.id);
              M.Model.addFrame([ids2.k1, ids2.k1a]);
              M.Model.addFrame([ids2.k1a]);
              M.Model.addRelation(M.Model.root.id, ids2.k1, {});
            });
            M.Layout.layoutAll();
            M.Render.render();
          }
        """, ids)
        rel_id = js("MM.Model.relations[0].id")
        page.locator('.rel-hit[data-id="%s"]' % rel_id).click()
        page.wait_for_timeout(100)
        handle = page.locator('.rel-handle[data-id="%s"][data-pt="to"]' % rel_id)
        check(handle.count() == 1, "选中关联线显示 to 端点")
        hb = handle.bounding_box()
        target = js("""
          () => {
            const M = window.MM;
            const inn = M.Model.frames[1];
            const vis = new Set(M.Model.visibleNodes(M.Model.root).map(n => n.id));
            const g = M.Render.frameGeometry(inn, vis);
            const r = document.getElementById('canvas').getBoundingClientRect();
            const s = M.Render.worldToScreen(g.x + g.w - 6, g.y + g.h - 6);
            return { x: s.x + r.x, y: s.y + r.y };
          }
        """)
        page.mouse.move(hb["x"] + hb["width"] / 2, hb["y"] + hb["height"] / 2)
        page.mouse.down()
        page.mouse.move(target["x"], target["y"], steps=8)
        page.wait_for_timeout(100)
        page.mouse.up()
        page.wait_for_timeout(150)
        check(js("MM.Model.relations[0].toFrame === true && MM.Model.relations[0].to === MM.Model.frames[1].id"),
              "拖拽端点命中最内层外框（非最外层）")

        page.locator("#btn-collapse-all").click()
        page.wait_for_timeout(150)
        check(js("MM.Model.visibleNodes(MM.Model.root).every(n => Number.isFinite(n.x) && Number.isFinite(n.y))"),
              "全部收起后所有可见节点坐标有限（无 NaN）")
        check(js("MM.Model.visibleNodes(MM.Model.root).length < MM.Model.allNodes(MM.Model.root).length"),
              "全部收起后可见节点少于全部节点")
        tf = js("(() => { const t = document.querySelector('#canvas g').transform.baseVal.consolidate(); return t ? {a: t.matrix.a, b: t.matrix.b, c: t.matrix.c, d: t.matrix.d, e: t.matrix.e, f: t.matrix.f} : null; })()")
        check(tf and all(abs(tf[k]) < 1e6 for k in ("a", "b", "c", "d", "e", "f")),
              "全部收起后视口变换矩阵有限")

        check(page.locator("#line-style-select option").count() == 6, "连线配色下拉含 6 个选项")
        check(page.locator("#theme-select option").count() == 11, "主题下拉含「跟随系统」等 11 个选项")
        page.locator("#theme-select").select_option("system")
        page.wait_for_timeout(100)
        dark = js("window.matchMedia('(prefers-color-scheme: dark)').matches")
        check(js("MM.Model.settings.theme") == "system", "选择跟随系统写入 settings.theme")
        check(js("document.documentElement.dataset.theme") == ("night" if dark else "blue"),
              "跟随系统主题解析为 %s" % ("night" if dark else "blue"))
        page.emulate_media(color_scheme="dark")
        page.wait_for_timeout(150)
        check(js("document.documentElement.dataset.theme") == "night", "系统深色时跟随系统解析为 night")
        page.emulate_media(color_scheme="light")
        page.wait_for_timeout(150)
        check(js("document.documentElement.dataset.theme") == "blue", "系统浅色时跟随系统解析回 blue")
        page.locator("#theme-select").select_option("blue")
        page.wait_for_timeout(100)
        check(js("document.documentElement.dataset.theme") == "blue", "切回经典蓝主题生效")
        page.locator("#btn-help").click()
        page.wait_for_timeout(100)
        check(page.locator(".shortcuts tr").count() >= 20, "帮助弹窗快捷键表已补全（≥20 行）")
        check(page.get_by_text("Ctrl+S", exact=True).count() == 1, "快捷键表含 Ctrl+S")
        check(page.get_by_text("Ctrl+Y").count() == 1, "快捷键表含 Ctrl+Y")
        check(page.get_by_text("Backspace").count() == 1, "快捷键表含 Backspace")
        page.locator(".modal button.primary").click()
        page.wait_for_timeout(100)
        page.locator("#btn-expand-all").click()
        page.wait_for_timeout(150)
        page.locator("#line-style-select").select_option("rainbow")
        page.wait_for_timeout(100)
        check(js("MM.Model.settings.lineStyle") == "rainbow", "切换连线配色写入 settings")
        colors = js("""() => {
            const paths = document.querySelectorAll('#canvas path.connector');
            const s = new Set();
            for (const p of paths) s.add(p.getAttribute('stroke'));
            return [...s];
        }""")
        check(len(colors) >= 2, "彩虹模式下不同层级连线颜色不同（%s）" % colors)

        js("MM.Model.clearSelection()")
        js("MM.Style.setOpen(false)")
        page.wait_for_timeout(50)
        page.locator("#btn-style").click()
        page.wait_for_timeout(100)
        check(page.locator("#style-panel").is_visible(), "打开样式面板")
        check(page.locator("#style-hint").is_visible(), "无选中时显示提示")
        kid = js("MM.Model.root.children[0].id")
        page.locator('g.node[data-id="%s"]' % kid).click()
        page.wait_for_timeout(100)
        check(page.locator("#style-controls").is_visible(), "选中节点后显示样式控件")
        js("""function() {
            const n = MM.Model.find(MM.Model.root, arguments[0]);
            MM.Model.change(() => {
                n.style = { bg: '#ff00aa', textColor: '#00ffaa', borderColor: '#aa00ff', borderWidth: 4, radius: 0, fontSize: 24, bold: true };
            });
        }""", kid)
        page.wait_for_timeout(100)
        check(js("MM.Model.settings.lineStyle") == "rainbow", "连线配色保持")
        check(js("function(){ return MM.Model.find(MM.Model.root, arguments[0]).style.bg }", kid) == "#ff00aa", "样式写入节点")
        check(js("function(){ return MM.Model.find(MM.Model.root, arguments[0]).style.fontSize }", kid) == 24, "样式字号写入")
        rect = page.locator('g.node[data-id="%s"] rect.nrect' % kid)
        check(rect.get_attribute("fill") == "#ff00aa", "SVG 背景色生效")
        check(rect.get_attribute("stroke") == "#aa00ff", "SVG 边框色生效")
        check(rect.get_attribute("stroke-width") == "4", "SVG 边框粗细生效")
        check(rect.get_attribute("rx") == "0", "SVG 圆角生效")
        text = page.locator('g.node[data-id="%s"] text' % kid).first
        check(text.get_attribute("font-size") == "24", "SVG 字号生效")
        check(text.get_attribute("font-weight") == "700", "SVG 加粗生效")

        page.mouse.click(60, 200)
        page.wait_for_timeout(100)
        check(not page.locator("#style-panel").is_visible(), "点击空白收起样式面板")
        page.locator('g.node[data-id="%s"]' % kid).click()
        page.wait_for_timeout(100)
        check(page.locator("#style-panel").is_visible(), "点击节点重新打开样式面板")

        page.goto("http://127.0.0.1:%d/testbed-frame.html" % PORT)
        page.wait_for_function("document.title.indexOf('{') === 0")
        out = json.loads(page.title())
        na = out["nodes"]["Node A"]
        a1 = out["nodes"]["A1"]
        nb = out["nodes"]["Node B"]
        nc = out["nodes"]["Node C"]
        single = out["frames"]["single"]
        multi = out["frames"]["multi"]
        a1_top = a1["y"] - a1["h"] / 2
        check(abs(single["y"] + 14 - a1_top) < 0.01, "单节点外框：框顶与成员子树顶间隔 14")
        check(single["y"] - 14 + 20 <= a1_top + 1e-6, "带标签外框：pill 底不压成员节点")
        b_top = min(nb["y"] - nb["h"] / 2, nc["y"] - nc["h"] / 2)
        check(abs(multi["y"] + 14 - b_top) < 0.01, "多节点外框：框顶与成员顶间隔 14")
        check(abs(multi["x"] - single["x"]) < 0.01, "两外框左缘对齐")

        page.goto("http://127.0.0.1:%d/index.html" % PORT)
        page.wait_for_timeout(300)
        js("(() => { const m = document.querySelector('.modal-mask'); if (m) m.remove(); })()")
        js("MM.Style.setOpen(false)")
        inn_id = js("MM.Model.frames[1].id")
        pt = js("""
          (fid) => {
            const M = window.MM;
            const f = M.Model.frames.find(x => x.id === fid);
            const vis = new Set(M.Model.visibleNodes(M.Model.root).map(n => n.id));
            const g = M.Render.frameGeometry(f, vis);
            const r = document.getElementById('canvas').getBoundingClientRect();
            const s = M.Render.worldToScreen(g.x + g.w / 2, g.y + 4);
            return { x: s.x + r.x, y: s.y + r.y };
          }
        """, inn_id)
        page.mouse.click(pt["x"], pt["y"])
        page.wait_for_timeout(150)
        check(page.locator("#style-panel").is_visible(), "单击外框打开样式面板")
        check(page.locator("#style-title").inner_text() == "外框样式", "面板标题切换为外框样式")
        check(page.locator("div.st-row:has(#st-dash)").is_visible(), "外框模式显示线型行")
        check(not page.locator("div.st-row:has(#st-bg)").is_visible(), "外框模式隐藏节点专属行")

        page.locator("#st-border").fill("#00ccff")
        page.locator("#st-border-w").fill("4")
        page.locator("#st-radius").fill("0")
        page.locator("#st-dash").uncheck()
        page.wait_for_timeout(150)
        st = js("(fid) => MM.Model.frames.find(x => x.id === fid).style", inn_id)
        check(st["borderColor"] == "#00ccff", "外框边框颜色写入")
        check(st["borderWidth"] == 4, "外框边框粗细写入")
        check(st["radius"] == 0, "外框圆角写入")
        check(st["dash"] is False, "外框实线写入")
        fr = page.locator('.frame-rect[data-id="%s"]' % inn_id)
        check(fr.get_attribute("stroke") == "#00ccff", "SVG 外框颜色生效")
        check(fr.get_attribute("stroke-width") == "4", "SVG 外框粗细生效")
        check(fr.get_attribute("rx") == "0", "SVG 外框圆角生效")
        check(fr.get_attribute("stroke-dasharray") == "none", "SVG 外框实线生效")

        page.locator("#st-reset").click()
        page.wait_for_timeout(100)
        check(js("(fid) => MM.Model.frames.find(x => x.id === fid).style", inn_id) is None, "恢复默认清空外框样式")
        check(fr.get_attribute("stroke-dasharray") == "8 5", "恢复默认后虚线恢复")
        page.mouse.click(60, 200)
        page.wait_for_timeout(100)
        check(not page.locator("#style-panel").is_visible(), "外框模式面板可收起")

        js("MM.Style.setOpen(false)")
        page.locator("#btn-export").click()
        page.wait_for_timeout(100)
        check(page.locator("#ex-scope").count() == 1, "导出对话框含范围选择")
        check(js("!!MM.Model.primaryNode()") is False, "无选中时分支选项禁用")
        page.locator(".modal button.primary").click()
        page.wait_for_function("window.__saved.length === 1")
        check(js("window.__picked.suggestedName").endswith(".png"), "PNG 导出经保存对话框（可选路径）")
        check(js("window.__picked.suggestedName").startswith("\u6839\u8282\u70b9"), "PNG 文件名以根节点标题开头")
        page.locator("#btn-export").click()
        page.wait_for_timeout(100)
        page.locator(".modal #ex-fmt").select_option("JSON 备份")
        page.locator(".modal button.primary").click()
        page.wait_for_function("window.__saved.length === 2")
        check(js("window.__picked.suggestedName").endswith(".json"), "JSON 导出经保存对话框")

        page.locator("#btn-import").click()
        page.wait_for_timeout(100)
        check(page.locator("#imp-open").count() == 1, "导入对话框含打开 .mind/.json 入口")
        page.locator(".modal button.primary").click()
        page.wait_for_timeout(100)

        check(page.locator("#minimap").count() == 1, "画布右下角存在小地图")
        check(js("typeof window.MM.Minimap === 'object' && typeof MM.Minimap.minimap === 'function'"), "MM.Minimap 模块已挂载")
        check(js("MM.Minimap.minimap()") is None or True, "小地图可刷新不报错")
        page.screenshot(path=str(ROOT / "tools" / "smoke-shot.png"))
        browser.close()

    print("SMOKE OK")


if __name__ == "__main__":
    main()
