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

        page.goto("http://127.0.0.1:%d/index.html" % PORT)
        modal = page.locator(".modal")
        check(modal.count() > 0, "首次打开显示欢迎弹窗")
        page.locator(".tpl-card.tpl-blank").click()
        page.wait_for_timeout(300)

        js = lambda expr, arg=None: page.evaluate(expr, arg)
        check(bool(js("!!window.MM && !!MM.Model.root")), "根节点就绪")
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

        ids = js("(() => { const r = MM.Model.root; const k1 = r.children[0]; const k1a = k1.children[0]; return { k1: k1.id, k1a: k1a.id }; })()")

        root_id = js("MM.Model.root.id")
        node_sel = 'g.node[data-id="%s"]' % root_id
        menu = page.locator("#ctx-menu")

        page.locator(node_sel).click(button="right")
        check(menu.is_visible(), "右键节点弹出菜单")
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
            return M.Render.worldToScreen(g.x + g.w - 6, g.y + g.h - 6);
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

        page.screenshot(path=str(ROOT / "tools" / "smoke-shot.png"))
        browser.close()

    print("SMOKE OK")


if __name__ == "__main__":
    main()
