// Página da Gestão da Guild (fica fora do HTML para a CSP poder proibir scripts embutidos)
(function(){
  "use strict";
  var G = window.PKA_GUILD;
  var $ = function(id){ return document.getElementById(id); };

  // ---------- guardar ----------
  var dados = { imports: [], cfg: {} };
  // lê só o que é do próprio objeto (um membro chamado "constructor" não pode quebrar a página)
  function de(o, k){ return o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined; }
  function padraoCfg(){ return { metaPontos: null, metaContrib: null, regra: "todas", diasInativo: 3, saldo: null, isentos: {}, discord: {}, hookNome: "", alertaAuto: true, guild: "" }; }
  function lsLer(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsGravar(k, v){ try{ if(v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); }catch(e){} }

  // os dados ficam no servidor, compartilhados entre os admins da guild; modo "nuvem" = logado
  var CHAVE_SESSAO = "pka-guild-sessao";
  var sessao = null;
  try{ sessao = JSON.parse(lsLer(CHAVE_SESSAO) || "null"); }catch(e){}
  var modo = sessao && sessao.token ? "nuvem" : null;
  var hookInfo = { configurado: false };
  dados.cfg = padraoCfg();
  // limpa o que o antigo modo "só neste navegador" deixou guardado
  ["pka-guild-v1", "pka-guild-webhook", "pka-guild-modo"].forEach(function(k){ lsGravar(k, null); });

  function api(acao, extra){
    var corpo = Object.assign({ acao: acao, token: sessao ? sessao.token : "" }, extra || {});
    return fetch("/api/guild", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) })
      .then(function(r){
        return r.json().catch(function(){ return { erro: "O servidor não respondeu direito. Tente de novo." }; }).then(function(j){
          if(r.status === 401 && acao !== "entrar" && acao !== "criar"){ sairNuvem(j.erro); throw new Error(j.erro); }
          if(!r.ok){ var er = new Error(j.erro || "Erro " + r.status); er.naoAchou = r.status === 404; throw er; }
          return j;
        });
      }, function(){ throw new Error("Sem conexão com o servidor do PKA-HUB."); });
  }
  function aplicarRemoto(j){
    var g = dados.cfg.guild;
    dados.imports = (j.dados && j.dados.imports) || [];
    dados.cfg = Object.assign(padraoCfg(), (j.dados && j.dados.cfg) || {});
    dados.cfg.guild = g || lsLer("pka-guild-sel") || "";
    hookInfo = j.hook || { configurado: false };
    ultimoAlertaAuto = j.ultimoAlertaAuto || null;
    pintarDesfazer(j.desfazer || null);
  }
  // o servidor guarda por 7 dias como estava antes da última mudança grande (apagar ou restaurar)
  function pintarDesfazer(d){
    var box = $("desfazerBox"); if(!box) return;
    box.hidden = !d; $("desfazerVazio").hidden = !d;
    if(!d) return;
    var em = new Date(d.em);
    $("btnDesfazer").textContent = "Desfazer: " + String(d.acao || "última mudança");
    $("btnDesfazer2").textContent = $("btnDesfazer").textContent;
    $("desfazerTxt").className = "status";
    $("desfazerTxt").textContent = isNaN(em) ? "" : "feito em " + em.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  var ultimoAlertaAuto = null;
  var tCfg = null;
  function salvar(){
    lsGravar("pka-guild-sel", dados.cfg.guild || "");
    clearTimeout(tCfg);
    tCfg = setTimeout(function(){
      api("cfg", { cfg: dados.cfg }).catch(function(e){ var st = $("impStatus"); st.className = "status erro"; st.textContent = "Não salvou os ajustes: " + e.message; });
    }, 400);
  }
  // muda as importações no servidor e redesenha
  function mudarImports(acao, extra){
    return api(acao, extra).then(function(j){ aplicarRemoto(j); tudo(); return true; })
      .catch(function(e){ var st = $("impStatus"); st.className = "status erro"; st.textContent = e.message; return false; });
  }
  function sairNuvem(msg){
    if(sessao) api("sair").catch(function(){});
    sessao = null; lsGravar(CHAVE_SESSAO, null); modo = null;
    dados = { imports: [], cfg: padraoCfg() }; hookInfo = { configurado: false };
    pintarDesfazer(null);
    tudo();
    if(msg){ $("eStatus").className = "status erro"; $("eStatus").textContent = msg; }
  }

  // ---------- formatos ----------
  var nf = new Intl.NumberFormat("pt-BR");
  function n(v){ return nf.format(v); }
  function din(v){ return (v < 0 ? "-$" : "$") + nf.format(Math.abs(v)); }
  function esc(s){ return String(s).replace(/[&<>"']/g, function(c){ return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function dm(d){ return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0"); }
  function dmh(d){ return dm(d) + " " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function cargo(r){ return String(r || "").replace(/^(the|a|an)\s+/i, ""); }
  function inteiro(v){ var s = String(v == null ? "" : v).trim(); if(!s) return null; var x = G.lerInteiro(s); return x > 0 ? x : null; }
  function valor(v){ var x = G.lerValor(v); return x > 0 ? x : null; }
  function plural(q, um, varios){ return n(q) + " " + (q === 1 ? um : varios); }
  function textoDailies(falta){
    var c = G.comoCompletar(falta);
    var op = [plural(c.primal, "Primal", "Primal"), plural(c.wildscape, "Wildscape", "Wildscape"), plural(c.normal, "Normal", "Normal")];
    return op.join(" ou ");
  }
  function textoSaldo(falta){
    var c = G.comoCompletarSaldo(falta);
    return n(c.primal) + " Primal ou " + n(c.wildscape) + " Wildscape ou " + n(c.normal) + " Normal; ou " +
      plural(c.diamondDoacoes, "doação", "doações") + " em diamond (" + plural(c.diamonds, "diamond", "diamonds") + " no mesmo dia); ou " +
      n(c.dolar) + "× $100k" + (c.dolarDias > 1 ? " (" + c.dolarDias + " dias)" : "");
  }

  // ---------- guild e semanas ----------
  function guilds(){
    var l = [];
    dados.imports.forEach(function(im){ if(l.indexOf(im.guild) < 0) l.push(im.guild); });
    return l;
  }
  function guildAtual(){
    var l = guilds();
    if(l.indexOf(dados.cfg.guild) >= 0) return dados.cfg.guild;
    return l.length ? l[l.length - 1] : "";
  }
  function importsDaGuild(){ var g = guildAtual(); return dados.imports.filter(function(im){ return im.guild === g; }); }
  function semanas(){
    var l = [];
    importsDaGuild().forEach(function(im){ var d = G.lerDataExport(im.exportedAt); if(d){ var k = G.chaveSemana(d); if(l.indexOf(k) < 0) l.push(k); } });
    return l.sort().reverse();
  }
  var semanaSel = null;

  // ---------- importar ----------
  function dataLocal(ms){
    var d = new Date(ms), p = function(x){ return String(x).padStart(2, "0"); };
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }
  function importar(arquivos){
    var st = $("impStatus"); st.className = "status"; st.textContent = "Lendo…";
    var ok = 0, erros = [], novas = [];
    Promise.all(arquivos.map(function(f){
      return f.text().then(function(t){
        try{
          var im = G.lerArquivo(f.name, t);
          if(!im.exportedAt) im.exportedAt = dataLocal(f.lastModified || Date.now());
          if(!im.guild) im.guild = guildAtual() || "Minha guild";
          if(!im.members.length) throw new Error("nenhum membro");
          novas.push(im); ok++;
        }catch(e){ erros.push(f.name + " (" + e.message + ")"); }
      });
    })).then(function(){
      if(novas.length){
        dados.cfg.guild = novas[novas.length - 1].guild;
        lsGravar("pka-guild-sel", dados.cfg.guild);
        var d = G.lerDataExport(novas[novas.length - 1].exportedAt);
        semanaSel = d ? G.chaveSemana(d) : null;
      }
      var fim = function(salvou){
        st.className = "status" + (erros.length || !salvou ? " erro" : "");
        if(salvou) st.textContent = (ok ? plural(ok, "arquivo importado", "arquivos importados") : "") + (erros.length ? (ok ? ". " : "") + "Não deu para ler: " + erros.join(", ") : "");
      };
      if(!novas.length){ fim(true); return; }
      st.textContent = "Enviando…";
      var maisNova = novas.reduce(function(a, b){ return a.exportedAt > b.exportedAt ? a : b; }).exportedAt;
      var eraAMaisNova = dados.imports.every(function(x){ return x.exportedAt <= maisNova; });
      mudarImports("importar", { imports: novas }).then(function(salvou){
        fim(salvou);
        if(salvou && eraAMaisNova) alertaAutomatico();
      });
    });
  }
  $("arquivo").addEventListener("change", function(e){ var fs = [].slice.call(e.target.files || []); if(fs.length) importar(fs); e.target.value = ""; });
  $("btnImport").addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); $("arquivo").click(); } });
  $("drop").addEventListener("click", function(){ $("arquivo").click(); });
  $("drop").addEventListener("keydown", function(e){ if(e.key === "Enter" || e.key === " "){ e.preventDefault(); $("arquivo").click(); } });
  var arrastos = 0;
  document.addEventListener("dragenter", function(e){ e.preventDefault(); arrastos++; document.body.classList.add("arrastando"); });
  document.addEventListener("dragleave", function(){ arrastos = Math.max(0, arrastos - 1); if(!arrastos) document.body.classList.remove("arrastando"); });
  document.addEventListener("dragover", function(e){ e.preventDefault(); });
  document.addEventListener("drop", function(e){
    e.preventDefault(); arrastos = 0; document.body.classList.remove("arrastando");
    var fs = [].slice.call((e.dataTransfer && e.dataTransfer.files) || []); if(fs.length) importar(fs);
  });

  // ---------- conta da semana ----------
  var semana = null; // resultado da semana escolhida
  function metas(){ return { pontos: dados.cfg.metaPontos, contrib: dados.cfg.metaContrib, regra: dados.cfg.regra }; }
  function temMeta(){ return dados.cfg.metaPontos > 0 || dados.cfg.metaContrib > 0; }
  function calcular(){
    // o jogo zera pontos e contribuição no server save de segunda: vale o número da última importação da semana
    var r = G.valoresDaSemana(importsDaGuild(), semanaSel, { pontos: "zera", contrib: "zera" });
    if(!r) return null;
    var fr = G.fracaoSemana(r.ultima), mt = metas();
    r.fracao = fr;
    // ritmo: espera a parte da meta dos dias que já fecharam (no 1º dia ninguém está atrasado)
    r.diasFechados = Math.floor(fr * 7);
    r.membros.forEach(function(m){
      m.isento = de(dados.cfg.isentos, m.name) === true;
      var a = G.avaliar(m, mt, r.diasFechados / 7);
      m.situacao = m.isento ? "isento" : a.situacao;
      m.faltaPontos = a.faltaPontos; m.faltaContrib = a.faltaContrib;
      m.online = m.status === "online";
      m.dias = m.online ? 0 : G.diasDesde(m.lastLogin, r.ultima);
    });
    return r;
  }

  // ---------- faixa ----------
  function pintarFaixa(){
    var sel = $("selSemana"), ws = semanas();
    sel.innerHTML = ws.map(function(k){
      var p = k.split("-"), ini = new Date(+p[0], +p[1] - 1, +p[2]), fim = new Date(ini); fim.setDate(fim.getDate() + 6);
      return '<option value="' + k + '"' + (k === semanaSel ? " selected" : "") + ">" + dm(ini) + " a " + dm(fim) + "</option>";
    }).join("");
    var info = [];
    var gs = guilds();
    info.push("Guild <b>" + esc(guildAtual()) + "</b>" + (gs.length > 1 ? ' <button class="btn peq" id="trocaGuild">trocar</button>' : ""));
    info.push("<b>" + semana.membros.length + "</b> membros");
    info.push("<b>" + semana.importacoes + "</b> " + (semana.importacoes === 1 ? "importação" : "importações") + " na semana");
    var dia = Math.min(7, Math.floor(semana.fracao * 7) + 1);
    info.push("Dia <b>" + dia + "</b> de 7");
    pintarUltima();
    $("faixaInfo").innerHTML = info.map(function(t){ return "<span>" + t + "</span>"; }).join("");
    $("faixaBarra").style.width = (semana.fracao * 100).toFixed(1) + "%";
    var tg = $("trocaGuild");
    if(tg) tg.addEventListener("click", function(){
      var l = guilds(), i = l.indexOf(guildAtual());
      dados.cfg.guild = l[(i + 1) % l.length]; semanaSel = null; salvar(); tudo();
    });
  }
  // destaque de quando foi a última importação (de qualquer semana) e há quanto tempo
  function pintarUltima(){
    var ims = importsDaGuild(), ult = null;
    ims.forEach(function(im){ var d = G.lerDataExport(im.exportedAt); if(d && (!ult || d > ult)) ult = d; });
    if(!ult) return;
    var horas = (Date.now() - ult) / 3600000;
    $("ultData").textContent = dm(ult) + " às " + String(ult.getHours()).padStart(2, "0") + ":" + String(ult.getMinutes()).padStart(2, "0");
    $("ultIdade").textContent = horas < 1 ? "há menos de 1 hora" : horas < 48 ? "há " + Math.floor(horas) + (Math.floor(horas) === 1 ? " hora" : " horas") : "há " + Math.floor(horas / 24) + " dias";
    $("ultima").classList.toggle("velha", horas >= 12);
  }
  $("ultImportar").addEventListener("click", function(){ $("arquivo").click(); });
  setInterval(function(){ if(!$("comDados").hidden) pintarUltima(); }, 60000);
  $("selSemana").addEventListener("change", function(e){ semanaSel = e.target.value; tudo(); });

  // ---------- painel ----------
  var filtroSit = "todos";
  var SIT = { bateu: ["ok", "Bateu"], caminho: ["vai", "No caminho"], abaixo: ["mal", "Abaixo"], isento: ["neutro", "Isento"] };
  var ORD_SIT = { abaixo: 0, caminho: 1, bateu: 2, isento: 3 };

  function textoFalta(m){
    var p = [];
    if(m.faltaPontos > 0) p.push("Faltam " + plural(m.faltaPontos, "ponto", "pontos") + ": " + textoDailies(m.faltaPontos));
    if(m.faltaContrib > 0) p.push("Faltam " + din(m.faltaContrib) + " de contribuição: " + textoSaldo(m.faltaContrib));
    return p.join(". ");
  }
  function pintarPainel(){
    var mt = metas(), ms = semana.membros;
    $("avisoMeta").hidden = temMeta();
    var semBase = ms.filter(function(m){ return m.semBase; }).length;
    $("avisoBase").hidden = !semBase;
    if(semBase) $("avisoBaseTxt").innerHTML = "Os números acumulam e não há importação da semana anterior para " + plural(semBase, "membro", "membros") + ". Para " + (semBase === 1 ? "ele" : "eles") + " a semana conta a partir da primeira importação desta semana.";
    var c = { bateu: 0, caminho: 0, abaixo: 0, isento: 0 }, tp = 0, tc = 0;
    ms.forEach(function(m){ if(m.situacao) c[m.situacao]++; tp += m.pontos; tc += m.contrib; });
    var tiles = [];
    if(temMeta()){
      tiles.push(["abaixo", "mal", "Abaixo", c.abaixo], ["caminho", "vai", "No caminho", c.caminho], ["bateu", "ok", "Bateram", c.bateu], ["isento", "", "Isentos", c.isento]);
    } else {
      tiles.push(["todos", "", "Membros", ms.length], ["isento", "", "Isentos", c.isento]);
    }
    var html = tiles.map(function(t){
      return '<button class="tile ' + t[1] + '" data-f="' + t[0] + '" aria-pressed="' + (filtroSit === t[0]) + '"><span class="r">' + t[2] + '</span><span class="v num">' + t[3] + "</span></button>";
    }).join("");
    html += '<div class="tile"><span class="r">Pontos da guild</span><span class="v num">' + n(tp) + "</span></div>";
    html += '<div class="tile"><span class="r">Contribuição</span><span class="v num">' + din(tc) + "</span></div>";
    var tl = $("tiles"); tl.innerHTML = html;
    tl.style.setProperty("--cols", tiles.length + 2);
    [].forEach.call(tl.querySelectorAll("button.tile"), function(b){
      b.addEventListener("click", function(){ filtroSit = filtroSit === b.dataset.f ? "todos" : b.dataset.f; pintarPainel(); });
    });

    var busca = semAcento($("busca").value.trim()), ord = $("ordem").value;
    var lista = ms.filter(function(m){
      if(filtroSit !== "todos" && m.situacao !== filtroSit) return false;
      return !busca || semAcento(m.name).indexOf(busca) >= 0;
    });
    lista.sort(function(a, b){
      if(ord === "pontos") return b.pontos - a.pontos || b.contrib - a.contrib;
      if(ord === "contrib") return b.contrib - a.contrib || b.pontos - a.pontos;
      if(ord === "nome") return a.name.localeCompare(b.name, "pt-BR");
      var sa = a.situacao ? ORD_SIT[a.situacao] : 9, sb = b.situacao ? ORD_SIT[b.situacao] : 9;
      return sa - sb || (a.pontos - b.pontos) || (a.contrib - b.contrib) || a.name.localeCompare(b.name, "pt-BR");
    });
    var h = '<div class="linha cab"><span>Membro</span><span>Pontos</span><span>Contribuição</span><span>Situação</span></div>';
    if(!lista.length) h += '<div class="vazio">Ninguém aqui.</div>';
    lista.forEach(function(m){
      var pP = mt.pontos > 0 ? Math.min(100, m.pontos / mt.pontos * 100) : null;
      var pC = mt.contrib > 0 ? Math.min(100, m.contrib / mt.contrib * 100) : null;
      var sit = m.situacao ? SIT[m.situacao] : null;
      h += '<div class="linha' + (m.isento ? " isento" : "") + '">' +
        '<div class="membro"><b>' + esc(m.name) + "</b><span>" + esc(cargo(m.rank)) + " · nv. " + n(m.level) + "</span></div>" +
        '<div><span class="rot">Pontos</span><span class="val num">' + n(m.pontos) + (mt.pontos > 0 ? " <small>de " + n(mt.pontos) + "</small>" : "") + "</span>" +
          (pP !== null ? '<div class="mini"><i style="width:' + pP + '%"></i></div>' : "") +
          (m.dPontos ? '<span class="delta">+' + n(m.dPontos) + " desde " + dmh(semana.anterior) + "</span>" : "") + "</div>" +
        '<div><span class="rot">Contribuição</span><span class="val num">' + din(m.contrib) + (mt.contrib > 0 ? " <small>de " + din(mt.contrib) + "</small>" : "") + "</span>" +
          (pC !== null ? '<div class="mini"><i style="width:' + pC + '%"></i></div>' : "") +
          (m.dContrib ? '<span class="delta">+' + din(m.dContrib) + " desde " + dmh(semana.anterior) + "</span>" : "") + "</div>" +
        '<div class="sit">' + (sit ? '<span class="chip ' + sit[0] + '">' + sit[1] + "</span>" : '<span class="chip neutro">Sem meta</span>') +
          (m.situacao === "abaixo" || m.situacao === "caminho" ? '<span class="falta">' + esc(textoFalta(m)) + "</span>" : "") + "</div>" +
      "</div>";
    });
    $("lista").innerHTML = h;
  }
  function semAcento(s){ return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  $("busca").addEventListener("input", function(){ pintarPainel(); });
  $("ordem").addEventListener("change", function(){ pintarPainel(); });

  // ---------- cobrança ----------
  var tipoCob = "abaixo", desmarcados = {}, textoEditado = false;
  function listaCob(tipo){
    var ms = semana.membros.filter(function(m){ return !m.isento; });
    if(tipo === "abaixo") return ms.filter(function(m){ return m.situacao === "abaixo"; });
    if(tipo === "naobateu") return ms.filter(function(m){ return m.situacao === "abaixo" || m.situacao === "caminho"; });
    var lim = dados.cfg.diasInativo || 3;
    return ms.filter(function(m){ return !m.online && m.dias != null && m.dias >= lim; }).sort(function(a, b){ return b.dias - a.dias; });
  }
  function textoMeta(){
    var p = [];
    if(dados.cfg.metaPontos > 0) p.push(plural(dados.cfg.metaPontos, "ponto", "pontos"));
    if(dados.cfg.metaContrib > 0) p.push(din(dados.cfg.metaContrib) + " de contribuição");
    return p.join(dados.cfg.regra === "qualquer" ? " ou " : " e ");
  }
  function intervaloSemana(){
    var ini = G.inicioSemana(semana.ultima), fim = new Date(ini); fim.setDate(fim.getDate() + 6);
    return dm(ini) + " a " + dm(fim);
  }
  function marcacao(m){ var id = String(de(dados.cfg.discord, m.name) || "").trim(); return G.idDiscordValido(id) ? " <@" + id + ">" : ""; }
  function linhaMembro(m, tipo){
    if(tipo === "inativos") return "• **" + m.name + "**" + marcacao(m) + " · último acesso " + m.lastLogin.slice(0, 16) + " (" + plural(Math.floor(m.dias), "dia", "dias") + ")";
    var p = [];
    if(dados.cfg.metaPontos > 0) p.push(n(m.pontos) + "/" + n(dados.cfg.metaPontos) + " pontos" + (m.faltaPontos > 0 ? " (faltam " + n(m.faltaPontos) + ": " + textoDailies(m.faltaPontos) + ")" : ""));
    if(dados.cfg.metaContrib > 0) p.push(din(m.contrib) + " de " + din(dados.cfg.metaContrib) + (m.faltaContrib > 0 ? " (faltam " + din(m.faltaContrib) + ": " + textoSaldo(m.faltaContrib) + ")" : ""));
    return "• **" + m.name + "**" + marcacao(m) + " · " + p.join(" · ");
  }
  function gerarTexto(){
    var sel = listaCob(tipoCob).filter(function(m){ return !desmarcados[tipoCob + "|" + m.name]; });
    var g = guildAtual(), linhas = [];
    if(tipoCob === "inativos"){
      linhas.push("**" + g + " · membros sem logar há " + plural(dados.cfg.diasInativo || 3, "dia", "dias") + " ou mais**");
      linhas.push("Conferido em " + dmh(semana.ultima) + ".");
    } else if(tipoCob === "abaixo"){
      linhas.push("**" + g + " · cobrança da meta semanal**");
      linhas.push("Semana " + intervaloSemana() + " · meta: " + textoMeta());
      linhas.push("Até " + dmh(semana.ultima) + ", estes membros estão abaixo do ritmo para bater a meta:");
    } else {
      linhas.push("**" + g + " · ainda não bateram a meta da semana**");
      linhas.push("Semana " + intervaloSemana() + " · meta: " + textoMeta());
      linhas.push("Até " + dmh(semana.ultima) + ", estes membros ainda não bateram. Quem não bater até domingo 23:59 pode ser kickado:");
    }
    linhas.push("");
    sel.forEach(function(m){ linhas.push(linhaMembro(m, tipoCob)); });
    if(tipoCob !== "inativos"){ linhas.push(""); linhas.push("A semana fecha domingo às 23:59."); }
    return { texto: linhas.join("\n"), membros: sel };
  }
  function pintarCobranca(){
    var nA = listaCob("abaixo").length, nN = listaCob("naobateu").length, nI = listaCob("inativos").length;
    $("nAbaixo").textContent = temMeta() ? nA : ""; $("nNaoBateu").textContent = temMeta() ? nN : ""; $("nInativos").textContent = nI;
    var cc = $("contCob"); cc.hidden = !(temMeta() && nA); cc.textContent = nA;
    [].forEach.call($("segCob").querySelectorAll("button"), function(b){ b.setAttribute("aria-pressed", String(b.dataset.tipo === tipoCob)); });
    var titulos = { abaixo: "Abaixo do ritmo", naobateu: "Ainda não bateram", inativos: "Inativos" };
    var notas = {
      abaixo: "Quem está abaixo do esperado para os dias que já fecharam. Exemplo: no dia 4 (quinta), espera 3/7 da meta da semana.",
      naobateu: "Todos que ainda não bateram a meta, incluindo quem está no caminho. No domingo, é a lista de quem seria kickado.",
      inativos: "Quem não loga há " + plural(dados.cfg.diasInativo || 3, "dia", "dias") + " ou mais, contando até a última importação. Isentos ficam de fora."
    };
    $("cobTitulo").textContent = titulos[tipoCob];
    var lista = listaCob(tipoCob), ul = $("cobLista");
    if(tipoCob !== "inativos" && !temMeta()){
      $("cobNota").innerHTML = 'Defina a meta na aba <a href="#" data-ir="ajustes">Ajustes</a> para montar esta lista.';
      ul.innerHTML = ""; $("cobTexto").value = ""; $("cobTodos").hidden = true; ligarIr(); return;
    }
    $("cobNota").textContent = notas[tipoCob];
    $("cobTodos").hidden = !lista.length;
    ul.innerHTML = lista.length ? lista.map(function(m){
      var k = tipoCob + "|" + m.name, temId = G.idDiscordValido(String(de(dados.cfg.discord, m.name) || ""));
      var det = tipoCob === "inativos" ? "Último acesso " + esc(m.lastLogin) : esc(textoFalta(m));
      return '<li><label><input type="checkbox" data-k="' + esc(k) + '"' + (desmarcados[k] ? "" : " checked") + '><span><b>' + esc(m.name) + "</b>" + (temId ? '<span class="tag-id">Discord</span>' : "") + "</span><small>" + det + "</small></label></li>";
    }).join("") : '<li class="vazio">Ninguém nesta lista.</li>';
    [].forEach.call(ul.querySelectorAll("input"), function(i){
      i.addEventListener("change", function(){ if(i.checked) delete desmarcados[i.dataset.k]; else desmarcados[i.dataset.k] = 1; textoEditado = false; atualizarTexto(); });
    });
    var algum = lista.some(function(m){ return !desmarcados[tipoCob + "|" + m.name]; });
    $("cobTodos").textContent = algum ? "Desmarcar todos" : "Marcar todos";
    if(!textoEditado) atualizarTexto();
  }
  function atualizarTexto(){ $("cobTexto").value = gerarTexto().texto; }
  $("cobTexto").addEventListener("input", function(){ textoEditado = true; });
  $("cobRefazer").addEventListener("click", function(){ textoEditado = false; atualizarTexto(); });
  $("cobTodos").addEventListener("click", function(){
    var lista = listaCob(tipoCob), algum = lista.some(function(m){ return !desmarcados[tipoCob + "|" + m.name]; });
    lista.forEach(function(m){ var k = tipoCob + "|" + m.name; if(algum) desmarcados[k] = 1; else delete desmarcados[k]; });
    textoEditado = false; pintarCobranca();
  });
  [].forEach.call($("segCob").querySelectorAll("button"), function(b){
    b.addEventListener("click", function(){ tipoCob = b.dataset.tipo; textoEditado = false; $("cobStatus").textContent = ""; pintarCobranca(); });
  });
  $("cobCopiar").addEventListener("click", function(){
    var t = $("cobTexto").value, st = $("cobStatus");
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ st.className = "status"; st.textContent = "Copiado."; })
      .catch(function(){ $("cobTexto").select(); st.className = "status"; st.textContent = "Selecionei o texto: use Ctrl+C."; });
  });

  // ---------- alerta automático ----------
  // Na primeira importação do dia (a mais nova da guild), manda sozinho a lista de quem está abaixo do ritmo.
  // O servidor garante que só sai um por dia, mesmo com vários admins importando.
  function alertaAutomatico(){
    if(!dados.cfg.alertaAuto || !hookInfo.configurado || !temMeta() || !semana) return;
    var lista = listaCob("abaixo");
    if(!lista.length) return;
    var antes = tipoCob, desm = desmarcados;
    tipoCob = "abaixo"; desmarcados = {};
    var g = gerarTexto();
    tipoCob = antes; desmarcados = desm;
    var ids = g.membros.map(function(m){ return String(de(dados.cfg.discord, m.name) || "").trim(); }).filter(G.idDiscordValido);
    var st = $("impStatus");
    api("enviar", { texto: g.texto, ids: ids, nome: dados.cfg.hookNome || "", auto: true }).then(function(j){
      if(!j.pulado){ ultimoAlertaAuto = diaHoje(); st.textContent += ". Alerta de cobrança enviado no Discord (" + plural(lista.length, "membro", "membros") + ")."; }
      else st.textContent += ". O alerta de hoje já tinha saído.";
      pintarAuto();
    }).catch(function(e){ st.className = "status erro"; st.textContent += ". O alerta automático não foi: " + e.message; });
  }
  function diaHoje(){ return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); }
  function pintarAuto(){
    $("alertaAuto").checked = dados.cfg.alertaAuto !== false;
    var t = "";
    if(ultimoAlertaAuto){ var p = ultimoAlertaAuto.split("-"); t = "Último alerta automático: " + p[2] + "/" + p[1] + (ultimoAlertaAuto === diaHoje() ? " (hoje; o próximo sai na primeira importação de amanhã)" : "") + "."; }
    $("alertaUlt").textContent = t;
  }
  $("alertaAuto").addEventListener("change", function(){ dados.cfg.alertaAuto = this.checked; salvar(); });

  // ---------- Discord ----------
  function enviarDiscord(texto, ids, st){
    {
      if(!hookInfo.configurado){ st.className = "status erro"; st.innerHTML = 'Cole o endereço do webhook na aba <a href="#" data-ir="ajustes">Ajustes</a>.'; ligarIr(); return Promise.resolve(false); }
      if(!texto.trim()){ st.className = "status erro"; st.textContent = "A mensagem está vazia."; return Promise.resolve(false); }
      st.className = "status"; st.textContent = "Enviando…";
      return api("enviar", { texto: texto, ids: ids, nome: dados.cfg.hookNome || "" }).then(function(j){
        st.className = "status"; st.textContent = j.partes > 1 ? "Enviado em " + j.partes + " mensagens." : "Enviado."; return true;
      }).catch(function(e){ st.className = "status erro"; st.textContent = "Não foi: " + e.message; return false; });
    }
  }
  $("cobDiscord").addEventListener("click", function(){
    var b = this, g = gerarTexto();
    var ids = g.membros.map(function(m){ return String(de(dados.cfg.discord, m.name) || "").trim(); }).filter(G.idDiscordValido);
    b.disabled = true;
    enviarDiscord($("cobTexto").value, ids, $("cobStatus")).then(function(){ b.disabled = false; });
  });
  function pintarHook(){
    var i = $("webhook");
    {
      i.value = "";
      i.placeholder = hookInfo.configurado ? "Salvo no servidor (termina em …" + hookInfo.final + "). Cole outro para trocar." : "https://discord.com/api/webhooks/...";
      $("hookOnde").innerHTML = "Ele fica guardado no servidor, só para esta guild. Nenhum admin consegue ver o endereço inteiro de volta.";
    }
  }
  $("webhook").addEventListener("change", function(){
    var v = this.value.trim(), st = $("hookStatus");
    if(v && !G.webhookValido(v)){ st.className = "status erro"; st.textContent = "Esse endereço não parece um webhook do Discord."; return; }
    {
      if(!v) return;
      st.className = "status"; st.textContent = "Salvando…";
      api("hook", { url: v }).then(function(j){ hookInfo = j.hook; pintarHook(); st.textContent = "Salvo para a guild."; })
        .catch(function(e){ st.className = "status erro"; st.textContent = e.message; });
      return;
    }
  });
  $("hookApagar").addEventListener("click", function(){
    var st = $("hookStatus");
    {
      api("hook", { url: "" }).then(function(j){ hookInfo = j.hook; pintarHook(); st.className = "status"; st.textContent = "Endereço apagado do servidor."; })
        .catch(function(e){ st.className = "status erro"; st.textContent = e.message; });
      return;
    }
  });
  $("hookNome").value = dados.cfg.hookNome || "";
  $("hookNome").addEventListener("change", function(){ dados.cfg.hookNome = this.value.trim(); salvar(); });
  $("hookTeste").addEventListener("click", function(){
    var v = $("webhook").value.trim(), st = $("hookStatus"), b = this;
    b.disabled = true;
    enviarDiscord("Teste do PKA-HUB: os alertas da guild **" + guildAtual() + "** vão chegar neste canal.", [], st).then(function(){ b.disabled = false; });
  });

  // ---------- caixa ----------
  function pintarCaixa(){
    var saldo = dados.cfg.saldo;
    $("saldo").value = saldo != null ? n(saldo) : "";
    var membros = semana.membros;
    $("bosses").innerHTML = G.BOSSES.map(function(b){
      var comNivel = membros.filter(function(m){ return m.level >= b.nivel; }).length;
      var chip = saldo == null ? "" : (saldo >= b.custo ? '<span class="chip ok">Dá para fazer</span>' : '<span class="chip mal">Faltam ' + din(b.custo - saldo) + "</span>");
      return '<div class="boss"><div><b>' + b.nome + "</b><br><small>Nível mínimo " + b.nivel + " · " + comNivel + " com nível</small></div>" +
        '<div style="text-align:right"><div class="preco num">' + din(b.custo) + "</div>" + chip + "</div></div>";
    }).join("");
    pintarRend();
  }
  $("saldo").addEventListener("change", function(){ dados.cfg.saldo = this.value.trim() === "" ? null : G.lerValor(this.value); salvar(); pintarCaixa(); });
  function q(id){ return Math.max(0, G.lerInteiro($(id).value)); }
  function pintarRend(){
    var dol = q("qDolar"), dia = q("qDiamond");
    var r = G.rendimento({ normal: q("qNormal"), wildscape: q("qWildscape"), primal: q("qPrimal"), dolar: dol, diamond: dia });
    var cel = [["Saldo da guild", din(r.saldo)], ["Pontos", n(r.pontos)], ["Guild XP", n(r.guildXp)], ["XP do player", n(r.xp)], ["Medal Tokens", n(r.tokens)], ["Kills", n(r.kills)]];
    if(dol) cel.push(["Custa em $", din(r.dinheiro)]);
    if(dia) cel.push(["Custa em diamond", n(r.diamonds)]);
    $("rend").innerHTML = cel.map(function(c){ return "<div><span>" + c[0] + '</span><b class="num">' + c[1] + "</b></div>"; }).join("");
    var notas = [];
    if(dol > 3) notas.push("A doação em $ vai até 3 vezes por dia: " + n(dol) + " vezes leva " + Math.ceil(dol / 3) + " dias.");
    if(dia) notas.push("Diamond conta como " + n(dia) + " doações no mesmo dia (1 + 2 + 4…).");
    $("rendNota").textContent = notas.join(" ");
  }
  ["qNormal", "qWildscape", "qPrimal", "qDolar", "qDiamond"].forEach(function(id){ $(id).addEventListener("input", pintarRend); });
  (function tabelas(){
    var h = "";
    for(var k = 1; k <= 8; k++) h += "<tr><td>" + k + "ª</td><td>" + n(G.diamondDaVez(k)) + "</td><td>" + n(G.diamondsTotal(k)) + "</td><td>+" + din(k * G.DIAMOND_SALDO) + "</td></tr>";
    $("tDiamond").innerHTML = h;
    $("tDailies").innerHTML = G.DAILIES.map(function(d){
      return "<tr><td>" + d.nome + "</td><td>" + d.pontos + "</td><td>" + n(d.kills) + "</td><td>" + din(d.saldo) + '</td><td class="opc">' + n(d.guildXp) + '</td><td class="opc">' + n(d.xp) + '</td><td class="opc">' + d.tokens + "</td></tr>";
    }).join("");
  })();

  // ---------- ajustes ----------
  function pintarAjustes(){
    $("metaPontos").value = dados.cfg.metaPontos || "";
    $("metaContrib").value = dados.cfg.metaContrib ? n(dados.cfg.metaContrib) : "";
    $("diasInativo").value = dados.cfg.diasInativo || 3;
    document.querySelector('input[name=regra][value="' + dados.cfg.regra + '"]').checked = true;
    $("grpRegra").hidden = !(dados.cfg.metaPontos > 0 && dados.cfg.metaContrib > 0);
    var ms = semana.membros.slice().sort(function(a, b){ return a.name.localeCompare(b.name, "pt-BR"); });
    $("membrosCfg").innerHTML = ms.map(function(m, i){
      var id = String(de(dados.cfg.discord, m.name) || "");
      return '<div class="m"><b>' + esc(m.name) + '</b><label><input type="checkbox" data-i="' + i + '"' + (de(dados.cfg.isentos, m.name) === true ? " checked" : "") + "> Isento</label>" +
        '<input type="text" inputmode="numeric" data-i="' + i + '" value="' + esc(id) + '" placeholder="ID do Discord" aria-label="ID do Discord de ' + esc(m.name) + '"' + (id && !G.idDiscordValido(id) ? ' class="ruim"' : "") + "></div>";
    }).join("");
    [].forEach.call($("membrosCfg").querySelectorAll("input"), function(inp){
      var m = ms[+inp.dataset.i];
      inp.addEventListener("change", function(){
        if(inp.type === "checkbox"){ if(inp.checked) dados.cfg.isentos[m.name] = true; else delete dados.cfg.isentos[m.name]; }
        else { var v = inp.value.trim(); if(v) dados.cfg.discord[m.name] = v; else delete dados.cfg.discord[m.name]; inp.classList.toggle("ruim", !!v && !G.idDiscordValido(v)); }
        salvar(); recalcular(false);
      });
    });
    var ims = importsDaGuild().slice().reverse();
    $("imports").innerHTML = ims.map(function(im){
      var d = G.lerDataExport(im.exportedAt);
      return "<li><span>" + (d ? dmh(d) : esc(im.exportedAt)) + " · " + esc(im.guild) + " · " + im.members.length + ' membros</span><button class="btn peq perigo" data-k="' + esc(im.guild + "|" + im.exportedAt) + '">Apagar</button></li>';
    }).join("");
    [].forEach.call($("imports").querySelectorAll("button"), function(b){
      b.addEventListener("click", function(){
        var k = b.dataset.k, i = k.lastIndexOf("|");
        mudarImports("apagarImport", { guild: k.slice(0, i), exportedAt: k.slice(i + 1) });
      });
    });
  }
  function cfgNum(id, campo, ler){ $(id).addEventListener("change", function(){ dados.cfg[campo] = ler(this.value); salvar(); recalcular(true); }); }
  cfgNum("metaPontos", "metaPontos", inteiro); cfgNum("metaContrib", "metaContrib", valor);
  $("diasInativo").addEventListener("change", function(){ dados.cfg.diasInativo = inteiro(this.value) || 3; salvar(); recalcular(true); });
  [["regra", "regra"]].forEach(function(p){
    [].forEach.call(document.querySelectorAll("input[name=" + p[0] + "]"), function(r){
      r.addEventListener("change", function(){ if(r.checked){ dados.cfg[p[1]] = r.value; salvar(); recalcular(true); } });
    });
  });
  $("apagarTudo").addEventListener("click", function(){
    var b = this;
    if(b.dataset.certeza !== "1"){ b.dataset.certeza = "1"; b.textContent = "Clique de novo para apagar"; setTimeout(function(){ b.dataset.certeza = ""; b.textContent = "Apagar todas"; }, 4000); return; }
    var g = guildAtual();
    b.dataset.certeza = ""; b.textContent = "Apagar todas";
    mudarImports("apagarTudo", { guild: g });
  });

  // ---------- abas ----------
  var aba = "painel";
  try{ var ab = sessionStorage.getItem("pka-guild-aba"); if(ab) aba = ab; }catch(e){}
  function irPara(nome){
    aba = nome;
    try{ sessionStorage.setItem("pka-guild-aba", nome); }catch(e){}
    ["painel", "cobranca", "caixa", "ajustes"].forEach(function(a){
      $("t-" + a).setAttribute("aria-selected", String(a === nome));
      $("p-" + a).hidden = a !== nome;
    });
  }
  ["painel", "cobranca", "caixa", "ajustes"].forEach(function(a){ $("t-" + a).addEventListener("click", function(){ irPara(a); }); });
  function ligarIr(){
    [].forEach.call(document.querySelectorAll("[data-ir]"), function(el){
      if(el.dataset.ligado) return; el.dataset.ligado = "1";
      el.addEventListener("click", function(e){ e.preventDefault(); irPara(el.dataset.ir); window.scrollTo({ top: 0, behavior: "smooth" }); });
    });
  }

  // ---------- entrar ----------
  function entrar(acao, cod, senha, st){
    st.className = "status"; st.textContent = acao === "criar" ? "Criando…" : "Entrando…";
    api(acao, { codigo: cod, senha: senha }).then(function(j){
      sessao = { token: j.token, codigo: j.codigo }; lsGravar(CHAVE_SESSAO, JSON.stringify(sessao));
      modo = "nuvem"; $("eSenha").value = ""; $("pSenha").value = ""; $("pSenha2").value = ""; st.textContent = "";
      return carregarNuvem();
    }).catch(function(e){
      st.className = "status erro";
      if(e.naoAchou){
        st.innerHTML = esc(e.message) + ' <button class="link" type="button" id="irPrimeiro">Fazer o primeiro acesso</button>';
        $("irPrimeiro").addEventListener("click", function(){ abaEntrar("primeiro"); $("pCodigo").value = $("eCodigo").value; $("pSenha").focus(); });
      } else st.textContent = e.message;
    });
  }
  function abaEntrar(qual){
    $("tabEntrar").setAttribute("aria-pressed", String(qual === "entrar"));
    $("tabPrimeiro").setAttribute("aria-pressed", String(qual === "primeiro"));
    $("formEntrar").hidden = qual !== "entrar"; $("formPrimeiro").hidden = qual !== "primeiro";
  }
  $("tabEntrar").addEventListener("click", function(){ abaEntrar("entrar"); });
  $("tabPrimeiro").addEventListener("click", function(){ abaEntrar("primeiro"); });
  $("formEntrar").addEventListener("submit", function(e){ e.preventDefault(); entrar("entrar", $("eCodigo").value.trim(), $("eSenha").value, $("eStatus")); });
  $("formPrimeiro").addEventListener("submit", function(e){
    e.preventDefault();
    var st = $("pStatus");
    if($("pSenha").value !== $("pSenha2").value){ st.className = "status erro"; st.textContent = "As duas senhas não são iguais."; return; }
    entrar("criar", $("pCodigo").value.trim(), $("pSenha").value, st);
  });
  $("btnSair").addEventListener("click", function(){ sairNuvem(); abaEntrar("entrar"); });
  $("aTrocar").addEventListener("click", function(){
    var st = $("aStatus"), v = $("aSenha").value;
    if(v.length < 8){ st.className = "status erro"; st.textContent = "A nova senha precisa ter pelo menos 8 caracteres."; return; }
    api("senha", { atual: $("aAtual").value, nova: v }).then(function(j){
      sessao = { token: j.token, codigo: j.codigo }; lsGravar(CHAVE_SESSAO, JSON.stringify(sessao));
      $("aAtual").value = ""; $("aSenha").value = ""; st.className = "status"; st.textContent = "Senha trocada. Os outros admins foram desconectados; passe a nova para eles.";
    }).catch(function(e){ st.className = "status erro"; st.textContent = e.message; });
  });
  function desfazer(){
    if(!confirm("Voltar os dados da guild para como estavam antes desta mudança?")) return;
    mudarImports("desfazer");
  }
  $("btnDesfazer").addEventListener("click", desfazer);
  $("btnDesfazer2").addEventListener("click", desfazer);
  $("bkBaixar").addEventListener("click", function(){
    var st = $("bkStatus"); st.className = "status"; st.textContent = "Gerando…";
    api("backup").then(function(j){
      var blob = new Blob([JSON.stringify(j, null, 1)], { type: "application/json" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "guild-" + j.codigo + "-" + String(j.geradoEm).slice(0, 10) + ".json";
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
      st.textContent = "Cópia baixada.";
    }).catch(function(e){ st.className = "status erro"; st.textContent = e.message; });
  });
  $("bkRestaurar").addEventListener("click", function(){ $("bkArquivo").click(); });
  $("bkArquivo").addEventListener("change", function(){
    var f = this.files && this.files[0], st = $("bkStatus"); this.value = "";
    if(!f) return;
    if(f.size > 1400000){ st.className = "status erro"; st.textContent = "Arquivo grande demais para uma cópia da guild."; return; }
    f.text().then(function(t){
      var bk; try{ bk = JSON.parse(t); }catch(e){ throw new Error("Esse arquivo não é um JSON válido."); }
      if(!bk || bk.tipo !== "pka-guild-backup") throw new Error("Esse arquivo não é uma cópia de segurança da Gestão da Guild.");
      if(!confirm("Restaurar troca as importações e os ajustes que estão no servidor pelos do arquivo. Continuar?")) return null;
      st.className = "status"; st.textContent = "Restaurando…";
      return api("restaurar", { backup: bk });
    }).then(function(j){ if(!j) return; aplicarRemoto(j); tudo(); st.className = "status"; st.textContent = "Cópia restaurada."; })
      .catch(function(e){ st.className = "status erro"; st.textContent = e.message; });
  });
  var carregando = false;
  function carregarNuvem(){
    carregando = true; tudo();
    return api("ler").then(function(j){ carregando = false; aplicarRemoto(j); tudo(); })
      .catch(function(e){ carregando = false; tudo(); var st = $("impStatus"); st.className = "status erro"; st.textContent = e.message; });
  }
  // quando o admin volta para a aba, busca o que os outros mudaram
  document.addEventListener("visibilitychange", function(){
    if(document.visibilityState === "visible" && modo === "nuvem" && !carregando)
      api("ler").then(function(j){ aplicarRemoto(j); tudo(); }).catch(function(){});
  });

  // ---------- tudo ----------
  function recalcular(todasAbas){
    semana = calcular();
    if(!semana){ tudo(); return; }
    pintarPainel(); pintarCobranca();
    if(todasAbas){ pintarAjustes(); pintarCaixa(); }
  }
  function tudo(){
    $("telaEntrar").hidden = modo !== null;
    $("telaCarregando").hidden = !(modo === "nuvem" && carregando);
    $("btnImport").hidden = modo === null || carregando;
    $("conta").hidden = modo !== "nuvem";
    if(sessao) $("contaCodigo").textContent = sessao.codigo;
    if(sessao) $("aCodigo").textContent = sessao.codigo;
    pintarHook(); pintarAuto();
    $("ondeFica").textContent = "As importações ficam no servidor do PKA-HUB, só para os admins desta guild.";
    var ws = modo && !carregando ? semanas() : [];
    var tem = ws.length > 0;
    if(tem) $("btnImport").hidden = true; // com dados, o botão fica no destaque da última importação
    $("semDados").hidden = tem || !modo || carregando; $("comDados").hidden = !tem;
    if(!tem) return;
    if(ws.indexOf(semanaSel) < 0) semanaSel = ws[0];
    semana = calcular();
    pintarFaixa(); pintarPainel(); pintarCobranca(); pintarCaixa(); pintarAjustes();
    irPara(aba); ligarIr();
  }
  if(modo === "nuvem") carregarNuvem(); else tudo();
})();
