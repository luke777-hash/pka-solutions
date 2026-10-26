// Visual novo do Planejador 2x2x2: botão de tema, indicador dos passos, animação ao trocar de passo
// e descrições dos painéis atrás do botão "?". Não mexe em cálculo nem em dado: só em classes e botões próprios (vn-*).
(function(){
  "use strict";
  var raiz = document.documentElement;
  var main = document.querySelector("main");
  var CHAVE_TEMA = "pkahub-tema"; // a mesma do hub, para a escolha valer no site todo

  // ---------- tema claro/escuro ----------
  function temaAtual(){
    if(raiz.dataset.theme==="dark") return "escuro";
    if(raiz.dataset.theme==="light") return "claro";
    try{ return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro"; }catch(e){ return "claro"; }
  }
  var SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  var LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
  var btnDados = document.querySelector('.topbar [data-act="dados"]');
  var btnTema = document.createElement("button");
  btnTema.type = "button";
  btnTema.className = "btn vn-tema";
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
  if(btnDados){
    // "Salvar / carregar" e o tema ficam juntos no canto do topo
    var acoes = document.createElement("div");
    acoes.className = "vn-acoes";
    btnDados.parentNode.insertBefore(acoes, btnDados);
    acoes.appendChild(btnDados);
    acoes.appendChild(btnTema);
    pintarBotao();
  }

  // ---------- indicador que desliza sob o passo escolhido ----------
  var nav = document.querySelector(".steps");
  var ind = document.createElement("span");
  ind.className = "vn-ind";
  ind.setAttribute("aria-hidden", "true");
  if(nav) nav.appendChild(ind);
  function moverIndicador(){
    var sel = nav && nav.querySelector('.step[aria-selected="true"]');
    if(!sel){ ind.style.width = "0"; return; }
    ind.style.width = sel.offsetWidth + "px";
    ind.style.transform = "translateX(" + sel.offsetLeft + "px)";
  }

  // ---------- animação ao trocar de passo ----------
  var ultimo = null, timer = null;
  function aoTrocarPasso(){
    var aberto = main && main.querySelector('[role="tabpanel"]:not([hidden])');
    moverIndicador();
    if(!aberto || aberto===ultimo) return;
    var primeira = ultimo===null;
    ultimo = aberto;
    if(primeira) return; // na primeira abertura a página já aparece pronta
    aberto.classList.remove("vn-entra");
    void aberto.offsetWidth;
    aberto.classList.add("vn-entra");
    clearTimeout(timer);
    timer = setTimeout(function(){ aberto.classList.remove("vn-entra"); }, 900);
  }

  // ---------- descrições dos painéis atrás do botão "?" ----------
  // Só esconde as explicações fixas de cada painel (lista abaixo). Avisos, pendências e resultados continuam visíveis.
  var EXPLICACOES = [
    "Nome, função na rotação e dano total do combo",
    "A numeração é a ordem de uso",
    "Cada coluna é um Lurer",
    "Valores em gold aceitam",
    "Preço de cada tier.",
    "O guia mostra só o total de 0 a 5 Stars",
    "Como o planejador conta as stones",
    "O custo por stone é o menor",
    "Escolha como ele ficaria",
    "O plano usa o dano atual deles",
    "Para subir de hazard, as 3 duplas",
    "Quanto cada melhoria dá sozinha",
    "Escolha de qual boost até qual boost"
  ];
  var abertas = {};
  function ehExplicacao(p){
    var t = (p.textContent || "").trim();
    for(var i=0;i<EXPLICACOES.length;i++) if(t.indexOf(EXPLICACOES[i])===0) return true;
    return false;
  }
  function prepararDescricoes(){
    var subs = main.querySelectorAll(".panel-sub:not([data-vn])");
    for(var i=0;i<subs.length;i++){
      var p = subs[i];
      p.setAttribute("data-vn", "1");
      if(!ehExplicacao(p)) continue;
      var caixa = p.parentElement, h = caixa && caixa.querySelector("h2");
      if(!h || h.parentElement!==caixa) continue;
      var chave = h.textContent.trim();
      caixa.classList.add("vn-cab");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vn-info";
      b.textContent = "?";
      b.setAttribute("aria-label", "Explicar: " + chave);
      b.setAttribute("data-vn-chave", chave);
      var aberta = !!abertas[chave];
      b.setAttribute("aria-expanded", String(aberta));
      p.classList.add(aberta ? "vn-aberta" : "vn-fechada");
      h.insertAdjacentElement("afterend", b);
    }
  }
  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest(".vn-info");
    if(!b) return;
    var chave = b.getAttribute("data-vn-chave");
    var p = b.parentElement.querySelector(".panel-sub");
    var abrir = b.getAttribute("aria-expanded")!=="true";
    abertas[chave] = abrir;
    b.setAttribute("aria-expanded", String(abrir));
    if(p){ p.classList.toggle("vn-fechada", !abrir); p.classList.toggle("vn-aberta", abrir); }
  });

  // ---------- textos que só repetem o valor digitado ----------
  // Ex.: "= 237.000", "= 140 kk", "não informado". Aparecem quando o campo está em uso.
  var REPETE = /^(=\s*[\d.,]+\s*(kk|k)?|não informado)$/i;
  function prepararEcos(){
    var ecos = main.querySelectorAll(".echo");
    for(var i=0;i<ecos.length;i++){
      var e = ecos[i], t = (e.textContent || "").trim();
      var repete = REPETE.test(t) && !e.classList.contains("bad");
      if(repete!==e.classList.contains("vn-eco")) e.classList.toggle("vn-eco", repete);
    }
  }

  // ---------- acompanha o que o planejador desenha ----------
  var agendado = false;
  function atualizar(){
    agendado = false;
    prepararDescricoes();
    prepararEcos();
    aoTrocarPasso();
  }
  function agendar(){ if(!agendado){ agendado = true; requestAnimationFrame(atualizar); } }
  if(main){
    new MutationObserver(agendar).observe(main, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:["hidden","class"]});
  }
  if(nav){
    new MutationObserver(agendar).observe(nav, {subtree:true, attributes:true, attributeFilter:["aria-selected"]});
  }
  window.addEventListener("resize", moverIndicador);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(moverIndicador);
  atualizar();
})();
