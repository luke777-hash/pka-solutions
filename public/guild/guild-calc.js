/* Contas da Gestão da Guild.
   Só dados e números: nada aqui mexe na página. A página (index.html) chama estas funções.
   Os testes ficam em testes/guild.test.js (rodar com: npm test).
   Valores do jogo passados pelo Lucas (dailies, doações) e lidos do print da aba Boss. */
(function(){
  "use strict";

  // ---------- regras do jogo ----------
  var DAILIES = [
    { id: "normal",    nome: "Normal",    pontos: 1, kills: 300, guildXp: 150, xp: 60000,  tokens: 3,  saldo: 150 },
    { id: "wildscape", nome: "Wildscape", pontos: 2, kills: 600, guildXp: 300, xp: 300000, tokens: 6,  saldo: 300 },
    { id: "primal",    nome: "Primal",    pontos: 4, kills: 400, guildXp: 600, xp: 750000, tokens: 15, saldo: 600 }
  ];
  var BOSSES = [
    { nome: "Giant Steelix",    nivel: 250, custo: 2000 },
    { nome: "Giant Jynx",       nivel: 275, custo: 5000 },
    { nome: "Giant Tentacruel", nivel: 300, custo: 6000 },
    { nome: "Giant Marowak",    nivel: 400, custo: 10000 }
  ];
  var DOACAO_DOLAR = { vezes: 3, custo: 100000, saldo: 300 }; // por dia, zera no server save
  var DIAMOND_SALDO = 1000;                                    // cada doação em diamond põe $1.000 no saldo

  // n-ª doação em diamond do dia custa 2^(n-1); n doações custam 2^n - 1 no total
  function diamondDaVez(n){ return n >= 1 ? Math.pow(2, n - 1) : 0; }
  function diamondsTotal(n){ return n >= 1 ? Math.pow(2, n) - 1 : 0; }

  // ---------- datas ----------
  var DIA = 86400000;
  // "2026-11-16 01:00:07" (exportedAt) -> Date no horário local, sem fuso
  function lerDataExport(s){
    var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(String(s || "").trim());
    if(!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }
  // "15/11/2026 21:00:01" (lastLogin) -> Date; vazio -> null
  function lerDataBR(s){
    var m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(String(s || "").trim());
    if(!m) return null;
    return new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
  }
  // "GuildMembers_Luke_Drk_2026-11-16_010007.csv" -> "2026-11-16 01:00:07"
  function dataDoNomeArquivo(nome){
    var m = /(\d{4}-\d{2}-\d{2})_(\d{2})(\d{2})(\d{2})/.exec(String(nome || ""));
    return m ? m[1] + " " + m[2] + ":" + m[3] + ":" + m[4] : null;
  }
  function doisDig(n){ return (n < 10 ? "0" : "") + n; }
  function chaveData(d){ return d.getFullYear() + "-" + doisDig(d.getMonth() + 1) + "-" + doisDig(d.getDate()); }
  // a semana começa no server save de segunda (00:00) e vai até domingo 23:59
  function inicioSemana(d){
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = (x.getDay() + 6) % 7; // segunda = 0
    x.setDate(x.getDate() - dow);
    return x;
  }
  function chaveSemana(d){ return chaveData(inicioSemana(d)); }
  function fimSemana(ini){ var f = new Date(ini); f.setDate(f.getDate() + 7); return f; }
  // quanto da semana já passou, de 0 a 1
  function fracaoSemana(d){
    var ini = inicioSemana(d), fim = fimSemana(ini);
    return Math.max(0, Math.min(1, (d - ini) / (fim - ini)));
  }
  function diasDesde(lastLogin, ref){
    var d = lerDataBR(lastLogin);
    if(!d || !ref) return null;
    return Math.max(0, (ref - d) / DIA);
  }

  // ---------- números ----------
  // "$1.000" -> 1000, "1,900" -> 1900, "4" -> 4 (os valores do jogo são inteiros)
  function lerInteiro(v){
    if(typeof v === "number") return isFinite(v) ? Math.round(v) : 0;
    var s = String(v == null ? "" : v).replace(/[^\d-]/g, "");
    var n = parseInt(s, 10);
    return isFinite(n) ? n : 0;
  }

  // ---------- importação ----------
  var APELIDOS = {
    name: ["name", "nome", "player", "jogador"],
    rank: ["rank", "cargo"],
    level: ["level", "nivel", "nível", "lvl"],
    status: ["status"],
    lastLogin: ["lastlogin", "last login", "ultimo acesso", "último acesso", "ultimoacesso"],
    points: ["points", "pontos"],
    contribution: ["contribution", "contribuicao", "contribuição"]
  };
  function semAcento(s){ return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[_]/g, " ").trim(); }
  function campoDoCabecalho(h){
    var c = semAcento(h);
    for(var k in APELIDOS){
      for(var i = 0; i < APELIDOS[k].length; i++){ if(semAcento(APELIDOS[k][i]) === c) return k; }
    }
    return null;
  }
  function membroLimpo(m){
    return {
      name: String(m.name == null ? "" : m.name).trim(),
      rank: String(m.rank == null ? "" : m.rank).trim(),
      level: lerInteiro(m.level),
      status: String(m.status == null ? "" : m.status).trim().toLowerCase(),
      lastLogin: String(m.lastLogin == null ? "" : m.lastLogin).trim(),
      points: lerInteiro(m.points),
      contribution: lerInteiro(m.contribution)
    };
  }
  // separa uma linha de CSV respeitando aspas
  function linhaCSV(linha, sep){
    var out = [], cur = "", aspas = false;
    for(var i = 0; i < linha.length; i++){
      var ch = linha[i];
      if(aspas){
        if(ch === '"'){ if(linha[i + 1] === '"'){ cur += '"'; i++; } else aspas = false; }
        else cur += ch;
      } else if(ch === '"') aspas = true;
      else if(ch === sep){ out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function lerCSV(texto){
    var linhas = String(texto).replace(/^﻿/, "").split(/\r?\n/).filter(function(l){ return l.trim() !== ""; });
    if(!linhas.length) throw new Error("arquivo vazio");
    var cab = linhas[0], sep = ",";
    var conta = { ",": cab.split(",").length, ";": cab.split(";").length, "\t": cab.split("\t").length };
    if(conta[";"] > conta[sep]) sep = ";";
    if(conta["\t"] > conta[sep]) sep = "\t";
    var campos = linhaCSV(cab, sep).map(campoDoCabecalho);
    if(campos.indexOf("name") < 0) throw new Error("não achei a coluna do nome no CSV");
    var membros = [];
    for(var i = 1; i < linhas.length; i++){
      var cols = linhaCSV(linhas[i], sep), m = {};
      for(var j = 0; j < campos.length; j++){ if(campos[j]) m[campos[j]] = cols[j]; }
      if(m.name && String(m.name).trim()) membros.push(membroLimpo(m));
    }
    return membros;
  }
  // lê um arquivo exportado pelo jogo (JSON ou CSV) e devolve { guild, exportedAt, members }
  function lerArquivo(nome, texto){
    var t = String(texto).replace(/^﻿/, "").trim();
    var porNome = dataDoNomeArquivo(nome);
    if(t[0] === "{" || t[0] === "["){
      var o = JSON.parse(t);
      var lista = Array.isArray(o) ? o : o.members;
      if(!Array.isArray(lista)) throw new Error("o JSON não tem a lista de membros");
      return {
        guild: (!Array.isArray(o) && o.guild) ? String(o.guild) : "",
        exportedAt: (!Array.isArray(o) && o.exportedAt) ? String(o.exportedAt) : porNome,
        members: lista.map(membroLimpo).filter(function(m){ return m.name; })
      };
    }
    return { guild: "", exportedAt: porNome, members: lerCSV(t) };
  }

  // ---------- semana ----------
  // imports: [{guild, exportedAt, members}] da mesma guild. modo: { pontos: "zera"|"acumula", contrib: "zera"|"acumula" }
  // Devolve os valores da semana de cada membro que aparece na última importação da semana.
  function valoresDaSemana(imports, semana, modo){
    var ord = imports.map(function(im){ return { im: im, d: lerDataExport(im.exportedAt) }; })
      .filter(function(x){ return x.d; })
      .sort(function(a, b){ return a.d - b.d; });
    var naSemana = ord.filter(function(x){ return chaveSemana(x.d) === semana; });
    if(!naSemana.length) return null;
    var antes = ord.filter(function(x){ return chaveSemana(x.d) < semana; });
    var ultima = naSemana[naSemana.length - 1], anterior = naSemana.length > 1 ? naSemana[naSemana.length - 2] : null;
    function achar(x, nome){
      if(!x) return null;
      for(var i = 0; i < x.im.members.length; i++){ if(x.im.members[i].name === nome) return x.im.members[i]; }
      return null;
    }
    function base(nome){
      // último registro antes da semana; se não houver, o primeiro da semana
      for(var i = antes.length - 1; i >= 0; i--){ var m = achar(antes[i], nome); if(m) return { m: m, antes: true }; }
      for(var j = 0; j < naSemana.length; j++){ var n = achar(naSemana[j], nome); if(n) return { m: n, antes: false }; }
      return null;
    }
    var membros = ultima.im.members.map(function(m){
      var b = base(m.name), a = achar(anterior, m.name);
      var pts = m.points, ctb = m.contribution, semBase = false;
      if(modo && modo.pontos === "acumula"){ pts = b ? m.points - b.m.points : m.points; if(b && !b.antes) semBase = true; }
      if(modo && modo.contrib === "acumula"){ ctb = b ? m.contribution - b.m.contribution : m.contribution; if(b && !b.antes) semBase = true; }
      return {
        name: m.name, rank: m.rank, level: m.level, status: m.status, lastLogin: m.lastLogin,
        pontos: pts, contrib: ctb, semBase: semBase,
        dPontos: a ? m.points - a.points : null,
        dContrib: a ? m.contribution - a.contribution : null
      };
    });
    var nomesUltima = {};
    ultima.im.members.forEach(function(m){ nomesUltima[m.name] = 1; });
    var sairam = [];
    naSemana.forEach(function(x){ x.im.members.forEach(function(m){ if(!nomesUltima[m.name] && sairam.indexOf(m.name) < 0) sairam.push(m.name); }); });
    return { membros: membros, ultima: ultima.d, anterior: anterior ? anterior.d : null, importacoes: naSemana.length, sairam: sairam };
  }

  // ---------- meta ----------
  // metas: { pontos: n|null, contrib: n|null, regra: "todas"|"qualquer" }; fracao: quanto da semana já passou
  // situação: "bateu", "caminho" (no ritmo para bater até domingo) ou "abaixo"
  function avaliar(m, metas, fracao){
    var temP = metas.pontos > 0, temC = metas.contrib > 0;
    if(!temP && !temC) return { situacao: null, faltaPontos: 0, faltaContrib: 0 };
    var okP = temP ? m.pontos >= metas.pontos : null;
    var okC = temC ? m.contrib >= metas.contrib : null;
    var ritP = temP ? m.pontos >= metas.pontos * fracao : null;
    var ritC = temC ? m.contrib >= metas.contrib * fracao : null;
    function junta(a, b){
      var v = [a, b].filter(function(x){ return x !== null; });
      return metas.regra === "qualquer" ? v.some(Boolean) : v.every(Boolean);
    }
    var situacao = junta(okP, okC) ? "bateu" : (junta(ritP, ritC) ? "caminho" : "abaixo");
    return {
      situacao: situacao,
      faltaPontos: temP ? Math.max(0, metas.pontos - m.pontos) : 0,
      faltaContrib: temC ? Math.max(0, metas.contrib - m.contrib) : 0
    };
  }
  // como fechar os pontos que faltam: só Primal, só Wildscape, só Normal, e a mistura com menos dailies (soma exata)
  function comoCompletar(falta){
    falta = Math.max(0, Math.ceil(falta));
    var p = Math.floor(falta / 4), r = falta % 4;
    return {
      primal: Math.ceil(falta / 4), wildscape: Math.ceil(falta / 2), normal: falta,
      mistura: { primal: p, wildscape: Math.floor(r / 2), normal: r % 2 }
    };
  }

  // ---------- quanto rende ----------
  // q: { normal, wildscape, primal, dolar (vezes de $100k), diamond (doações) }
  function rendimento(q){
    var r = { pontos: 0, saldo: 0, guildXp: 0, xp: 0, tokens: 0, kills: 0, dinheiro: 0, diamonds: 0 };
    DAILIES.forEach(function(d){
      var n = Math.max(0, q[d.id] || 0);
      r.pontos += n * d.pontos; r.saldo += n * d.saldo; r.guildXp += n * d.guildXp; r.xp += n * d.xp; r.tokens += n * d.tokens; r.kills += n * d.kills;
    });
    var dol = Math.max(0, q.dolar || 0);
    r.saldo += dol * DOACAO_DOLAR.saldo; r.dinheiro = dol * DOACAO_DOLAR.custo;
    var dia = Math.max(0, q.diamond || 0);
    r.saldo += dia * DIAMOND_SALDO; r.diamonds = diamondsTotal(dia);
    return r;
  }

  // ---------- Discord ----------
  var WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,200}\/?$/;
  function webhookValido(url){ return WEBHOOK_RE.test(String(url || "").trim()); }
  // corta o texto em pedaços de até 'max' caracteres, sem partir linhas (o Discord aceita 2000 por mensagem)
  function dividirMensagem(texto, max){
    max = max || 2000;
    var partes = [], atual = "";
    String(texto).split("\n").forEach(function(l){
      while(l.length > max){ if(atual){ partes.push(atual); atual = ""; } partes.push(l.slice(0, max)); l = l.slice(max); }
      var junto = atual ? atual + "\n" + l : l;
      if(junto.length > max){ partes.push(atual); atual = l; } else atual = junto;
    });
    if(atual.trim()) partes.push(atual);
    return partes;
  }
  // ID de usuário do Discord: só números (17 a 20 dígitos)
  function idDiscordValido(id){ return /^\d{17,20}$/.test(String(id || "").trim()); }

  window.PKA_GUILD = {
    DAILIES: DAILIES, BOSSES: BOSSES, DOACAO_DOLAR: DOACAO_DOLAR, DIAMOND_SALDO: DIAMOND_SALDO,
    diamondDaVez: diamondDaVez, diamondsTotal: diamondsTotal,
    lerDataExport: lerDataExport, lerDataBR: lerDataBR, dataDoNomeArquivo: dataDoNomeArquivo, chaveData: chaveData,
    inicioSemana: inicioSemana, chaveSemana: chaveSemana, fimSemana: fimSemana, fracaoSemana: fracaoSemana, diasDesde: diasDesde,
    lerInteiro: lerInteiro, lerCSV: lerCSV, lerArquivo: lerArquivo,
    valoresDaSemana: valoresDaSemana, avaliar: avaliar, comoCompletar: comoCompletar, rendimento: rendimento,
    webhookValido: webhookValido, dividirMensagem: dividirMensagem, idDiscordValido: idDiscordValido
  };
})();
