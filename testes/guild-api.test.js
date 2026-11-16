// Testes do backend da Gestão da Guild (api/guild.js) com um Redis de mentira em memória e um Discord de mentira.
// Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { criarHandler, codigoLimpo, dividirMensagem, cifrar, decifrar, LIMITES } from "../api/guild.js";

function redisFalso() {
  const m = new Map();
  return async (cmd, k, v, ...op) => {
    if (cmd === "GET") return m.has(k) ? m.get(k) : null;
    if (cmd === "SET") { if (op.includes("NX") && m.has(k)) return null; m.set(k, v); return "OK"; }
    if (cmd === "DEL") { m.delete(k); return 1; }
    if (cmd === "INCR" || cmd === "INCRBY") { const n = (+m.get(k) || 0) + (cmd === "INCRBY" ? +v : 1); m.set(k, String(n)); return n; }
    if (cmd === "EXPIRE") return 1;
    throw new Error("comando " + cmd);
  };
}
const enviados = [];
const discordFalso = async (url, o) => { enviados.push({ url, corpo: JSON.parse(o.body) }); return { ok: true, status: 200, json: async () => ({}) }; };
const db = redisFalso();
const h = criarHandler(() => db, discordFalso);
async function chamar(corpo, opc = {}) {
  const r = { st: 0, j: null, headers: {} };
  const res = { setHeader: (k, v) => (r.headers[k] = v), status(s) { r.st = s; return this; }, json(j) { r.j = j; return this; } };
  const headers = { "content-type": "application/json", "x-real-ip": opc.ip || "10.0.0.1", ...(opc.headers || {}) };
  await (opc.h || h)({ method: opc.method || "POST", headers, body: corpo }, res);
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
  assert.equal(r.j.dados.cfg.metaContrib, 1000); assert.equal(r.j.dados.cfg.discord.B, undefined);
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

// ---------- segurança ----------
test("só aceita POST com JSON", async () => {
  let r = await chamar({ acao: "ler" }, { method: "GET" });
  assert.equal(r.st, 405);
  r = await chamar("acao=entrar", { headers: { "content-type": "application/x-www-form-urlencoded" } });
  assert.equal(r.st, 415);
  r = await chamar("{quebrado");
  assert.equal(r.st, 400);
  r = await chamar([1, 2]);
  assert.equal(r.st, 400);
  assert.equal(r.headers["Cache-Control"], "no-store");
});

test("senha nova precisa de 8 a 200 caracteres", async () => {
  let r = await chamar({ acao: "criar", codigo: "curta", senha: "1234567" }, { ip: "10.1.0.1" });
  assert.equal(r.st, 400);
  r = await chamar({ acao: "criar", codigo: "longa", senha: "x".repeat(201) }, { ip: "10.1.0.1" });
  assert.equal(r.st, 400);
  r = await chamar({ acao: "entrar", codigo: "intocaveis", senha: { $ne: 1 } }, { ip: "10.1.0.1" });
  assert.equal(r.st, 401);
});

test("trocar a senha pede a atual e derruba as outras sessões", async () => {
  await chamar({ acao: "criar", codigo: "troca-senha", senha: "primeira1" }, { ip: "10.2.0.1" });
  const a = (await chamar({ acao: "entrar", codigo: "troca-senha", senha: "primeira1" }, { ip: "10.2.0.1" })).j.token;
  const b = (await chamar({ acao: "entrar", codigo: "troca-senha", senha: "primeira1" }, { ip: "10.2.0.2" })).j.token;
  let r = await chamar({ acao: "senha", token: a, atual: "errada000", nova: "segunda22" });
  assert.equal(r.st, 403);
  r = await chamar({ acao: "senha", token: a, atual: "primeira1", nova: "segunda22" });
  assert.equal(r.st, 200); assert.ok(r.j.token);
  const novo = r.j.token;
  assert.equal((await chamar({ acao: "ler", token: a })).st, 401);
  assert.equal((await chamar({ acao: "ler", token: b })).st, 401);
  assert.equal((await chamar({ acao: "ler", token: novo })).st, 200);
  assert.equal((await chamar({ acao: "entrar", codigo: "troca-senha", senha: "primeira1" }, { ip: "10.2.0.3" })).st, 401);
  assert.equal((await chamar({ acao: "entrar", codigo: "troca-senha", senha: "segunda22" }, { ip: "10.2.0.3" })).st, 200);
});

test("sessões antigas (sem geração) continuam valendo", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const cod = await db("GET", "guild-sessao:" + token);
  await db("SET", "guild-sessao:velha-sessao-sem-geracao-01", cod.split("|")[0]);
  assert.equal((await chamar({ acao: "ler", token: "velha-sessao-sem-geracao-01" })).st, 200);
});

test("bloqueia força bruta por IP e por guild", async () => {
  await chamar({ acao: "criar", codigo: "alvo-forca", senha: "certa1234" }, { ip: "10.3.0.1" });
  for (let i = 0; i < LIMITES.erroGuildIp[0]; i++) await chamar({ acao: "entrar", codigo: "alvo-forca", senha: "errada" + i + "xx" }, { ip: "10.3.0.9" });
  let r = await chamar({ acao: "entrar", codigo: "alvo-forca", senha: "certa1234" }, { ip: "10.3.0.9" });
  assert.equal(r.st, 429);
  // de outro IP o dono ainda entra
  r = await chamar({ acao: "entrar", codigo: "alvo-forca", senha: "certa1234" }, { ip: "10.3.0.2" });
  assert.equal(r.st, 200);
});

test("limite de criar guild por IP", async () => {
  let ultimo;
  for (let i = 0; i <= LIMITES.criar[0]; i++) ultimo = await chamar({ acao: "criar", codigo: "spam-" + i, senha: "senha1234" }, { ip: "10.4.0.1" });
  assert.equal(ultimo.st, 429);
});

test("ajustes não aceitam __proto__ nem valores estranhos", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const cfg = JSON.parse('{"isentos":{"__proto__":true,"constructor":true,"B":"sim","C":true},"discord":{"__proto__":"123456789012345678","C":123456789012345678},"metaPontos":"1e400","diasInativo":99999}');
  const r = await chamar({ acao: "cfg", token, cfg });
  assert.equal(r.st, 200);
  const c = r.j.dados.cfg;
  assert.deepEqual(Object.keys(c.isentos), ["C"]);
  assert.deepEqual(Object.keys(c.discord), []);
  assert.equal(c.metaPontos, null); assert.equal(c.diasInativo, 365);
  assert.equal({}.isAdmin, undefined);
});

test("importação limpa texto e recusa datas e números absurdos", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const ims = [
    { guild: "X", exportedAt: "2026-13-40 99:99:99", members: [{ name: "A" }] },
    { guild: "X", exportedAt: "2026-11-17 10:00:00", members: [null, 5, { name: { a: 1 } }, { name: "<img src=x onerror=alert(1)>\u0000", points: "9".repeat(400), contribution: [1] }] },
  ];
  const r = await chamar({ acao: "importar", token, imports: ims });
  const im = r.j.dados.imports.find((x) => x.guild === "X");
  assert.equal(r.j.dados.imports.filter((x) => x.guild === "X").length, 1);
  assert.equal(im.members.length, 1);
  assert.equal(im.members[0].points, 0); assert.equal(im.members[0].contribution, 0);
});

test("pedido grande demais é recusado", async () => {
  const r = await chamar(JSON.stringify({ acao: "ler", lixo: "x".repeat(1_600_000) }));
  assert.equal(r.st, 413);
});

test("webhook cifrado com GUILD_CHAVE e nunca devolvido", async () => {
  const env = { GUILD_CHAVE: "k".repeat(40) };
  const c = cifrar(HOOK, env);
  assert.ok(c.startsWith("v1:") && !c.includes("discord"));
  assert.equal(decifrar(c, env), HOOK);
  assert.throws(() => decifrar(c.slice(0, -4) + "AAAA", env));
  const db2 = redisFalso(), env2 = { GUILD_CHAVE: "z".repeat(40) };
  const h2 = criarHandler(() => db2, discordFalso, env2);
  const t = (await chamar({ acao: "criar", codigo: "cifra", senha: "senha1234" }, { h: h2, ip: "10.5.0.1" })).j.token;
  const r = await chamar({ acao: "hook", token: t, url: HOOK }, { h: h2 });
  assert.equal(r.j.hook.final, "ABCD");
  assert.ok((await db2("GET", "guild:cifra:hook")).startsWith("v1:"));
  const antes = enviados.length;
  assert.equal((await chamar({ acao: "enviar", token: t, texto: "oi" }, { h: h2 })).st, 200);
  assert.equal(enviados[antes].url, HOOK + "?wait=true");
});

test("enviar só menciona IDs válidos e nunca @everyone", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const antes = enviados.length;
  await chamar({ acao: "enviar", token, texto: "@everyone @here teste", ids: [123456789012345678, "123456789012345678", "1 OR 1"] });
  const c = enviados[antes].corpo;
  assert.deepEqual(c.allowed_mentions, { parse: [], users: ["123456789012345678"] });
  assert.ok(c.content.includes("\n") === false);
});

test("cópia de segurança sai sem webhook e volta igual", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const bk = await chamar({ acao: "backup", token });
  assert.equal(bk.st, 200); assert.equal(bk.j.tipo, "pka-guild-backup");
  assert.ok(!JSON.stringify(bk.j).includes("webhooks"));
  const n = bk.j.dados.imports.length;
  await chamar({ acao: "apagarTudo", token, guild: "Intocaveis" });
  let r = await chamar({ acao: "restaurar", token, backup: { tipo: "outro" } });
  assert.equal(r.st, 400);
  r = await chamar({ acao: "restaurar", token, backup: bk.j });
  assert.equal(r.st, 200); assert.equal(r.j.dados.imports.length, n);
});

test("token de uma guild não lê outra", async () => {
  const t1 = (await chamar({ acao: "criar", codigo: "guild-um", senha: "senha1234" }, { ip: "10.6.0.1" })).j.token;
  await chamar({ acao: "criar", codigo: "guild-dois", senha: "senha1234" }, { ip: "10.6.0.1" });
  const r = await chamar({ acao: "ler", token: t1, codigo: "guild-dois" });
  assert.equal(r.j.codigo, "guild-um");
});

// ---------- achados dos agentes de ataque (cada um virou teste) ----------
test("[ataque 4] JSON aninhado demais vira 400 e não derruba a função", async () => {
  let fundo = {}; const raiz = fundo;
  for (let i = 0; i < 20000; i++) { fundo.a = {}; fundo = fundo.a; }
  const r = await chamar(raiz);
  assert.equal(r.st, 400);
});

test("[ataque 4] datas que não existem no calendário são recusadas", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  const r = await chamar({ acao: "importar", token, imports: ["2026-02-31", "2026-11-31", "0000-01-01"].map((d) => ({ guild: "Datas", exportedAt: d + " 10:00:00", members: [{ name: "A" }] })) });
  assert.equal(r.j.dados.imports.filter((x) => x.guild === "Datas").length, 0);
});

test("[ataque 4] mensagem longa não parte emoji ao meio", () => {
  const partes = dividirMensagem("a".repeat(1999) + "😀" + "b".repeat(10));
  assert.ok(partes.every((p) => !/[\ud800-\udbff]$/.test(p)));
  assert.equal(partes.join(""), "a".repeat(1999) + "😀" + "b".repeat(10));
});

test("[ataque 1] ataque de muitos IPs não tranca o dono para fora", async () => {
  await chamar({ acao: "criar", codigo: "alvo-dos", senha: "certa1234" }, { ip: "10.7.0.1" });
  for (let i = 0; i < LIMITES.erroGuild[0] + 5; i++) await chamar({ acao: "entrar", codigo: "alvo-dos", senha: "errada" + i + "xx" }, { ip: "10.8." + Math.floor(i / 5) + ".1" });
  const r = await chamar({ acao: "entrar", codigo: "alvo-dos", senha: "certa1234" }, { ip: "10.7.0.1" });
  assert.equal(r.st, 200);
});

test("[ataque 1] x-forwarded-for inventado não abre novos limites", async () => {
  let ultimo;
  for (let i = 0; i <= LIMITES.criar[0]; i++) {
    ultimo = await chamar({ acao: "criar", codigo: "xff-" + i, senha: "senha1234" }, { headers: { "x-real-ip": undefined, "x-forwarded-for": "1.2.3." + i } });
  }
  assert.equal(ultimo.st, 429);
});

test("[ataque 2] chutar a senha atual na troca de senha bloqueia como no login", async () => {
  const t = (await chamar({ acao: "criar", codigo: "chute-atual", senha: "certa1234" }, { ip: "10.9.0.1" })).j.token;
  let r;
  for (let i = 0; i < LIMITES.erroGuildIp[0]; i++) r = await chamar({ acao: "senha", token: t, atual: "chute" + i + "xx", nova: "outra12345" }, { ip: "10.9.0.5" });
  assert.equal(r.st, 403);
  r = await chamar({ acao: "senha", token: t, atual: "certa1234", nova: "outra12345" }, { ip: "10.9.0.5" });
  assert.equal(r.st, 429);
});

test("[ataque 6] limite do Discord conta cada parte da mensagem", async () => {
  const t = (await chamar({ acao: "criar", codigo: "spam-discord", senha: "senha1234" }, { ip: "10.10.0.1" })).j.token;
  await chamar({ acao: "hook", token: t, url: HOOK });
  const grande = ("x".repeat(1990) + "\n").repeat(10);
  let ok = 0, r;
  for (let i = 0; i < 6; i++) { r = await chamar({ acao: "enviar", token: t, texto: grande }); if (r.st === 200) ok += r.j.partes; }
  assert.ok(ok <= LIMITES.enviar[0]);
  assert.equal(r.st, 429);
});

test("[ataque 6] auto precisa ser true/false e o nome do bot não pode imitar o Discord", async () => {
  const { j: { token } } = await chamar({ acao: "entrar", codigo: "intocaveis", senha: "segredo1" });
  assert.equal((await chamar({ acao: "enviar", token, texto: "x", auto: "true" })).st, 400);
  const antes = enviados.length;
  await chamar({ acao: "enviar", token, texto: "oi", nome: "Discord System" });
  assert.equal(enviados[antes].corpo.username, undefined);
});

test("[ataque 7] dados de uma guild nunca passam do tamanho máximo", async () => {
  const t = (await chamar({ acao: "criar", codigo: "gorda", senha: "senha1234" }, { ip: "10.11.0.1" })).j.token;
  const membros = Array.from({ length: 200 }, (_, i) => ({ name: "M".repeat(55) + i, rank: "r".repeat(30), status: "s".repeat(20), lastLogin: "l".repeat(25), level: 999, points: 1e11, contribution: 1e11 }));
  for (let lote = 0; lote < 8; lote++) {
    const ims = Array.from({ length: 6 }, (_, i) => ({ guild: "G", exportedAt: "2026-11-1" + (6 + (i % 4)) + " 1" + lote + ":0" + i + ":00", members: membros }));
    await chamar({ acao: "importar", token: t, imports: ims });
  }
  const tam = (await db("GET", "guild:gorda:dados")).length;
  assert.ok(tam < 3_000_000, "guardou " + tam);
});

test("[ataque 10] restaurar recusa cópia de outra guild e de versão futura", async () => {
  const ta = (await chamar({ acao: "criar", codigo: "rest-a", senha: "senha1234" }, { ip: "10.12.0.1" })).j.token;
  const tb = (await chamar({ acao: "criar", codigo: "rest-b", senha: "senha1234" }, { ip: "10.12.0.1" })).j.token;
  const bk = (await chamar({ acao: "backup", token: ta })).j;
  assert.equal((await chamar({ acao: "restaurar", token: tb, backup: bk })).st, 400);
  assert.equal((await chamar({ acao: "restaurar", token: ta, backup: { ...bk, versao: 99 } })).st, 400);
  assert.equal((await chamar({ acao: "restaurar", token: ta, backup: { ...bk, dados: {} } })).st, 400);
  assert.equal((await chamar({ acao: "restaurar", token: ta, backup: bk })).st, 200);
});

test("[ataque 10] apagar tudo pode ser desfeito", async () => {
  const t = (await chamar({ acao: "criar", codigo: "desfaz", senha: "senha1234" }, { ip: "10.13.0.1" })).j.token;
  await chamar({ acao: "importar", token: t, imports: [{ guild: "D", exportedAt: "2026-11-16 10:00:00", members: [{ name: "A" }] }] });
  let r = await chamar({ acao: "apagarTudo", token: t, guild: "D" });
  assert.equal(r.j.dados.imports.length, 0); assert.ok(r.j.desfazer);
  r = await chamar({ acao: "desfazer", token: t });
  assert.equal(r.j.dados.imports.length, 1);
  r = await chamar({ acao: "desfazer", token: t });
  assert.equal(r.j.dados.imports.length, 0);
});
