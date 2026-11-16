// Backend da Gestão da Guild: guarda as importações e os ajustes de cada guild para todos os admins verem o mesmo.
// Roda na Vercel. O banco é um Redis da Upstash (a integração da Vercel cria as variáveis KV_REST_API_URL e KV_REST_API_TOKEN).
// Cada guild tem um código e uma senha; quem entra com a senha recebe um token de sessão que vale 30 dias.
// O webhook do Discord fica só aqui no servidor: a página nunca recebe o endereço de volta, só os últimos caracteres.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSAO_DIAS = 30;
const MAX_SEMANAS = 12;          // guarda as importações das últimas 12 semanas
const MAX_TENTATIVAS = 10;       // senhas erradas por guild a cada 15 minutos
const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,200}\/?$/;

// ---------- Redis pela API REST da Upstash ----------
export function redisDoAmbiente(env = process.env, f = fetch) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (...cmd) => {
    const r = await f(url, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(cmd) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error("banco: " + (j.error || r.status));
    return j.result;
  };
}

// ---------- ajudantes ----------
export function codigoLimpo(s) {
  return String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function hash(senha, sal) { return scryptSync(String(senha), sal, 32).toString("hex"); }
function confere(senha, sal, esperado) {
  const a = Buffer.from(hash(senha, sal), "hex"), b = Buffer.from(String(esperado), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function webhookValido(u) { return WEBHOOK_RE.test(String(u || "").trim()); }
export function dividirMensagem(texto, max = 2000) {
  const partes = []; let atual = "";
  for (let l of String(texto).split("\n")) {
    while (l.length > max) { if (atual) { partes.push(atual); atual = ""; } partes.push(l.slice(0, max)); l = l.slice(max); }
    const junto = atual ? atual + "\n" + l : l;
    if (junto.length > max) { partes.push(atual); atual = l; } else atual = junto;
  }
  if (atual.trim()) partes.push(atual);
  return partes;
}
// segunda-feira da semana de "2026-11-16 01:00:07"
function chaveSemana(exportedAt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(exportedAt || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const numero = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const texto = (v, max = 60) => String(v == null ? "" : v).slice(0, max);
function importLimpo(im) {
  if (!im || !Array.isArray(im.members) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(String(im.exportedAt))) return null;
  return {
    guild: texto(im.guild, 60), exportedAt: String(im.exportedAt),
    members: im.members.slice(0, 200).map((m) => ({
      name: texto(m.name), rank: texto(m.rank, 30), level: numero(m.level), status: texto(m.status, 20),
      lastLogin: texto(m.lastLogin, 25), points: numero(m.points), contribution: numero(m.contribution),
    })).filter((m) => m.name),
  };
}
function cfgLimpo(c) {
  c = c && typeof c === "object" ? c : {};
  const mapa = (o, fn) => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).slice(0, 300).map(([k, v]) => [texto(k), fn(v)]));
  const pos = (v) => (v == null || v === "" ? null : Math.max(0, numero(v)) || null);
  return {
    metaPontos: pos(c.metaPontos), metaContrib: pos(c.metaContrib), regra: c.regra === "qualquer" ? "qualquer" : "todas",
    diasInativo: pos(c.diasInativo) || 3, saldo: c.saldo == null || c.saldo === "" ? null : numero(c.saldo),
    isentos: mapa(c.isentos, () => true), discord: mapa(c.discord, (v) => (/^\d{17,20}$/.test(String(v)) ? String(v) : "")),
    hookNome: texto(c.hookNome, 80),
  };
}

// ---------- ações ----------
export function criarHandler(obterRedis = () => redisDoAmbiente(), f = fetch) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    const responder = (st, corpo) => res.status(st).json(corpo);
    if (req.method !== "POST") return responder(405, { erro: "Use POST." });
    const db = obterRedis();
    if (!db) return responder(503, { erro: "O banco da guild ainda não foi configurado no site." });
    let b = req.body;
    if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
    b = b || {};
    const acao = String(b.acao || "");
    const K = (cod, s) => "guild:" + cod + ":" + s;

    try {
      // ----- criar e entrar -----
      if (acao === "criar" || acao === "entrar") {
        const cod = codigoLimpo(b.codigo), senha = String(b.senha || "");
        if (cod.length < 3) return responder(400, { erro: "O código precisa ter pelo menos 3 letras ou números." });
        if (senha.length < 6) return responder(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });
        if (acao === "criar") {
          const sal = randomBytes(16).toString("hex");
          const ok = await db("SET", K(cod, "acesso"), JSON.stringify({ sal, hash: hash(senha, sal), criadoEm: new Date().toISOString() }), "NX");
          if (ok !== "OK") return responder(409, { erro: "Já existe uma guild com esse código. Use Entrar, ou escolha outro código." });
          await db("SET", K(cod, "dados"), JSON.stringify({ imports: [], cfg: cfgLimpo({}) }));
        } else {
          const tent = K(cod, "tentativas");
          const n = numero(await db("GET", tent));
          if (n >= MAX_TENTATIVAS) return responder(429, { erro: "Muitas senhas erradas. Espere 15 minutos." });
          const ac = JSON.parse((await db("GET", K(cod, "acesso"))) || "null");
          if (!ac || !confere(senha, ac.sal, ac.hash)) {
            await db("INCR", tent); await db("EXPIRE", tent, 900);
            return responder(401, { erro: "Código ou senha errados." });
          }
          await db("DEL", tent);
        }
        const token = randomBytes(24).toString("base64url");
        await db("SET", "guild-sessao:" + token, cod, "EX", SESSAO_DIAS * 86400);
        return responder(200, { token, codigo: cod });
      }

      // ----- daqui para baixo precisa estar dentro -----
      const token = String(b.token || "");
      const cod = /^[\w-]{20,64}$/.test(token) ? await db("GET", "guild-sessao:" + token) : null;
      if (!cod) return responder(401, { erro: "Sua sessão expirou. Entre de novo com o código e a senha." });

      const lerDados = async () => JSON.parse((await db("GET", K(cod, "dados"))) || "null") || { imports: [], cfg: cfgLimpo({}) };
      const gravar = (d) => db("SET", K(cod, "dados"), JSON.stringify(d));
      const resposta = async (d) => {
        const hook = (await db("GET", K(cod, "hook"))) || "";
        return responder(200, { codigo: cod, dados: d, hook: hook ? { configurado: true, final: hook.slice(-4) } : { configurado: false } });
      };

      if (acao === "ler") return resposta(await lerDados());
      if (acao === "sair") { await db("DEL", "guild-sessao:" + token); return responder(200, { ok: true }); }

      if (acao === "importar") {
        const d = await lerDados();
        const novas = (Array.isArray(b.imports) ? b.imports : []).slice(0, 50).map(importLimpo).filter(Boolean);
        for (const im of novas) {
          d.imports = d.imports.filter((x) => !(x.guild === im.guild && x.exportedAt === im.exportedAt));
          d.imports.push(im);
        }
        d.imports.sort((a, z) => (a.exportedAt < z.exportedAt ? -1 : 1));
        const semanas = [...new Set(d.imports.map((x) => chaveSemana(x.exportedAt)))].sort().slice(-MAX_SEMANAS);
        d.imports = d.imports.filter((x) => semanas.includes(chaveSemana(x.exportedAt)));
        await gravar(d);
        return resposta(d);
      }
      if (acao === "apagarImport") {
        const d = await lerDados();
        d.imports = d.imports.filter((x) => !(x.guild === b.guild && x.exportedAt === b.exportedAt));
        await gravar(d); return resposta(d);
      }
      if (acao === "apagarTudo") {
        const d = await lerDados(); d.imports = d.imports.filter((x) => x.guild !== b.guild);
        await gravar(d); return resposta(d);
      }
      if (acao === "cfg") {
        const d = await lerDados(); d.cfg = cfgLimpo({ ...d.cfg, ...(b.cfg || {}) });
        await gravar(d); return resposta(d);
      }
      if (acao === "senha") {
        const nova = String(b.nova || "");
        if (nova.length < 6) return responder(400, { erro: "A senha precisa ter pelo menos 6 caracteres." });
        const sal = randomBytes(16).toString("hex");
        await db("SET", K(cod, "acesso"), JSON.stringify({ sal, hash: hash(nova, sal), criadoEm: new Date().toISOString() }));
        return responder(200, { ok: true });
      }
      if (acao === "hook") {
        const url = String(b.url || "").trim();
        if (!url) { await db("DEL", K(cod, "hook")); return resposta(await lerDados()); }
        if (!webhookValido(url)) return responder(400, { erro: "Esse endereço não parece um webhook do Discord." });
        await db("SET", K(cod, "hook"), url);
        return resposta(await lerDados());
      }
      if (acao === "enviar") {
        const url = await db("GET", K(cod, "hook"));
        if (!url) return responder(400, { erro: "Nenhum webhook do Discord salvo para esta guild." });
        const partes = dividirMensagem(String(b.texto || "").slice(0, 20000));
        if (!partes.length) return responder(400, { erro: "A mensagem está vazia." });
        const ids = (Array.isArray(b.ids) ? b.ids : []).filter((x) => /^\d{17,20}$/.test(String(x))).slice(0, 100);
        const nome = texto(b.nome, 80).trim();
        for (const p of partes) {
          const corpo = { content: p, allowed_mentions: { parse: [], users: ids } };
          if (nome) corpo.username = nome;
          let r = await f(url + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
          if (r.status === 429) {
            const j = await r.json().catch(() => ({}));
            await new Promise((ok) => setTimeout(ok, Math.min(5, j.retry_after || 1) * 1000));
            r = await f(url + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) });
          }
          if (!r.ok) return responder(502, { erro: r.status === 401 || r.status === 404 ? "O Discord não achou esse webhook (foi apagado?)." : "O Discord respondeu " + r.status + "." });
        }
        return responder(200, { ok: true, partes: partes.length });
      }
      return responder(400, { erro: "Ação desconhecida." });
    } catch (e) {
      return responder(500, { erro: "Falha no servidor. Tente de novo em instantes." });
    }
  };
}

export default criarHandler();
