/* Campo de pokémon do time com busca, lista para escolher e imagem animada.
   A lista vem de /dados/pokedex.js (Pokédex da wiki oficial).
   Ao escolher, o nome é escrito no mesmo campo e o evento "input" avisa o planejador, como se a pessoa tivesse digitado.
   Ainda dá para digitar um nome que não está na lista. */
(function(){
  "use strict";
  var LISTA = window.PKA_POKEDEX || [];
  if(!LISTA.length) return;
  var ANIM = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/";
  var PEQ = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/";
  var WIKI = "https://wiki.pokealliance.com";
  var MAX = 8;

  function norm(t){ return String(t||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[’']/g,"").replace(/\s+/g," ").trim(); }
  var itens = LISTA.map(function(r){ return {nome:r[0], num:r[1], shiny:!!r[2], wiki:r[3], tier:r[4], k:norm(r[0])}; });
  var porNome = {}; itens.forEach(function(it){ if(!porNome[it.k]) porNome[it.k] = it; });

  // "sh charizard" e "s. charizard" também acham o shiny
  function consulta(t){ var q = norm(t); return q.replace(/^(sh|s\.)\s+/, "shiny "); }
  function achar(nome){ var q = consulta(nome); return porNome[q] || null; }

  function buscar(t){
    var q = consulta(t); if(!q) return [];
    var ini = [], meio = [];
    itens.forEach(function(it){
      var i = it.k.indexOf(q);
      if(i === 0 || it.k.indexOf("shiny " + q) === 0) ini.push(it);
      else if(i > 0 || String(it.num) === q) meio.push(it);
    });
    return ini.concat(meio).slice(0, MAX);
  }

  // imagem: animação do Pokémon Showdown (via PokeAPI); se falhar, a imagem da wiki oficial
  function imagem(it, peq){
    var img = new Image();
    img.alt = ""; img.decoding = "async";
    var fontes = [];
    if(peq) fontes.push(PEQ + (it.shiny ? "shiny/" : "") + it.num + ".png");
    else fontes.push(ANIM + (it.shiny ? "shiny/" : "") + it.num + ".gif");
    if(it.wiki) fontes.push(WIKI + it.wiki);
    var n = 0;
    img.onerror = function(){ n++; if(n < fontes.length) img.src = fontes[n]; else img.onerror = null; };
    img.src = fontes[0];
    return img;
  }

  function enfeitar(input){
    if(input.dataset.ep) return; input.dataset.ep = "1";
    var caixa = input.parentNode; caixa.classList.add("ep");
    var foto = document.createElement("span"); foto.className = "ep-foto"; foto.setAttribute("aria-hidden","true");
    caixa.insertBefore(foto, input);
    var lista = document.createElement("ul"); lista.className = "ep-lista"; lista.id = input.id + "-lista"; lista.setAttribute("role","listbox"); lista.hidden = true;
    lista.setAttribute("aria-label","Pokémons encontrados");
    caixa.appendChild(lista);
    input.setAttribute("role","combobox"); input.setAttribute("aria-autocomplete","list");
    input.setAttribute("aria-expanded","false"); input.setAttribute("aria-controls", lista.id);
    input.placeholder = "Digite para buscar o Pokémon";

    var achados = [], ativo = -1, ultimo = null;

    function pintarFoto(){
      var it = achar(input.value), chave = it ? it.k : (input.value.trim() ? "?" : "");
      if(chave === ultimo) return; ultimo = chave;
      foto.innerHTML = ""; foto.classList.remove("ep-desconhecido","ep-novo");
      if(it){ foto.appendChild(imagem(it, false)); void foto.offsetWidth; foto.classList.add("ep-novo"); }
      else { var v = document.createElement("span"); v.className = "ep-vazio"; foto.appendChild(v); if(chave) foto.classList.add("ep-desconhecido"); }
    }
    input._epPintar = pintarFoto;

    function fechar(){ lista.hidden = true; input.setAttribute("aria-expanded","false"); input.removeAttribute("aria-activedescendant"); ativo = -1; }
    function marcar(i){
      ativo = i;
      Array.prototype.forEach.call(lista.children, function(li, j){ if(li.getAttribute("role") === "option") li.setAttribute("aria-selected", String(j === i)); });
      var li = lista.children[i];
      if(li){ input.setAttribute("aria-activedescendant", li.id); li.scrollIntoView({block:"nearest"}); }
    }
    function abrir(){
      var t = input.value; achados = buscar(t);
      lista.innerHTML = "";
      if(!t.trim()){ fechar(); return; }
      if(!achados.length){
        var m = document.createElement("li"); m.className = "ep-msg"; m.textContent = "Nenhum Pokémon com esse nome na Pokédex da wiki. O nome digitado fica valendo assim mesmo.";
        lista.appendChild(m);
      }
      achados.forEach(function(it, j){
        var li = document.createElement("li"); li.className = "ep-op"; li.id = lista.id + "-" + j; li.setAttribute("role","option"); li.setAttribute("aria-selected","false");
        li.appendChild(imagem(it, true));
        var n = document.createElement("span"); n.className = "ep-n"; n.textContent = it.nome; li.appendChild(n);
        var tg = document.createElement("span"); tg.className = "ep-t" + (it.shiny ? " ep-sh" : "");
        tg.textContent = it.tier ? (/^\d+$/.test(it.tier) ? "Tier " + it.tier : it.tier) : (it.shiny ? "Shiny" : "");
        li.appendChild(tg);
        li.addEventListener("mousedown", function(ev){ ev.preventDefault(); escolher(it); });
        lista.appendChild(li);
      });
      lista.hidden = false; input.setAttribute("aria-expanded","true");
      marcar(achados.length ? 0 : -1);
    }
    function escolher(it){
      input.value = it.nome;
      input.dispatchEvent(new Event("input", {bubbles:true}));
      fechar(); pintarFoto();
    }

    input.addEventListener("input", function(ev){ pintarFoto(); if(ev.isTrusted !== false) abrir(); });
    input.addEventListener("focus", function(){ if(input.value.trim() && !achar(input.value)) abrir(); });
    input.addEventListener("blur", function(){ setTimeout(fechar, 120); });
    input.addEventListener("keydown", function(ev){
      if(lista.hidden){ if(ev.key === "ArrowDown" && input.value.trim()){ abrir(); ev.preventDefault(); } return; }
      if(ev.key === "ArrowDown"){ ev.preventDefault(); if(achados.length) marcar((ativo + 1) % achados.length); }
      else if(ev.key === "ArrowUp"){ ev.preventDefault(); if(achados.length) marcar((ativo - 1 + achados.length) % achados.length); }
      else if(ev.key === "Enter"){ if(ativo >= 0 && achados[ativo]){ ev.preventDefault(); escolher(achados[ativo]); } }
      else if(ev.key === "Escape"){ ev.preventDefault(); fechar(); }
      else if(ev.key === "Tab"){ fechar(); }
    });
    pintarFoto();
  }

  function enfeitarTodos(){
    var ins = document.querySelectorAll('#rows input[id^="nome-"]');
    Array.prototype.forEach.call(ins, enfeitar);
    return ins;
  }
  enfeitarTodos();
  // o nome também muda ao carregar dados salvos; confere de vez em quando para trocar a imagem
  setInterval(function(){ Array.prototype.forEach.call(enfeitarTodos(), function(i){ if(i._epPintar) i._epPintar(); }); }, 600);
})();
