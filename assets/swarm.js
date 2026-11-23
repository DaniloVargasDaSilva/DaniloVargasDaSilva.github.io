/* Enxame de agentes que constrói a página ao vivo, em toda visita.
   Topo: planejadores desenham o wireframe, escritores digitam, testadores carimbam os números e a estilista escolhe a cor.
   Seções: quando cada uma entra na tela, uma equipe pequena desenha os blocos e os revela um a um.
   Os traços passam por fora dos blocos, nunca sobre o texto. Esc ou "Skip" encerram; "reduzir movimento" desliga tudo. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rebuildBtn = document.getElementById("rebuild");
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var css = function (n) { return getComputedStyle(root).getPropertyValue(n).trim(); };
  var isPT = function () { return root.lang === "pt-BR"; };
  var T = {
    en: { planner: "planner", writer: "writer", tester: "tester", stylist: "stylist", skip: "Skip", watch: "Watch the agents build this page", built: function (n, s) { return "Built live by " + n + " agents in " + s + " s · watch again"; } },
    pt: { planner: "planejador", writer: "escritor", tester: "testador", stylist: "estilista", skip: "Pular", watch: "Ver os agentes construírem esta página", built: function (n, s) { return "Construída ao vivo por " + n + " agentes em " + s + " s · ver de novo"; } }
  };
  var tx = function () { return T[isPT() ? "pt" : "en"]; };
  var enabled = (function () { try { return localStorage.getItem("agents") !== "off"; } catch (e) { return true; } })();

  if (reduce) {
    root.classList.remove("sw-pre", "sw-mono", "sw-on");
    if (rebuildBtn) rebuildBtn.hidden = true;
    window.SWARM = { finishAll: function () {}, setEnabled: function () {} };
    return;
  }

  /* ---------- utilidades ---------- */
  var PAD = 7;
  function ease(x) { return x <= 0 ? 0 : x >= 1 ? 1 : x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function rectOf(els, pad) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    els.forEach(function (el) { var r = el.getBoundingClientRect(); if (!r.width && !r.height) return; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); });
    if (x0 > x1) return { x: 0, y: 0, w: 0, h: 0 };
    pad = pad == null ? PAD : pad;
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }
  function perim(r, p) {
    var L = 2 * (r.w + r.h), d = clamp(p) * L;
    if (d < r.w) return [r.x + d, r.y];
    d -= r.w; if (d < r.h) return [r.x + r.w, r.y + d];
    d -= r.h; if (d < r.w) return [r.x + r.w - d, r.y + r.h];
    d -= r.w; return [r.x, r.y + r.h - d];
  }
  function endOf(el) {
    var range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
    var rs = range.getClientRects(), b = el.getBoundingClientRect();
    if (!rs.length) return [b.left + 2, b.top + b.height * 0.25];
    var r = rs[rs.length - 1]; return [r.right + 3, r.top + r.height * 0.2];
  }
  function show(el, ms) { if (!el) return; el.style.transition = "opacity " + (ms || 320) + "ms ease"; el.style.opacity = "1"; }

  /* ---------- tela de desenho compartilhada ---------- */
  var canvas = null, ctx, W, H, raf = 0, jobs = [], C = {}, FONT = "";
  function colors() { C = { ink: css("--ink"), muted: css("--muted"), blue: css("--blue") || "#1F3FBF", sheet: css("--sheet"), line: css("--line") }; FONT = css("--display") || "sans-serif"; }
  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas"); canvas.className = "swarm-canvas"; canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas); ctx = canvas.getContext("2d"); resize();
  }
  function resize() {
    if (!canvas) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("themechange", colors);
  function addJob(j) {
    ensureCanvas(); colors(); j.t0 = performance.now(); jobs.push(j);
    if (!raf) raf = requestAnimationFrame(loop);
  }
  function loop(now) {
    raf = 0;
    if (!canvas) return;
    ctx.clearRect(0, 0, W, H);
    jobs = jobs.filter(function (j) { if (j.ended) return false; var alive = !j.dead && j.draw((now - j.t0) / 1000); if (!alive) { j.ended = true; j.end(); } return alive; });
    if (jobs.length) raf = requestAnimationFrame(loop);
    else { canvas.remove(); canvas = null; }
  }

  /* ---------- desenho ---------- */
  function cursor(x, y, s, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.lineTo(4, 11.5); ctx.lineTo(7, 18); ctx.lineTo(9.5, 17); ctx.lineTo(6.5, 10.5); ctx.lineTo(11.5, 10.5); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = C.sheet; ctx.stroke(); ctx.restore();
  }
  function tag(x, y, text) {
    ctx.save(); ctx.font = "600 11px " + FONT;
    var w = ctx.measureText(text).width + 10;
    ctx.fillStyle = C.ink; ctx.fillRect(x + 4, y - 22, w, 17);
    ctx.fillStyle = C.sheet; ctx.textBaseline = "middle"; ctx.fillText(text, x + 9, y - 13.5); ctx.restore();
  }
  function wire(r, p, alpha, label) {
    if (alpha <= 0 || p <= 0) return;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = C.muted; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.beginPath(); var n = 48;
    for (var i = 0; i <= n; i++) { var q = perim(r, p * i / n); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.setLineDash([]);
    if (label && p >= 1) { ctx.font = "500 10px " + FONT; ctx.fillStyle = C.muted; ctx.textBaseline = "bottom"; ctx.fillText(label, r.x, r.y - 3); }
    ctx.restore();
  }

  /* ---------- topo ---------- */
  var heroJob = null;
  function heroBuild() {
    if (heroJob) return;
    var hero = $(".hero"); if (!hero) return;
    root.classList.add("sw-pre", "sw-mono");
    var h1 = $(".intro-text h1"), sub = $(".intro .sub"), crane = $(".crane"), dim = $(".dim");
    var h1html = h1 ? h1.innerHTML : "";
    if (h1) { h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim()); h1.innerHTML = "&#8203;"; show(h1, 1); }
    hero.setAttribute("aria-busy", "true");
    var parts = [["nav", $(".topbar nav")], ["ctl", $(".topbar .controls")], ["h1", h1], ["sub", sub], ["stats", $(".stats")], ["crane", crane], ["dim", dim]];
    var plans = [];
    parts.forEach(function (p, i) {
      if (!p[1]) return;
      plans.push({ key: p[0], el: p[1], t0: 0.3 + i * 0.15, t1: 0.3 + i * 0.15 + 0.9, side: i % 2 ? 1 : -1, label: p[0] === "crane" });
    });
    var stats = Array.prototype.slice.call(document.querySelectorAll(".stats > div"));
    var skip = document.createElement("button");
    skip.type = "button"; skip.className = "swarm-skip"; skip.textContent = tx().skip;
    document.body.appendChild(skip);
    var job = { kind: "hero" };
    skip.addEventListener("click", function () { if (!job.ended) { job.ended = true; job.end(); } });
    var END = 5.3, start = performance.now();
    job.draw = function (t) {
      var wFade = 1 - clamp((t - 4.0) / 0.6);
      // 1. planejar
      plans.forEach(function (a) {
        var r = rectOf([a.el]); if (a.key === "h1" && h1) { var fs = parseFloat(getComputedStyle(h1).fontSize); r.h = Math.max(r.h, fs * 2.05 + 2 * PAD); }
        var p = clamp((t - a.t0) / (a.t1 - a.t0)), x, y, s0 = perim(r, 0), ex = a.side < 0 ? -30 : W + 30;
        wire(r, ease(p), wFade, a.label ? Math.round(r.w - 2 * PAD) + " × " + Math.round(r.h - 2 * PAD) : null);
        if (t < a.t0) { var k = ease(clamp(t / a.t0)); x = lerp(ex, s0[0], k); y = lerp(s0[1] + 40, s0[1], k); }
        else if (p < 1) { var q = perim(r, ease(p)); x = q[0]; y = q[1]; }
        else {
          if (a.key === "nav" || a.key === "ctl" || a.key === "crane") show(a.el, 380);
          var k2 = ease(clamp((t - a.t1) / 0.7)); if (k2 >= 1) return;
          x = lerp(s0[0], ex, k2); y = lerp(s0[1], s0[1] - 60, k2);
        }
        cursor(x, y, 1, C.ink);
        if (plans.indexOf(a) < 3 && t > a.t0 && p < 1 && y <= r.y + 1 && r.y > 26) tag(x, y, tx().planner);
      });
      // 2. escrever o nome
      if (h1) {
        var full = h1html.replace(/<br\s*\/?>/gi, "\n"), A = 1.4, B = 2.7, n = Math.round(full.length * clamp((t - A) / (B - A)));
        if (t >= A) h1.innerHTML = full.slice(0, n).replace(/\n/g, "<br>") || "&#8203;";
        var pos = endOf(h1), wx, wy;
        if (t < A) { var kk = ease(clamp((t - 0.8) / 0.6)); wx = lerp(-30, pos[0], kk); wy = lerp(pos[1] - 80, pos[1], kk); }
        else if (t < B + 0.25) { wx = pos[0]; wy = pos[1]; }
        else { var ko = ease(clamp((t - B - 0.25) / 0.6)); wx = lerp(pos[0], -30, ko); wy = lerp(pos[1], pos[1] - 100, ko); }
        if (t > 0.8 && t < B + 0.9) cursor(wx, wy, 1, C.ink);
      }
      // a frase de baixo aparece atrás de um segundo escritor, que anda pela linha de baixo dela
      if (sub) {
        var S0 = 2.1, S1 = 3.0, pp = ease(clamp((t - S0) / (S1 - S0))), sr = sub.getBoundingClientRect();
        if (t >= S0) { sub.style.opacity = "1"; sub.style.clipPath = "inset(-4px " + (100 - pp * 100) + "% -4px -4px)"; }
        var rx = sr.left + sr.width * pp, ry = sr.bottom + 4;
        if (t < S0) { var kw = ease(clamp((t - 1.6) / 0.5)); rx = lerp(-30, sr.left, kw); ry = lerp(sr.bottom + 80, ry, kw); }
        if (t > 1.6 && t < S1 + 0.15) cursor(rx, ry, 1, C.ink);
      }
      // 3. testadores carimbam os números
      stats.forEach(function (el, i) {
        var a = 2.9 + i * 0.17, k = ease(clamp((t - a) / 0.5)), r = el.getBoundingClientRect();
        var cx = r.left - 4, cy = r.top + 4, sx = cx + (i % 2 ? 90 : -90), sy = H + 30, x = lerp(sx, cx, k), y = lerp(sy, cy, k);
        if (k >= 1) { show(el, 260); var ko = ease(clamp((t - a - 0.6) / 0.5)); if (ko >= 1) return; x = lerp(cx, sx, ko); y = lerp(cy, sy, ko); }
        if (k > 0) cursor(x, y, 1, C.ink);
      });
      // 4. a estilista testa as cores dentro da ilustração da ponte rolante, sem cobrir texto
      if (crane) {
        var cr = crane.getBoundingClientRect(), P0 = 3.4, sw = [C.muted, "#C0561B", "#00806F", "#6E3DB0", C.blue];
        var bx = cr.left + 14, by = cr.top + 22;
        if (t > P0 - 0.5 && t < 5.0) {
          var al = clamp((t - (P0 - 0.5)) / 0.3) * (1 - clamp((t - 4.6) / 0.35));
          ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = C.sheet; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
          ctx.fillRect(bx - 8, by - 8, sw.length * 30 + 10, 40); ctx.strokeRect(bx - 8, by - 8, sw.length * 30 + 10, 40);
          sw.forEach(function (c, i) { ctx.fillStyle = c; ctx.fillRect(bx + i * 30, by, 22, 22); });
          ctx.restore();
          var idx = Math.min(sw.length - 1, Math.floor(clamp((t - P0) / 1.0) * sw.length)), sx2 = bx + idx * 30 + 11, sy2 = by + 14;
          var k3 = ease(clamp((t - (P0 - 0.5)) / 0.5)), px = t < P0 ? lerp(W + 30, bx + 11, k3) : sx2, py = t < P0 ? lerp(by - 40, sy2, k3) : sy2;
          if (t > 4.4) { var kz = ease(clamp((t - 4.45) / 0.55)); px = lerp(sx2, W + 30, kz); py = lerp(sy2, sy2 - 50, kz); }
          if (t > 4.4 && t < 4.75) { ctx.save(); ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.globalAlpha = 1 - (t - 4.4) / 0.35; ctx.beginPath(); ctx.arc(sx2, sy2, 6 + (t - 4.4) * 60, 0, 7); ctx.stroke(); ctx.restore(); }
          cursor(px, py, 1, C.ink); if (t < 4.4 && t > P0 - 0.2) tag(bx - 8 + 0 * px, by - 8, tx().stylist);
        }
        if (t > 4.4 && root.classList.contains("sw-mono")) { root.classList.remove("sw-mono"); colors(); }
      } else if (t > 4.4) root.classList.remove("sw-mono");
      if (t > 4.2) show(dim, 400);
      return t < END;
    };
    job.end = function () {
      if (h1) { h1.innerHTML = h1html; h1.removeAttribute("aria-label"); }
      root.classList.remove("sw-pre", "sw-mono");
      [h1, sub, crane, dim, $(".topbar nav"), $(".topbar .controls")].concat(stats).forEach(function (el) { if (el) { el.style.opacity = ""; el.style.clipPath = ""; el.style.transition = ""; } });
      hero.removeAttribute("aria-busy"); skip.remove(); heroJob = null; colors();
      var secs = ((performance.now() - start) / 1000).toFixed(1);
      if (rebuildBtn) { rebuildBtn.hidden = false; rebuildBtn.textContent = tx().built(14, secs); }
    };
    heroJob = job; addJob(job);
  }
  function ensureLoop() { if (!raf && jobs.length) raf = requestAnimationFrame(loop); }

  /* ---------- seções ---------- */
  var sections = Array.prototype.slice.call(document.querySelectorAll("main > section, .body > .side"));
  var running = new Set();
  function groupsOf(sec) {
    var h2 = $(":scope > h2", sec), kids = Array.prototype.slice.call(sec.children).filter(function (c) { return c !== h2 && c.offsetParent !== null; });
    var G = [], max = 6;
    if (kids.length <= max) kids.forEach(function (k) { G.push([k]); });
    else { var per = Math.ceil(kids.length / max); for (var i = 0; i < kids.length; i += per) G.push(kids.slice(i, i + per)); }
    return { h2: h2, groups: G, kids: kids };
  }
  function sectionBuild(sec) {
    if (running.has(sec) || sec.classList.contains("sw-done")) return;
    running.add(sec);
    var g = groupsOf(sec), h2 = g.h2, h2html = h2 ? h2.innerHTML : "", nP = Math.min(3, g.groups.length);
    var OUT = 0.55, GAP = 0.1;
    g.groups.forEach(function (gr, i) { gr.s = 0.3 + Math.floor(i / nP) * (OUT + GAP) + (i % nP) * 0.12; gr.e = gr.s + OUT; gr.planner = i % nP; });
    var last = g.groups.reduce(function (m, gr) { return Math.max(m, gr.e); }, 0.8), END = last + 0.75;
    if (h2) { h2.innerHTML = "&#8203;"; show(h2, 1); }
    var job = { kind: "section" };
    job.draw = function (t) {
      var sr = sec.getBoundingClientRect();
      if (sr.bottom < -40 || sr.top > H + 40) return false; // saiu da tela: termina e mostra tudo
      // escritor digita o título
      if (h2) {
        var txt = h2html.replace(/<[^>]+>/g, ""), A = 0.1, B = 0.1 + Math.min(0.7, txt.length * 0.06), n = Math.round(txt.length * clamp((t - A) / (B - A)));
        if (n > 0) h2.textContent = txt.slice(0, n);
        var p = endOf(h2), x = p[0], y = p[1];
        if (t > B + 0.2) { var ko = ease(clamp((t - B - 0.2) / 0.5)); x = lerp(p[0], -30, ko); y = lerp(p[1], p[1] - 60, ko); }
        if (t < B + 0.7) cursor(x, y, 1, C.ink);
      }
      // planejadores contornam e revelam os blocos
      for (var pi = 0; pi < nP; pi++) {
        var mine = g.groups.filter(function (gr) { return gr.planner === pi; }), side = pi % 2 ? W + 30 : -30, px = null, py = null;
        for (var k = 0; k < mine.length; k++) {
          var gr = mine[k], r = rectOf(gr), prev = k ? perim(rectOf(mine[k - 1]), 1) : [side, r.y + 30], s0 = perim(r, 0);
          var prevEnd = k ? mine[k - 1].e : 0;
          wire(r, ease(clamp((t - gr.s) / OUT)), 1 - clamp((t - gr.e - 0.15) / 0.4), null);
          if (t >= gr.e) gr.forEach(function (el) { show(el, 320); });
          if (px !== null) continue;
          if (t < gr.s) { var kk = ease(clamp((t - prevEnd) / Math.max(0.12, gr.s - prevEnd))); px = lerp(prev[0], s0[0], kk); py = lerp(prev[1], s0[1], kk); }
          else if (t < gr.e) { var q = perim(r, ease((t - gr.s) / OUT)); px = q[0]; py = q[1]; }
        }
        if (px === null && mine.length) {
          var lr = perim(rectOf(mine[mine.length - 1]), 1), kx = ease(clamp((t - mine[mine.length - 1].e) / 0.6));
          if (kx < 1) { px = lerp(lr[0], side, kx); py = lerp(lr[1], lr[1] - 40, kx); }
        }
        if (px !== null) cursor(px, py, 1, C.ink);
      }
      return t < END;
    };
    job.end = function () {
      if (h2) h2.innerHTML = h2html;
      g.kids.concat(h2 ? [h2] : []).forEach(function (el) { el.style.opacity = ""; el.style.transition = ""; });
      sec.classList.add("sw-done"); running.delete(sec);
    };
    addJob(job);
  }

  var io = null;
  function watchSections() {
    if (!("IntersectionObserver" in window)) { sections.forEach(function (s) { s.classList.add("sw-done"); }); return; }
    if (io) io.disconnect();
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting && enabled) sectionBuild(e.target); });
    }, { threshold: 0, rootMargin: "0px 0px -18% 0px" });
    sections.forEach(function (s) { io.observe(s); });
  }
  function markSeen() {
    // o que já está acima da tela (link com âncora, recarregar no meio) aparece pronto
    sections.forEach(function (s) { if (s.getBoundingClientRect().bottom < window.innerHeight * 0.2) s.classList.add("sw-done"); });
  }

  /* ---------- controle ---------- */
  function finishAll() {
    jobs.forEach(function (j) { if (!j.ended) { j.ended = true; j.end(); } });
    jobs = [];
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (canvas) { canvas.remove(); canvas = null; }
  }
  function setEnabled(on) {
    enabled = on;
    if (!on) { finishAll(); sections.forEach(function (s) { s.classList.add("sw-done"); }); root.classList.remove("sw-ready"); }
    else { root.classList.add("sw-ready"); sections.forEach(function (s) { if (s.getBoundingClientRect().top > window.innerHeight) s.classList.remove("sw-done"); }); watchSections(); }
  }
  function rebuild() {
    finishAll();
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, 0); }
    var tries = 0;
    (function wait() {
      if (window.scrollY > 4 && tries++ < 40) { setTimeout(wait, 25); return; }
      root.classList.add("sw-ready");
      sections.forEach(function (s) { s.classList.remove("sw-done"); });
      heroBuild(); watchSections();
    })();
  }
  window.addEventListener("keydown", function (e) { if (e.key === "Escape") finishAll(); });
  window.addEventListener("wheel", function () { if (heroJob && window.scrollY > 40) heroJob.dead = true; }, { passive: true });
  window.addEventListener("langchange", function () { if (rebuildBtn && !heroJob) rebuildBtn.textContent = tx().watch; });
  if (rebuildBtn) rebuildBtn.addEventListener("click", rebuild);
  window.SWARM = { finishAll: finishAll, setEnabled: setEnabled, rebuild: rebuild };

  /* ---------- início ---------- */
  if (rebuildBtn) { rebuildBtn.hidden = false; rebuildBtn.textContent = tx().watch; }
  if (!enabled) { root.classList.remove("sw-pre", "sw-mono"); return; }
  markSeen();
  root.classList.add("sw-ready");
  if (root.classList.contains("sw-pre") && window.scrollY < 80) heroBuild(); else root.classList.remove("sw-pre", "sw-mono");
  watchSections();
})();
