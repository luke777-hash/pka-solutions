// Testes das contas da Gestão da Guild. Rodar com: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const codigo = readFileSync(new URL("../public/guild/guild-calc.js", import.meta.url), "utf8");
const ctx = { window: {} };
vm.runInNewContext(codigo, ctx);
const G = ctx.window.PKA_GUILD;
const j = (v) => JSON.parse(JSON.stringify(v));

test("diamond: a n-ª doação custa 2^(n-1) e n doações custam 2^n - 1", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(G.diamondDaVez), [1, 2, 4, 8, 16]);
  assert.deepEqual([1, 2, 3, 4, 5].map(G.diamondsTotal), [1, 3, 7, 15, 31]);
  assert.equal(G.diamondsTotal(0), 0);
});

test("semana começa segunda 00:00 e termina domingo", () => {
  assert.equal(G.chaveSemana(G.lerDataExport("2026-11-16 01:00:07")), "2026-11-16"); // segunda
  assert.equal(G.chaveSemana(G.lerDataExport("2026-11-22 23:59:59")), "2026-11-16"); // domingo
  assert.equal(G.chaveSemana(G.lerDataExport("2026-11-15 23:59:00")), "2026-11-09");
  assert.equal(G.chaveSemana(G.lerDataExport("2026-11-23 00:00:00")), "2026-11-23");
  const f = G.fracaoSemana(G.lerDataExport("2026-11-19 12:00:00")); // quinta meio-dia = 3,5 dias
  assert.ok(Math.abs(f - 0.5) < 1e-9);
});

test("como completar os pontos que faltam", () => {
  assert.deepEqual(j(G.comoCompletar(6)), { primal: 2, wildscape: 3, normal: 6, mistura: { primal: 1, wildscape: 1, normal: 0 } });
  assert.deepEqual(j(G.comoCompletar(7)).mistura, { primal: 1, wildscape: 1, normal: 1 });
  assert.deepEqual(j(G.comoCompletar(0)), { primal: 0, wildscape: 0, normal: 0, mistura: { primal: 0, wildscape: 0, normal: 0 } });
});

test("rendimento das dailies e doações", () => {
  const r = G.rendimento({ normal: 1, wildscape: 1, primal: 1, dolar: 3, diamond: 2 });
  assert.equal(r.pontos, 7);
  assert.equal(r.saldo, 150 + 300 + 600 + 900 + 2000);
  assert.equal(r.guildXp, 1050);
  assert.equal(r.xp, 1110000);
  assert.equal(r.tokens, 24);
  assert.equal(r.dinheiro, 300000);
  assert.equal(r.diamonds, 3);
});

test("lê o JSON exportado pelo jogo", () => {
  const im = G.lerArquivo("GuildMembers_Luke_Drk_2026-11-16_010007.json", JSON.stringify({
    guild: "Teste", exportedAt: "2026-11-16 01:00:07",
    members: [{ name: "A", rank: "a Member", level: 502, status: "online", lastLogin: "", points: 0, contribution: 1900 }]
  }));
  assert.equal(im.guild, "Teste");
  assert.equal(im.exportedAt, "2026-11-16 01:00:07");
  assert.equal(im.members[0].contribution, 1900);
});

test("lê CSV com ; ou , e valores com $ e ponto de milhar", () => {
  const a = G.lerArquivo("GuildMembers_X_2026-11-16_010007.csv", "Nome;Cargo;Nível;Status;Último acesso;Pontos;Contribuição\nLuke Drk;a Member;502;online;;0;$1.000\n\"Fulano, o Bravo\";a Member;348;offline;15/11/2026 19:56:36;4;$900\n");
  assert.equal(a.exportedAt, "2026-11-16 01:00:07");
  assert.equal(a.members.length, 2);
  assert.equal(a.members[0].contribution, 1000);
  assert.equal(a.members[1].name, "Fulano, o Bravo");
  assert.equal(a.members[1].points, 4);
  const b = G.lerArquivo("x.csv", "name,rank,level,status,lastLogin,points,contribution\n\"Fulano, o Bravo\",a Member,348,offline,15/11/2026 19:56:36,4,900\n");
  assert.equal(b.members[0].name, "Fulano, o Bravo");
  assert.equal(b.members[0].lastLogin, "15/11/2026 19:56:36");
  assert.equal(b.exportedAt, null);
});

const m = (name, points, contribution) => ({ name, rank: "a Member", level: 400, status: "offline", lastLogin: "", points, contribution });
const imports = [
  { guild: "G", exportedAt: "2026-11-15 22:00:00", members: [m("A", 10, 5000), m("B", 8, 1000)] },
  { guild: "G", exportedAt: "2026-11-17 10:00:00", members: [m("A", 12, 5500), m("B", 8, 1000), m("C", 1, 0)] },
  { guild: "G", exportedAt: "2026-11-19 12:00:00", members: [m("A", 16, 6100), m("C", 3, 150)] }
];

test("semana: modo zera usa o valor da última importação", () => {
  const r = G.valoresDaSemana(imports, "2026-11-16", { pontos: "zera", contrib: "zera" });
  assert.equal(r.importacoes, 2);
  const A = r.membros.find((x) => x.name === "A");
  assert.equal(A.pontos, 16); assert.equal(A.contrib, 6100);
  assert.equal(A.dPontos, 4); assert.equal(A.dContrib, 600);
  assert.deepEqual(j(r.sairam), ["B"]);
});

test("semana: modo acumula desconta a semana anterior", () => {
  const r = G.valoresDaSemana(imports, "2026-11-16", { pontos: "acumula", contrib: "acumula" });
  const A = r.membros.find((x) => x.name === "A"), C = r.membros.find((x) => x.name === "C");
  assert.equal(A.pontos, 6); assert.equal(A.contrib, 1100); assert.equal(A.semBase, false);
  assert.equal(C.pontos, 2); assert.equal(C.contrib, 150); assert.equal(C.semBase, true);
});

test("avaliar: bateu, no caminho e abaixo", () => {
  const metas = { pontos: 14, contrib: 0, regra: "todas" };
  assert.equal(G.avaliar({ pontos: 14, contrib: 0 }, metas, 0.5).situacao, "bateu");
  assert.equal(G.avaliar({ pontos: 7, contrib: 0 }, metas, 0.5).situacao, "caminho");
  const ab = G.avaliar({ pontos: 6, contrib: 0 }, metas, 0.5);
  assert.equal(ab.situacao, "abaixo"); assert.equal(ab.faltaPontos, 8);
  const duas = { pontos: 10, contrib: 1000, regra: "todas" };
  assert.equal(G.avaliar({ pontos: 10, contrib: 0 }, duas, 1).situacao, "abaixo");
  assert.equal(G.avaliar({ pontos: 10, contrib: 0 }, { ...duas, regra: "qualquer" }, 1).situacao, "bateu");
  assert.equal(G.avaliar({ pontos: 0, contrib: 0 }, { pontos: null, contrib: null }, 1).situacao, null);
});

test("Discord: valida webhook e ID e divide mensagens longas", () => {
  assert.ok(G.webhookValido("https://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz_-ABC"));
  assert.ok(!G.webhookValido("https://example.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"));
  assert.ok(!G.webhookValido("http://discord.com/api/webhooks/123456789012345678/abcdefghijklmnopqrstuvwxyz"));
  assert.ok(G.idDiscordValido("123456789012345678"));
  assert.ok(!G.idDiscordValido("Fulano#1234"));
  const linhas = Array.from({ length: 100 }, (_, i) => "linha " + i + " " + "x".repeat(40));
  const partes = G.dividirMensagem(linhas.join("\n"), 2000);
  assert.ok(partes.length > 1);
  assert.ok(partes.every((p) => p.length <= 2000));
  assert.equal(partes.join("\n"), linhas.join("\n"));
});

test("dias desde o último acesso", () => {
  const ref = G.lerDataExport("2026-11-16 01:00:07");
  assert.ok(Math.abs(G.diasDesde("13/11/2026 23:30:47", ref) - 2.062) < 0.01);
  assert.equal(G.diasDesde("", ref), null);
});
