// Testes do backend da Gestão da Guild (api/guild.js) com um Redis de mentira em memória e um Discord de mentira.
// Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarHandler, codigoLimpo, dividirMensagem } from "../api/guild.js";

function redisFalso() {
  const m = new Map();
  return async (cmd, k, v, ...op) => {
    if (cmd === "GET") return m.has(k) ? m.get(k) : null;
    if (cmd === "SET") { if (op.includes("NX") && m.has(k)) return null; m.set(k, v); return "OK"; }
    if (cmd === "DEL") { m.delete(k); return 1; }
    if (cmd === "INCR") { const n = (+m.get(k) || 0) + 1; m.set(k, String(n)); return n; }
    if (cmd === "EXPIRE") return 1;
    throw new Error("comando " + cmd);
  };
}
const enviados = [];
const discordFalso = async (url, o) => { enviados.push({ url, corpo: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({}) }; };
const db = redisFalso();
const h = criarHandler(() => db, discordFalso);
async function chamar(corpo) {
  const r = { st: 0, j: null, headers: {} };
  const res = { setHeader: (k, v) => (r.headers[k] = v), status(s) { r.st = s; return this; }, json(j) { r.j = j; return this; } };
  await h({ method: "POST", body: corpo }, res);
  return r;
}
const HOOK = "https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyzABCD";

test("código da guild vira um código limpo", () => {
  assert.equal(codigoLimpo("  Intocáveis Sun "), "intocaveis-sun");
});

test("criar, entrar e senha errada", async () => {
  let r = await chamar({ acao: "criar", codigo: "Intocaveis", senha: "segredo1" });
  assert.equal(r.st, 200); assert.ok(r.j.token);
  r = await chamar({ acao: "criar", codigo: "intocaveis", senha: "outra123" });
  assert.equal(r.st, 409);
  r = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "errada99" });
  assert.equal(r.st, 401);
  r = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  assert.equal(r.st, 200);
  r = await chamar({ acao: "ler", token: "x".repeat(30) });
  assert.equal(r.st, 401);
});

test("importar, ajustes e webhook que nunca volta inteiro", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const im = { guild: "Intocaveis", exportedAt: "2026-11-16 01:00:07", members: [{ name: "A", rank: "a Member", level: 400, status: "online", lastLogin: "", points: 4, contribution: 900 }] };
  let r = await chamar({ acao: "importar", token, imports: [im, im, { lixo: 1 }] });
  assert.equal(r.st, 200); assert.equal(r.j.dados.imports.length, 1);
  r = await chamar({ acao: "cfg", token, cfg: { metaContrib: 1000, isentos: { A: true }, discord: { A: "123456789012345678", B: "nome#1" } } });
  assert.equal(r.j.dados.cfg.metaContrib, 1000); assert.equal(r.j.dados.cfg.discord.B, "");
  r = await chamar({ acao: "hook", token, url: "https://example.com/x" });
  assert.equal(r.st, 400);
  r = await chamar({ acao: "hook", token, url: HOOK });
  assert.equal(r.st, 200); assert.equal(r.j.hook.configurado, true); assert.equal(r.j.hook.final, "ABCD");
  assert.ok(!JSON.stringify(r.j).includes("123456789012345678/"));
  r = await chamar({ acao: "enviar", token, texto: "oi\n" + "x".repeat(2500), ids: ["123456789012345678", "ruim"], nome: "Guild" });
  assert.equal(r.st, 200); assert.equal(r.j.partes, 3);
  assert.equal(enviados[0].url, HOOK + "?wait=true");
  assert.deepEqual(enviados[0].corpo.allowed_mentions, { parse: [], users: ["123456789012345678"] });
});

test("guarda só as últimas 12 semanas", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const ims = [];
  for (let i = 0; i < 15; i++) {
    const d = new Date(Date.UTC(2026, 7, 3 + i * 7)).toISOString().slice(0, 10);
    ims.push({ guild: "Intocaveis", exportedAt: d + " 10:00:00", members: [{ name: "A", points: i }] });
  }
  const r = await chamar({ acao: "importar", token, imports: ims });
  const semanas = new Set(r.j.dados.imports.map((x) => x.exportedAt.slice(0, 10)));
  assert.equal(semanas.size, 12);
});

test("divide mensagens em até 2000 caracteres", () => {
  assert.ok(dividirMensagem("a\n".repeat(3000)).every((p) => p.length <= 2000));
});

test("guild que não existe responde 404 com orientação", async () => {
  const r = await chamar({ acao: "entrar", codigo: "nao-existe", senha: "qualquer1" });
  assert.equal(r.st, 404); assert.match(r.j.erro, /primeiro acesso/);
});

test("alerta automático sai só uma vez por dia", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const antes = enviados.length;
  let r = await chamar({ acao: "enviar", token, texto: "alerta", auto: true });
  assert.equal(r.j.ok, true); assert.equal(r.j.pulado, undefined);
  r = await chamar({ acao: "enviar", token, texto: "alerta", auto: true });
  assert.equal(r.j.pulado, true);
  assert.equal(enviados.length, antes + 1);
  r = await chamar({ acao: "enviar", token, texto: "manual" });
  assert.equal(r.j.partes, 1);
  r = await chamar({ acao: "ler", token });
  assert.ok(r.j.ultimoAlertaAuto);
});
