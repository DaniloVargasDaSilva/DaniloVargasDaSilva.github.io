/* Controles do topo: idioma (inglês por padrão), tema claro/escuro e liga/desliga dos agentes. */
(function () {
  "use strict";
  var root = document.documentElement;
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  var norm = function (s) { return s.replace(/\s+/g, " ").trim(); };

  /* ---------- idioma ---------- */
  var PT = window.SITE_PT || {}, SEL = window.SITE_I18N_SEL || "";
  var nodes = [];
  if (SEL) document.querySelectorAll(SEL).forEach(function (el) {
    if (el.__i18n) return;
    var k = norm(el.textContent);
    if (PT[k] != null) { el.__i18n = { en: el.innerHTML, pt: PT[k] }; nodes.push(el); }
  });
  var sub = document.querySelector(".intro .sub");
  var subText = sub ? [sub.firstChild, sub.lastChild] : [];
  var SUB = { en: ["Software engineer and tech lead, now building ", " in public."], pt: ["Engenheiro de software e tech lead, agora construindo ", " em público."] };
  var ATTR = [
    [".topbar nav", "aria-label", "Sections", "Seções"],
    ["#crane", "aria-label", "A pixel-art version of Danilo operating a workshop crane, moving project blocks P0 to P8 from planned to shipped", "Uma versão em pixel art do Danilo operando uma ponte rolante, levando os blocos P0 a P8 de planejado para entregue"],
    [".dim", "aria-label", "Career path: machining in 2017, software in 2020, tech lead in 2025, AI in 2026", "Trajetória: usinagem em 2017, software em 2020, tech lead em 2025, IA em 2026"],
    ["#walkers", "aria-label", "Small robots walking along the timeline. Click one to make it jump.", "Robôs pequenos andando pela linha do tempo. Clique em um para ele pular."]
  ];
  var META = {
    en: { title: document.title, desc: (document.querySelector('meta[name="description"]') || {}).content || "" },
    pt: { title: "Danilo Vargas da Silva · Engenheiro de Software e Tech Lead indo para IA", desc: "Engenheiro de Software Sênior e Tech Lead indo para engenharia de IA. Da usinagem de precisão ao software e à IA: redes neurais, MCP servers, RAG, fine-tuning e visão computacional, construídos em público." }
  };
  var UI = {
    en: { theme: "Switch to dark mode", themeL: "Switch to light mode", agents: "Agents", agentsOn: "Agents are building the page. Click to turn them off.", agentsOff: "Agents are off. Click to turn them on." },
    pt: { theme: "Mudar para o modo escuro", themeL: "Mudar para o modo claro", agents: "Agentes", agentsOn: "Os agentes estão construindo a página. Clique para desligar.", agentsOff: "Os agentes estão desligados. Clique para ligar." }
  };
  function lang() { return root.lang === "pt-BR" ? "pt" : "en"; }

  function fmt(n, l) { return Math.round(n).toLocaleString(l === "pt" ? "pt-BR" : "en-US"); }
  function applyLang(l, silent) {
    if (window.SWARM) window.SWARM.finishAll();
    root.lang = l === "pt" ? "pt-BR" : "en";
    nodes.forEach(function (el) { el.innerHTML = el.__i18n[l]; });
    if (subText[0] && subText[0].nodeType === 3) subText[0].textContent = SUB[l][0];
    if (subText[1] && subText[1].nodeType === 3) subText[1].textContent = SUB[l][1];
    ATTR.forEach(function (a) { var el = document.querySelector(a[0]); if (el) el.setAttribute(a[1], l === "pt" ? a[3] : a[2]); });
    document.title = META[l].title;
    var md = document.querySelector('meta[name="description"]'); if (md) md.content = META[l].desc;
    document.querySelectorAll(".count").forEach(function (el) {
      if (!el.dataset.suffixEn) el.dataset.suffixEn = el.dataset.suffix || "";
      if (el.dataset.suffixEn === "th") el.dataset.suffix = l === "pt" ? "º" : "th";
      el.textContent = (el.dataset.prefix || "") + fmt(+el.dataset.to, l) + (el.dataset.suffix || "");
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.lang === l ? "true" : "false"); });
    paintControls();
    if (!silent) window.dispatchEvent(new Event("langchange"));
  }

  /* ---------- tema ---------- */
  var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  function isDark() { var t = root.getAttribute("data-theme"); return t ? t === "dark" : !!(mq && mq.matches); }
  function setTheme(t) { root.setAttribute("data-theme", t); store.set("theme", t); paintControls(); window.dispatchEvent(new Event("themechange")); }
  if (mq && mq.addEventListener) mq.addEventListener("change", function () { if (!root.getAttribute("data-theme")) { paintControls(); window.dispatchEvent(new Event("themechange")); } });

  /* ---------- agentes ---------- */
  function agentsOn() { return store.get("agents") !== "off"; }

  /* ---------- botões ---------- */
  var themeBtn = document.getElementById("themeBtn"), agentsBtn = document.getElementById("agentsBtn");
  function paintControls() {
    var l = lang(), u = UI[l];
    if (themeBtn) {
      var d = isDark();
      themeBtn.innerHTML = '<i class="fa-solid ' + (d ? "fa-sun" : "fa-moon") + '" aria-hidden="true"></i>';
      themeBtn.setAttribute("aria-label", d ? u.themeL : u.theme); themeBtn.title = d ? u.themeL : u.theme;
    }
    if (agentsBtn) {
      var on = agentsOn();
      agentsBtn.innerHTML = '<i class="fa-solid fa-robot" aria-hidden="true"></i><span>' + u.agents + "</span>";
      agentsBtn.setAttribute("aria-pressed", on ? "true" : "false");
      agentsBtn.title = on ? u.agentsOn : u.agentsOff;
    }
  }
  document.querySelectorAll("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () { store.set("lang", b.dataset.lang); applyLang(b.dataset.lang); });
  });
  if (themeBtn) themeBtn.addEventListener("click", function () { setTheme(isDark() ? "light" : "dark"); });
  if (agentsBtn) agentsBtn.addEventListener("click", function () {
    var on = !agentsOn(); store.set("agents", on ? "on" : "off"); paintControls();
    if (window.SWARM) window.SWARM.setEnabled(on);
  });

  applyLang(store.get("lang") === "pt" ? "pt" : "en", true);
  window.SITE = { lang: lang, agentsOn: agentsOn };
})();
