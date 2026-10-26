// Janela "Apoie o PKA-HUB", usada pelo hub e pelas ferramentas.
// - No hub, abre sozinha na primeira visita de cada sessão, até a pessoa escolher "Não mostrar novamente".
// - Depois do "Não mostrar novamente", o botão Apoiar ganha um brilho discreto (sem cobrir nada).
// - Qualquer elemento com data-apoio abre a janela.
(function(){
  "use strict";
  var DADOS = {
    chave: "f68a5b78-50dd-449a-9407-e10dfcd926da",
    banco: "Itaú",
    player: "Luke Drk",
    servidor: "Sun",
    titular: "Lucas Feitosa"
  };
  var CHAVE_NAO_MOSTRAR = "pkahub-apoio-nao-mostrar";
  var CHAVE_SESSAO = "pkahub-apoio-visto";
  var raiz = document.documentElement;

  function ler(st, k){ try{ return st.getItem(k); }catch(e){ return null; } }
  function gravar(st, k, v){ try{ st.setItem(k, v); }catch(e){} }

  var naoMostrar = ler(window.localStorage, CHAVE_NAO_MOSTRAR) === "1";
  if(naoMostrar) raiz.classList.add("pa-lembrar");

  var CORACAO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20Z"/></svg>';

  var dlg = null, msg = null;
  function montar(){
    if(dlg) return dlg;
    dlg = document.createElement("dialog");
    dlg.className = "pa-janela";
    dlg.setAttribute("aria-labelledby", "pa-titulo");
    dlg.innerHTML =
      '<div class="pa-dentro">' +
        '<button type="button" class="pa-x" data-pa="fechar" aria-label="Fechar">✕</button>' +
        '<span class="pa-icone">' + CORACAO + '</span>' +
        '<h2 id="pa-titulo">Apoie o PKA-HUB</h2>' +
        '<p class="pa-texto">O hub é gratuito. Se ele te ajuda no jogo, você pode apoiar com qualquer valor pelo Pix.</p>' +
        '<label class="pa-rotulo" for="pa-chave">Chave Pix (' + DADOS.banco + ')</label>' +
        '<div class="pa-linha"><input id="pa-chave" type="text" readonly value="' + DADOS.chave + '"><button type="button" class="pa-copiar" data-pa="copiar" autofocus>Copiar</button></div>' +
        '<p class="pa-quem">Feito por <b>' + DADOS.player + '</b> · Servidor ' + DADOS.servidor + '</p>' +
        '<p class="pa-titular">No app do banco, o Pix aparece em nome de ' + DADOS.titular + '.</p>' +
        '<p class="pa-msg" aria-live="polite"></p>' +
        '<div class="pa-acoes">' +
          '<button type="button" class="pa-nao" data-pa="nao-mostrar">Não mostrar novamente</button>' +
          '<button type="button" class="pa-fechar" data-pa="fechar">Fechar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(dlg);
    msg = dlg.querySelector(".pa-msg");
    dlg.addEventListener("click", function(e){
      if(e.target === dlg){ fechar(); return; }
      var b = e.target.closest("[data-pa]"); if(!b) return;
      var a = b.getAttribute("data-pa");
      if(a === "fechar") fechar();
      else if(a === "nao-mostrar"){ gravar(window.localStorage, CHAVE_NAO_MOSTRAR, "1"); raiz.classList.add("pa-lembrar"); fechar(); }
      else if(a === "copiar") copiar(b);
    });
    dlg.querySelector("#pa-chave").addEventListener("focus", function(){ this.select(); });
    return dlg;
  }
  function abrir(){
    var d = montar();
    msg.textContent = "";
    var bc = d.querySelector(".pa-copiar"); bc.textContent = "Copiar";
    // "Não mostrar novamente" só faz sentido enquanto a janela abre sozinha
    d.querySelector(".pa-nao").hidden = ler(window.localStorage, CHAVE_NAO_MOSTRAR) === "1";
    if(typeof d.showModal === "function"){ try{ d.showModal(); }catch(e){ d.setAttribute("open", ""); } }
    else d.setAttribute("open", "");
  }
  function fechar(){ if(!dlg) return; if(typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); }
  function copiar(b){
    var campo = dlg.querySelector("#pa-chave");
    function ok(){ b.textContent = "Copiada"; msg.textContent = "Chave copiada. Obrigado pelo apoio!"; }
    function manual(){ campo.focus(); campo.select(); msg.textContent = "Selecionei a chave: copie com Ctrl+C."; }
    try{ navigator.clipboard.writeText(DADOS.chave).then(ok, manual); }catch(e){ manual(); }
  }

  // botão Apoiar na faixa "← Todas as ferramentas" das ferramentas
  var faixa = document.querySelector(".pkahub-volta");
  if(faixa && !faixa.querySelector("[data-apoio]")){
    faixa.classList.add("pa-faixa");
    var bt = document.createElement("button");
    bt.type = "button";
    bt.className = "pkahub-botao pa-botao";
    bt.setAttribute("data-apoio", "");
    bt.innerHTML = CORACAO + "<span>Apoiar</span>";
    faixa.appendChild(bt);
  }

  document.addEventListener("click", function(e){
    var b = e.target.closest && e.target.closest("[data-apoio]");
    if(b){ e.preventDefault(); abrir(); }
  });

  window.pkahubApoio = { abrir: abrir };

  // no hub, abre sozinha uma vez por sessão
  var noHub = location.pathname === "/" || location.pathname === "/index.html";
  if(noHub && !naoMostrar && ler(window.sessionStorage, CHAVE_SESSAO) !== "1"){
    gravar(window.sessionStorage, CHAVE_SESSAO, "1");
    setTimeout(abrir, 600);
  }
})();
