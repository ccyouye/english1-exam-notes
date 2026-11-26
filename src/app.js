/* ============================================================
   考研英语一 · 真题解析库 — 应用脚本（无依赖）
   ============================================================ */
(function () {
  "use strict";

  const D = window.SITE_DATA;
  const R = D.reading;
  const S = D.small;
  const KINDS = ["完形", "新题型", "翻译"];
  const KIND_EN = { 完形: "CLOZE", 新题型: "PART B", 翻译: "TRANSLATION" };
  const FILTERS = [
    ["all", "全部"],
    ["阅读", "阅读"],
    ["完形", "完形"],
    ["新题型", "新题型"],
    ["翻译", "翻译"],
  ];
  const view = document.getElementById("view");
  const crumb = document.getElementById("crumb");
  const sidebar = document.getElementById("sidebar");
  const toastEl = document.getElementById("toast");

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    },
  };

  const state = {
    practice: store.get("ky.practice", false) === true,
    theme: document.documentElement.dataset.theme || "light",
    stars: new Set(store.get("ky.stars", [])),
    searchFilter: "all",
    index: null,
  };

  /* ---------------- 基础工具 ---------------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function md(s) {
    if (!s) return "";
    let out = esc(s);
    out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return out;
  }
  function sceneHTML(s, activeNo) {
    return esc(s).replace(/\[(\d{1,2})\]/g, (m, n) =>
      `<span class="scene-mark${Number(n) === activeNo ? " now" : ""}">${n}</span>`
    );
  }
  function readYear(y) {
    return R.years.find((x) => x.year === y);
  }
  function smallYear(y) {
    return S.years.find((x) => x.year === y);
  }
  function kindCount(part) {
    return part.items.length;
  }
  function yearList(arr, route) {
    return arr.map((y) => `<a class="year-chip" href="#/${route}/${y}">${y}</a>`).join("");
  }
  function labelOf(kind) {
    if (kind === "完形") return "完形填空";
    if (kind === "新题型") return "新题型";
    return "翻译";
  }
  function practiceClass() {
    return state.practice ? "practice" : "";
  }
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove("show"), 1800);
  }
  function starHTML(key) {
    const on = state.stars.has(key);
    return `<button class="star ${on ? "on" : ""}" data-star="${esc(key)}" aria-label="标记此题" title="标记 / 取消标记">${on ? "★" : "☆"}</button>`;
  }
  function revealBar(key) {
    return `<div class="reveal-bar"><button class="btn sm primary" data-reveal>显示答案</button><span class="hint">先做一遍，再对答案</span></div>`;
  }
  function answerBadge(ans) {
    return `<span class="qanswer" title="答案 ${esc(ans)}"><span class="ans-real">${esc(ans)}</span><span class="ans-hide">?</span></span>`;
  }
  function field(label, body, cls) {
    return `<div class="field ${cls || ""}"><div class="flabel">${label}</div>${body}</div>`;
  }
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const qi = raw.indexOf("?");
    const path = qi >= 0 ? raw.slice(0, qi) : raw;
    const qs = qi >= 0 ? raw.slice(qi + 1) : "";
    let seg = [];
    try {
      seg = path.split("/").filter(Boolean).map(decodeURIComponent);
    } catch (e) {
      seg = path.split("/").filter(Boolean);
    }
    return { seg, q: new URLSearchParams(qs) };
  }
  function setCrumb(parts) {
    crumb.innerHTML = parts
      .map((p, i) =>
        i === parts.length - 1
          ? `<b>${esc(p.text || p)}</b>`
          : `<a href="${p.href || "#/"}">${esc(p.text || p)}</a><span class="sep">/</span>`
      )
      .join("");
  }

  /* ---------------- 侧栏 ---------------- */
  function renderSidebar() {
    const years = (arr, route, cls) =>
      `<div class="year-grid">${arr
        .map((y) => `<a class="year-chip" data-year-link="${y}" href="#/${route}/${y}">${y}</a>`)
        .join("")}</div>`;
    sidebar.innerHTML = `
      <a class="brand" href="#/">
        <span class="brand-mark">英</span>
        <span>
          <span class="brand-title">真题解析库</span>
          <span class="brand-sub">POSTGRAD ENGLISH I</span>
        </span>
      </a>
      <div class="nav-group">
        <div class="nav-title">概览</div>
        <a class="nav-link" data-nav="home" href="#/"><span class="ni">◈</span>总览</a>
        <a class="nav-link" data-nav="search" href="#/search"><span class="ni">⌕</span>全文搜索</a>
      </div>
      <div class="nav-group">
        <div class="nav-title">阅读 Part A · ${R.stats.total} 题</div>
        <a class="nav-link" data-nav="reading-preface" href="#/reading/preface"><span class="ni">序</span>前言 · 怎么用</a>
        <a class="nav-link" data-nav="reading-guide" href="#/reading/guide"><span class="ni">壹</span>方法论总纲</a>
        <a class="nav-link" data-nav="reading-quick" href="#/reading/quick"><span class="ni">贰</span>题型速查 / 讲义例题</a>
        <a class="nav-link" data-nav="reading-methods" href="#/reading/methods"><span class="ni">叁</span>方法统计与索引</a>
        <a class="nav-link" data-nav="reading-answers" href="#/reading/answers"><span class="ni">答</span>答案速查</a>
        <div class="nav-title" style="margin-top:12px">真题 2005—2026</div>
        ${years(R.years.map((y) => y.year), "reading")}
      </div>
      <div class="nav-group">
        <div class="nav-title">小三门 · ${S.stats.total} 题</div>
        <a class="nav-link" data-nav="small-guide" href="#/small/guide"><span class="ni">壹</span>方法体系</a>
        <a class="nav-link" data-nav="small-methods" href="#/small/methods"><span class="ni">贰</span>方法索引</a>
        <a class="nav-link" data-nav="small-answers" href="#/small/answers"><span class="ni">答</span>答案速查</a>
        <div class="nav-title" style="margin-top:12px">真题 2010—2026</div>
        ${years(S.years.map((y) => y.year), "small")}
      </div>
      <div class="sidebar-foot">
        <span>已标记 <b id="starCount">${state.stars.size}</b> 题</span>
        <span>离线 · v1.0</span>
      </div>`;
    updateStarCount();
  }
  function updateStarCount() {
    const el = document.getElementById("starCount");
    if (el) el.textContent = state.stars.size;
  }
  function setActiveNav(r) {
    sidebar.querySelectorAll(".nav-link").forEach((a) => a.classList.remove("active"));
    sidebar.querySelectorAll(".year-chip").forEach((a) => a.classList.remove("active"));
    let key = "";
    if (!r.seg.length) key = "home";
    else if (r.seg[0] === "search") key = "search";
    else if (r.seg[0] === "reading") {
      if (["preface", "guide", "quick", "methods", "answers"].includes(r.seg[1])) key = "reading-" + r.seg[1];
      else key = "reading-" + r.seg[1];
    } else if (r.seg[0] === "small") {
      if (["guide", "methods", "answers"].includes(r.seg[1])) key = "small-" + r.seg[1];
      else key = "small-" + r.seg[1];
    }
    const link = sidebar.querySelector(`.nav-link[data-nav="${key}"]`);
    if (link) link.classList.add("active");
    if (/^\d{4}$/.test(r.seg[1] || "") && (r.seg[0] === "reading" || r.seg[0] === "small")) {
      const chip = sidebar.querySelector(`.year-chip[data-year-link="${r.seg[1]}"]`);
      if (chip) chip.classList.add("active");
    }
  }

  /* ---------------- 首页 ---------------- */
  function renderHome() {
    const readN = R.stats.total;
    const smallN = S.stats.total;
    const yearsR = R.years.map((y) => y.year);
    const yearsS = S.years.map((y) => y.year);
    const typeBars = R.stats.types
      .map((t) => {
        const max = Math.max(...R.stats.types.map((x) => x.count));
        const pct = Math.round((t.count / max) * 100);
        return `<div class="bar-row"><span class="bl">${t.name}</span><span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span><span class="bv">${t.count}</span></div>`;
      })
      .join("");
    return `
    <section class="hero">
      <div class="eyebrow">考研英语（一） · 2005—2026</div>
      <h1>把真题，<br><span class="accent">读成方法。</span></h1>
      <p class="lead">两本逐题解析合成一个离线阅读库：<b>阅读 Part A</b> 2005—2026（88 篇 440 题），<b>小三门</b> 2010—2026（完形 340 空、新题型 85 题、翻译 85 句）。每道题都标注定位、可用方法、逐项比错与避坑点，可按年份、题型、方法、关键词自由检索。</p>
      <div class="hero-actions">
        <a class="btn primary" href="#/reading/2026">从最新一套开始 <span aria-hidden="true">→</span></a>
        <a class="btn" href="#/small/2026">小三门 2026</a>
        <a class="btn ghost" href="#/reading/guide">先看方法论</a>
      </div>
      <div class="stat-strip">
        <div class="stat"><div class="num">${D.meta.total}<em>题</em></div><div class="lab">逐题解析总数</div></div>
        <div class="stat"><div class="num">${yearsR.length + yearsS.length}<em>套</em></div><div class="lab">覆盖年份 · 2005—2026</div></div>
        <div class="stat"><div class="num">88<em>篇</em></div><div class="lab">阅读文章 · 440 题</div></div>
        <div class="stat"><div class="num">33<em>条</em></div><div class="lab">小三门方法代号</div></div>
      </div>
    </section>

    <section>
      <div class="section-title">两本书 <span class="en">TWO BOOKS</span></div>
      <div class="book-grid">
        <div class="book-card">
          <div class="bk">Reading · Part A</div>
          <h2><a href="#/reading/${yearsR[yearsR.length - 1]}">阅读逐题解析</a></h2>
          <div class="desc">颉斌斌阅读方法论落地：精准定位、选项比错、主旨校验。每年四篇，先“文章速读”，再逐题给题干、选项中英对照、定位句、可用方法、解析与避坑。</div>
          <div class="nums"><span><b>${readN}</b>题</span><span><b>88</b>篇</span><span><b>22</b>年</span><span><b>${R.stats.methods.length}</b>种方法</span></div>
          <div class="year-grid">${yearList(yearsR, "reading")}</div>
          <a class="btn sm" style="margin-top:4px" href="#/reading/${yearsR[yearsR.length - 1]}">进入阅读解析 →</a>
        </div>
        <div class="book-card small">
          <div class="bk">Cloze · Part B · Translation</div>
          <h2><a href="#/small/${yearsS[yearsS.length - 1]}">小三门逐题解析</a></h2>
          <div class="desc">依据祁迹「小三门」课堂笔记方法体系：完形 20 空、新题型 5 题、翻译 5 句。完形每个选项均附中文释义，每空另给出题句英中对照；每题固定“方法—线索—解析—排除”，翻译另给意群切分、采分点与参考译文。</div>
          <div class="nums"><span><b>${smallN}</b>题</span><span><b>17</b>年</span><span><b>33</b>条方法</span><span><b>3</b>种题型</span></div>
          <div class="year-grid">${yearList(yearsS, "small")}</div>
          <a class="btn sm" style="margin-top:4px" href="#/small/${yearsS[yearsS.length - 1]}">进入小三门解析 →</a>
        </div>
      </div>
    </section>

    <section>
      <div class="section-title">方法入口 <span class="en">METHODS</span></div>
      <div class="entry-grid">
        <a class="entry" href="#/reading/guide"><span class="ico">壹</span><b>阅读方法论总纲</b><span>精准定位 · 选项比错 · 主旨校验，七大题型专属打法。</span></a>
        <a class="entry" href="#/reading/quick"><span class="ico">贰</span><b>题型速查表</b><span>考场上先判题型，再按表取动作；附讲义经典例题索引。</span></a>
        <a class="entry" href="#/small/guide"><span class="ico">叁</span><b>小三门方法体系</b><span>X / P / H / L / C / T 六组代号，从口诀到操作步骤。</span></a>
        <a class="entry" href="#/reading/methods"><span class="ico">肆</span><b>方法统计与索引</b><span>看清哪些方法是高频、哪些低频但致命，按方法反查题目。</span></a>
      </div>
    </section>

    <section>
      <div class="section-title">怎么用 <span class="en">HOW TO USE</span></div>
      <div class="howto">
        <div class="step"><b>① 限时做题</b><span>按考场节奏完成，先不看答案；用顶部“练习模式”遮住答案。</span></div>
        <div class="step"><b>② 精准定位</b><span>对照“定位”栏，检查你选的句子是否真的回答了题干所问。</span></div>
        <div class="step"><b>③ 选项比错</b><span>重点看错误项是怎么错的：词错、方向错、程度错、主体错、时间错。</span></div>
        <div class="step"><b>④ 归因复盘</b><span>把错题归入方法，按方法索引专项训练；星标功能记录待复习题。</span></div>
      </div>
    </section>

    <section>
      <div class="section-title">阅读题型分布 <span class="en">TYPE MIX</span></div>
      <div class="bar-list">${typeBars}</div>
    </section>

    <div class="notice">
      <b>数据说明：</b>阅读解析以《颉斌斌阅读方法论》公开讲义为底本，覆盖 2005—2026 年英语（一）88 篇 440 题；小三门解析依据课堂笔记方法体系，覆盖 2010—2026 年完形 340 空、新题型 85 题、翻译 85 句。真题原文、选项与答案以官方卷面为准；解析中的英文引文保留原卷（含个别 OCR 异形），翻译参考译文以“准确、通顺”为标准，不追求唯一。
      <br><b>本站为离线单页：</b>所有数据已内嵌，不联网即可使用；答题记录与星标保存在本机浏览器。内容整理自课堂讲义与公开真题，仅供个人复习使用。
    </div>`;
  }

  /* ---------------- 阅读年页 ---------------- */
  function renderReadingYear(year, tno, query) {
    const y = readYear(year);
    if (!y) {
      return `<div class="empty">未找到 ${year} 年的阅读数据。</div>`;
    }
    const t = y.texts.find((x) => x.no === tno) || y.texts[0];
    const idx = R.years.indexOf(y);
    const prev = R.years[idx - 1];
    const next = R.years[idx + 1];
    const speed = t.speed;
    const rows = [
      ["主旨词", speed.keyword, "key"],
      ["文章结构", speed.structure, ""],
      ["主旨", speed.gist, "gist"],
      ["作者态度", speed.attitude, ""],
      ["阅读提示", speed.tips, ""],
    ]
      .map(
        ([lab, val, cls]) =>
          `<div class="brief-row ${cls}"><div class="brief-lab">${lab}</div><div class="brief-val">${md(val)}</div></div>`
      )
      .join("");

    const tabs = y.texts
      .map((x) => {
        const range = x.questions.length
          ? `${x.questions[0].no}–${x.questions[x.questions.length - 1].no}`
          : "";
        return `<a class="tab ${x.no === t.no ? "active" : ""}" href="#/reading/${year}/${x.no}">Text ${x.no}<span class="cnt">${range}</span></a>`;
      })
      .join("");

    const qs = t.questions
      .map((q, qi) => {
        const key = `r:${year}:${q.no}`;
        const methods = q.methods.length
          ? `<ul class="methods">${q.methods
              .map(
                (m) =>
                  `<li>${
                    m.role
                      ? `<span class="role ${m.role === "主" ? "primary" : "aux"}">${m.role}</span>`
                      : `<span class="role none">法</span>`
                  }<span>${md(m.text)}</span></li>`
              )
              .join("")}</ul>`
          : `<div class="ftext">${md(q.methodsRaw)}</div>`;
        return `
        <article class="qcard" id="r-${year}-${q.no}" data-key="${key}">
          <div class="qhead" role="button" tabindex="0" aria-expanded="false">
            <span class="qno">${q.no}</span>
            ${answerBadge(q.answer)}
            <span class="qtype" title="${esc(q.type)}"><span class="k">题型</span> · ${md(q.type)}</span>
            <span class="qmeta">${q.methods.length} 条方法</span>
            <span class="qacts">${starHTML(key)}</span>
            <span class="chev" aria-hidden="true">▼</span>
          </div>
          <div class="qbody">
            ${revealBar(key)}
            ${q.stem ? `<div class="stem-box"><div class="stem-en">${md(q.stem)}</div>${q.stemZh ? `<div class="stem-zh">${esc(q.stemZh)}</div>` : ""}</div>` : ""}
            ${q.options && q.options.some((o) => o.text) ? `<div class="reading-opts">${q.options.map((o) => `<div class="opt ${o.label === q.answer ? "correct" : ""}"><span class="olabel">${o.label}</span><span class="opt-body"><span class="opt-en">${esc(o.text)}</span>${o.zh ? `<span class="opt-zh">${esc(o.zh)}</span>` : ""}</span></div>`).join("")}</div>` : ""}
            ${field("定位", `<div class="ftext locate">${md(q.locate)}</div>`)}
            ${field("可用方法", methods)}
            ${field("解析", `<div class="ftext">${md(q.analysis)}</div>`)}
            ${field("讲义对应", `<div class="ftext" style="font-size:13.8px;color:var(--muted)">${md(q.ref)}</div>`)}
            <div class="pitfall"><b>避坑</b>${md(q.pitfall)}</div>
          </div>
        </article>`;
      })
      .join("");

    return `
    <div class="page-head">
      <div class="eyebrow">READING · PART A · ${year}</div>
      <h1>${year} 年 英语（一）阅读</h1>
      <div class="sub">四篇文章、二十道题。先用“文章速读”定主旨与结构，再逐题回到定位句；每道题的“可用方法”区分主方法与辅助方法，考场上取一条最快、最稳的。</div>
      <div class="meta-row">
        <span class="pill accent">4 篇</span>
        <span class="pill">20 题</span>
        <span class="pill">Text ${t.no} · ${t.questions.length} 题</span>
        <span class="year-nav" style="margin-left:auto">
          ${prev ? `<a class="btn sm" href="#/reading/${prev.year}/${t.no}">← ${prev.year}</a>` : ""}
          ${next ? `<a class="btn sm" href="#/reading/${next.year}/${t.no}">${next.year} →</a>` : ""}
        </span>
      </div>
    </div>
    <div class="reader-bar">
      <div class="tabs">${tabs}</div>
      <span class="spacer"></span>
      <button class="btn sm" data-expand>展开本篇解析</button>
      <button class="btn sm ghost" data-collapse>收起</button>
    </div>
    <div class="brief" id="brief-${year}-${t.no}">
      <div class="brief-head">文章速读 <span style="letter-spacing:.08em;color:var(--faint);font-weight:400">SPEED READ</span><span class="spacer"></span><span class="hint">Text ${t.no}</span></div>
      ${rows}
    </div>
    <div class="section-title" style="margin-top:30px">逐题解析 <span class="en">QUESTIONS</span>
      <span class="spacer"></span>
      <span class="qjump">${t.questions.map((q) => `<button data-jump="r-${year}-${q.no}">${q.no}</button>`).join("")}</span>
    </div>
    <div class="qlist">${qs}</div>
    <div class="notice" style="margin-top:24px">阅读部分为逐题解析，不含原卷全文；每题“定位”栏已标明段句并引原文，请配合真题卷使用。</div>
    <div class="footer"><span>阅读 Part A · ${year} 年 · Text ${t.no}</span><span><a href="#/reading/answers">答案速查</a> · <a href="#/reading/methods">方法索引</a></span></div>`;
  }

  /* ---------------- 小三门年页 ---------------- */
  function renderSmallYear(year, kind, query) {
    const y = smallYear(year);
    if (!y) return `<div class="empty">未找到 ${year} 年的小三门数据。</div>`;
    if (!KINDS.includes(kind)) kind = "完形";
    const part = y.parts[kind];
    const idx = S.years.indexOf(y);
    const prev = S.years[idx - 1];
    const next = S.years[idx + 1];

    const tabs = KINDS.map((k) => {
      const p = y.parts[k];
      const cnt = k === "完形" ? `${p.items.length} 空` : `${p.items.length} 题`;
      return `<a class="tab ${k === kind ? "active" : ""}" href="#/small/${year}/${k}">${labelOf(k)}<span class="cnt">${cnt}</span></a>`;
    }).join("");

    let extra = "";
    if (kind === "新题型" && part.options.length) {
      extra = `<div class="options-panel" style="margin-top:18px">${part.options
        .map(
          (o) =>
            `<div class="opt"><span class="olabel">${o.label}</span><span>${md(o.text)}</span></div>`
        )
        .join("")}</div>`;
    }
    if (kind === "翻译" && part.terms.length) {
      extra = `<div class="terms">${part.terms
        .map((t) => `<span class="term"><b>${esc(t.en)}</b><span>${esc(t.zh)}</span></span>`)
        .join("")}</div>`;
    }

    const answerStrip = (() => {
      if (kind === "翻译") {
        return `<div class="answer-strip"><span>翻译为参考译文，无唯一答案；逐句见下。</span></div>`;
      }
      if (kind === "新题型") {
        const letters = part.items.map((i) => i.answer).join(" ");
        return `<div class="answer-strip"><span>答案</span><code>${letters}</code><span class="hint">${part.answerString ? esc(part.answerString) : ""}</span></div>`;
      }
      return `<div class="answer-strip"><span>答案串</span><code>${part.items.map((i) => i.answer).join("")}</code><span class="hint">按 1—20 顺序</span></div>`;
    })();

    const coverCheck = part.checks && (part.checks.method_coverage || part.checks.methods_used);
    const qs = part.items
      .map((it) => {
        const key = `s:${year}:${kind}:${it.no}`;
        if (kind === "完形") {
          const opts = (it.opts || [])
            .map((text, i) => {
              const label = "ABCD"[i];
              const zh = it.optZh && it.optZh[i] ? it.optZh[i] : "";
              return `<div class="opt ${label === it.answer ? "correct" : ""}">
                <span class="olabel">${label}</span>
                <span class="opt-body"><span class="opt-en">${esc(text)}</span>${zh ? `<span class="opt-zh">${esc(zh)}</span>` : ""}</span>
              </div>`;
            })
            .join("");
          return `
          <article class="qcard" id="s-${year}-${kind}-${it.no}" data-key="${key}">
            <div class="qhead" role="button" tabindex="0" aria-expanded="false">
              <span class="qno">${it.no}</span>
              ${answerBadge(it.answer)}
              <span class="qtype"><span class="k">考点</span> · ${md(it.point)}</span>
              <span class="qmeta">完形</span>
              <span class="qacts">${starHTML(key)}</span>
              <span class="chev" aria-hidden="true">▼</span>
            </div>
            <div class="qbody">
              ${revealBar(key)}
              <div class="cloze-opts">${opts}</div>
              ${it.sentence ? `<div class="scene-box"><div class="scene-label">出题句 · 英/中</div><div class="scene-en">${sceneHTML(it.sentence, it.no)}</div>${it.sentenceZh ? `<div class="scene-zh">${sceneHTML(it.sentenceZh, it.no)}</div>` : ""}</div>` : ""}
              ${field("方法", `<div class="ftext">${md(it.method)}</div>`)}
              ${field("线索", `<div class="ftext">${md(it.clue)}</div>`)}
              ${field("解析", `<div class="ftext">${md(it.analysis)}</div>`)}
              ${field("排除", `<div class="ftext">${md(it.exclude)}</div>`)}
            </div>
          </article>`;
        }
        if (kind === "新题型") {
          return `
          <article class="qcard" id="s-${year}-${kind}-${it.no}" data-key="${key}">
            <div class="qhead" role="button" tabindex="0" aria-expanded="false">
              <span class="qno">${it.no}</span>
              ${answerBadge(it.answer)}
              <span class="qtype"><span class="k">${esc(part.subtype || "新题型")}</span> · 第 ${it.no} 题</span>
              <span class="qmeta">Part B</span>
              <span class="qacts">${starHTML(key)}</span>
              <span class="chev" aria-hidden="true">▼</span>
            </div>
            <div class="qbody">
              ${revealBar(key)}
              ${field("方法", `<div class="ftext">${md(it.method)}</div>`)}
              ${field("线索", `<div class="ftext">${md(it.clue)}</div>`)}
              ${field("解析", `<div class="ftext">${md(it.analysis)}</div>`)}
              ${field("排除", `<div class="ftext">${md(it.exclude)}</div>`)}
            </div>
          </article>`;
        }
        const chunks = (it.chunks || "")
          .split("||")
          .map((c) => c.trim())
          .filter(Boolean)
          .map((c) => {
            const p = c.split("→");
            const ce = (p[0] || "").trim();
            const ca = p.length > 1 ? p.slice(1).join("→").trim() : "";
            return `<div class="chunk"><span class="ce">${esc(ce)}</span><span class="arr">→</span><span class="ca">${esc(ca)}</span></div>`;
          })
          .join("");
        return `
        <article class="qcard" id="s-${year}-${kind}-${it.no}" data-key="${key}">
          <div class="qhead" role="button" tabindex="0" aria-expanded="false">
            <span class="qno">${it.no}</span>
            <span class="qanswer" style="background:var(--teal);font-size:12px">译</span>
            <span class="qtype"><span class="k">划线句</span> · ${esc(it.sentence.slice(0, 64))}${it.sentence.length > 64 ? "…" : ""}</span>
            <span class="qmeta">Part C</span>
            <span class="qacts">${starHTML(key)}</span>
            <span class="chev" aria-hidden="true">▼</span>
          </div>
          <div class="qbody">
            <div class="tr-sentence">${esc(it.sentence)}</div>
            ${field("意群切分", `<div class="chunks">${chunks}</div>`)}
            ${field("采分点", `<div class="keypoints">${md(it.keypoints)}</div>`)}
            <div class="translation"><span class="lbl">参考译文</span>${esc(it.translation)}</div>
            ${field("方法", `<div class="ftext">${md(it.method)}</div>`)}
            ${field("解析", `<div class="ftext">${md(it.analysis)}</div>`)}
          </div>
        </article>`;
      })
      .join("");

    return `
    <div class="page-head">
      <div class="eyebrow">${KIND_EN[kind]} · ${year}</div>
      <h1>${year} 年 小三门</h1>
      <div class="sub">完形填空 20 空、新题型 5 题、翻译 5 句。固定体例：<b>方法</b>（用哪条、带代号）→ <b>线索</b>（原文哪一句、哪个词）→ <b>解析</b>（为什么是它）→ <b>排除</b>（为什么不是其余选项）。</div>
      <div class="meta-row">
        <span class="pill accent">${part.subtype || labelOf(kind)}</span>
        <span class="pill">${kind === "完形" ? "20 空" : kind === "新题型" ? "5 题" : "5 句"}</span>
        <span class="pill">${year} 年</span>
        <span class="year-nav" style="margin-left:auto">
          ${prev ? `<a class="btn sm" href="#/small/${prev.year}/${kind}">← ${prev.year}</a>` : ""}
          ${next ? `<a class="btn sm" href="#/small/${next.year}/${kind}">${next.year} →</a>` : ""}
        </span>
      </div>
    </div>
    <div class="reader-bar">
      <div class="tabs">${tabs}</div>
      <span class="spacer"></span>
      <button class="btn sm" data-expand>展开全部</button>
      <button class="btn sm ghost" data-collapse>收起</button>
    </div>
    <div class="overview" id="overview-${year}-${kind}">
      <span class="lbl">篇章总览 · OVERVIEW</span>${md(part.overview)}
    </div>
    <div class="passage-wrap" id="passage-${year}-${kind}">
      <div class="passage-head">真题原文 <span style="letter-spacing:.08em;color:var(--faint);font-weight:400">PASSAGE</span><span class="spacer"></span>
        <button class="btn sm ghost" data-toggle-passage>收起原文</button>
      </div>
      <div class="passage-body">${part.passage.join("")}${extra}</div>
    </div>
    ${answerStrip}
    <div class="section-title" style="margin-top:30px">逐题解析 <span class="en">QUESTIONS</span>
      <span class="spacer"></span>
      <span class="qjump">${part.items.map((it) => `<button data-jump="s-${year}-${kind}-${it.no}">${it.no}</button>`).join("")}</span>
    </div>
    <div class="qlist">${qs}</div>
    ${coverCheck ? `<div class="notice" style="margin-top:24px"><b>方法覆盖校验</b><br>${md(coverCheck)}</div>` : ""}
    <div class="footer"><span>小三门 · ${year} 年 · ${labelOf(kind)}</span><span><a href="#/small/answers">答案速查</a> · <a href="#/small/methods">方法索引</a></span></div>`;
  }

  /* ---------------- 文档页 ---------------- */
  function docPage(html, options) {
    const opt = options || {};
    if (opt.hideH1) html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, "");
    return `
    <div class="page-head">
      <div class="eyebrow">${opt.eyebrow || "METHOD"}</div>
      <h1>${opt.title || ""}</h1>
      ${opt.sub ? `<div class="sub">${opt.sub}</div>` : ""}
    </div>
    <div class="doc-grid${opt.wide ? " wide" : ""}">
      <article class="doc">${html}</article>
      ${opt.wide ? "" : '<aside class="toc" id="toc"><div class="toc-title">本页目录</div><div id="tocBody"></div></aside>'}
    </div>
    <div class="footer"><span>${opt.footer || ""}</span><span>共 ${(html.match(/<h[23]/g) || []).length} 节</span></div>`;
  }

  function renderReadingPreface() {
    return docPage(R.preface, {
      hideH1: true,
      wide: true,
      eyebrow: "READING · PREFACE",
      title: "前言 · 怎么用这本书",
      sub: "这本书要解决的不是“读不懂”，而是“读懂了却选不对”。阅读部分按“精准定位—选项比错—主旨校验”组织，每道题都能回到一条可执行的动作。",
      footer: "阅读 Part A · 前言",
    });
  }

  function renderReadingQuick() {
    return docPage(
      `<div class="doc-body">${R.quick}${R.examples}</div>`,
      {
        eyebrow: "READING · QUICK REFERENCE",
        wide: true,
        title: "题型速查 · 讲义例题",
        sub: "考场上先判题型，再按表取动作。下表把七类题型的题干信号、定位对象、核心动作与高频陷阱放在一起；后面是讲义经典例题索引，可按方法回查。",
        footer: "阅读 Part A · 第二章 / 第三章",
      }
    );
  }
  function renderReadingGuide() {
    return docPage(R.guide, {
      hideH1: true,
      eyebrow: "READING · METHODOLOGY",
      title: "阅读方法论总纲",
      sub: "读懂题干问什么 → 找到能回答题干所问的句子 → 在四个选项中比出出错概率最小的一个。三大法宝：精准定位、选项比错、主旨校验。",
      footer: "阅读 Part A · 第一章",
    });
  }
  function renderSmallGuide() {
    return docPage(S.guide, {
      hideH1: true,
      eyebrow: "CLOZE · PART B · TRANSLATION",
      title: "小三门方法体系",
      sub: "把课堂笔记里分散的口诀、步骤、判断标准编号成册：X 信息填空、P 排序、H 小标题、L 匹配、C 完形、T 翻译。每道题后的方法代号都可回到这里查定义。",
      footer: "小三门 · 方法体系",
    });
  }

  function renderReadingMethods() {
    const max = Math.max(...R.stats.methods.map((m) => m.count));
    const tiles = R.stats.methods
      .map(
        (m) => `<a class="method-tile" href="#/reading/method/${encodeURIComponent(m.name)}">
          <span class="mt-name">${esc(m.name)}</span>
          <span class="mt-cnt">${m.count}</span><span class="mt-unit">题</span>
        </a>`
      )
      .join("");
    const bars = R.stats.methods
      .slice(0, 12)
      .map(
        (m) =>
          `<div class="bar-row"><span class="bl">${esc(m.name)}</span><span class="bar-track"><span class="bar-fill" style="width:${Math.round((m.count / max) * 100)}%"></span></span><span class="bv">${m.count}</span></div>`
      )
      .join("");
    const total = R.stats.total;
    return `
    <div class="page-head">
      <div class="eyebrow">READING · METHOD INDEX</div>
      <h1>方法统计与索引</h1>
      <div class="sub">按每道题“可用方法”字段统计，一题可计多种方法；共 ${total} 题。点击任一方法，可反查使用它的全部题目。</div>
      <div class="meta-row"><span class="pill accent">${R.stats.methods.length} 种方法</span><span class="pill">${total} 题</span><span class="pill">22 年</span></div>
    </div>
    <div class="section-title">高频方法 <span class="en">TOP 12</span></div>
    <div class="bar-list">${bars}</div>
    <div class="section-title">全部方法 <span class="en">ALL METHODS</span></div>
    <div class="method-grid">${tiles}</div>
    <div class="footer"><span>统计口径：每题“可用方法”字段的规范名；同题多方法分别计数。</span><span><a href="#/reading/answers">答案速查</a></span></div>`;
  }

  function renderReadingMethod(name) {
    const qs = [];
    R.years.forEach((y) => {
      y.texts.forEach((t) => {
        t.questions.forEach((q) => {
          if (q.methodNames.includes(name)) qs.push({ year: y.year, t: t.no, q });
        });
      });
    });
    const list = qs
      .map(
        (x) => `<a class="result" href="#/reading/${x.year}/${x.t}?focus=r-${x.year}-${x.q.no}">
          <div class="r-top"><span class="r-label">${x.year} · Text ${x.t} · Q${x.q.no}</span><span class="pill">${esc(x.q.type.split("（")[0])}</span></div>
          <div class="r-snippet">${md(x.q.locate)}</div>
        </a>`
      )
      .join("");
    return `
    <div class="page-head">
      <div class="eyebrow">READING · METHOD</div>
      <h1>${esc(name)}</h1>
      <div class="sub">共 ${qs.length} 道题使用该方法。点击任题回到对应年份与 Text，自动展开解析。</div>
      <div class="meta-row"><a class="pill" href="#/reading/methods">← 返回方法统计</a></div>
    </div>
    ${qs.length ? list : `<div class="empty">暂无使用该方法的题目。</div>`}
    <div class="footer"><span>阅读 Part A · ${esc(name)}</span><span>${qs.length} 题</span></div>`;
  }

  function renderSmallMethods() {
    const tiles = S.stats.codes
      .map(
        (c) => `<a class="method-tile" href="#/small/code/${c.code}">
          <span class="mt-name"><b style="font-family:var(--font-mono);color:var(--accent)">${c.code}</b> ${esc(c.name)}</span>
          <span class="mt-cnt">${c.count}</span><span class="mt-unit">题</span>
        </a>`
      )
      .join("");
    const byKind = S.stats.types;
    return `
    <div class="page-head">
      <div class="eyebrow">CLOZE · PART B · TRANSLATION</div>
      <h1>小三门方法索引</h1>
      <div class="sub">X 信息填空、P 排序、H 小标题、L 匹配、C 完形、T 翻译。点击代号可反查使用它的题目；题目里的方法栏即引用这些代号。</div>
      <div class="meta-row">
        <span class="pill accent">${S.stats.codes.length} 条方法</span>
        <span class="pill">完形 ${byKind.完形} 空</span>
        <span class="pill">新题型 ${byKind.新题型} 题</span>
        <span class="pill">翻译 ${byKind.翻译} 句</span>
      </div>
    </div>
    <div class="method-grid">${tiles}</div>
    <div class="footer"><span>按题目“方法”字段中的代号统计，一题可计多条。</span><span><a href="#/small/guide">方法体系</a></span></div>`;
  }

  function renderSmallCode(code) {
    const c = S.stats.codes.find((x) => x.code === code);
    if (!c) return `<div class="empty">未找到方法 ${esc(code)}。</div>`;
    const list = c.questions
      .map(
        (x) => `<a class="result" href="#/small/${x.year}/${x.kind}?focus=s-${x.year}-${x.kind}-${x.no}">
          <div class="r-top"><span class="r-label">${x.year} · ${labelOf(x.kind)} · 第 ${x.no} ${x.kind === "完形" ? "空" : "题"}</span></div>
          ${x.hint ? `<div class="r-snippet">${esc(x.hint)}</div>` : ""}
        </a>`
      )
      .join("");
    return `
    <div class="page-head">
      <div class="eyebrow">SMALL · METHOD ${esc(code)}</div>
      <h1><span style="font-family:var(--font-mono);color:var(--accent)">${esc(code)}</span> ${esc(c.name)}</h1>
      <div class="sub">共 ${c.questions.length} 处使用。点击题目回到对应年份与题型，自动展开解析。</div>
      <div class="meta-row"><a class="pill" href="#/small/methods">← 返回方法索引</a></div>
    </div>
    ${list || `<div class="empty">暂无题目。</div>`}
    <div class="footer"><span>小三门 · ${esc(code)}</span><span>${c.questions.length} 处</span></div>`;
  }

  function renderReadingAnswers() {
    const rows = R.answers
      .map(
        (r) => `<tr>
          <td class="yr"><a href="#/reading/${r.year}/1">${r.year}</a></td>
          ${[1, 2, 3, 4]
            .map((i) => `<td class="ans">${esc((r["t" + i] || "").split(" ").join(" "))}</td>`)
            .join("")}
        </tr>`
      )
      .join("");
    return `
    <div class="page-head">
      <div class="eyebrow">READING · ANSWER KEY</div>
      <h1>阅读答案速查</h1>
      <div class="sub">2005—2026 年英语（一）阅读 Part A，每年四篇、二十题。答案以官方答案为准；点击年份回到该年解析。</div>
    </div>
    <div class="tbl-wrap"><table class="answer-table">
      <thead><tr><th>年份</th><th>Text 1（21—25）</th><th>Text 2（26—30）</th><th>Text 3（31—35）</th><th>Text 4（36—40）</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="footer"><span>阅读 Part A · 2005—2026</span><span>${R.answers.length} 年 · ${R.stats.total} 题</span></div>`;
  }

  function renderSmallAnswers() {
    const rows = S.answers
      .map(
        (r) => `<tr>
          <td class="yr"><a href="#/small/${r.year}/完形">${r.year}</a></td>
          <td class="ans">${esc(r.cloze)}</td>
          <td>${esc(r.newtypeLabel)} <span class="ans">${esc(r.newtype)}</span></td>
          <td style="color:var(--muted)">参考译文见解析</td>
        </tr>`
      )
      .join("");
    return `
    <div class="page-head">
      <div class="eyebrow">SMALL · ANSWER KEY</div>
      <h1>小三门答案速查</h1>
      <div class="sub">2010—2026 年完形填空与新题型答案；翻译为参考译文，不设唯一答案，点击年份进入逐句解析。</div>
    </div>
    <div class="tbl-wrap"><table class="answer-table">
      <thead><tr><th>年份</th><th>完形 1—20</th><th>新题型 41—45</th><th>翻译</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="footer"><span>小三门 · 2010—2026</span><span>完形 ${S.stats.types.完形} 空 · 新题型 ${S.stats.types.新题型} 题 · 翻译 ${S.stats.types.翻译} 句</span></div>`;
  }

  /* ---------------- 搜索 ---------------- */
  function buildIndex() {
    if (state.index) return state.index;
    const idx = [];
    R.years.forEach((y) => {
      y.texts.forEach((t) => {
        idx.push({
          book: "阅读",
          kind: "阅读",
          year: y.year,
          label: `${y.year} · 阅读 Text ${t.no} · 文章速读`,
          type: "文章速读",
          route: `#/reading/${y.year}/${t.no}`,
          focus: `brief-${y.year}-${t.no}`,
          text: [t.speed.keyword, t.speed.structure, t.speed.gist, t.speed.attitude, t.speed.tips].join(" "),
        });
        t.questions.forEach((q) => {
          idx.push({
            book: "阅读",
            kind: "阅读",
            year: y.year,
            label: `${y.year} · 阅读 Text ${t.no} · Q${q.no}`,
            type: q.type,
            route: `#/reading/${y.year}/${t.no}`,
            focus: `r-${y.year}-${q.no}`,
            text: [
              q.stem, q.stemZh, q.type, q.locate, q.methodsRaw, q.analysis, q.ref, q.pitfall,
              ...(q.options || []).flatMap((o) => [o.text, o.zh]),
            ].join(" "),
          });
        });
      });
    });
    S.years.forEach((y) => {
      KINDS.forEach((k) => {
        const p = y.parts[k];
        idx.push({
          book: "小三门",
          kind: k,
          year: y.year,
          label: `${y.year} · ${labelOf(k)} · 篇章总览`,
          type: p.subtype || "",
          route: `#/small/${y.year}/${k}`,
          focus: `overview-${y.year}-${k}`,
          text: [p.subtype, p.overview].join(" "),
        });
        p.items.forEach((it) => {
          const text =
            k === "翻译"
              ? [it.sentence, it.chunks, it.method, it.keypoints, it.translation, it.analysis].join(" ")
              : [it.point || "", it.sentence || "", it.sentenceZh || "", it.method, it.clue, it.analysis, it.exclude, (it.optZh || []).join(" ")].join(" ");
          idx.push({
            book: "小三门",
            kind: k,
            year: y.year,
            label: `${y.year} · ${labelOf(k)} · 第 ${it.no} ${k === "完形" ? "空" : "题"}`,
            type: k === "完形" ? it.point : p.subtype || labelOf(k),
            route: `#/small/${y.year}/${k}`,
            focus: `s-${y.year}-${k}-${it.no}`,
            text,
          });
        });
      });
    });
    state.index = idx;
    return idx;
  }

  function searchTerms(q) {
    return q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
  }
  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  function highlight(s, terms) {
    let out = esc(s);
    terms.forEach((t) => {
      if (!t) return;
      out = out.replace(new RegExp("(" + escapeReg(esc(t)) + ")", "gi"), "<mark>$1</mark>");
    });
    return out;
  }
  function makeSnippet(rawText, terms) {
    const text = rawText.replace(/[`*]/g, "");
    const low = text.toLowerCase();
    let pos = -1;
    for (const t of terms) {
      const p = low.indexOf(t);
      if (p >= 0 && (pos < 0 || p < pos)) pos = p;
    }
    if (pos < 0) pos = 0;
    const start = Math.max(0, pos - 46);
    const end = Math.min(text.length, start + 118);
    return (start > 0 ? "…" : "") + highlight(text.slice(start, end), terms) + (end < text.length ? "…" : "");
  }
  function runSearch(q, filter) {
    const items = buildIndex();
    const terms = searchTerms(q);
    if (!terms.length) return [];
    const res = [];
    for (const it of items) {
      if (filter !== "all" && it.kind !== filter) continue;
      const low = it.text.toLowerCase();
      let score = 0;
      let ok = true;
      for (const t of terms) {
        const c = low.split(t).length - 1;
        if (!c) {
          ok = false;
          break;
        }
        score += c;
      }
      if (ok) res.push({ it, score });
    }
    res.sort((a, b) => b.score - a.score || b.it.year - a.it.year);
    return res.slice(0, 100).map((x) => x.it);
  }

  function renderSearch(query) {
    const q = query.get("q") || "";
    const f = query.get("f") || state.searchFilter;
    state.searchFilter = f;
    return `
    <div class="search-hero">
      <div class="eyebrow">SEARCH · 950 QUESTIONS</div>
      <h1 style="font-family:var(--font-serif);font-size:clamp(30px,4vw,44px);margin:8px 0 6px">全文搜索</h1>
      <div class="sub" style="color:var(--ink-2)">输入中文概念、英文原词、方法名或题号，例如“精准定位”“However”“2020”“paralysis by analysis”。多个关键词用空格分隔。</div>
      <div class="search-big">
        <span class="si">⌕</span>
        <input id="searchInput" type="search" placeholder="搜索解析、方法、原文引句、考点……" value="${esc(q)}" autocomplete="off">
      </div>
      <div class="filters" id="filters">
        ${FILTERS.map(
          ([v, label]) =>
            `<button class="chip ${f === v ? "active" : ""}" data-filter="${v}">${label}</button>`
        ).join("")}
      </div>
    </div>
    <div id="results"></div>
    <div class="footer"><span>搜索范围：阅读 440 题 + 小三门 510 题 + 篇目总览</span><span><span class="kbd">/</span> 聚焦搜索框</span></div>`;
  }

  function updateResults() {
    const input = document.getElementById("searchInput");
    const box = document.getElementById("results");
    if (!input || !box) return;
    const q = input.value;
    if (!q.trim()) {
      box.innerHTML = `<div class="empty">输入关键词开始检索。<br>也可从侧栏按年份进入。</div>`;
      return;
    }
    const items = runSearch(q, state.searchFilter);
    const terms = searchTerms(q);
    if (!items.length) {
      box.innerHTML = `<div class="empty">没有找到与“${esc(q)}”相关的内容。<br>试试更短的关键词，或切换筛选。</div>`;
      return;
    }
    box.innerHTML =
      `<div class="hint" style="margin:4px 0 6px">找到 ${items.length}${items.length >= 100 ? "+" : ""} 条结果</div>` +
      items
        .map(
          (it) => `<a class="result" href="${it.route}?focus=${encodeURIComponent(it.focus)}">
            <div class="r-top"><span class="r-label">${esc(it.label)}</span>
              <span class="pill">${esc(it.kind)}</span>
              ${it.type ? `<span class="pill" style="color:var(--muted)">${esc(String(it.type).split("（")[0].slice(0, 18))}</span>` : ""}
            </div>
            <div class="r-snippet">${makeSnippet(it.text, terms)}</div>
          </a>`
        )
        .join("");
  }

  /* ---------------- TOC ---------------- */
  function mountTOC() {
    const doc = document.querySelector(".doc");
    const body = document.getElementById("tocBody");
    if (!doc || !body) return;
    const hs = [...doc.querySelectorAll("h2, h3")];
    if (!hs.length) {
      document.getElementById("toc").style.display = "none";
      return;
    }
    body.innerHTML = hs
      .map(
        (h, i) =>
          `<a href="#" class="${h.tagName === "H3" ? "lv3" : ""}" data-toc="${h.id || "h" + i}">${esc(h.textContent)}</a>`
      )
      .join("");
    body.querySelectorAll("[data-toc]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const el = doc.querySelector(`[id="${a.dataset.toc}"]`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  /* ---------------- 空位点击 / 渲染后处理 ---------------- */
  let currentPart = null;
  function hydrateBlanks() {
    if (!currentPart) return;
    const part = currentPart;
    view.querySelectorAll(".blank[data-no]").forEach((b) => {
      const no = Number(b.dataset.no);
      const it = part.items.find((x) => x.no === no);
      if (!it) return;
      b.dataset.ans = it.answer;
      b.title = `第 ${no} 题：点击查看 / 收起答案`;
      if (b.dataset.bound) return;
      b.dataset.bound = "1";
      const toggle = (e) => {
        e.stopPropagation();
        if (b.classList.contains("revealed")) {
          b.classList.remove("revealed");
          b.textContent = String(no);
        } else {
          b.classList.add("revealed");
          b.textContent = it.answer;
        }
      };
      b.addEventListener("click", toggle);
      b.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle(e);
        }
      });
    });
  }

  function afterRender(r) {
    mountTOC();
    hydrateBlanks();
    const focus = r.q.get("focus");
    if (focus) {
      const el = document.getElementById(focus);
      if (el) {
        const card = el.closest(".qcard");
        if (card) {
          card.classList.add("open");
          const head = card.querySelector(".qhead");
          if (head) head.setAttribute("aria-expanded", "true");
        }
        setTimeout(() => {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          if (card) {
            card.classList.add("flash");
            setTimeout(() => card.classList.remove("flash"), 1800);
          }
        }, 60);
      }
    } else {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
    if (r.seg[0] === "search") {
      const inp = document.getElementById("searchInput");
      if (inp && !inp.value && r.q.get("q")) inp.value = r.q.get("q");
      updateResults();
    }
  }

  /* ---------------- 路由 ---------------- */
  function route() {
    const r = parseHash();
    const seg = r.seg;
    let html = "";
    document.title = "考研英语一 · 真题解析库";
    currentPart = null;

    if (!seg.length) {
      html = renderHome();
      setCrumb(["总览"]);
    } else if (seg[0] === "reading") {
      const sub = seg[1] || "";
      if (sub === "preface") {
        html = renderReadingPreface();
        setCrumb([{ text: "总览", href: "#/" }, { text: "阅读", href: "#/reading/guide" }, "前言"]);
        document.title = "前言 · 真题解析库";
      } else if (sub === "guide") {
        html = renderReadingGuide();
        setCrumb([{ text: "总览", href: "#/" }, "阅读", "方法论总纲"]);
        document.title = "阅读方法论总纲 · 真题解析库";
      } else if (sub === "quick") {
        html = renderReadingQuick();
        setCrumb([{ text: "总览", href: "#/" }, "阅读", "题型速查"]);
        document.title = "题型速查 · 真题解析库";
      } else if (sub === "methods") {
        html = renderReadingMethods();
        setCrumb([{ text: "总览", href: "#/" }, "阅读", "方法统计"]);
        document.title = "方法统计与索引 · 真题解析库";
      } else if (sub === "answers") {
        html = renderReadingAnswers();
        setCrumb([{ text: "总览", href: "#/" }, "阅读", "答案速查"]);
        document.title = "阅读答案速查 · 真题解析库";
      } else if (sub === "method") {
        html = renderReadingMethod(seg[2] || "");
        setCrumb([{ text: "总览", href: "#/" }, { text: "阅读", href: "#/reading/methods" }, seg[2] || ""]);
        document.title = (seg[2] || "") + " · 方法索引";
      } else if (/^\d{4}$/.test(sub)) {
        const tno = Number(seg[2] || 1);
        html = renderReadingYear(Number(sub), tno, r.q);
        setCrumb([{ text: "总览", href: "#/" }, { text: "阅读 Part A", href: "#/reading/" + sub }, sub + " 年"]);
        document.title = sub + " 年阅读解析 · 真题解析库";
      } else {
        html = `<div class="empty">页面不存在。<a href="#/">回到总览</a></div>`;
      }
    } else if (seg[0] === "small") {
      const sub = seg[1] || "";
      if (sub === "guide") {
        html = renderSmallGuide();
        setCrumb([{ text: "总览", href: "#/" }, "小三门", "方法体系"]);
        document.title = "小三门方法体系 · 真题解析库";
      } else if (sub === "methods") {
        html = renderSmallMethods();
        setCrumb([{ text: "总览", href: "#/" }, "小三门", "方法索引"]);
        document.title = "小三门方法索引 · 真题解析库";
      } else if (sub === "answers") {
        html = renderSmallAnswers();
        setCrumb([{ text: "总览", href: "#/" }, "小三门", "答案速查"]);
        document.title = "小三门答案速查 · 真题解析库";
      } else if (sub === "code") {
        html = renderSmallCode(seg[2] || "");
        setCrumb([{ text: "总览", href: "#/" }, { text: "小三门", href: "#/small/methods" }, seg[2] || ""]);
        document.title = (seg[2] || "") + " · 小三门方法";
      } else if (/^\d{4}$/.test(sub)) {
        const kind = KINDS.includes(seg[2]) ? seg[2] : "完形";
        html = renderSmallYear(Number(sub), kind, r.q);
        currentPart = smallYear(Number(sub)).parts[kind];
        setCrumb([{ text: "总览", href: "#/" }, { text: "小三门", href: "#/small/" + sub }, sub + " 年 · " + labelOf(kind)]);
        document.title = sub + " 年 " + labelOf(kind) + " · 真题解析库";
      } else {
        html = `<div class="empty">页面不存在。<a href="#/">回到总览</a></div>`;
      }
    } else if (seg[0] === "search") {
      html = renderSearch(r.q);
      setCrumb([{ text: "总览", href: "#/" }, "全文搜索"]);
      document.title = "全文搜索 · 真题解析库";
    } else {
      html = `<div class="empty">页面不存在。<a href="#/">回到总览</a></div>`;
    }

    view.className = "view " + practiceClass();
    view.innerHTML = html;
    const topInput = document.querySelector("#topSearch input");
    if (topInput) topInput.value = r.seg[0] === "search" ? r.q.get("q") || "" : "";
    setActiveNav(r);
    afterRender(r);
  }

  /* ---------------- 交互 ---------------- */
  function togglePractice() {
    state.practice = !state.practice;
    store.set("ky.practice", state.practice);
    document.body.classList.toggle("practice", state.practice);
    const btn = document.getElementById("practiceBtn");
    if (btn) {
      btn.classList.toggle("active", state.practice);
      btn.querySelector(".label").textContent = state.practice ? "练习模式 · 开" : "练习模式";
    }
    route();
  }
  function toggleTheme() {
    state.theme = state.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = state.theme;
    store.set("ky.theme", state.theme);
    const btn = document.getElementById("themeBtn");
    if (btn) btn.textContent = state.theme === "dark" ? "☀" : "◐";
  }
  function toggleStar(key, btn) {
    if (state.stars.has(key)) state.stars.delete(key);
    else state.stars.add(key);
    store.set("ky.stars", [...state.stars]);
    if (btn) {
      const on = state.stars.has(key);
      btn.classList.toggle("on", on);
      btn.textContent = on ? "★" : "☆";
    }
    updateStarCount();
  }
  function openCard(card, open) {
    if (!card) return;
    card.classList.toggle("open", open);
    const head = card.querySelector(".qhead");
    if (head) head.setAttribute("aria-expanded", open ? "true" : "false");
  }

  view.addEventListener("click", (e) => {
    const star = e.target.closest("[data-star]");
    if (star) {
      e.stopPropagation();
      toggleStar(star.dataset.star, star);
      return;
    }
    const ansBadge = e.target.closest(".qanswer");
    if (ansBadge && state.practice) {
      e.stopPropagation();
      const card = ansBadge.closest(".qcard");
      if (card) card.classList.add("revealed");
      return;
    }
    const reveal = e.target.closest("[data-reveal]");
    if (reveal) {
      e.stopPropagation();
      const card = reveal.closest(".qcard");
      if (card) card.classList.add("revealed");
      return;
    }
    const expand = e.target.closest("[data-expand]");
    if (expand) {
      view.querySelectorAll(".qcard").forEach((c) => openCard(c, true));
      toast("已展开全部解析");
      return;
    }
    const collapse = e.target.closest("[data-collapse]");
    if (collapse) {
      view.querySelectorAll(".qcard").forEach((c) => openCard(c, false));
      return;
    }
    const tp = e.target.closest("[data-toggle-passage]");
    if (tp) {
      const wrap = tp.closest(".passage-wrap");
      if (wrap) {
        const col = wrap.classList.toggle("collapsed");
        tp.textContent = col ? "展开原文" : "收起原文";
      }
      return;
    }
    const jump = e.target.closest("[data-jump]");
    if (jump) {
      e.preventDefault();
      const el = document.getElementById(jump.dataset.jump);
      if (el) {
        const card = el.closest(".qcard");
        if (card) openCard(card, true);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    const head = e.target.closest(".qhead");
    if (head) {
      const card = head.closest(".qcard");
      openCard(card, !card.classList.contains("open"));
      return;
    }
    const chip = e.target.closest("[data-filter]");
    if (chip) {
      state.searchFilter = chip.dataset.filter;
      document.querySelectorAll("#filters .chip").forEach((c) => c.classList.toggle("active", c === chip));
      updateResults();
      return;
    }
  });

  view.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      const head = e.target.closest(".qhead");
      if (head && e.target === head) {
        e.preventDefault();
        const card = head.closest(".qcard");
        openCard(card, !card.classList.contains("open"));
      }
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target && e.target.id === "searchInput") {
      updateResults();
      const r = parseHash();
      const value = e.target.value.trim();
      try {
        history.replaceState(
          null,
          "",
          "#/search?q=" + encodeURIComponent(value) + (state.searchFilter !== "all" ? "&f=" + state.searchFilter : "")
        );
      } catch (err) {}
    }
  });

  document.addEventListener("submit", (e) => {
    if (e.target && e.target.id === "topSearch") {
      e.preventDefault();
      const input = e.target.querySelector("input");
      const v = (input.value || "").trim();
      location.hash = "#/search" + (v ? "?q=" + encodeURIComponent(v) : "");
    }
  });

  document.getElementById("menuBtn").addEventListener("click", () => {
    document.body.classList.toggle("nav-open");
  });
  document.getElementById("backdrop").addEventListener("click", () => {
    document.body.classList.remove("nav-open");
  });
  document.getElementById("practiceBtn").addEventListener("click", togglePractice);
  document.getElementById("themeBtn").addEventListener("click", toggleTheme);

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (e.key === "/" && tag !== "input" && tag !== "textarea") {
      e.preventDefault();
      const inp = document.getElementById("searchInput") || document.querySelector(".topsearch input");
      if (inp) inp.focus();
    }
    if (e.key === "Escape") {
      document.body.classList.remove("nav-open");
      if (tag === "input") e.target.blur();
    }
  });

  window.addEventListener("hashchange", route);

  /* ---------------- 启动 ---------------- */
  function init() {
    document.body.classList.toggle("practice", state.practice);
    const pb = document.getElementById("practiceBtn");
    if (pb) {
      pb.classList.toggle("active", state.practice);
      pb.querySelector(".label").textContent = state.practice ? "练习模式 · 开" : "练习模式";
    }
    const tb = document.getElementById("themeBtn");
    if (tb) tb.textContent = state.theme === "dark" ? "☀" : "◐";
    renderSidebar();
    if (!location.hash) {
      history.replaceState(null, "", "#/");
    }
    route();
  }
  init();
})();
