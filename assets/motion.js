/* Animações do site: pontos interativos, ponte rolante, robôs andando, texto digitando,
   contadores e barra de leitura. Tudo respeita "reduzir movimento" do sistema. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  var colors = {};
  function readColors() {
    colors = { ink: css("--ink"), muted: css("--muted"), blue: css("--blue"), sheet: css("--sheet"), paper: css("--paper"), grid: css("--grid"), line: css("--line") };
  }
  readColors();
  if (window.matchMedia) {
    var mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.addEventListener) mq.addEventListener("change", function () { readColors(); drawOnceAll(); });
  }
  var isPT = function () { return document.documentElement.lang === "pt-BR"; };
  window.addEventListener("themechange", function () { readColors(); if (reduce) drawOnceAll(); });
  var visible = true;
  document.addEventListener("visibilitychange", function () { visible = !document.hidden; });

  /* ---------- barra de leitura ---------- */
  var bar = document.getElementById("readbar");
  function onScroll() {
    if (!bar) return;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + "%";
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- pontos interativos ---------- */
  var hero = document.querySelector(".hero");
  var dc = document.getElementById("dots");
  var dctx = dc && dc.getContext("2d");
  var DW = 0, DH = 0, dpr = 1, mx = -1e4, my = -1e4, heroOn = true;
  function sizeDots() {
    if (!dc) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    DW = hero.clientWidth; DH = hero.clientHeight;
    dc.width = Math.round(DW * dpr); dc.height = Math.round(DH * dpr);
  }
  function drawDots(t) {
    if (!dctx) return;
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dctx.clearRect(0, 0, DW, DH);
    var s = 22, R = 150;
    for (var y = s / 2; y < DH; y += s) {
      for (var x = s / 2; x < DW; x += s) {
        var dx = x - mx, dy = y - my, d = Math.sqrt(dx * dx + dy * dy);
        var wave = Math.sin(x * 0.011 + y * 0.007 - t * 1.1);
        var r = 1.05 + wave * 0.35, ox = 0, oy = 0;
        if (d < R && d > 0.01) {
          var k = 1 - d / R; k = k * k;
          r += k * 2.6; ox = (dx / d) * k * 10; oy = (dy / d) * k * 10;
          dctx.globalAlpha = 0.35 + k * 0.65; dctx.fillStyle = colors.blue;
        } else {
          dctx.globalAlpha = 0.22 + (wave + 1) * 0.1; dctx.fillStyle = colors.muted;
        }
        dctx.beginPath(); dctx.arc(x + ox, y + oy, Math.max(0.4, r), 0, 6.283); dctx.fill();
      }
    }
    dctx.globalAlpha = 1;
  }
  if (hero) {
    hero.addEventListener("pointermove", function (e) { var r = hero.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; });
    hero.addEventListener("pointerleave", function () { mx = my = -1e4; });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { heroOn = es[0].isIntersecting; }).observe(hero);
  }

  /* ---------- ponte rolante com o avatar ---------- */
  var cc = document.getElementById("crane");
  var cctx = cc && cc.getContext("2d");
  var craneOn = true;
  if (cc && "IntersectionObserver" in window) new IntersectionObserver(function (es) { craneOn = es[0].isIntersecting; }).observe(cc);
  var GW = 120, GH = 90, FLOOR = 79;
  var PAL = { h: "#1f1a17", s: "#e7b993", g: "#141414", e: "#141414", m: "#a5574a", w: "#f1f1ee", l: "#3fb36a", p: "#2c3540", k: "#1a1a1a" };
  var AV = [
    "...hhhh...",
    "..hhhhhh..",
    ".hhhhhhhh.",
    ".hssssssh.",
    ".gegssgeg.",
    ".ssssssss.",
    "..ssmmss..",
    "...ssss...",
    "..wwlwww..",
    ".wwwlwwww.",
    "wwwwlwwwww",
    "s.wwlwww.s",
    "..wwwwww..",
    "..pppppp..",
    "..pp..pp..",
    "..kk..kk.."
  ];
  function slot(side, k) { // k: 0..8, k=0 é o bloco de baixo à esquerda
    var col = k % 3, row = Math.floor(k / 3);
    var x0 = side === "L" ? 12 : 72;
    return { x: x0 + col * 13, y: FLOOR - (row + 1) * 9 };
  }
  var blocks, order, step, phase, ph, tx, hookY, carrying, done, pauseT, lever, blinkT;
  function resetCrane() {
    blocks = [];
    for (var i = 0; i < 9; i++) { var sl = slot("L", i); blocks.push({ id: i, x: sl.x, y: sl.y, state: "planned" }); }
    order = [6, 7, 8, 3, 4, 5, 0, 1, 2]; // de cima para baixo na pilha da esquerda
    step = 0; phase = 0; ph = 0; tx = 60; hookY = 22; carrying = null; done = 0; pauseT = 0; lever = 0; blinkT = 0;
  }
  resetCrane();
  function px(c, x, y, w, h) { cctx.fillStyle = c; cctx.fillRect(x, y, w, h); }
  function drawBlock(b, carried) {
    var shipped = b.state === "shipped";
    px(colors.ink, b.x, b.y, 12, 8);
    px(shipped ? colors.blue : colors.sheet, b.x + 1, b.y + 1, 10, 6);
    cctx.fillStyle = shipped ? "#ffffff" : colors.ink;
    cctx.font = "600 5px Archivo, Arial, sans-serif";
    cctx.textAlign = "center"; cctx.textBaseline = "middle";
    cctx.fillText("P" + b.id, b.x + 6, b.y + 4.4);
    if (carried) { px(colors.blue, b.x + 5, b.y - 1, 2, 1); }
  }
  function drawCrane(t) {
    if (!cctx) return;
    var dpr2 = Math.min(2, window.devicePixelRatio || 1);
    var sc = (cc.clientWidth || 360) / GW;
    if (cc.width !== Math.round(GW * sc * dpr2)) { cc.width = Math.round(GW * sc * dpr2); cc.height = Math.round(GH * sc * dpr2); }
    cctx.setTransform(sc * dpr2, 0, 0, sc * dpr2, 0, 0);
    cctx.imageSmoothingEnabled = false;
    px(colors.sheet, 0, 0, GW, GH);
    // piso e marcações
    px(colors.ink, 0, FLOOR, GW, 1);
    for (var f = 2; f < GW; f += 6) px(colors.line, f, FLOOR + 3, 3, 1);
    cctx.fillStyle = colors.muted; cctx.font = "500 4px Archivo, Arial, sans-serif"; cctx.textAlign = "center"; cctx.textBaseline = "alphabetic";
    cctx.fillText(isPT() ? "a fazer" : "planned", 31, FLOOR + 9); cctx.fillText(isPT() ? "entregue" : "shipped", 91, FLOOR + 9);
    // pórtico
    px(colors.ink, 4, 8, 2, FLOOR - 8); px(colors.ink, 114, 8, 2, FLOOR - 8);
    px(colors.ink, 3, 7, 114, 3);
    for (var r = 6; r < 114; r += 4) px(colors.sheet, r, 8, 1, 1);
    // carrinho, cabo e gancho
    var t0 = Math.round(tx);
    px(colors.ink, t0 - 4, 10, 8, 3); px(colors.blue, t0 - 3, 11, 6, 1);
    px(colors.ink, t0, 13, 1, Math.max(1, Math.round(hookY) - 13));
    px(colors.ink, t0 - 2, Math.round(hookY), 5, 1); px(colors.ink, t0 - 2, Math.round(hookY) + 1, 1, 1); px(colors.ink, t0 + 2, Math.round(hookY) + 1, 1, 1);
    // blocos
    for (var i = 0; i < blocks.length; i++) if (blocks[i] !== carrying) drawBlock(blocks[i], false);
    if (carrying) { carrying.x = t0 - 6; carrying.y = Math.round(hookY) + 2; drawBlock(carrying, true); }
    // painel de controle e alavanca
    px(colors.ink, 64, FLOOR - 10, 5, 10); px(colors.blue, 65, FLOOR - 8, 1, 1); px(phase === 2 || phase === 6 ? colors.blue : colors.muted, 67, FLOOR - 8, 1, 1);
    var lx = lever > 0 ? 1 : lever < 0 ? -1 : 0;
    px(colors.ink, 66 + lx, FLOOR - 14, 1, 4); px(colors.blue, 65 + lx, FLOOR - 15, 3, 1);
    // avatar
    var ax = 53, ay = FLOOR - AV.length;
    var blink = (t % 4.2) < 0.12;
    for (var yy = 0; yy < AV.length; yy++) {
      for (var xx = 0; xx < AV[yy].length; xx++) {
        var ch = AV[yy][xx]; if (ch === ".") continue;
        if (ch === "e" && blink) ch = "s";
        if (yy === 10 && xx === 9 && lever !== 0) { continue; }
        px(PAL[ch], ax + xx, ay + yy, 1, 1);
      }
    }
    // braço na alavanca
    if (lever !== 0) { px(PAL.w, ax + 9, ay + 9, 2, 1); px(PAL.s, ax + 11, ay + 8, 1, 1); }
    // contador
    cctx.fillStyle = colors.blue; cctx.font = "700 5px Archivo, Arial, sans-serif"; cctx.textAlign = "right";
    cctx.fillText(done + "/9", 112, 6);
  }
  var SPEED = 34, LIFT = 30, CLEAR = 22;
  function updateCrane(dt) {
    if (pauseT > 0) { pauseT -= dt; if (pauseT <= 0 && done === 9) resetCrane(); lever = 0; return; }
    var b = blocks[order[step]];
    var src = { x: b.x + 6 }, dst = slot("R", step);
    function moveTo(target) { var d = target - tx; lever = d > 0 ? 1 : -1; var m = SPEED * dt; if (Math.abs(d) <= m) { tx = target; return true; } tx += Math.sign(d) * m; return false; }
    function liftTo(target) { var d = target - hookY; lever = 0; var m = LIFT * dt; if (Math.abs(d) <= m) { hookY = target; return true; } hookY += Math.sign(d) * m; return false; }
    if (phase === 0) { if (moveTo(src.x)) phase = 1; }
    else if (phase === 1) { if (liftTo(b.y - 2)) { phase = 2; ph = 0.35; } }
    else if (phase === 2) { ph -= dt; lever = 0; if (ph <= 0) { carrying = b; phase = 3; } }
    else if (phase === 3) { if (liftTo(CLEAR)) phase = 4; }
    else if (phase === 4) { if (moveTo(dst.x + 6)) phase = 5; }
    else if (phase === 5) { if (liftTo(dst.y - 2)) { phase = 6; ph = 0.35; } }
    else if (phase === 6) { ph -= dt; if (ph <= 0) { b.x = dst.x; b.y = dst.y; b.state = "shipped"; carrying = null; done++; phase = 7; } }
    else if (phase === 7) { if (liftTo(CLEAR)) { phase = 0; step++; if (step >= 9) { pauseT = 2.5; } } }
  }
  function staticCrane() { // estado parado: 3 blocos já entregues
    resetCrane();
    for (var k = 0; k < 3; k++) { var b = blocks[order[k]], d = slot("R", k); b.x = d.x; b.y = d.y; b.state = "shipped"; }
    done = 3; tx = 60;
  }

  /* ---------- robôs andando na cota ---------- */
  var wc = document.getElementById("walkers");
  var wctx = wc && wc.getContext("2d");
  var svg = document.querySelector(".dim svg");
  var WW = 0, WH = 0, lineY = 0, wscale = 3;
  var ROBOT = [
    "...b...",
    "..ooo..",
    ".ooooo.",
    ".ovvvo.",
    ".ooooo.",
    "..ooo..",
    ".ooooo.",
    "o.ooo.o",
    "..o.o..",
    "..o.o.."
  ];
  var ROBOT2 = ROBOT.slice(0, 8).concat(["..oo...", "...o..."]);
  var SAY_EN = ["measuring twice…", "loss 2.31 → 1.87", "shipping P0", "fitting LoRA…", "±0.01 mm", "training… 42%", "hello, recruiter!", "pip install patience", "attention is all we need", "backprop by hand"];
  var SAY_PT = ["medindo duas vezes…", "loss 2,31 → 1,87", "entregando o P0", "ajustando LoRA…", "±0,01 mm", "treinando… 42%", "oi, recrutador!", "pip install paciência", "atenção é tudo", "backprop na mão"];
  var bots = [
    { x: 60, dir: 1, v: 26, y: 0, vy: 0, say: "", sayT: 0, wait: 0, tint: "ink" },
    { x: 420, dir: -1, v: 18, y: 0, vy: 0, say: "", sayT: 0, wait: 0, tint: "blue" },
    { x: 760, dir: 1, v: 22, y: 0, vy: 0, say: "", sayT: 0, wait: 0, tint: "muted" }
  ];
  var sayClock = 3;
  function sizeWalkers() {
    if (!wc || !svg) return;
    var r = svg.getBoundingClientRect();
    WW = r.width; WH = r.height;
    lineY = (40 / 120) * WH;
    var d = Math.min(2, window.devicePixelRatio || 1);
    wc.width = Math.round(WW * d); wc.height = Math.round(WH * d);
    wc.style.width = WW + "px"; wc.style.height = WH + "px";
    wctx.setTransform(d, 0, 0, d, 0, 0);
    wscale = WW < 700 ? 2 : 3;
    bots.forEach(function (b, i) { b.x = Math.min(b.x, WW - 30); });
  }
  function drawRobot(b, frame) {
    var spr = frame ? ROBOT2 : ROBOT;
    var w = 7 * wscale, h = spr.length * wscale;
    var bx = Math.round(b.x - w / 2), by = Math.round(lineY - 2 - h - b.y);
    var body = colors[b.tint] || colors.ink;
    for (var yy = 0; yy < spr.length; yy++) {
      var row = spr[yy];
      for (var xx = 0; xx < row.length; xx++) {
        var c = row[b.dir < 0 ? row.length - 1 - xx : xx];
        if (c === ".") continue;
        wctx.fillStyle = c === "v" ? colors.sheet : c === "b" ? colors.blue : body;
        wctx.fillRect(bx + xx * wscale, by + yy * wscale, wscale, wscale);
      }
    }
    if (b.sayT > 0) {
      wctx.font = "600 12px Archivo, Arial, sans-serif";
      var tw = wctx.measureText(b.say).width + 12, bh = 20;
      var sx = Math.max(2, Math.min(WW - tw - 2, b.x - tw / 2)), sy = by - bh - 8;
      wctx.fillStyle = colors.sheet; wctx.strokeStyle = colors.ink; wctx.lineWidth = 1.5;
      wctx.fillRect(sx, sy, tw, bh); wctx.strokeRect(sx, sy, tw, bh);
      wctx.beginPath(); wctx.moveTo(b.x - 4, sy + bh); wctx.lineTo(b.x, sy + bh + 6); wctx.lineTo(b.x + 4, sy + bh); wctx.fillStyle = colors.sheet; wctx.fill();
      wctx.fillStyle = colors.ink; wctx.textAlign = "left"; wctx.textBaseline = "middle";
      wctx.fillText(b.say, sx + 6, sy + bh / 2 + 1);
    }
    b._box = { x: bx, y: by, w: w, h: h };
  }
  function drawWalkers(t) {
    if (!wctx) return;
    wctx.clearRect(0, 0, WW, WH);
    for (var i = 0; i < bots.length; i++) drawRobot(bots[i], Math.floor(t * 6 + i) % 2 === 0 && bots[i].wait <= 0 && !reduce);
  }
  function talk(b) { var SAY = isPT() ? SAY_PT : SAY_EN; b.say = SAY[Math.floor(Math.random() * SAY.length)]; b.sayT = 2.6; }
  function updateWalkers(dt) {
    sayClock -= dt;
    if (sayClock <= 0) { talk(bots[Math.floor(Math.random() * bots.length)]); sayClock = 5 + Math.random() * 4; }
    bots.forEach(function (b) {
      if (b.sayT > 0) b.sayT -= dt;
      if (b.y > 0 || b.vy > 0) { b.vy -= 900 * dt; b.y += b.vy * dt; if (b.y <= 0) { b.y = 0; b.vy = 0; } }
      if (b.wait > 0) { b.wait -= dt; return; }
      b.x += b.dir * b.v * dt;
      if (b.x < 20) { b.x = 20; b.dir = 1; }
      if (b.x > WW - 20) { b.x = WW - 20; b.dir = -1; }
      if (Math.random() < dt * 0.08) b.wait = 1 + Math.random() * 1.5;
    });
  }
  if (wc) {
    function hit(e) {
      var r = wc.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (var i = 0; i < bots.length; i++) { var bx = bots[i]._box; if (bx && x >= bx.x - 4 && x <= bx.x + bx.w + 4 && y >= bx.y - 4 && y <= bx.y + bx.h + 4) return bots[i]; }
      return null;
    }
    wc.addEventListener("pointermove", function (e) { wc.style.cursor = hit(e) ? "pointer" : "default"; });
    wc.addEventListener("click", function (e) { var b = hit(e); if (b) { b.vy = 260; b.y = 0.1; talk(b); if (reduce) drawWalkers(0); } });
  }

  /* ---------- texto digitando ---------- */
  var typed = document.getElementById("typed");
  var WORDS_EN = ["AI agents", "MCP servers", "neural nets from scratch", "a GPT in Portuguese", "fine-tuned models", "computer vision", "a production RAG"];
  var WORDS_PT = ["agentes de IA", "MCP servers", "redes neurais do zero", "um GPT em português", "modelos com fine-tuning", "visão computacional", "um RAG em produção"];
  var WORDS = isPT() ? WORDS_PT : WORDS_EN;
  window.addEventListener("langchange", function () { WORDS = isPT() ? WORDS_PT : WORDS_EN; if (typed) typed.textContent = WORDS[0]; if (typeof wi !== "undefined") { wi = 0; ci = WORDS[0].length; del = true; hold = 1.6; } });
  if (typed && !reduce) {
    var wi = 0, ci = WORDS[0].length, del = true, hold = 1.6, acc = 0;
    var typeTick = function (dt) {
      acc += dt;
      if (hold > 0) { hold -= dt; return; }
      if (acc < (del ? 0.035 : 0.07)) return; acc = 0;
      if (del) { ci--; if (ci <= 0) { del = false; wi = (wi + 1) % WORDS.length; } }
      else { ci++; if (ci >= WORDS[wi].length) { del = true; hold = 1.8; } }
      typed.textContent = WORDS[wi].slice(0, Math.max(0, ci)) || "​";
    };
  }

  /* ---------- contadores ---------- */
  function fmt(n) { return Math.round(n).toLocaleString(isPT() ? "pt-BR" : "en-US"); }
  var counts = Array.prototype.slice.call(document.querySelectorAll(".count"));
  function runCount(el) {
    var to = +el.dataset.to, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "", t0 = null, D = 1400;
    function f(ts) { if (!t0) t0 = ts; var p = Math.min(1, (ts - t0) / D); var e = 1 - Math.pow(1 - p, 3); el.textContent = pre + fmt(to * e) + suf; if (p < 1) requestAnimationFrame(f); }
    requestAnimationFrame(f);
  }
  if (!reduce && "IntersectionObserver" in window) {
    var co = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { runCount(en.target); co.unobserve(en.target); } }); }, { threshold: 0.6 });
    counts.forEach(function (el) { co.observe(el); });
  }

  /* ---------- barras de progresso dos projetos ---------- */
  var bars = Array.prototype.slice.call(document.querySelectorAll(".bar"));
  if (!reduce && "IntersectionObserver" in window) {
    bars.forEach(function (b) { b.classList.add("wait"); });
    var bo = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove("wait"); bo.unobserve(en.target); } }); }, { threshold: 0.8 });
    bars.forEach(function (b) { bo.observe(b); });
  }

  /* ---------- laço principal ---------- */
  function drawOnceAll() { sizeDots(); sizeWalkers(); drawDots(0); drawCrane(0); drawWalkers(0); }
  window.addEventListener("resize", function () { sizeDots(); sizeWalkers(); if (reduce) drawOnceAll(); });
  if (reduce) { staticCrane(); drawOnceAll(); return; }
  sizeDots(); sizeWalkers();
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    var t = now / 1000;
    if (visible && craneOn) { updateCrane(dt); drawCrane(t); }
    if (visible && heroOn) {
      drawDots(t);
      updateWalkers(dt); drawWalkers(t);
      if (typeTick) typeTick(dt);
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
