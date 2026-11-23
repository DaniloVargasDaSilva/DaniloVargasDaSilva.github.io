/* Enxame de agentes que constrói o topo da página ao vivo.
   Fases: planejar (wireframe), escrever (texto), estilizar (escolher a cor), entregar (os agentes formam SHIPPED).
   Roda uma vez por sessão, pula com Esc, clique, rolagem ou o botão "Skip", e não roda com "reduzir movimento". */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var rebuildBtn = document.getElementById("rebuild");
  if (reduce) { if (rebuildBtn) rebuildBtn.hidden = true; cleanup(); return; }

  var css = function (n) { return getComputedStyle(root).getPropertyValue(n).trim(); };
  var $ = function (s) { return document.querySelector(s); };
  var shipBox = null, running = false, raf = 0, canvas, ctx, W, H, dpr, t0, agents, rects, swarm, h1, h1html, subEl, skipBtn, shipPts;
  var C = {};

  function cleanup() {
    root.classList.remove("swarm-pre", "swarm-mono");
    document.querySelectorAll("[data-swarm]").forEach(function (el) { el.style.opacity = ""; el.style.clipPath = ""; el.style.transition = ""; el.removeAttribute("data-swarm"); });
  }
  function show(el, ms) {
    if (!el || el.getAttribute("data-swarm") === "on") return;
    el.setAttribute("data-swarm", "on");
    el.style.transition = "opacity " + (ms || 350) + "ms ease";
    el.style.opacity = "1";
  }
  function ease(x) { return x < 0 ? 0 : x > 1 ? 1 : x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function box(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, el: el }; }
  function perim(r, p) {
    var L = 2 * (r.w + r.h), d = p * L;
    if (d < r.w) return [r.x + d, r.y];
    d -= r.w; if (d < r.h) return [r.x + r.w, r.y + d];
    d -= r.h; if (d < r.w) return [r.x + r.w - d, r.y + r.h];
    d -= r.w; return [r.x, r.y + r.h - d];
  }
  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ---------- montagem do roteiro ---------- */
  function build(force) {
    if (running) return;
    if (!force && window.scrollY > 80) { cleanup(); return; }
    running = true;
    root.classList.add("swarm-pre", "swarm-mono");
    C = { ink: css("--ink"), muted: css("--muted"), blue: css("--blue"), sheet: css("--sheet"), line: css("--line") };
    if (!C.blue || C.blue === C.muted) C.blue = "#1F3FBF";

    canvas = document.createElement("canvas");
    canvas.className = "swarm-canvas"; canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    resize();

    skipBtn = document.createElement("button");
    skipBtn.type = "button"; skipBtn.className = "swarm-skip"; skipBtn.textContent = "Skip build";
    skipBtn.addEventListener("click", finish);
    document.body.appendChild(skipBtn);

    h1 = $(".intro-text h1"); h1html = h1 ? h1.innerHTML : "";
    if (h1) { h1.setAttribute("aria-label", h1.textContent.replace(/\s+/g, " ").trim()); h1.textContent = ""; }
    subEl = $(".intro .sub");
    var hero = $(".hero"); if (hero) hero.setAttribute("aria-busy", "true");

    var targets = [
      [".topbar .mark", "plan"], [".topbar nav", "plan"], [".intro-text h1", "plan"],
      [".intro .sub", "plan"], [".stats", "plan"], [".crane", "plan"], [".dim", "plan"]
    ];
    rects = [];
    targets.forEach(function (t, i) {
      var el = $(t[0]); if (!el) return;
      var r = box(el);
      if (el === h1) { r.h = Math.max(r.h, parseFloat(getComputedStyle(h1).fontSize) * 2.1); }
      if (r.w < 4 || r.y > H) return;
      r.t0 = 0.35 + i * 0.16; r.t1 = r.t0 + 0.95; r.label = Math.round(r.w) + " × " + Math.round(r.h);
      rects.push(r);
    });

    // agentes com nome: 7 planejadores, 2 escritores, 1 estilista
    agents = [];
    var names = ["planner", "planner", "planner", "planner", "planner", "planner", "planner"];
    rects.forEach(function (r, i) {
      var sx = i % 2 ? W + 30 : -30, sy = r.y + r.h / 2 + (i % 3 - 1) * 60;
      agents.push({ role: names[i] || "planner", tag: i < 3, sx: sx, sy: sy, r: r, kind: "plan" });
    });
    var hb = h1 ? box(h1) : { x: 40, y: 140, w: 300, h: 80 };
    var sb = subEl ? box(subEl) : { x: 40, y: 260, w: 300, h: 40 };
    agents.push({ role: "writer", tag: true, kind: "write", sx: -40, sy: hb.y - 40 });
    agents.push({ role: "writer", tag: false, kind: "wipe", sx: -40, sy: sb.y + 80, r: sb });
    agents.push({ role: "stylist", tag: true, kind: "style", sx: W + 40, sy: hb.y, hb: hb });
    var stats = Array.prototype.slice.call(document.querySelectorAll(".stats > div"));
    stats.forEach(function (el, i) { var b = box(el); agents.push({ role: "tester", tag: i === 0, kind: "stamp", sx: b.x + b.w / 2 + (i % 2 ? 1 : -1) * 120, sy: H + 30, r: b, el: el, t: 3.0 + i * 0.18 }); });

    // texto do final, amostrado de um canvas fora da tela
    shipPts = sampleText("SHIPPED", W < 640 ? 230 : 420);
    swarm = shipPts.map(function (p, i) {
      var a = Math.random() * Math.PI * 2, R = Math.max(W, H) * (0.6 + Math.random() * 0.3);
      return { sx: W / 2 + Math.cos(a) * R, sy: H / 2 + Math.sin(a) * R, tx: p[0], ty: p[1], d: Math.random() * 0.55, ox: (Math.random() - .5) * 2, oy: (Math.random() - .5) * 2 };
    });

    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", finish, { passive: true, once: true });
    window.addEventListener("touchmove", finish, { passive: true, once: true });
    window.addEventListener("resize", onResize);
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function sampleText(word, max) {
    var c = document.createElement("canvas"), w = Math.min(W * 0.86, 1000), fs = Math.min(w / (word.length * 0.62), H * 0.3);
    c.width = Math.ceil(w); c.height = Math.ceil(fs * 1.2);
    var x = c.getContext("2d");
    x.fillStyle = "#000"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "800 " + fs + "px " + (css("--display") || "sans-serif");
    x.fillText(word, c.width / 2, c.height / 2);
    var d = x.getImageData(0, 0, c.width, c.height).data, pts = [], step = Math.max(4, Math.round(fs / 22));
    for (var yy = 0; yy < c.height; yy += step) for (var xx = 0; xx < c.width; xx += step) if (d[(yy * c.width + xx) * 4 + 3] > 128) pts.push([xx, yy]);
    for (var i = pts.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), tmp = pts[i]; pts[i] = pts[j]; pts[j] = tmp; }
    pts = pts.slice(0, max);
    var offX = (W - c.width) / 2, offY = Math.min(H * 0.42, 320) - c.height / 2;
    shipBox = { x: offX, y: offY, w: c.width, h: c.height };
    return pts.map(function (p) { return [p[0] + offX, p[1] + offY]; });
  }

  /* ---------- desenho ---------- */
  function cursor(x, y, s, color, alpha) {
    ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 15); ctx.lineTo(4, 11.5); ctx.lineTo(7, 18); ctx.lineTo(9.5, 17); ctx.lineTo(6.5, 10.5); ctx.lineTo(11.5, 10.5); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1.4; ctx.strokeStyle = C.sheet; ctx.stroke(); ctx.restore();
  }
  function tag(x, y, text, color) {
    ctx.save(); ctx.font = "600 11px " + (css("--display") || "sans-serif");
    var w = ctx.measureText(text).width + 10;
    ctx.fillStyle = color; ctx.fillRect(x + 12, y + 16, w, 17);
    ctx.fillStyle = C.sheet; ctx.textBaseline = "middle"; ctx.fillText(text, x + 17, y + 25); ctx.restore();
  }
  function wire(r, p, alpha) {
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = C.ink; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.beginPath(); var n = 40;
    for (var i = 0; i <= n; i++) { var q = perim(r, p * i / n); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    ctx.stroke(); ctx.setLineDash([]);
    if (p >= 1) { ctx.font = "500 11px " + (css("--display") || "sans-serif"); ctx.fillStyle = C.muted; ctx.fillText(r.label, r.x + 4, r.y - 5); }
    ctx.restore();
  }

  function frame(now) {
    var t = (now - t0) / 1000;
    ctx.clearRect(0, 0, W, H);
    var wireFade = 1 - clamp((t - 4.1) / 0.6);

    // 1. planejar: cada planejador entra e desenha o contorno do seu bloco
    agents.forEach(function (a) {
      if (a.kind !== "plan") return;
      var r = a.r, p = clamp((t - r.t0) / (r.t1 - r.t0)), x, y;
      if (t < r.t0) { var k = ease(clamp(t / r.t0)); var s0 = perim(r, 0); x = lerp(a.sx, s0[0], k); y = lerp(a.sy, s0[1], k); }
      else if (p < 1) { var q = perim(r, ease(p)); x = q[0]; y = q[1]; }
      else { var k2 = ease(clamp((t - r.t1) / 0.8)); var e = perim(r, 1); x = lerp(e[0], a.sx, k2); y = lerp(e[1], a.sy - 80, k2); if (r.el && r.el !== h1 && r.el !== subEl && !r.el.classList.contains("stats")) show(r.el, 400); }
      if (wireFade > 0) wire(r, ease(p), wireFade * (t > r.t0 ? 1 : 0));
      if (k2 === undefined || k2 < 1) { cursor(x, y, 1, C.ink); if (a.tag && p < 1 && t > r.t0) tag(x, y, a.role, C.ink); }
    });

    // 2. escrever: o nome é digitado letra por letra
    var w = agents.filter(function (a) { return a.kind === "write"; })[0];
    if (w && h1) {
      show(h1, 1);
      var full = h1html.replace(/<br\s*\/?>/gi, "\n"), T0 = 1.5, T1 = 2.9, n = Math.round(full.length * clamp((t - T0) / (T1 - T0)));
      if (t >= T0) { var part = full.slice(0, n); h1.innerHTML = part.replace(/\n/g, "<br>"); }
      var pos = endOf(h1), wx, wy;
      if (t < T0) { var kk = ease(clamp((t - 0.9) / 0.6)); wx = lerp(w.sx, pos[0], kk); wy = lerp(w.sy, pos[1], kk); }
      else if (t < T1 + 0.3) { wx = pos[0] + 2; wy = pos[1] - 4; }
      else { var ko = ease(clamp((t - T1 - 0.3) / 0.7)); wx = lerp(pos[0], -40, ko); wy = lerp(pos[1], pos[1] - 120, ko); }
      if (t < T1 + 1) { cursor(wx, wy, 1, C.ink); if (t > T0 && t < T1) tag(wx, wy, "writer", C.ink); }
    }
    // a frase de baixo aparece por trás de um segundo escritor
    var wp = agents.filter(function (a) { return a.kind === "wipe"; })[0];
    if (wp && subEl) {
      var S0 = 2.2, S1 = 3.2, pp = ease(clamp((t - S0) / (S1 - S0)));
      if (t >= S0) { subEl.setAttribute("data-swarm", "on"); subEl.style.opacity = "1"; subEl.style.clipPath = "inset(0 " + (100 - pp * 100) + "% 0 0)"; }
      var rx = wp.r.x + wp.r.w * pp, ry = wp.r.y + wp.r.h * 0.6;
      if (t < S0) { var kw = ease(clamp((t - 1.7) / 0.5)); rx = lerp(wp.sx, wp.r.x, kw); ry = lerp(wp.sy, ry, kw); }
      if (t < S1 + 0.2) cursor(rx, ry, 1, C.ink);
    }
    // testadores carimbam os números
    agents.forEach(function (a) {
      if (a.kind !== "stamp") return;
      var k = ease(clamp((t - a.t) / 0.55)), cx = a.r.x + a.r.w * 0.3, cy = a.r.y + a.r.h * 0.5;
      var x = lerp(a.sx, cx, k), y = lerp(a.sy, cy, k);
      if (k >= 1) { show(a.el, 250); var ko = ease(clamp((t - a.t - 0.7) / 0.5)); x = lerp(cx, a.sx, ko); y = lerp(cy, a.sy, ko); if (ko >= 1) return; }
      cursor(x, y, 1, C.ink); if (a.tag && k > 0 && k < 1) tag(x, y, "tester", C.ink);
    });

    // 3. estilizar: a estilista testa 4 cores e escolhe o azul
    var st = agents.filter(function (a) { return a.kind === "style"; })[0];
    if (st) {
      var P0 = 3.4, hb = st.hb, sw = [C.muted, "#C0561B", "#00806F", "#6E3DB0", C.blue], bx = W < 700 ? hb.x : Math.min(hb.x + hb.w + 24, W - 190), by = W < 700 ? Math.max(hb.y - 52, 8) : Math.max(hb.y - 6, 60);
      if (t > P0 - 0.5 && t < 5.1) {
        var al = clamp((t - (P0 - 0.5)) / 0.3) * (1 - clamp((t - 4.7) / 0.4));
        ctx.save(); ctx.globalAlpha = al; ctx.fillStyle = C.sheet; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
        ctx.fillRect(bx - 8, by - 8, sw.length * 30 + 10, 40); ctx.strokeRect(bx - 8, by - 8, sw.length * 30 + 10, 40);
        sw.forEach(function (c, i) { ctx.fillStyle = c; ctx.fillRect(bx + i * 30, by, 22, 22); });
        ctx.restore();
      }
      var hop = clamp((t - P0) / 1.0), idx = Math.min(sw.length - 1, Math.floor(hop * sw.length)), sx = bx + idx * 30 + 11, sy = by + 14;
      var sx0 = lerp(st.sx, bx + 11, ease(clamp((t - (P0 - 0.5)) / 0.5))), sy0 = lerp(st.sy, sy, ease(clamp((t - (P0 - 0.5)) / 0.5)));
      if (t > P0 - 0.5 && t < 5.2) {
        var px = t < P0 ? sx0 : sx, py = t < P0 ? sy0 : sy;
        if (t > 4.4) { var kz = ease(clamp((t - 4.5) / 0.7)); px = lerp(sx, W + 40, kz); py = lerp(sy, sy - 60, kz); }
        if (t > 4.4 && t < 4.75) { ctx.save(); ctx.strokeStyle = C.blue; ctx.lineWidth = 2; ctx.globalAlpha = 1 - (t - 4.4) / 0.35; ctx.beginPath(); ctx.arc(sx, sy, 6 + (t - 4.4) * 60, 0, 7); ctx.stroke(); ctx.restore(); }
        cursor(px, py, 1, C.ink); if (t < 4.4) tag(px, py, "stylist", C.ink);
      }
      if (t > 4.4) root.classList.remove("swarm-mono");
    }

    // 4. entregar: o enxame inteiro forma SHIPPED e depois se espalha
    var F0 = 4.8;
    if (t > F0) {
      var gather = 1.1, hold = 0.7, scat = 0.8, blue = C.blue, cs = W < 640 ? 0.42 : 0.62;
      var band = clamp((t - F0 - 0.5) / 0.4) * (1 - clamp((t - F0 - 1.9) / 0.6));
      if (band > 0 && shipBox) { ctx.save(); ctx.globalAlpha = band * 0.88; ctx.fillStyle = C.sheet; ctx.fillRect(shipBox.x - 16, shipBox.y - 12, shipBox.w + 32, shipBox.h + 24); ctx.restore(); }
      for (var i = 0; i < swarm.length; i++) {
        var s = swarm[i], tt = t - F0 - s.d, x, y, a = 1;
        if (tt < 0) continue;
        if (tt < gather) { var k = ease(tt / gather); x = lerp(s.sx, s.tx, k); y = lerp(s.sy, s.ty, k); }
        else if (tt < gather + hold) { x = s.tx + s.ox * Math.sin(tt * 9); y = s.ty + s.oy * Math.cos(tt * 9); }
        else { var ks = ease((tt - gather - hold) / scat); x = lerp(s.tx, s.sx, ks); y = lerp(s.ty, s.sy, ks); a = 1 - ks; }
        cursor(x, y, cs, blue, a);
      }
      if (t > F0 + 1.3) show($(".dim"), 400);
    }
    if (t > F0 + 0.55 + 1.1 + 0.7 + 0.8 + 0.1) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function endOf(el) {
    var range = document.createRange(); range.selectNodeContents(el); range.collapse(false);
    var rs = range.getClientRects(), r = rs.length ? rs[rs.length - 1] : el.getBoundingClientRect();
    if (!rs.length || r.width === 0 && r.height === 0) { var b = el.getBoundingClientRect(); return [b.left + 2, b.top + 10]; }
    return [r.right, r.top + r.height * 0.15];
  }

  function finish() {
    if (!running) return;
    running = false; cancelAnimationFrame(raf);
    if (h1) { h1.innerHTML = h1html; h1.removeAttribute("aria-label"); }
    if (canvas) canvas.remove(); if (skipBtn) skipBtn.remove();
    var hero = $(".hero"); if (hero) hero.removeAttribute("aria-busy");
    window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize);
    cleanup();
    try { sessionStorage.setItem("swarm-built", "1"); } catch (e) {}
    if (rebuildBtn) rebuildBtn.hidden = false;
  }
  function onKey(e) { if (e.key === "Escape") finish(); }
  function onResize() { finish(); }
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1); W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (rebuildBtn) rebuildBtn.addEventListener("click", function () {
    try { window.scrollTo({ top: 0, behavior: "instant" }); } catch (e) { window.scrollTo(0, 0); }
    var tries = 0;
    (function wait() { if (window.scrollY < 5 || tries++ > 40) build(true); else setTimeout(wait, 25); })();
  });
  if (root.classList.contains("swarm-pre")) build(); else if (rebuildBtn) rebuildBtn.hidden = false;
})();
