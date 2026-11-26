#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把两份成稿（阅读 2005—2026、小三门 2010—2026）组装成一个离线单页网站。
用法：
    python3 build_site.py            # 生成 index.html
    python3 build_site.py --dump     # 同时输出 src/data.json（调试用）
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent
READ_MD = BASE / "阅读/成稿/书稿源文件.md"
READ_Q = BASE / "阅读/成稿/阅读题目与翻译.json"
SMALL_DIR = BASE / "小三门/解析工程"
SMALL_DATA = SMALL_DIR / "data"
SMALL_OUT = SMALL_DIR / "out"
SMALL_METHOD = SMALL_DIR / "方法体系.md"

CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩"


# ----------------------------------------------------------------------------
# Markdown（够用的子集：标题 / 表格 / 列表 / 引用 / 分隔线 / 粗体 / 行内代码）
# ----------------------------------------------------------------------------
def esc(s: str) -> str:
    return html.escape(s, quote=False)


def md_inline(s: str) -> str:
    s = esc(s)
    s = re.sub(r"`([^`\n]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return s


def _is_table_sep(line: str) -> bool:
    return bool(re.match(r"^\|[\s:\-|]+\|$", line.strip()))


def _table_html(lines: list[str]) -> str:
    rows = []
    for ln in lines:
        cells = [c.strip() for c in ln.strip().strip("|").split("|")]
        rows.append(cells)
    if not rows:
        return ""
    head = rows[0]
    body = rows[2:] if len(rows) > 1 and _is_table_sep(lines[1]) else rows[1:]
    out = ['<div class="tbl-wrap"><table><thead><tr>']
    out += [f"<th>{md_inline(c)}</th>" for c in head]
    out.append("</tr></thead><tbody>")
    for r in body:
        out.append("<tr>" + "".join(f"<td>{md_inline(c)}</td>" for c in r) + "</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def _list_html(items: list[tuple[int, str, str]]) -> str:
    """items: (indent, ordered_marker, text)"""
    if not items:
        return ""
    base = min(i for i, _, _ in items)
    out = []
    stack: list[tuple[int, str]] = []  # (indent, tag)
    for indent, marker, text in items:
        ordered = marker[0].isdigit()
        tag = "ol" if ordered else "ul"
        lvl = max(0, (indent - base) // 2)
        while stack and stack[-1][0] > lvl:
            out.append(f"</{stack.pop()[1]}>")
        if not stack or stack[-1][0] < lvl:
            out.append(f"<{tag}>")
            stack.append((lvl, tag))
        elif stack[-1][1] != tag:
            out.append(f"</{stack.pop()[1]}><{tag}>")
            stack.append((lvl, tag))
        out.append(f"<li>{md_inline(text)}</li>")
    while stack:
        out.append(f"</{stack.pop()[1]}>")
    return "".join(out)


def md_to_html(md: str, id_prefix: str = "sec") -> str:
    lines = md.splitlines()
    out: list[str] = []
    i = 0
    hcount = 0
    while i < len(lines):
        line = lines[i]
        s = line.strip()
        if not s or s == "<<<PAGEBREAK>>>":
            i += 1
            continue
        if s.startswith("|") and i + 1 < len(lines) and _is_table_sep(lines[i + 1]):
            block = [line]
            i += 1
            while i < len(lines) and lines[i].strip().startswith("|"):
                block.append(lines[i])
                i += 1
            out.append(_table_html(block))
            continue
        m = re.match(r"^(#{1,4})\s+(.*)$", s)
        if m:
            lvl = len(m.group(1))
            hcount += 1
            out.append(f'<h{lvl} id="{id_prefix}-{hcount}">{md_inline(m.group(2))}</h{lvl}>')
            i += 1
            continue
        if re.match(r"^-{3,}$", s) or re.match(r"^\*{3,}$", s):
            out.append("<hr>")
            i += 1
            continue
        if s.startswith(">"):
            block = []
            while i < len(lines) and lines[i].strip().startswith(">"):
                block.append(re.sub(r"^\s*>\s?", "", lines[i]))
                i += 1
            paras = [p for p in re.split(r"\n\s*\n", "\n".join(block)) if p.strip()]
            inner = "".join(f"<p>{md_inline(p.strip())}</p>" for p in paras)
            out.append(f"<blockquote>{inner}</blockquote>")
            continue
        if re.match(r"^\s*([-*]|\d+\.)\s+", line):
            items = []
            while i < len(lines):
                lm = re.match(r"^(\s*)([-*]|\d+\.)\s+(.*)$", lines[i])
                if lm:
                    items.append((len(lm.group(1).replace("\t", "  ")), lm.group(2), lm.group(3)))
                    i += 1
                elif lines[i].strip() and lines[i].startswith((" ", "\t")) and items:
                    # 续行并入上一条
                    items[-1] = (items[-1][0], items[-1][1], items[-1][2] + lines[i].strip())
                    i += 1
                elif not lines[i].strip():
                    # 空行后若仍是列表则继续
                    j = i + 1
                    while j < len(lines) and not lines[j].strip():
                        j += 1
                    if j < len(lines) and re.match(r"^\s*([-*]|\d+\.)\s+", lines[j]):
                        i = j
                        continue
                    break
                else:
                    break
            out.append(_list_html(items))
            continue
        # 段落
        para = [s]
        i += 1
        while i < len(lines):
            t = lines[i].strip()
            if not t or t == "<<<PAGEBREAK>>>":
                break
            if re.match(r"^(#{1,4})\s+", t) or t.startswith(">") or t.startswith("|"):
                break
            if re.match(r"^\s*([-*]|\d+\.)\s+", lines[i]) or re.match(r"^-{3,}$", t):
                break
            para.append(t)
            i += 1
        out.append(f"<p>{md_inline(' '.join(para))}</p>")
    return "\n".join(out)


# ----------------------------------------------------------------------------
# 阅读：书稿源文件.md
# ----------------------------------------------------------------------------
READ_FIELDS = ["答案", "题型", "定位", "可用方法", "解析", "讲义对应", "避坑"]
SPEED_FIELDS = ["主旨词", "文章结构", "主旨（主旨词＋方向）", "作者态度", "阅读提示"]


def parse_method_blocks(raw: str) -> list[dict]:
    raw = raw.strip()
    chunks = [c for c in re.split(f"(?=[{CIRCLED}])", raw) if c.strip()]
    if not chunks:
        return []
    blocks = []
    for c in chunks:
        c = c.strip().lstrip("＋+").strip()
        if not c:
            continue
        role = None
        if re.search(r"[【（(]主[】）)]", c):
            role = "主"
        elif re.search(r"[【（(]辅[】）)]", c):
            role = "辅"
        text = re.sub(r"[【（(](主|辅)[】）)]", "", c).strip()
        text = re.sub(f"^[{CIRCLED}]\\s*", "", text).strip()
        text = re.sub(r"^[＋+]\s*", "", text).strip()
        text = re.sub(r"[＋+]+\s*$", "", text).strip()
        if text:
            blocks.append({"role": role, "text": text})
    return blocks


TYPE_MAIN = ["普通细节题", "推断题", "态度题", "主旨题", "例子题", "词汇题", "句子题"]


def main_type(t: str) -> str:
    head = re.split(r"[（(·/]", t)[0].strip()
    if "态度" in head or head.endswith("观点题"):
        return "态度题"
    for x in TYPE_MAIN:
        if head.startswith(x):
            return x
    return "其他"


CANON_METHODS: list[tuple[str, list[str]]] = [
    ("精准定位", ["精准定位", "同义替换定位"]),
    ("选项比错", ["选项比错"]),
    ("防并列", ["防并列"]),
    ("主旨校验", ["主旨校验"]),
    ("方向同一律", ["方向同一律"]),
    ("句意重心", ["句意重心"]),
    ("求异", ["求异"]),
    ("反向定位", ["反向定位"]),
    ("内容做题法", ["内容做题法"]),
    ("内容同一律", ["内容同一律", "同一律·内容同一"]),
    ("例子题观点句", ["例子题观点句", "例子题找观点句"]),
    ("限定词", ["抓限定词", "限定词"]),
    ("作者态度", ["作者态度"]),
    ("取反/取非", ["取反/取非", "取反／取非", "取反", "取非"]),
    ("读5项/读9项", ["读5项", "读9项"]),
    ("不易出错点", ["不易出错点"]),
    ("末段主旨", ["末段主旨"]),
    ("隐含假设", ["隐含假设"]),
    ("求同", ["求同"]),
    ("题干逻辑", ["题干逻辑", "深度理解题干"]),
    ("研究结论", ["研究结论"]),
    ("已做题定位句", ["已做题定位句"]),
    ("原命题转逆否", ["原命题转逆否"]),
    ("六大结构", ["六大结构"]),
    ("选项相关性", ["选项相关性"]),
    ("奥卡姆剃刀", ["奥卡姆剃刀"]),
    ("前后题共性", ["前后题共性"]),
    ("选项重复性", ["选项重复性"]),
    ("选项共性", ["选项共性"]),
    ("S形定位", ["S形定位", "S 形定位"]),
]



def method_name_of(text: str) -> str | None:
    base = re.split(r"——|：", text, maxsplit=1)[0].strip()
    base = re.sub(r"[（(].*$", "", base).strip(" ·,，、")
    if not base:
        return None
    for canon, aliases in CANON_METHODS:
        for a in aliases:
            if base == a or base.startswith(a) or a.startswith(base):
                return canon
    return None

def parse_reading() -> dict:
    raw = READ_MD.read_text(encoding="utf-8")
    qpath = READ_Q if READ_Q.exists() else (ROOT / "src" / "reading_questions.json")
    qbank = json.loads(qpath.read_text(encoding="utf-8")) if qpath.exists() else {}
    year_matches = list(re.finditer(r"(?m)^# (\d{4})年英语（一）阅读\s*$", raw))
    first_year = year_matches[0].start()
    app_start = raw.index("# 附录A")
    front = raw[:first_year]

    def cut(start_marker: str, end_marker: str) -> str:
        a = raw.index(start_marker)
        b = raw.index(end_marker)
        return raw[a:b]

    preface = raw[: raw.index("# 第一章 方法论总纲")]
    guide = cut("# 第一章 方法论总纲", "# 第二章 题型速查表")
    quick = cut("# 第二章 题型速查表", "# 第三章 讲义例题索引")
    examples = cut("# 第三章 讲义例题索引", "# 2005年英语（一）阅读")

    years = []
    for idx, m in enumerate(year_matches):
        y = int(m.group(1))
        end = year_matches[idx + 1].start() if idx + 1 < len(year_matches) else app_start
        body = raw[m.end():end]
        texts = []
        for tm in re.finditer(r"(?ms)^## Text (\d)\s*\n(.*?)(?=^## Text |\Z)", body):
            tno = int(tm.group(1))
            tblock = tm.group(2)
            sm = re.search(r"(?ms)^### 文章速读\s*\n(.*?)(?=^#### 第)", tblock)
            speed = {}
            if sm:
                for fm in re.finditer(r"(?m)^- \*\*(.+?)\*\*：(.*)$", sm.group(1)):
                    speed[fm.group(1)] = fm.group(2).strip()
            qs = []
            for qm in re.finditer(
                r"(?ms)^#### 第(\d+)题\s*\n(.*?)(?=^#### 第|^## Text|^# |\Z)", tblock
            ):
                no = int(qm.group(1))
                qb = qm.group(2)
                fields = {}
                for fm in re.finditer(r"(?m)^- \*\*(.+?)\*\*：(.*)$", qb):
                    fields[fm.group(1)] = fm.group(2).strip()
                qd = qbank.get(str(y), {}).get(str(tno), {}).get(str(no), {})
                qs.append(
                    {
                        "no": no,
                        "answer": fields.get("答案", "").strip(),
                        "stem": qd.get("stem", ""),
                        "stemZh": qd.get("stemZh", ""),
                        "options": [
                            {
                                "label": L,
                                "text": (qd.get("options", {}).get(L, {}) or {}).get("text", ""),
                                "zh": (qd.get("options", {}).get(L, {}) or {}).get("zh", ""),
                            }
                            for L in "ABCD"
                        ] if qd else [],
                        "type": fields.get("题型", ""),
                        "locate": fields.get("定位", ""),
                        "methodsRaw": fields.get("可用方法", ""),
                        "methods": parse_method_blocks(fields.get("可用方法", "")),
                        "methodNames": [],
                        "analysis": fields.get("解析", ""),
                        "ref": fields.get("讲义对应", ""),
                        "pitfall": fields.get("避坑", ""),
                    }
                )
            texts.append(
                {
                    "no": tno,
                    "speed": {
                        "keyword": speed.get("主旨词", ""),
                        "structure": speed.get("文章结构", ""),
                        "gist": speed.get("主旨（主旨词＋方向）", ""),
                        "attitude": speed.get("作者态度", ""),
                        "tips": speed.get("阅读提示", ""),
                    },
                    "questions": qs,
                }
            )
        years.append({"year": y, "texts": texts})

    # 统计
    type_counts = {k: 0 for k in TYPE_MAIN}
    method_counts = {name: 0 for name, _ in CANON_METHODS}
    total = 0
    for y in years:
        for t in y["texts"]:
            for q in t["questions"]:
                total += 1
                type_counts[main_type(q["type"])] = type_counts.get(main_type(q["type"]), 0) + 1
                seen = set()
                for b in q["methods"]:
                    nm = method_name_of(b["text"])
                    if nm:
                        seen.add(nm)
                q["methodNames"] = sorted(seen)
                for nm in seen:
                    method_counts[nm] += 1
    method_stats = [
        {"name": n, "count": c}
        for n, c in sorted(method_counts.items(), key=lambda kv: -kv[1])
        if c > 0
    ]
    type_stats = [{"name": k, "count": v} for k, v in type_counts.items() if v]

    answers = []
    for y in years:
        row = {"year": y["year"]}
        for t in y["texts"]:
            row[f"t{t['no']}"] = " ".join(q["answer"] for q in t["questions"])
        answers.append(row)

    return {
        "preface": md_to_html(preface, "preface"),
        "guide": md_to_html(guide, "guide"),
        "quick": md_to_html(quick, "quick"),
        "examples": md_to_html(examples, "example"),
        "years": years,
        "stats": {"total": total, "types": type_stats, "methods": method_stats},
        "answers": answers,
    }


# ----------------------------------------------------------------------------
# 小三门：方法体系.md + data/*.md + out/*.json
# ----------------------------------------------------------------------------
def parse_small_method_codes(md: str) -> dict[str, str]:
    names = {}
    in_table = False
    for line in md.splitlines():
        if line.strip().startswith("| 代号 |"):
            in_table = True
            continue
        if in_table:
            if not line.strip().startswith("|"):
                if names:
                    break
                continue
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if len(cells) >= 2 and re.fullmatch(r"[XPHLCT]\d{1,2}", cells[0]):
                names[cells[0]] = cells[1]
    return names


def parse_cloze_options(text: str) -> dict[int, list[str]]:
    opts = {}
    for m in re.finditer(
        r"(?m)^(\d+)\.\s*\[ A \]\s*(.*?)\s*\[ B \]\s*(.*?)\s*\[ C \]\s*(.*?)\s*\[ D \]\s*(.*)$",
        text,
    ):
        opts[int(m.group(1))] = [m.group(2).strip(), m.group(3).strip(), m.group(4).strip(), m.group(5).strip()]
    return opts


def inline_blank(kind: str, line: str) -> str:
    ln = esc(line)
    if kind == "完形":
        ln = re.sub(
            r"_{2,}\s*(\d{1,2})\s*_{2,}",
            lambda m: f'<span class="blank" data-no="{m.group(1)}" tabindex="0" role="button">{m.group(1)}</span>',
            ln,
        )
    elif kind == "新题型":
        ln = re.sub(
            r"\((\d{2})\)\s*_*",
            lambda m: (
                f'<span class="blank" data-no="{m.group(1)}" tabindex="0" role="button">{m.group(1)}</span>'
                if 41 <= int(m.group(1)) <= 45
                else m.group(0)
            ),
            ln,
        )
    elif kind == "翻译":
        ln = re.sub(
            r"\*\*\((\d{2})\)\*\*",
            lambda m: f'<span class="qmark" data-no="{m.group(1)}">{m.group(1)}</span>',
            ln,
        )
    return ln


def build_passage(kind: str, subtype: str, text: str) -> list[str]:
    blocks = []
    for line in text.splitlines():
        if not line.strip():
            continue
        raw = line.strip()
        ln = inline_blank(kind, raw)
        cls = "passage-p"
        if kind == "新题型" and "排序" in subtype and re.match(r"^\[[A-H]\]", raw):
            m = re.match(r"^\[([A-H])\]\s*(.*)$", raw)
            ln = (f'<span class="plabel">{m.group(1)}</span>' + inline_blank(kind, m.group(2))) if m else ln
            cls = "passage-p sortpara"
        elif kind == "新题型" and "→" in raw:
            cls = "passage-p chainline"
        elif re.match(r"^(Part [A-C]|Section I|Directions:|Read the following|In the following|The following)", raw):
            cls = "passage-p direction"
        blocks.append(f'<p class="{cls}">{ln}</p>')
    return blocks


def read_answer_string(md: str) -> str:
    m = re.search(r"(?ms)^## 答案\s*\n+(.+?)(?:\n\s*\(|\n\s*（|\Z)", md)
    return m.group(1).strip() if m else ""


def parse_small() -> dict:
    method_md = SMALL_METHOD.read_text(encoding="utf-8")
    code_names = parse_small_method_codes(method_md)
    guide_html = md_to_html(method_md, "sm")

    sent_path = SMALL_DIR / "cloze_sentences.json"
    if not sent_path.exists():
        sent_path = ROOT / "src" / "cloze_sentences.json"
    cloze_sent = json.loads(sent_path.read_text(encoding="utf-8")) if sent_path.exists() else {}

    opt_zh_path = SMALL_DIR / "opt_zh.json"
    if not opt_zh_path.exists():
        opt_zh_path = ROOT / "src" / "opt_zh.json"
    opt_zh = json.loads(opt_zh_path.read_text(encoding="utf-8")) if opt_zh_path.exists() else {}

    years = []
    code_counts: dict[str, int] = {}
    code_questions: dict[str, list[dict]] = {}
    type_total = {"完形": 0, "新题型": 0, "翻译": 0}

    for y in range(2010, 2027):
        parts = {}
        for kind in ["完形", "新题型", "翻译"]:
            md_path = SMALL_DATA / f"{kind}_{y}.md"
            js_path = SMALL_OUT / f"{kind}_{y}.json"
            md = md_path.read_text(encoding="utf-8")
            data = json.loads(js_path.read_text(encoding="utf-8"))
            first_nl = md.index("\n")
            body = md[first_nl + 1 :]
            subtype = data.get("type", "")
            options = []
            chain = data.get("chain", "")

            if kind == "完形":
                idx = body.index("## 选项")
                passage = body[:idx]
                opt_map = parse_cloze_options(body[idx:])
                for it in data["items"]:
                    it["opts"] = opt_map.get(it["no"], [])
                    zh = opt_zh.get(str(y), {}).get(str(it["no"]), {})
                    it["optZh"] = [zh.get(L, "") for L in "ABCD"]
                    sent = cloze_sent.get(str(y), {}).get(str(it["no"]), {})
                    it["sentence"] = sent.get("sentence", "")
                    it["sentenceZh"] = sent.get("sentenceZh", "")
            elif kind == "新题型":
                body = body.split("## 答案")[0]
                lines = body.rstrip().splitlines()
                if "排序" not in subtype:
                    opt_lines = []
                    while lines and re.match(r"^\[[A-G]\]\s+", lines[-1].strip()):
                        opt_lines.insert(0, lines.pop())
                    for ln in opt_lines:
                        m = re.match(r"^\[([A-G])\]\s+(.*)$", ln.strip())
                        if m:
                            options.append({"label": m.group(1), "text": m.group(2).strip()})
                    # 若正文里有“## 选项”分隔则去掉
                    body = "\n".join(lines)
                    body = re.split(r"(?m)^## 选项\s*$", body)[0]
                else:
                    body = "\n".join(lines)
                passage = body
            else:
                passage = body.split("## 参考译文")[0]

            part = {
                "kind": kind,
                "year": y,
                "subtype": subtype,
                "overview": data.get("overview", ""),
                "passage": build_passage(kind, subtype, passage),
                "options": options,
                "chain": chain,
                "terms": data.get("terms", []),
                "items": data["items"],
                "answerString": read_answer_string(md) if kind != "翻译" else "",
                "checks": data.get("checks", {}),
            }
            parts[kind] = part
            type_total[kind] += len(data["items"])
            for it in data["items"]:
                codes = {
                    cm.group(1) + cm.group(2)
                    for cm in re.finditer(r"\b([XPHLCT])(\d{1,2})\b", it.get("method", ""))
                }
                hint = it.get("point") or it.get("method") or ""
                for code in codes:
                    code_counts[code] = code_counts.get(code, 0) + 1
                    code_questions.setdefault(code, []).append(
                        {"year": y, "kind": kind, "no": it.get("no"), "hint": hint[:90]}
                    )
        years.append({"year": y, "parts": parts})

    code_stats = []
    for code, count in sorted(
        code_counts.items(),
        key=lambda kv: (("XPHLCT".index(kv[0][0]) if kv[0][0] in "XPHLCT" else 9), int(re.sub(r"\D", "", kv[0]) or 0)),
    ):
        code_stats.append(
            {
                "code": code,
                "name": code_names.get(code, ""),
                "count": count,
                "questions": code_questions.get(code, []),
            }
        )

    return {
        "guide": guide_html,
        "years": years,
        "stats": {"total": sum(type_total.values()), "types": type_total, "codes": code_stats},
        "answers": [
            {
                "year": y["year"],
                "cloze": "".join(it["answer"] for it in y["parts"]["完形"]["items"]),
                "newtype": "".join(it["answer"] for it in y["parts"]["新题型"]["items"]),
                "newtypeLabel": y["parts"]["新题型"]["subtype"],
            }
            for y in years
        ],
    }


def compose(data: dict) -> Path:
    src = ROOT / "src"
    template = (src / "index.template.html").read_text(encoding="utf-8")
    css = (src / "style.css").read_text(encoding="utf-8")
    app = (src / "app.js").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    html = (
        template.replace("/*__CSS__*/", css)
        .replace("__DATA__", payload)
        .replace("/*__APP__*/", app)
    )
    out = ROOT / "index.html"
    out.write_text(html, encoding="utf-8")
    return out


def main() -> None:
    reading = parse_reading()
    small = parse_small()
    data = {
        "meta": {
            "readingTotal": reading["stats"]["total"],
            "smallTotal": small["stats"]["total"],
            "total": reading["stats"]["total"] + small["stats"]["total"],
            "readYears": [y["year"] for y in reading["years"]],
            "smallYears": [y["year"] for y in small["years"]],
        },
        "reading": reading,
        "small": small,
    }
    if "--dump" in sys.argv:
        (ROOT / "src" / "data.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8"
        )
    print(
        "阅读", reading["stats"]["total"],
        "小三门", small["stats"]["total"],
        "合计", data["meta"]["total"],
    )
    print("阅读年份", len(reading["years"]), "小三门年份", len(small["years"]))
    print("阅读方法", len(reading["stats"]["methods"]), "小三门方法", len(small["stats"]["codes"]))
    print("答案缺失", sum(1 for y in reading["years"] for t in y["texts"] for q in t["questions"] if not q["answer"]))
    out = compose(data)
    print("已生成", out, f"{out.stat().st_size / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
