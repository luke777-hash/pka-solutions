// Visual novo do PKA Hunt Analyzer: botão de tema, animação ao abrir e ao filtrar,
// e explicações fixas das seções atrás do botão "?".
// Não mexe em cálculo nem em dado: só em classes e elementos próprios (vn-*).
(function(){
  "use strict";
  var raiz = document.documentElement;
  var CHAVE_TEMA = "pkahub-tema"; // a mesma do hub, para a escolha valer no site todo

  // ---------- tema claro/escuro ----------
  function temaAtual(){
    if(raiz.dataset.theme==="dark") return "escuro";
    if(raiz.dataset.theme==="light") return "claro";
    try{ return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro"; }catch(e){ return "claro"; }
  }
  var SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  var LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
  var pill = document.getElementById("storePill");
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
  if(pill){
    var grupo = document.createElement("div");
    grupo.className = "vn-topo";
    pill.parentNode.insertBefore(grupo, pill);
    grupo.appendChild(pill);
    grupo.appendChild(btnTema);
    pintarBotao();
  }

  // ---------- explicações fixas das seções atrás do botão "?" ----------
  var linhas = document.querySelectorAll("main .h2row");
  for(var i=0;i<linhas.length;i++){
    var linha = linhas[i], h = linha.querySelector(":scope > h2"), dica = linha.querySelector(":scope > span.hint");
    if(!h || !dica || !(dica.textContent||"").trim()) continue;
    var cab = document.createElement("span");
    cab.className = "vn-cab";
    linha.insertBefore(cab, h);
    cab.appendChild(h);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "vn-info";
    b.textContent = "?";
    b.setAttribute("aria-label", "Explicar: " + h.textContent.trim());
    b.setAttribute("aria-expanded", "false");
    cab.appendChild(b);
    dica.classList.add("vn-fechada");
    (function(b, dica){
      b.addEventListener("click", function(){
        var abrir = b.getAttribute("aria-expanded")!=="true";
        b.setAttribute("aria-expanded", String(abrir));
        dica.classList.toggle("vn-fechada", !abrir);
        dica.classList.toggle("vn-aberta", abrir);
      });
    })(b, dica);
  }

  // ---------- animação ao abrir a página e ao trocar filtros ----------
  var main = document.querySelector("main");
  var timer = null;
  function animarEntrada(){
    if(!main) return;
    main.classList.remove("vn-entra");
    void main.offsetWidth;
    main.classList.add("vn-entra");
    clearTimeout(timer);
    timer = setTimeout(function(){ main.classList.remove("vn-entra"); }, 1000);
  }
  ["fPeriod","fChar","fTarget","metric"].forEach(function(id){
    var s = document.getElementById(id);
    if(s) s.addEventListener("change", function(){ requestAnimationFrame(animarEntrada); });
  });
  var btnImp = document.getElementById("btnImport");
  if(btnImp) btnImp.addEventListener("click", function(){ setTimeout(animarEntrada, 60); });
  requestAnimationFrame(animarEntrada);
})();
