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


def smoke_mobile(p, browser, device):
    ctx = browser.new_context(**p.devices[device])
    page = ctx.new_page()
    page.goto("http://127.0.0.1:%d/index.html" % PORT)
    page.wait_for_timeout(400)
    if page.locator(".modal").count():
        page.locator(".tpl-card.tpl-blank").click()
        page.wait_for_timeout(200)
    js = lambda expr, arg=None: page.evaluate(expr, arg)

    js("""() => {
      const M = window.MM;
      const r = M.Model.root;
      M.Model.change(() => {
        const k1 = M.Model.addChild(r, "K1");
        M.Model.addChild(r, "K2");
        M.Model.addChild(k1, "K1a");
      });
      M.Layout.layoutAll();
      M.Render.fit();
    }""")
    page.wait_for_timeout(200)

    vw = js("innerWidth")
    vh = js("innerHeight")
    check(vw <= 430, "%s：手机视口宽度 %d（360–430px 目标范围）" % (device, vw))
    check(js("window.matchMedia('(hover: none)').matches") is True, "触屏设备 hover: none 生效")
    check(js("window.matchMedia('(hover: hover)').matches") is False, "触屏设备 hover: hover 不生效")

    def center(node_id):
        return js("""(id) => {
          const M = window.MM;
          const n = M.Model.find(M.Model.root, id);
          const s = M.Render.worldToScreen(n.x, n.y);
          const r = document.getElementById("canvas").getBoundingClientRect();
          return { x: Math.round(s.x + r.x), y: Math.round(s.y + r.y) };
        }""", node_id)

    kid = js("() => MM.Model.root.children[0].id")
    pt = center(kid)

    page.evaluate("""(args) => {
      const el = document.querySelector('g.node[data-id="' + args.id + '"]');
      const o = { bubbles: true, cancelable: true, clientX: args.x, clientY: args.y,
        pointerId: 31, pointerType: "touch", isPrimary: true, button: 0, buttons: 1 };
      el.dispatchEvent(new PointerEvent("pointerdown", o));
      window.__lp = { el: el, o: o };
    }""", {"id": kid, "x": pt["x"], "y": pt["y"]})
    page.wait_for_timeout(750)

    menu = page.locator("#ctx-menu")
    check(menu.is_visible(), "长按节点弹出菜单")
    mstate = js("""() => {
      const m = document.getElementById("ctx-menu");
      const b = m.getBoundingClientRect();
      const item = m.querySelector(".ctx-item");
      return {
        pos: getComputedStyle(m).position,
        overflowY: getComputedStyle(m).overflowY,
        top: Math.round(b.top), bottom: Math.round(b.bottom),
        itemH: item ? Math.round(item.getBoundingClientRect().height) : 0,
        items: m.querySelectorAll(".ctx-item").length,
        scrollable: m.scrollHeight > m.clientHeight + 1
      };
    }""")
    check(mstate["pos"] == "fixed", "移动端菜单为固定定位底部抽屉")
    check(mstate["top"] >= 0 and mstate["bottom"] <= vh, "菜单完整落在视口内（top=%d bottom=%d vh=%d）"
          % (mstate["top"], mstate["bottom"], vh))
    check(mstate["itemH"] >= 44, "菜单项高度 %d ≥ 44" % mstate["itemH"])
    check(mstate["overflowY"] == "auto", "菜单可滚动（overflow-y=auto）")
    check(mstate["items"] >= 14, "节点菜单项数 %d（分组完整）" % mstate["items"])

    last_visible = js("""() => {
      const m = document.getElementById("ctx-menu");
      m.scrollTop = m.scrollHeight;
      const items = m.querySelectorAll(".ctx-item");
      const b = items[items.length - 1].getBoundingClientRect();
      return b.bottom <= innerHeight + 1 && b.top >= -1;
    }""")
    check(last_visible, "滚动到底后最后一项可见（无不可达项）")

    page.evaluate("""() => {
      const o = Object.assign({}, window.__lp.o, { buttons: 0 });
      document.getElementById("ctx-menu").dispatchEvent(new PointerEvent("pointerup", o));
    }""")
    page.wait_for_timeout(150)

    before = js("() => MM.Model.root.children[0].children.length")
    menu.locator(".ctx-item", has_text="添加子节点").click()
    page.wait_for_timeout(150)
    check(not menu.is_visible(), "点击菜单项后菜单收起")
    check(js("() => MM.Model.root.children[0].children.length") == before + 1, "抽屉菜单项可正常触达执行")

    js("() => { MM.Style.setOpen(false); MM.Model.clearSelection(); MM.Render.render(); }")
    page.wait_for_timeout(100)
    pt = center(kid)
    page.touchscreen.tap(pt["x"], pt["y"])
    page.wait_for_timeout(200)
    check(js("() => MM.Model.selectedNodes().length") == 1, "长按后手指在抽屉上抬起，再次单击仍可选中（指针状态不残留）")
    check(js("() => MM.Style.isOpen()") is False, "触屏单击不自动弹出样式面板")

    page.touchscreen.tap(pt["x"], pt["y"])
    page.wait_for_timeout(250)
    check(js("() => MM.Editor.isEditing") is True, "触屏双击进入编辑")
    er = js("""() => {
      const b = document.getElementById("edit-overlay").getBoundingClientRect();
      return { top: Math.round(b.top), bottom: Math.round(b.bottom), visible: b.width > 0 };
    }""")
    check(er["visible"] and er["top"] >= 0 and er["bottom"] <= vh, "编辑框落在可视区域内")
    js("() => document.querySelector('#edit-overlay textarea').blur()")
    page.wait_for_timeout(150)
    check(js("() => MM.Editor.isEditing") is False, "失焦提交退出编辑")

    js("() => { MM.Model.clearSelection(); MM.Render.render(); }")
    page.wait_for_timeout(100)
    edge = js("""(id) => {
      const M = window.MM;
      const n = M.Model.find(M.Model.root, id);
      const s = M.Render.worldToScreen(n.x - n.w / 2, n.y);
      const r = document.getElementById("canvas").getBoundingClientRect();
      return { x: Math.round(s.x + r.x) - 8, y: Math.round(s.y + r.y) };
    }""", kid)
    page.touchscreen.tap(edge["x"], edge["y"])
    page.wait_for_timeout(200)
    check(js("(id) => MM.Model.selectedNodes().some(n => n.id === id)", kid) is True,
          "点击节点外 8px 仍选中该节点（命中容差）")

    empty = js("""() => {
      const M = window.MM;
      const r = document.getElementById("canvas").getBoundingClientRect();
      const cand = [
        { x: r.left + 24, y: r.bottom - 30 },
        { x: r.right - 24, y: r.top + 30 },
        { x: r.left + 24, y: r.top + 30 }
      ];
      for (const p of cand) {
        let min = Infinity;
        for (const n of M.Model.visibleNodes(M.Model.root)) {
          const s = M.Render.worldToScreen(n.x, n.y);
          const dx = Math.max(Math.abs(p.x - r.left - s.x) - n.w / 2 * M.Render.view.s, 0);
          const dy = Math.max(Math.abs(p.y - r.top - s.y) - n.h / 2 * M.Render.view.s, 0);
          min = Math.min(min, Math.hypot(dx, dy));
        }
        if (min > 40) return { x: Math.round(p.x), y: Math.round(p.y), gap: Math.round(min) };
      }
      return null;
    }""")
    check(empty is not None, "存在距任意节点 >40px 的空白点")
    js("() => { MM.Model.clearSelection(); MM.Render.render(); }")
    page.wait_for_timeout(100)
    page.touchscreen.tap(empty["x"], empty["y"])
    page.wait_for_timeout(200)
    check(js("() => MM.Model.selectedNodes().length") == 0,
          "点击远处空白不误选节点（空白点距最近节点 %dpx）" % empty["gap"])

    fold = js("""(id) => {
      const b = document.querySelector('g.node[data-id="' + id + '"] g.fold-btn').getBoundingClientRect();
      return { x: Math.round(b.right) + 6, y: Math.round(b.top + b.height / 2) };
    }""", kid)
    page.touchscreen.tap(fold["x"], fold["y"])
    page.wait_for_timeout(200)
    check(js("(id) => MM.Model.find(MM.Model.root, id).collapsed", kid) is True,
          "点击折叠按钮外 6px 仍折叠该节点（按钮命中容差）")
    page.touchscreen.tap(fold["x"], fold["y"])
    page.wait_for_timeout(200)
    check(js("(id) => MM.Model.find(MM.Model.root, id).collapsed", kid) is False, "再次点击恢复展开")

    page.locator("#btn-outline").click()
    page.wait_for_timeout(200)
    close_box = js("""() => {
      const b = document.querySelector("#outline-panel .panel-close").getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    }""")
    check(close_box["w"] >= 44 and close_box["h"] >= 44,
          "面板关闭按钮 %dx%d ≥ 44（触控目标）" % (close_box["w"], close_box["h"]))
    check(js("""() => getComputedStyle(document.querySelector(".outline-li")).opacity""") == "1",
          "触屏下大纲行操作图标常显（不依赖 hover）")
    zoom_w = js("""() => document.getElementById("btn-zoom-in").getBoundingClientRect().width""")
    check(round(zoom_w) >= 44, "缩放按钮宽度 %d ≥ 44" % round(zoom_w))
    check(js("""() => getComputedStyle(document.getElementById("minimap")).touchAction""") == "none",
          "小地图 touch-action: none（触屏拖拽不被浏览器手势抢走）")
    page.locator("#outline-panel .panel-close").click()
    page.wait_for_timeout(150)
    check(not page.locator("#outline-panel").is_visible(), "触屏下大纲面板可关闭")

    ctx.close()


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
        check(js("!!window.MM.Image && typeof MM.Image.readImageFile === 'function'"), "图片处理模块已挂载")
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
        page.wait_for_selector(".modal", state="detached")
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

        page.wait_for_timeout(600)
        page.goto("http://127.0.0.1:%d/test/fixtures/testbed-frame.html" % PORT)
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

        page.locator("#lang-select").select_option("en")
        page.wait_for_timeout(100)
        check(page.locator("#btn-new").inner_text() == "New", "英文界面：新建按钮为 New")
        check(page.locator("#btn-export").inner_text() == "Export", "英文界面：导出按钮为 Export")
        check(page.locator("#empty-hint .eh-title").inner_text() == "Blank Mind Map", "英文界面：空态标题为 Blank Mind Map")
        check(js("document.documentElement.getAttribute('lang')") == "en", "英文界面 html lang=en")
        check(js("localStorage.getItem('mm.lang')") == "en", "英文界面语言已持久化")
        page.locator('g.node[data-id="%s"]' % kid).click(button="right")
        page.wait_for_timeout(100)
        check(menu.locator(".ctx-item", has_text="Edit text").count() == 1, "英文右键菜单含 Edit text")
        page.mouse.click(5, 300)
        page.wait_for_timeout(100)
        page.locator("#btn-export").click()
        page.wait_for_timeout(100)
        check(page.locator(".modal .m-row label", has_text="Format").count() == 1, "英文导出对话框含 Format")
        page.keyboard.press("Escape")
        page.wait_for_timeout(100)
        page.locator("#lang-select").select_option("zh")
        page.wait_for_timeout(100)
        check(page.locator("#btn-new").inner_text() == "新建", "切回中文恢复")


        check(page.locator("#minimap").count() == 1, "画布右下角存在小地图")
        check(js("typeof window.MM.Minimap === 'object' && typeof MM.Minimap.minimap === 'function'"), "MM.Minimap 模块已挂载")
        check(js("MM.Minimap.minimap()") is None or True, "小地图可刷新不报错")
        page.screenshot(path=str(ROOT / "tools" / "smoke-shot.png"))
        for device in ("iPhone SE", "iPhone 12"):
            smoke_mobile(p, browser, device)
        browser.close()

    print("SMOKE OK")


if __name__ == "__main__":
    main()
