// Testes das contas do Hunt Analyzer, com os valores de referência do pedido (sessões A e B de Glaceon e a curva do Shiny Arcanine).
// Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codigo = readFileSync(new URL("../public/hunt-analyzer/estatisticas.js", import.meta.url), "utf8");
const ctx = { window: {} };
vm.runInNewContext(codigo, ctx);
const E = ctx.window.PKA_ESTAT;

const perto = (v, alvo, tol, nome) => assert.ok(Math.abs(v - alvo) <= tol, `${nome}: deu ${v}, esperado ${alvo} (±${tol})`);

// sessão A: 972 kills de Glaceon, 34 shinys, 01:00:27 · sessão B: 1.222 kills, 45 shinys, 01:18:00
const A = { k: 34, n: 972, seg: 3627 }, B = { k: 45, n: 1222, seg: 4680 };

test("1. taxa total com faixa provável", () => {
  const w = E.wilson(A.k + B.k, A.n + B.n);
  perto(w.p * 100, 3.60, 0.005, "taxa %");
  perto(1 / w.p, 27.8, 0.05, "1 a cada");
  perto(w.lo * 100, 2.90, 0.005, "limite de baixo %");
  perto(w.hi * 100, 4.46, 0.005, "limite de cima %");
  perto(1 / w.hi, 22.4, 0.05, "1 a cada (menor)");
  perto(1 / w.lo, 34.5, 0.05, "1 a cada (maior)");
});

test("1. taxa da sessão A", () => {
  const w = E.wilson(A.k, A.n);
  perto(w.p * 100, 3.50, 0.005, "taxa %");
  perto(w.lo * 100, 2.51, 0.005, "limite de baixo %");
  perto(w.hi * 100, 4.85, 0.005, "limite de cima %");
});

test("1. nenhum shiny: a faixa só tem limite de cima", () => {
  const w = E.wilson(0, 500);
  assert.equal(w.lo, 0);
  assert.ok(w.hi > 0 && w.hi < 0.01);
});

test("2. sorte da sessão A comparada com a B", () => {
  const s = E.sorte(A.k, A.n, B.k, B.n);
  perto(s.esperado, 35.8, 0.05, "esperado");
  assert.equal(s.obtido, 34);
  assert.equal(Math.round(s.percentil), 42);
  assert.equal(s.rotulo, "dentro do normal");
});

test("2. sem outras sessões", () => {
  assert.equal(E.sorte(34, 972, 0, 0).motivo, "sem-outras");
});

test("2. rótulos de sorte", () => {
  assert.equal(E.rotuloSorte(3), "azar fora do comum");
  assert.equal(E.rotuloSorte(10), "abaixo da média");
  assert.equal(E.rotuloSorte(50), "dentro do normal");
  assert.equal(E.rotuloSorte(90), "acima da média");
  assert.equal(E.rotuloSorte(97), "sorte fora do comum");
});

test("3. as duas sessões têm a mesma taxa", () => {
  const r = E.mesmaTaxa([A, B]);
  perto(r.qui2, 0.05, 0.005, "qui-quadrado");
  perto(r.p, 0.82, 0.005, "p");
  assert.equal(r.gl, 1);
  assert.equal(r.pequena, true, "só 2 sessões: amostra pequena");
  assert.equal(r.motivo, "poucas-linhas");
});

test("3. faixas de horário", () => {
  assert.equal(E.faixaHorario(1), "Madrugada");  // sessão B começou 01:04
  assert.equal(E.faixaHorario(11), "Manhã");     // sessão A começou 11:02
  assert.equal(E.faixaHorario(12), "Tarde");
  assert.equal(E.faixaHorario(23), "Noite");
});

test("4. projeção de 3 horas", () => {
  const horas = (A.seg + B.seg) / 3600;
  const p = E.projecao(A.k + B.k, horas, 3);
  assert.equal(Math.round(p.esperado), 103);
  assert.equal(p.lo, 86);
  assert.equal(p.hi, 120);
});

test("5. chance de seca", () => {
  const p = (A.k + B.k) / (A.n + B.n);
  perto(E.seca(p, 50) * 100, 16.0, 0.05, "50 kills");
  perto(E.seca(p, 100) * 100, 2.6, 0.05, "100 kills");
  perto(E.seca(p, 150) * 100, 0.4, 0.05, "150 kills");
});

test("6. kills para margem de ±0,5 ponto", () => {
  const p = (A.k + B.k) / (A.n + B.n);
  const n = E.killsParaMargem(p, 0.005);
  assert.equal(Math.round(n / 100) * 100, 5300);
});

test("7. Ice Essence na sessão A, por 100 kills", () => {
  const f = E.poissonFaixa(366, A.n);
  perto(f.taxa * 100, 37.65, 0.005, "por 100 kills");
  perto(f.lo * 100, 33.90, 0.01, "limite de baixo");
  perto(f.hi * 100, 41.72, 0.01, "limite de cima");
});

// Shiny Arcanine no Critical Catch: 332 capturas, mediana 904,5, P80 2.773, P95 3.260, máximo 5.207
const arcanine = { mediana: 904.5, p80: 2773, p95: 3260, maximo: 5207, capturas: 332 };

test("8. posição na curva com 2.323 brokes", () => {
  const c = E.curvaComunidade(arcanine);
  assert.equal(Math.round((1 - E.sobrevivencia(c, 2323)) * 100), 75);
});

test("8. chance de fechar nas próximas 500", () => {
  const c = E.curvaComunidade(arcanine);
  assert.equal(Math.round(E.chanceProximas(c, 2323, 500) * 100), 30);
});

test("8. acima do máximo a curva não responde", () => {
  const c = E.curvaComunidade(arcanine);
  assert.equal(E.sobrevivencia(c, 5300), null);
  assert.equal(E.chanceProximas(c, 5000, 500), null);
});

test("8. taxa base e chance de aura", () => {
  const h0 = E.taxaBase(arcanine.mediana);
  assert.equal(Math.round(1 / h0), 1305);
  assert.equal(Math.round(E.chanceAura(h0, 300) * 100), 21);
  assert.equal(Math.round(E.chanceAura(h0, 642) * 100), 39);
  assert.equal(Math.round(E.estoqueParaChance(h0, 0.8) / 100) * 100, 2100);
});

test("8. números fora de ordem são recusados", () => {
  assert.equal(E.curvaComunidade({ mediana: 3000, p80: 2773, p95: 3260, maximo: 5207, capturas: 332 }).erro, "ordem");
});
