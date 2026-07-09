#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""繁体馆别生成器。

从简体源页生成 zh-hant/ 整树（11 页 + 4 个含中文文案的 JS 副本）。
源文件改动后重跑：  python3 tools/build_i18n.py
转换引擎 OpenCC s2t（含词组消歧）。zh-hant/ 是构建产物，勿手改。
"""
import os
import re

from opencc import OpenCC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://roserparker.github.io/hukanbit/"
PAGES = [
    "index.html", "lab.html", "study.html", "gallery.html",
    "satoshi.html", "treasury.html", "pay.html",
    "articles/01.html", "articles/02.html", "articles/03.html",
    "articles/04.html", "articles/05.html",
]
JS = ["main.js", "games.js", "lab.js", "flow.js", "analytics.js"]

cc = OpenCC("s2t")
corpus = []


def conv_page(p):
    src = open(os.path.join(ROOT, p), encoding="utf-8").read()
    depth = p.count("/")
    t = cc.convert(src)

    assert t.count('<html lang="zh-CN">') == 1, p
    t = t.replace('<html lang="zh-CN">', '<html lang="zh-Hant">')
    t = t.replace('content="zh_CN"', 'content="zh_TW"')
    t = t.replace("Noto+Serif+SC", "Noto+Serif+TC").replace("Noto+Sans+SC", "Noto+Sans+TC")
    t = re.sub(r'(<meta property="og:url" content=")' + re.escape(BASE), r"\1" + BASE + "zh-hant/", t)

    # CSS 路径加一层；JS 路径不动（zh-hant/assets/ 有转换副本）
    css = ("assets/style.css", "assets/games.css") if depth == 0 else ("../assets/style.css", "../assets/games.css")
    for a in css:
        t = t.replace('href="' + a, 'href="../' + a)

    # 语言切换条改为繁体馆别视角
    hans_href = ("../" if depth == 0 else "../../") + p
    en_target = "../" * (depth + 1) + ("en/articles/01.html" if p == "articles/01.html" else "en/index.html")
    new_sw = (
        '<div class="lang-switch" aria-label="語言 / Language">'
        f'<a href="{hans_href}" lang="zh-Hans" data-lang="zh-hans">简</a>'
        "<strong>繁</strong>"
        f'<a href="{en_target}" lang="en" data-lang="en">EN</a></div>'
    )
    t2 = re.sub(r'<div class="lang-switch".*?</div>', new_sw, t, count=1, flags=re.S)
    assert t2 != t, p
    t = t2

    # 朱雀仿宋缺繁体标准字形：繁体馆别不提供「仿」
    t2 = re.sub(r'\s*<button type="button" class="f-fang"[^>]*>[^<]*</button>', "", t)
    assert t2 != t, p
    t = t2

    t = t.replace(
        "<!DOCTYPE html>",
        "<!DOCTYPE html>\n<!-- generated from ../" + p + " by tools/build_i18n.py · 改源文件后重跑，勿直接编辑 -->",
        1,
    )
    out = os.path.join(ROOT, "zh-hant", p)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(t)
    corpus.append(t)


def conv_js(name):
    src = open(os.path.join(ROOT, "assets", name), encoding="utf-8").read()
    t = cc.convert(src)
    out = os.path.join(ROOT, "zh-hant", "assets", name)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(t)
    corpus.append(t)


if __name__ == "__main__":
    for p in PAGES:
        conv_page(p)
    for j in JS:
        conv_js(j)
    open("/tmp/hkb_corpus_tc.txt", "w", encoding="utf-8").write("\n".join(corpus))
    print("OK: zh-hant %d pages + %d js · unique chars %d" % (len(PAGES), len(JS), len(set("".join(corpus)))))
