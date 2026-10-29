// Testes da busca de estatísticas do Critical Catch (api/critical-catch.js), sem acessar a internet.
// Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import handler, { resumir } from "../api/critical-catch.js";

// mesmo formato do arquivo stats-v2.json do Critical Catch (só os campos que importam aqui)
const exemplo = {
  schemaVersion: 3,
  updatedAt: "2026-10-29T18:31:03.050Z",
  averagesSince: "2025-12-15T00:00:00-03:00",
  lastCatchAt: "2026-10-29T18:11:37.000Z",
  shinyStats: [
    { pokemon: "Glaceon", captures: 45, avgBalls: 4358.69, medianBalls: 2342, p80Balls: 7059, p95Balls: 16676, maxBalls: 22673 },
    { pokemon: "Arcanine", captures: 1797, avgBalls: 1371.3, medianBalls: 1018, p80Balls: 2969, p95Balls: 3280, maxBalls: 5207 },
  ],
};

function respostaFalsa() {
  const r = { status: 0, headers: {}, corpo: null };
  return Object.assign(r, {
    setHeader(k, v) { r.headers[k] = v; },
    status(c) { r.status = c; return r; },
    json(o) { r.corpo = o; return r; },
  });
}

test("resumir guarda nome, capturas, média, mediana, P80, P95 e máximo", () => {
  const d = resumir(exemplo);
  assert.equal(d.atualizadoEm, "2026-10-29T18:31:03.050Z");
  assert.deepEqual(d.shiny[0], ["Glaceon", 45, 4358.69, 2342, 7059, 16676, 22673]);
  assert.equal(d.shiny.length, 2);
});

test("resumir recusa um arquivo em outro formato", () => {
  assert.equal(resumir({ stats: [] }), null);
  assert.equal(resumir(null), null);
});

test("a função responde com os dados e guarda por 30 minutos", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => exemplo });
  try {
    const res = respostaFalsa();
    await handler({}, res);
    assert.equal(res.status, 200);
    assert.equal(res.corpo.shiny[1][0], "Arcanine");
    assert.match(res.headers["Cache-Control"], /s-maxage=1800/);
  } finally { globalThis.fetch = original; }
});

test("se o Critical Catch falhar, a função avisa sem quebrar", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });
  try {
    const res = respostaFalsa();
    await handler({}, res);
    assert.equal(res.status, 502);
    assert.ok(res.corpo.erro);
  } finally { globalThis.fetch = original; }
});
