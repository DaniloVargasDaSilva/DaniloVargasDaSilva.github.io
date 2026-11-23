/* Fotos em 2.5D: cada foto tem um mapa de profundidade (Depth Anything V2) e o WebGL desloca
   os pixels conforme o ponteiro, a inclinação do celular ou um leve movimento automático.
   A foto do topo entra com uma "varredura" de medição: uma linha azul desce e as curvas de nível
   da profundidade aparecem antes da foto. Sem WebGL ou com "reduzir movimento", fica a <img> parada. */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root = document.documentElement;
  var css = function (n) { return getComputedStyle(root).getPropertyValue(n).trim(); };
  function rgb(hex) {
    var c = document.createElement("canvas").getContext("2d"); c.fillStyle = hex || "#000"; var h = c.fillStyle;
    if (h[0] === "#") return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
    var m = h.match(/[\d.]+/g) || [0, 0, 0]; return [m[0] / 255, m[1] / 255, m[2] / 255];
  }

  var VS = "attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;v.y=1.-v.y;gl_Position=vec4(p,0.,1.);}";
  var FS = [
    "precision mediump float;",
    "uniform sampler2D img,dep;uniform vec2 m,ratio,cs,co;uniform float amt,focus,scan,cont,zoom;uniform vec3 blue,paper;",
    "varying vec2 v;",
    "float D(vec2 u){vec4 t=texture2D(dep,u);return t.r*.99611+t.g*.00389;}",
    "void main(){",
    "  vec2 u=((v-.5)/zoom+.5)*cs+co;",
    // deslocamento em 3 passos: aproxima o paralaxe de verdade sem custo alto
    "  vec2 o=vec2(0.);float d=D(u);",
    "  for(int i=0;i<3;i++){o=m*(d-focus)*amt*ratio*cs;d=D(u+o);}",
    "  vec2 q=clamp(u+o,0.001,.999);",
    "  vec3 c=texture2D(img,q).rgb;",
    "  float dz=D(q);",
    // curvas de nível da profundidade, com espessura constante na tela
    "  float f=dz*15.;float w=min(fwidth(f),.2)+.0001;float iso=smoothstep(.5-w*1.1,.5-w*.3,abs(fract(f)-.5));",
    "  float gray=dot(c,vec3(.299,.587,.114));",
    "  vec3 depthView=mix(paper,vec3(gray),.18);depthView=mix(depthView,blue,iso);",
    "  vec3 col=mix(c,depthView,cont);",
    // varredura de entrada
    "  float y=v.y;",
    "  if(scan<1.){",
    "    float ahead=step(scan,y);",
    "    float band=smoothstep(scan-.14,scan,y)*(1.-ahead);",
    "    vec3 pre=mix(paper,blue,iso*.75*smoothstep(scan+.5,scan,y));",
    "    col=mix(col,mix(col,depthView,.85),band);",
    "    col=mix(col,pre,ahead);",
    "    float line=1.-smoothstep(0.,.004,abs(y-scan));",
    "    col=mix(col,blue,line);",
    "  }",
    "  gl_FragColor=vec4(col,1.);",
    "}"
  ].join("\n");

  function Depth(fig) {
    this.fig = fig; this.canvas = fig.querySelector("canvas"); this.imgEl = fig.querySelector("img");
    this.hero = fig.classList.contains("hero-fig");
    this.orbit = parseFloat(fig.dataset.orbit || (this.hero ? 1 : 0));
    this.amt = parseFloat(fig.dataset.amount || (this.hero ? 0.045 : 0.035));
    this.m = [0, 0]; this.tm = [0, 0]; this.lastInput = -1e9; this.cont = 0; this.tcont = 0;
    this.scan = this.hero && !reduce ? -0.02 : 1.5; this.scanStarted = false; this.on = false; this.hover = false;
  }
  Depth.prototype.init = function () {
    var self = this, cv = this.canvas;
    var gl = cv.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) return false;
    gl.getExtension("OES_standard_derivatives");
    var fs = "#extension GL_OES_standard_derivatives : enable\n" + FS;
    function sh(t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; }
    var pr = gl.createProgram();
    try { gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs)); } catch (e) { return false; }
    gl.linkProgram(pr); gl.useProgram(pr);
    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.gl = gl; this.u = {};
    ["img", "dep", "m", "ratio", "cs", "co", "amt", "focus", "scan", "cont", "zoom", "blue", "paper"].forEach(function (n) { self.u[n] = gl.getUniformLocation(pr, n); });
    gl.uniform1i(this.u.img, 0); gl.uniform1i(this.u.dep, 1);
    gl.uniform1f(this.u.focus, parseFloat(this.fig.dataset.focus || 0.8));
    this.readColors();
    var n = 0, imgs = [new Image(), new Image()];
    imgs.forEach(function (im, i) {
      im.decoding = "async";
      im.onload = function () {
        gl.activeTexture(i ? gl.TEXTURE1 : gl.TEXTURE0);
        var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
        try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im); } catch (e) { return; }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (!i) self.ia = im.width / im.height;
        if (++n === 2) {
          self.ready = true; self.fig.classList.add("gl-on"); self.resize(); self.draw();
          if (self.hero && self.scan >= 1.5) self.fig.classList.add("cut-in");
        }
      };
      im.src = i ? self.fig.dataset.depth : (self.imgEl.currentSrc || self.imgEl.src);
    });
    // ponteiro: no topo, a página inteira do herói mexe a foto; na galeria, só o próprio quadro
    var zone = this.hero ? (this.fig.closest(".hero") || this.fig) : this.fig;
    zone.addEventListener("pointermove", function (e) {
      if (e.pointerType === "touch" && !self.hero) return;
      var r = self.fig.getBoundingClientRect();
      var sx = self.hero ? Math.max(r.width, 500) : r.width / 2, sy = self.hero ? Math.max(r.height, 500) : r.height / 2;
      self.tm = [clamp((e.clientX - (r.left + r.width / 2)) / sx, -1, 1), clamp((e.clientY - (r.top + r.height / 2)) / sy, -1, 1)];
      self.lastInput = performance.now(); self.hover = true;
    });
    zone.addEventListener("pointerleave", function () { self.hover = false; self.fig.classList.remove("lit"); if (!self.hero) self.tm = [0, 0]; });
    if (this.hero) {
      zone.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") self.fig.classList.add("lit"); });
      var drag = null;
      this.fig.addEventListener("pointerdown", function (e) {
        if (e.pointerType === "mouse") return;
        drag = { x: e.clientX, y: e.clientY, m: self.tm.slice() }; self.fig.classList.add("lit");
      });
      this.fig.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var r = self.fig.getBoundingClientRect();
        self.tm = [clamp(drag.m[0] + (e.clientX - drag.x) / (r.width * 0.5), -1, 1), clamp(drag.m[1] + (e.clientY - drag.y) / (r.height * 0.5), -1, 1)];
        self.lastInput = performance.now();
      });
      ["pointerup", "pointercancel"].forEach(function (ev) { self.fig.addEventListener(ev, function () { drag = null; self.fig.classList.remove("lit"); }); });
    }
    return true;
  };
  Depth.prototype.readColors = function () {
    if (!this.gl) return;
    this.gl.uniform3fv(this.u.blue, rgb(css("--blue"))); this.gl.uniform3fv(this.u.paper, rgb(css("--sheet")));
  };
  Depth.prototype.resize = function () {
    if (!this.gl) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1), r = this.canvas.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    this.gl.viewport(0, 0, w, h);
    // deslocamento igual nos dois eixos, independente da proporção da foto
    var a = r.width / Math.max(1, r.height);
    this.gl.uniform2f(this.u.ratio, a > 1 ? 1 / a : 1, a > 1 ? 1 : a);
    // "object-fit: cover" com ponto de foco (data-pos), igual à <img> por baixo
    var ia = this.ia || a, px = parseFloat(this.fig.dataset.pos || 0.5), sx = 1, sy = 1;
    if (ia > a) sx = a / ia; else sy = ia / a;
    this.gl.uniform2f(this.u.cs, sx, sy); var py = parseFloat(this.fig.dataset.posy || 0.5);
    this.gl.uniform2f(this.u.co, (1 - sx) * px, (1 - sy) * py);
    this.map = { sx: sx, sy: sy, cx: (1 - sx) * px, cy: (1 - sy) * py, zoom: 1 + this.amt * 0.9 };
    this.placeCut();
  };
  Depth.prototype.placeCut = function () {
    var cut = this.fig.querySelector(".cut"), mp = this.map; if (!cut || !mp) return;
    var d3 = this.canvas.parentNode, frame = d3.parentNode;
    var W = d3.offsetWidth, H = d3.offsetHeight, ox = frame.offsetLeft + d3.offsetLeft + frame.clientLeft, oy = frame.offsetTop + d3.offsetTop + frame.clientTop;
    var ch = parseFloat(this.fig.dataset.cutH || 0.33);
    // inverso do mapeamento do shader: textura -> tela
    function vx(t) { return ((t - mp.cx) / mp.sx - 0.5) * mp.zoom + 0.5; }
    function vy(t) { return ((t - mp.cy) / mp.sy - 0.5) * mp.zoom + 0.5; }
    var x0 = vx(0), x1 = vx(1), y0 = vy(0), y1 = vy(ch);
    cut.style.left = (ox + x0 * W) + "px"; cut.style.top = (oy + y0 * H) + "px";
    cut.style.width = ((x1 - x0) * W) + "px"; cut.style.height = ((y1 - y0) * H) + "px";
  };
  Depth.prototype.tilt = function () {
    if (!this.hero || reduce) return;
    var x = this.m[0], y = this.m[1] + this.sc;
    this.fig.style.transform = "perspective(1100px) rotateY(" + (x * 9).toFixed(2) + "deg) rotateX(" + (-y * 7).toFixed(2) + "deg)";
    this.fig.style.setProperty("--gx", (50 + x * 40).toFixed(1) + "%");
    this.fig.style.setProperty("--gy", (30 + y * 35).toFixed(1) + "%");
  };
  Depth.prototype.step = function (t, dt) {
    var idle = performance.now() - this.lastInput > 2500;
    if (this.orbit && idle && !reduce) {
      // órbita lenta e pequena quando ninguém mexe
      this.tm = [Math.sin(t * 0.45) * 0.55 * this.orbit, Math.cos(t * 0.33) * 0.3 * this.orbit];
    }
    if (this.hero) {
      var hh = (this.fig.closest(".hero") || document.body).offsetHeight || 1;
      var tsc = clamp(window.scrollY / hh, 0, 1) * 0.9;
      this.sc = (this.sc || 0) + (tsc - (this.sc || 0)) * (1 - Math.pow(0.004, dt));
    }
    var k = 1 - Math.pow(0.002, dt);
    this.m[0] += (this.tm[0] - this.m[0]) * k; this.m[1] += (this.tm[1] - this.m[1]) * k;
    this.cont += (this.tcont - this.cont) * (1 - Math.pow(0.001, dt));
    if (this.hero && this.scan < 1.5) {
      var shown = parseFloat(getComputedStyle(this.fig).opacity) > 0.6;
      if (shown) this.scanStarted = true;
      if (this.scanStarted) this.scan = Math.min(1.5, this.scan + dt / 1.7);
      if (this.scan > 0.08) this.fig.classList.add("cut-in");
    }
  };
  Depth.prototype.draw = function () {
    if (!this.ready) return;
    var gl = this.gl, u = this.u;
    gl.uniform2f(u.m, this.m[0], this.m[1] + (this.sc || 0));
    this.tilt();
    gl.uniform1f(u.amt, reduce ? 0 : this.amt);
    gl.uniform1f(u.zoom, 1 + this.amt * 0.9);
    gl.uniform1f(u.scan, this.scan);
    gl.uniform1f(u.cont, this.cont);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  var figs = Array.prototype.slice.call(document.querySelectorAll(".depth3d"));
  if (!figs.length) return;
  var items = [];
  function start(fig) {
    if (fig.__d3) return; var d = new Depth(fig); fig.__d3 = d;
    try { if (d.init()) items.push(d); } catch (e) { /* fica a foto normal */ }
    var btn = fig.querySelector(".depth-btn");
    if (btn) btn.addEventListener("click", function () {
      var on = btn.getAttribute("aria-pressed") !== "true"; btn.setAttribute("aria-pressed", on ? "true" : "false");
      fig.classList.toggle("depth-on", on);
      d.tcont = on ? 1 : 0; if (reduce) { d.cont = d.tcont; d.draw(); }
    });
  }
  var vis = new Map();
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { vis.set(e.target, e.isIntersecting); if (e.isIntersecting) start(e.target); });
    }, { rootMargin: "200px" });
    figs.forEach(function (f) { io.observe(f); });
  } else figs.forEach(start);

  // celular: inclinação do aparelho mexe a foto do topo (Android; no iOS fica a órbita automática)
  window.addEventListener("deviceorientation", function (e) {
    if (e.gamma == null) return;
    items.forEach(function (d) {
      if (!d.hero) return;
      d.tm = [clamp(e.gamma / 25, -1, 1), clamp((e.beta - 45) / 25, -1, 1)]; d.lastInput = performance.now();
    });
  });
  window.addEventListener("resize", function () { items.forEach(function (d) { d.resize(); d.draw(); }); });
  function recolor() { items.forEach(function (d) { d.readColors(); d.draw(); }); }
  window.addEventListener("themechange", recolor);
  if (window.matchMedia) { var mq = matchMedia("(prefers-color-scheme: dark)"); if (mq.addEventListener) mq.addEventListener("change", recolor); }
  // as cores mudam quando o enxame termina de montar o topo
  new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ["class", "data-theme"] });

  if (reduce) { setInterval(function () { items.forEach(function (d) { if (!d.drawn && d.ready) { d.draw(); d.drawn = true; } }); }, 300); return; }
  var last = performance.now();
  function loop(now) {
    var dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!document.hidden) items.forEach(function (d) {
      if (vis.get(d.fig) === false) return;
      d.step(now / 1000, dt);
      var moving = (d.hero && Math.abs(d.sc - clamp(window.scrollY / ((d.fig.closest(".hero") || document.body).offsetHeight || 1), 0, 1) * 0.9) > 0.001) || Math.abs(d.tm[0] - d.m[0]) + Math.abs(d.tm[1] - d.m[1]) > 0.0005 || Math.abs(d.tcont - d.cont) > 0.002 || (d.hero && d.scan < 1.5);
      if (moving || d.hero || d.orbit) d.draw();
    });
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
})();
