/* Contas estatísticas do PKA Hunt Analyzer.
   Só números: nada aqui lê a página nem o JSON. A página chama estas funções com os totais que ela já soma.
   Os testes ficam em testes/estatisticas.test.js (rodar com: npm test). */
(function(){
  "use strict";
  var Z95 = 1.959963984540054; // 95% numa curva normal

  // ---------- funções de base ----------
  // logaritmo da função gama (x > 0): leva x até 10 ou mais e usa a série de Stirling
  function lnGama(x){
    var prod = 1;
    while(x < 10){ prod *= x; x += 1; }
    var i2 = 1 / (x * x);
    return (x - 0.5) * Math.log(x) - x + 0.9189385332046728 + (1 / x) * (1/12 - i2 * (1/360 - i2 * (1/1260 - i2 * (1/1680 - i2 / 1188)))) - Math.log(prod);
  }
  // gama incompleta regularizada P(a, x)
  function gamaP(a, x){
    if(x <= 0) return 0;
    if(x < a + 1){ // série
      var ap = a, soma = 1 / a, d = soma;
      for(var n = 0; n < 1000; n++){ ap++; d *= x / ap; soma += d; if(Math.abs(d) < Math.abs(soma) * 1e-15) break; }
      return Math.min(1, soma * Math.exp(-x + a * Math.log(x) - lnGama(a)));
    }
    return 1 - gamaQfc(a, x);
  }
  function gamaQfc(a, x){ // fração contínua de Q(a, x)
    var b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
    for(var i = 1; i < 1000; i++){
      var an = -i * (i - a); b += 2;
      d = an * d + b; if(Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c; if(Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d; var del = d * c; h *= del; if(Math.abs(del - 1) < 1e-15) break;
    }
    return Math.exp(-x + a * Math.log(x) - lnGama(a)) * h;
  }
  // valor x em que P(a, x) = q (busca por bisseção)
  function gamaPInv(q, a){
    var lo = 0, hi = Math.max(1, a);
    while(gamaP(a, hi) < q) hi *= 2;
    for(var i = 0; i < 200; i++){ var m = (lo + hi) / 2; if(gamaP(a, m) < q) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // ---------- 1. faixa provável de uma proporção (intervalo de Wilson) ----------
  // k sucessos em n tentativas -> {p, lo, hi} como proporções (0 a 1)
  function wilson(k, n, z){
    if(!(n > 0)) return null;
    z = z || Z95;
    var p = k / n, z2 = z * z, den = 1 + z2 / n;
    var centro = (p + z2 / (2 * n)) / den;
    var meia = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den;
    return { p: p, lo: k === 0 ? 0 : Math.max(0, centro - meia), hi: k === n ? 1 : Math.min(1, centro + meia) };
  }

  // ---------- 2. sorte ou azar da sessão ----------
  // P(X <= k) com X ~ Binomial(n, p)
  function binomialAcum(k, n, p){
    if(k < 0) return 0;
    if(k >= n) return 1;
    if(p <= 0) return 1;
    if(p >= 1) return 0;
    var base = lnGama(n + 1), lp = Math.log(p), lq = Math.log(1 - p), s = 0;
    for(var i = 0; i <= k; i++) s += Math.exp(base - lnGama(i + 1) - lnGama(n - i + 1) + i * lp + (n - i) * lq);
    return Math.min(1, s);
  }
  function rotuloSorte(percentil){
    if(percentil < 5) return "azar fora do comum";
    if(percentil < 20) return "abaixo da média";
    if(percentil <= 80) return "dentro do normal";
    if(percentil <= 95) return "acima da média";
    return "sorte fora do comum";
  }
  // kSessao shinys em nSessao kills; kOutras e nOutras = soma das outras sessões da mesma espécie
  function sorte(kSessao, nSessao, kOutras, nOutras){
    if(!(nOutras > 0)) return { motivo: "sem-outras" };
    if(!(nSessao > 0)) return { motivo: "sem-kills" };
    var pRef = kOutras / nOutras;
    if(pRef <= 0) return { motivo: "sem-shiny-nas-outras" };
    var percentil = binomialAcum(kSessao, nSessao, pRef) * 100;
    return { pRef: pRef, esperado: nSessao * pRef, obtido: kSessao, percentil: percentil, rotulo: rotuloSorte(percentil) };
  }

  // ---------- 3. as sessões têm a mesma taxa? (qui-quadrado de homogeneidade) ----------
  // linhas = [{k: shinys, n: kills}] -> {qui2, gl, p, pequena, motivo}
  function mesmaTaxa(linhas){
    linhas = (linhas || []).filter(function(l){ return l.n > 0; });
    var K = 0, N = 0;
    linhas.forEach(function(l){ K += l.k; N += l.n; });
    if(linhas.length < 2 || K === 0 || K === N) return { qui2: NaN, gl: Math.max(0, linhas.length - 1), p: NaN, pequena: true, motivo: linhas.length < 2 ? "poucas-linhas" : "sem-variacao", linhas: linhas.length };
    var q = 0, menorEsperado = Infinity;
    linhas.forEach(function(l){
      var es = l.n * K / N, en = l.n * (N - K) / N;
      menorEsperado = Math.min(menorEsperado, es, en);
      q += (l.k - es) * (l.k - es) / es + ((l.n - l.k) - en) * ((l.n - l.k) - en) / en;
    });
    var gl = linhas.length - 1;
    var p = 1 - gamaP(gl / 2, q / 2);
    var motivo = linhas.length < 3 ? "poucas-linhas" : menorEsperado < 5 ? "esperado-baixo" : "";
    return { qui2: q, gl: gl, p: Math.max(0, Math.min(1, p)), pequena: !!motivo, motivo: motivo, linhas: linhas.length, menorEsperado: menorEsperado };
  }
  // faixa de horário de início, no fuso do navegador
  var FAIXAS = [["Madrugada", 0, 6], ["Manhã", 6, 12], ["Tarde", 12, 18], ["Noite", 18, 24]];
  function faixaHorario(hora){
    for(var i = 0; i < FAIXAS.length; i++) if(hora >= FAIXAS[i][1] && hora < FAIXAS[i][2]) return FAIXAS[i][0];
    return "";
  }

  // ---------- 4. projeção de shinys por tempo (Poisson) ----------
  // menor k com P(X <= k) >= q, X ~ Poisson(lambda)
  function poissonQuantil(lambda, q){
    if(!(lambda > 0)) return 0;
    var acum = 0, ll = Math.log(lambda);
    for(var k = 0; k < 1e7; k++){
      acum += Math.exp(-lambda + k * ll - lnGama(k + 1));
      if(acum >= q - 1e-12) return k;
    }
    return NaN;
  }
  function projecao(shinys, horas, horasAlvo){
    if(!(horas > 0) || !(horasAlvo > 0)) return null;
    var ritmo = shinys / horas, lambda = ritmo * horasAlvo;
    return { ritmo: ritmo, esperado: lambda, lo: poissonQuantil(lambda, 0.05), hi: poissonQuantil(lambda, 0.95) };
  }

  // ---------- 5. chance teórica de "seca" ----------
  function seca(p, n){ if(!(p > 0) || !(n >= 0)) return NaN; return Math.pow(1 - p, n); }

  // ---------- 6. kills para medir a taxa com uma margem ----------
  function killsParaMargem(p, margem){ if(!(p > 0) || !(margem > 0)) return NaN; return 1.96 * 1.96 * p * (1 - p) / (margem * margem); }

  // ---------- 7. faixa provável de contagem (Poisson exato) ----------
  // count eventos em "exposicao" unidades -> {taxa, lo, hi} por unidade
  function poissonFaixa(count, exposicao){
    if(!(exposicao > 0) || !(count >= 0)) return null;
    var lo = count === 0 ? 0 : gamaPInv(0.025, count);
    var hi = gamaPInv(0.975, count + 1);
    return { taxa: count / exposicao, lo: lo / exposicao, hi: hi / exposicao };
  }

  // ---------- 8. projeto de catch ----------
  // c = {mediana, p80, p95, maximo, capturas}
  function curvaComunidade(c){
    var x = [0, +c.mediana, +c.p80, +c.p95], s = [1, 0.5, 0.2, 0.05];
    for(var i = 1; i < x.length; i++) if(!(x[i] > x[i - 1])) return { erro: "ordem" };
    var aviso = "";
    if(+c.maximo > 0 || +c.capturas > 0){
      if(!(+c.maximo > x[3])) return { erro: "maximo" };
      if(!(+c.capturas > 0)) return { erro: "capturas" };
      if(1 / c.capturas < 0.05){ x.push(+c.maximo); s.push(1 / c.capturas); }
      else aviso = "poucas-capturas"; // com 20 capturas ou menos, o máximo não cabe abaixo do P95
    }
    return { x: x, s: s, fim: x[x.length - 1], aviso: aviso };
  }
  // fração que ainda não tinha capturado com "b" balls; null acima do último ponto
  function sobrevivencia(curva, b){
    if(!(b >= 0)) return null;
    var x = curva.x, s = curva.s;
    if(b > x[x.length - 1]) return null;
    for(var i = 0; i < x.length - 1; i++){
      if(b <= x[i + 1]) return s[i] * Math.pow(s[i + 1] / s[i], (b - x[i]) / (x[i + 1] - x[i]));
    }
    return s[s.length - 1];
  }
  function taxaBase(mediana){ return +mediana > 0 ? Math.LN2 / mediana : NaN; }
  function sobrevivenciaBase(h0, b){ return Math.exp(-h0 * b); }
  // chance de capturar nas próximas N balls, já tendo jogado b
  function chanceProximas(curva, b, N){
    var a = sobrevivencia(curva, b), d = sobrevivencia(curva, b + N);
    if(a == null || d == null || a <= 0) return null;
    return 1 - d / a;
  }
  function chanceProximasBase(h0, N){ return 1 - Math.exp(-h0 * N); }
  function chanceAura(h0, estoque){ return 1 - Math.exp(-h0 * estoque); }
  function estoqueParaChance(h0, chance){ return -Math.log(1 - chance) / h0; }

  window.PKA_ESTAT = {
    Z95: Z95, lnGama: lnGama, gamaP: gamaP, gamaPInv: gamaPInv,
    wilson: wilson, binomialAcum: binomialAcum, rotuloSorte: rotuloSorte, sorte: sorte,
    mesmaTaxa: mesmaTaxa, FAIXAS: FAIXAS, faixaHorario: faixaHorario,
    poissonQuantil: poissonQuantil, projecao: projecao, seca: seca, killsParaMargem: killsParaMargem, poissonFaixa: poissonFaixa,
    curvaComunidade: curvaComunidade, sobrevivencia: sobrevivencia, taxaBase: taxaBase, sobrevivenciaBase: sobrevivenciaBase,
    chanceProximas: chanceProximas, chanceProximasBase: chanceProximasBase, chanceAura: chanceAura, estoqueParaChance: estoqueParaChance
  };
})();
