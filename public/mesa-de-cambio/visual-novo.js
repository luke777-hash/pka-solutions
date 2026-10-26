// Visual novo da Mesa de câmbio: botão de tema, marcador dos modos, animação ao trocar de modo,
// explicações fixas atrás do botão "?", preços e regras antes dos cards e "Como a conta é feita" recolhido.
// Não mexe em cálculo nem em dado: só em classes e elementos próprios (vn-*).
(function(){
  "use strict";
  var raiz = document.documentElement;
  var CHAVE_TEMA = "pkahub-tema"; // a mesma do hub, para a escolha valer no site todo

  // ---------- tema claro/escuro ----------
  function temaAtual(){
    if(raiz.dataset.theme==="dark") return "escuro";
    if(raiz.dataset.theme==="light") return "claro";
    try{ return window.matchMedia("(prefers-color-scheme: light)").matches ? "claro" : "escuro"; }catch(e){ return "escuro"; }
  }
  var SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  var LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
  var cab = document.querySelector(".masthead");
  var btnTema = document.createElement("button");
  btnTema.type = "button";
  btnTema.className = "vn-tema";
  function pintarBotao(){
    var t = temaAtual(), prox = t==="escuro" ? "claro" : "escuro";
    btnTema.innerHTML = (t==="escuro" ? SOL : LUA) + "<span>" + (t==="escuro" ? "Escuro" : "Claro") + "</span>";
    btnTema.setAttribute("aria-label", "Mudar para o tema " + prox);
    btnTema.title = "Mudar para o tema " + prox;
  }
  btnTema.addEventListener("click", function(){
    var novo = temaAtual()==="escuro" ? "claro" : "escuro";
    raiz.dataset.theme = novo==="escuro" ? "dark" : "light";
    try{ localStorage.setItem(CHAVE_TEMA, novo); }catch(e){}
    pintarBotao();
  });
  if(cab){ cab.appendChild(btnTema); pintarBotao(); }

  // ---------- marcador que desliza sob o modo escolhido ----------
  var modos = document.getElementById("modes");
  var ind = document.createElement("span");
  ind.className = "vn-ind";
  ind.setAttribute("aria-hidden", "true");
  if(modos) modos.appendChild(ind);
  function moverIndicador(){
    var sel = modos && modos.querySelector('button[aria-pressed="true"]');
    if(!sel){ ind.style.width = "0"; return; }
    ind.style.width = sel.offsetWidth + "px";
    ind.style.transform = "translateX(" + sel.offsetLeft + "px)";
  }

  // ---------- animação ao trocar de modo ----------
  var wrap = document.querySelector(".wrap");
  var timer = null;
  function animarEntrada(){
    if(!wrap) return;
    wrap.classList.remove("vn-entra");
    void wrap.offsetWidth;
    wrap.classList.add("vn-entra");
    clearTimeout(timer);
    timer = setTimeout(function(){ wrap.classList.remove("vn-entra"); }, 900);
  }
  if(modos){
    modos.addEventListener("click", function(e){
      if(e.target.closest("button[data-mode]")) requestAnimationFrame(function(){ moverIndicador(); animarEntrada(); });
    });
    new MutationObserver(moverIndicador).observe(modos, {subtree:true, attributes:true, attributeFilter:["aria-pressed"]});
  }

  // ---------- explicações fixas dos grupos de preços atrás do botão "?" ----------
  var grupos = document.querySelectorAll(".config-wrap .group");
  for(var i=0;i<grupos.length;i++){
    var g = grupos[i], h = g.querySelector(":scope > h3"), p = g.querySelector(":scope > p");
    if(!h || !p) continue;
    var linha = document.createElement("div");
    linha.className = "vn-cab";
    g.insertBefore(linha, h);
    linha.appendChild(h);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "vn-info";
    b.textContent = "?";
    b.setAttribute("aria-label", "Explicar: " + h.textContent.trim());
    b.setAttribute("aria-expanded", "false");
    linha.appendChild(b);
    p.classList.add("vn-fechada");
    (function(b, p){
      b.addEventListener("click", function(){
        var abrir = b.getAttribute("aria-expanded")!=="true";
        b.setAttribute("aria-expanded", String(abrir));
        p.classList.toggle("vn-fechada", !abrir);
        p.classList.toggle("vn-aberta", abrir);
      });
    })(b, p);
  }

  // ---------- preços e regras antes dos cards, sempre abertos ----------
  // A conta depende desses números, então eles ficam visíveis antes do resultado das rotas.
  var cfgWrap = document.querySelector(".config-wrap");
  var cfg = document.getElementById("cfg");
  var board = document.getElementById("board");
  if(cfgWrap && cfg && board){
    var resumo = cfg.querySelector(":scope > summary");
    var titulo = document.createElement("h2");
    titulo.className = "vn-cfg-titulo";
    titulo.textContent = resumo ? resumo.textContent.trim() : "";
    cfg.open = true;
    cfg.addEventListener("toggle", function(){ if(!cfg.open) cfg.open = true; });
    if(resumo) resumo.setAttribute("hidden", "");
    var grade = document.createElement("div");
    grade.className = "vn-grupos";
    var gs = cfg.querySelectorAll(":scope > .group");
    if(gs.length){ cfg.insertBefore(grade, gs[0]); for(var k=0;k<gs.length;k++) grade.appendChild(gs[k]); }
    cfgWrap.classList.add("vn-cfg");
    cfgWrap.insertBefore(titulo, cfg);
    board.parentNode.insertBefore(cfgWrap, board);
    // o resultado principal vem depois do que você preenche, junto dos cards
    var veredito = document.getElementById("verdict");
    if(veredito) board.parentNode.insertBefore(veredito, board);
  }

  // ---------- "Como a conta é feita" recolhido ----------
  var notas = document.querySelector(".notes");
  var tit = notas && notas.querySelector(":scope > h3");
  var lista = notas && notas.querySelector(":scope > ul");
  if(tit && lista){
    var d = document.createElement("details");
    d.className = "vn-como";
    var s = document.createElement("summary");
    notas.insertBefore(d, tit);
    s.appendChild(tit);
    d.appendChild(s);
    d.appendChild(lista);
  }

  window.addEventListener("resize", moverIndicador);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(moverIndicador);
  moverIndicador();
})();
