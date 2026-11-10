// Barra de navegação do PKA-HUB, igual no hub e em todas as ferramentas.
// Fica no topo da página: marca PKA-HUB (volta ao início), as ferramentas, Apoiar e o tema.
// Para adicionar uma ferramenta: acrescente um item em FERRAMENTAS (e também em src/ferramentas.js, para o card do hub).
(function(){
  "use strict";
  var FERRAMENTAS = [
    { nome: "Planejador 2x2x2", endereco: "/planejador-2x2x2/", tema: "planejador" },
    { nome: "Mesa de câmbio", endereco: "/mesa-de-cambio/", tema: "mesa" },
    { nome: "PKA Hunt Analyzer", endereco: "/hunt-analyzer/", tema: "hunt" },
    { nome: "Pokelog para ATK 5", endereco: "/pokelog/", tema: "pokelog" }
  ];
  var CHAVE_TEMA = "pkahub-tema"; // a mesma do hub e das ferramentas
  var raiz = document.documentElement;
  var caminho = location.pathname;

  var SOL = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>';
  var LUA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/></svg>';
  var CORACAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20Z"/></svg>';
  var MENU = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  var MARCA = '<svg class="pkn-marca-icone" viewBox="0 0 24 24" aria-hidden="true">' +
    '<rect x="1" y="1" width="10" height="10" rx="2.5" class="pkn-c-planejador"/>' +
    '<rect x="13" y="1" width="10" height="10" rx="2.5" class="pkn-c-mesa"/>' +
    '<rect x="1" y="13" width="10" height="10" rx="2.5" class="pkn-c-hunt"/>' +
    '<rect x="13" y="13" width="10" height="10" rx="2.5" class="pkn-c-pokelog"/></svg>';

  function ativa(f){ return caminho === f.endereco || caminho.indexOf(f.endereco) === 0 || caminho + "/" === f.endereco; }

  var links = "";
  for(var i=0;i<FERRAMENTAS.length;i++){
    var f = FERRAMENTAS[i];
    links += '<li><a class="pkn-link pkn-t-' + f.tema + '" href="' + f.endereco + '"' + (ativa(f) ? ' aria-current="page"' : '') + '>' +
      '<span class="pkn-ponto" aria-hidden="true"></span>' + f.nome + '</a></li>';
  }

  var barra = document.createElement("header");
  barra.className = "pkn";
  barra.innerHTML =
    '<div class="pkn-dentro">' +
      '<a class="pkn-marca" href="/"' + (caminho === "/" || caminho === "/index.html" ? ' aria-current="page"' : '') + '>' + MARCA + '<span>PKA-HUB</span></a>' +
      '<div class="pkn-nav" role="navigation" aria-label="Ferramentas"><ul class="pkn-lista" id="pkn-lista">' + links + '</ul></div>' +
      '<div class="pkn-acoes">' +
        '<button type="button" class="pkn-botao pkn-apoiar" data-apoio="">' + CORACAO + '<span>Apoiar</span></button>' +
        '<button type="button" class="pkn-botao pkn-tema"></button>' +
        '<button type="button" class="pkn-botao pkn-menu" aria-expanded="false" aria-controls="pkn-lista">' + MENU + '<span>Ferramentas</span></button>' +
      '</div>' +
    '</div>';

  var aqui = document.currentScript;
  if(aqui && aqui.parentNode) aqui.parentNode.insertBefore(barra, aqui);
  else document.body.insertBefore(barra, document.body.firstChild);

  // ---------- tema claro/escuro ----------
  var bTema = barra.querySelector(".pkn-tema");
  function temaAtual(){
    if(raiz.dataset.theme === "dark") return "escuro";
    if(raiz.dataset.theme === "light") return "claro";
    try{ return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro"; }catch(e){ return "claro"; }
  }
  function pintarTema(){
    var t = temaAtual(), prox = t === "escuro" ? "claro" : "escuro";
    bTema.innerHTML = (t === "escuro" ? SOL : LUA) + "<span>" + (t === "escuro" ? "Escuro" : "Claro") + "</span>";
    bTema.setAttribute("aria-label", "Mudar para o tema " + prox);
    bTema.title = "Mudar para o tema " + prox;
  }
  bTema.addEventListener("click", function(){
    var novo = temaAtual() === "escuro" ? "claro" : "escuro";
    raiz.dataset.theme = novo === "escuro" ? "dark" : "light";
    try{ localStorage.setItem(CHAVE_TEMA, novo); }catch(e){}
    pintarTema();
  });
  pintarTema();

  // ---------- menu das ferramentas em telas estreitas ----------
  var bMenu = barra.querySelector(".pkn-menu");
  function abrirMenu(abrir){
    bMenu.setAttribute("aria-expanded", String(abrir));
    barra.classList.toggle("pkn-aberta", abrir);
  }
  bMenu.addEventListener("click", function(){ abrirMenu(bMenu.getAttribute("aria-expanded") !== "true"); });
  document.addEventListener("click", function(e){ if(!barra.contains(e.target)) abrirMenu(false); });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape" && barra.classList.contains("pkn-aberta")){ abrirMenu(false); bMenu.focus(); } });
})();
