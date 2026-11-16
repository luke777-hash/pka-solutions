// Backend da Gestão da Guild: guarda as importações e os ajustes de cada guild para todos os admins verem o mesmo.
// Roda na Vercel. O banco é um Redis da Upstash (a integração da Vercel cria as variáveis KV_REST_API_URL e KV_REST_API_TOKEN).
// Cada guild tem um código e uma senha; quem entra com a senha recebe um token de sessão que vale 30 dias.
// Trocar a senha derruba todas as sessões da guild (cada sessão guarda a "geração" da senha com que entrou).
// O webhook do Discord fica só aqui no servidor: a página nunca recebe o endereço de volta, só os últimos caracteres.
// Se a variável GUILD_CHAVE existir na Vercel (32+ caracteres), o webhook é guardado cifrado (AES-256-GCM).
// Logs: só eventos (ex.: login errado), nunca senha, token, IP ou webhook.
import { randomBytes, scryptSync, timingSafeEqual, createHash, createCipheriv, createDecipheriv } from "node:crypto";

const SESSAO_DIAS = 30;
const MAX_SEMANAS = 12;           // guarda as importações das últimas 12 semanas
const MAX_IMPORTS = 300;          // e no máximo 300 importações por guild
const MAX_CORPO = 1_500_000;      // tamanho máximo de um pedido (caracteres)
const MAX_GUARDADO = 3_000_000;   // tamanho máximo dos dados de uma guild (a Vercel não responde mais de 4,5 MB)
const DESFAZER_DIAS = 7;          // por quanto tempo dá para desfazer a última mudança grande
const SENHA_MIN = 8, SENHA_MIN_ANTIGA = 6, SENHA_MAX = 200;
const VERSAO_DADOS = 1;
// limites: [quantas vezes, em quantos segundos]
export const LIMITES = {
  ip: [600, 600],                 // qualquer pedido, por IP: 600 a cada 10 min
  criar: [5, 3600],               // criar guild, por IP: 5 por hora
  entrarIp: [30, 900],            // tentativas de login, por IP: 30 a cada 15 min
  erroGuildIp: [10, 900],         // senhas erradas numa guild vindas do mesmo IP: 10 a cada 15 min
  erroGuild: [50, 900],           // senhas erradas numa guild, de qualquer IP: 50 a cada 15 min
  enviar: [30, 3600],             // mensagens (partes) no Discord por guild: 30 por hora
  escrever: [120, 600],           // importar/ajustes/apagar por guild: 120 a cada 10 min
};
const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d{5,25}\/[\w-]{20,200}\/?$/;

// ---------- Redis pela API REST da Upstash ----------
export function redisDoAmbiente(env = process.env, f = fetch) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return async (...cmd) => {
    const r = await f(url, { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(cmd) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error("banco respondeu " + r.status);
    return j.result;
  };
}

// ---------- ajudantes ----------
export function codigoLimpo(s) {
  return String(typeof s === "string" ? s : "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function hash(senha, sal) { return scryptSync(String(senha), sal, 32).toString("hex"); }
function confere(senha, sal, esperado) {
  const a = Buffer.from(hash(senha, sal), "hex"), b = Buffer.from(String(esperado), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
export function webhookValido(u) { return typeof u === "string" && WEBHOOK_RE.test(u.trim()); }
export function dividirMensagem(texto, max = 2000) {
  const partes = []; let atual = "";
  for (let l of String(texto).split("\n")) {
    while (l.length > max) {
      if (atual) { partes.push(atual); atual = ""; }
      let corte = max;
      const c = l.charCodeAt(corte - 1);
      if (c >= 0xd800 && c <= 0xdbff) corte--; // não parte um emoji ao meio
      partes.push(l.slice(0, corte)); l = l.slice(corte);
    }
    const junto = atual ? atual + "\n" + l : l;
    if (junto.length > max) { partes.push(atual); atual = l; } else atual = junto;
  }
  if (atual.trim()) partes.push(atual);
  return partes;
}
export function diaBrasilia(agora = Date.now()) { return new Date(agora - 3 * 3600000).toISOString().slice(0, 10); }
// segunda-feira da semana de "2026-11-16 01:00:07"
function chaveSemana(exportedAt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(exportedAt || ""));
  if (!m) return "";
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
const numero = (v) => {
  if (typeof v !== "number" && typeof v !== "string") return 0;
  const n = Math.round(+v);
  return Number.isFinite(n) ? Math.max(-1e12, Math.min(1e12, n)) : 0;
};
// texto de uma linha: sem caracteres de controle
const texto = (v, max = 60) => (typeof v === "string" || typeof v === "number" ? String(v) : "").replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").slice(0, max);
// texto da mensagem: mantém as quebras de linha
const textoLongo = (v, max) => (typeof v === "string" ? v : "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, "").slice(0, max);
const DATA_RE = /^(20\d\d)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]) ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;
// data que existe no calendário (recusa 31/02, 31/11...)
function dataValida(s) {
  const m = typeof s === "string" ? DATA_RE.exec(s) : null;
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}
function importLimpo(im) {
  if (!im || typeof im !== "object" || !Array.isArray(im.members) || !dataValida(im.exportedAt)) return null;
  const members = im.members.slice(0, 200).filter((m) => m && typeof m === "object").map((m) => ({
    name: texto(m.name), rank: texto(m.rank, 30), level: numero(m.level), status: texto(m.status, 20),
    lastLogin: texto(m.lastLogin, 25), points: numero(m.points), contribution: numero(m.contribution),
  })).filter((m) => m.name.trim());
  if (!members.length) return null;
  return { guild: texto(im.guild, 60).trim() || "Minha guild", exportedAt: im.exportedAt, members };
}
// mapa nome -> valor, sem chaves perigosas (__proto__, constructor...)
const PROIBIDAS = new Set(["__proto__", "constructor", "prototype"]);
function mapa(o, fn) {
  const out = {};
  if (!o || typeof o !== "object" || Array.isArray(o)) return out;
  for (const [k, v] of Object.entries(o).slice(0, 300)) {
    const kk = texto(k);
    if (!kk || PROIBIDAS.has(kk)) continue;
    const vv = fn(v);
    if (vv) out[kk] = vv;
  }
  return out;
}
export function cfgLimpo(c) {
  c = c && typeof c === "object" && !Array.isArray(c) ? c : {};
  const pos = (v) => (v == null || v === "" ? null : Math.max(0, numero(v)) || null);
  return {
    metaPontos: pos(c.metaPontos), metaContrib: pos(c.metaContrib), regra: c.regra === "qualquer" ? "qualquer" : "todas",
    diasInativo: Math.min(365, pos(c.diasInativo) || 3), saldo: c.saldo == null || c.saldo === "" ? null : numero(c.saldo),
    isentos: mapa(c.isentos, (v) => v === true || undefined),
    discord: mapa(c.discord, (v) => (typeof v === "string" && /^\d{17,20}$/.test(v) ? v : undefined)),
    hookNome: texto(c.hookNome, 80),
    alertaAuto: c.alertaAuto !== false,
  };
}
// dados guardados: completa campos que faltam e marca a versão do formato (o "migrations" daqui)
export function migrar(d) {
  d = d && typeof d === "object" && !Array.isArray(d) ? d : {};
  return { versao: VERSAO_DADOS, imports: (Array.isArray(d.imports) ? d.imports : []).map(importLimpo).filter(Boolean), cfg: cfgLimpo(d.cfg) };
}
function limitarImports(lista) {
  lista.sort((a, z) => (a.exportedAt < z.exportedAt ? -1 : 1));
  const semanas = [...new Set(lista.map((x) => chaveSemana(x.exportedAt)))].sort().slice(-MAX_SEMANAS);
  lista = lista.filter((x) => semanas.includes(chaveSemana(x.exportedAt))).slice(-MAX_IMPORTS);
  // se passar do tamanho máximo, saem as importações mais antigas
  let tam = JSON.stringify(lista).length;
  while (tam > MAX_GUARDADO - 100_000 && lista.length > 1) tam -= JSON.stringify(lista.shift()).length + 1;
  return lista;
}

// ---------- cifra do webhook ----------
function chaveCifra(env) {
  const k = env.GUILD_CHAVE;
  return k && k.length >= 32 ? createHash("sha256").update(k).digest() : null;
}
export function cifrar(txt, env = process.env) {
  const k = chaveCifra(env);
  if (!k) return txt;
  const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", k, iv);
  const corpo = Buffer.concat([c.update(txt, "utf8"), c.final()]);
  return "v1:" + Buffer.concat([iv, c.getAuthTag(), corpo]).toString("base64");
}
export function decifrar(v, env = process.env) {
  if (!v || !String(v).startsWith("v1:")) return v || "";
  const k = chaveCifra(env);
  if (!k) return "";
  const b = Buffer.from(String(v).slice(3), "base64");
  const d = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

// na Vercel o x-real-ip é posto pela própria Vercel; o x-forwarded-for pode ser inventado pelo cliente, então não é usado
function ipDe(req) {
  const h = req.headers || {};
  const v = h["x-real-ip"] || (req.socket && req.socket.remoteAddress) || "";
  return String(v).trim().slice(0, 64) || "sem-ip";
}
// IPs que já passaram do limite geral: esta instância responde 429 sem gastar comandos no banco
const bloqueados = new Map();
function log(evento, extra) { console.log(JSON.stringify({ guild: "evento", evento, ...extra })); }

// ---------- ações ----------
export function criarHandler(obterRedis = () => redisDoAmbiente(), f = fetch, env = process.env) {
  return async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const responder = (st, corpo) => res.status(st).json(corpo);
    if (req.method !== "POST") return responder(405, { erro: "Use POST." });
    // só JSON: um site de fora não consegue mandar JSON sem pedir permissão ao navegador (CORS), e esta API não dá permissão
    const tipo = String((req.headers && req.headers["content-type"]) || "").toLowerCase();
    if (!tipo.startsWith("application/json")) return responder(415, { erro: "Envie JSON." });
    const db = obterRedis();
    if (!db) return responder(503, { erro: "O banco da guild ainda não foi configurado no site." });
    let b = req.body;
    try {
      if (typeof b === "string") {
        if (b.length > MAX_CORPO) return responder(413, { erro: "Pedido grande demais." });
        b = JSON.parse(b);
      }
      if (!b || typeof b !== "object" || Array.isArray(b)) return responder(400, { erro: "JSON inválido." });
      // JSON.stringify também falha com objetos aninhados demais (pilha estoura): isso vira 400, não derruba a função
      if (JSON.stringify(b).length > MAX_CORPO) return responder(413, { erro: "Pedido grande demais." });
    } catch { return responder(400, { erro: "JSON inválido." }); }
    const acao = typeof b.acao === "string" ? b.acao : "";
    const K = (cod, s) => "guild:" + cod + ":" + s;
    const ipHash = createHash("sha256").update(ipDe(req)).digest("hex").slice(0, 16); // não guarda o IP em si
    // conta um uso (ou "peso" usos) e diz se passou do limite
    const estourou = async (chave, [max, seg], peso = 1) => {
      const n = await db("INCRBY", "guild-limite:" + chave, peso);
      if (n === peso) await db("EXPIRE", "guild-limite:" + chave, seg);
      return n > max;
    };
    const ate = bloqueados.get(ipHash);
    if (ate && ate > Date.now()) return responder(429, { erro: "Muitos pedidos. Espere alguns minutos." });
    if (ate) bloqueados.delete(ipHash);
    const novaSessao = async (cod, ger) => {
      const token = randomBytes(24).toString("base64url");
      await db("SET", "guild-sessao:" + token, cod + "|" + ger, "EX", SESSAO_DIAS * 86400);
      return token;
    };

    try {
      if (await estourou("ip:" + ipHash, LIMITES.ip)) {
        if (bloqueados.size > 5000) bloqueados.clear();
        bloqueados.set(ipHash, Date.now() + 60_000);
        return responder(429, { erro: "Muitos pedidos. Espere alguns minutos." });
      }

      // ----- criar e entrar -----
      if (acao === "criar" || acao === "entrar") {
        const cod = codigoLimpo(b.codigo), senha = typeof b.senha === "string" ? b.senha : "";
        if (cod.length < 3) return responder(400, { erro: "O código precisa ter pelo menos 3 letras ou números." });
        if (senha.length > SENHA_MAX) return responder(400, { erro: "Senha longa demais." });
        if (acao === "criar") {
          if (senha.length < SENHA_MIN) return responder(400, { erro: "A senha precisa ter pelo menos " + SENHA_MIN + " caracteres." });
          if (await estourou("criar:" + ipHash, LIMITES.criar)) return responder(429, { erro: "Muitas guilds criadas daqui. Espere uma hora." });
          const sal = randomBytes(16).toString("hex");
          const ok = await db("SET", K(cod, "acesso"), JSON.stringify({ sal, hash: hash(senha, sal), ger: 1, criadoEm: new Date().toISOString() }), "NX");
          if (ok !== "OK") return responder(409, { erro: "Já existe uma guild com esse código. Use Entrar, ou escolha outro código." });
          await db("SET", K(cod, "dados"), JSON.stringify(migrar({})));
          log("guild_criada", { cod });
          return responder(200, { token: await novaSessao(cod, 1), codigo: cod });
        }
        if (await estourou("entrar:" + ipHash, LIMITES.entrarIp)) return responder(429, { erro: "Muitas tentativas daqui. Espere 15 minutos." });
        const tentIp = "guild-limite:erro:" + cod + ":" + ipHash, tentG = "guild-limite:erro:" + cod;
        // o limite geral da guild só barra quem já errou a senha dela: um ataque de muitos IPs não tranca o dono para fora
        const errosIp = numero(await db("GET", tentIp));
        if (errosIp >= LIMITES.erroGuildIp[0] || (errosIp > 0 && numero(await db("GET", tentG)) >= LIMITES.erroGuild[0])) {
          log("login_bloqueado", { cod });
          return responder(429, { erro: "Muitas senhas erradas. Espere 15 minutos." });
        }
        const ac = JSON.parse((await db("GET", K(cod, "acesso"))) || "null");
        if (!ac) return responder(404, { erro: "Não achamos nenhuma guild com o código \"" + cod + "\". Se é o primeiro acesso da sua guild, crie o código e a senha." });
        if (senha.length < SENHA_MIN_ANTIGA || !confere(senha, ac.sal, ac.hash)) {
          for (const [k, lim] of [[tentIp, LIMITES.erroGuildIp], [tentG, LIMITES.erroGuild]]) {
            if ((await db("INCR", k)) === 1) await db("EXPIRE", k, lim[1]);
          }
          log("login_errado", { cod });
          return responder(401, { erro: "Código ou senha errados." });
        }
        return responder(200, { token: await novaSessao(cod, ac.ger || 1), codigo: cod });
      }

      // ----- daqui para baixo precisa estar dentro -----
      const token = typeof b.token === "string" ? b.token : "";
      const sess = /^[\w-]{20,64}$/.test(token) ? await db("GET", "guild-sessao:" + token) : null;
      const [cod, gerSess] = String(sess || "").split("|");
      const ac = cod ? JSON.parse((await db("GET", K(cod, "acesso"))) || "null") : null;
      if (!cod || !ac || String(ac.ger || 1) !== String(gerSess || 1)) {
        if (sess) await db("DEL", "guild-sessao:" + token);
        return responder(401, { erro: "Sua sessão expirou. Entre de novo com o código e a senha." });
      }

      const lerDados = async () => migrar(JSON.parse((await db("GET", K(cod, "dados"))) || "null"));
      const gravar = (d) => db("SET", K(cod, "dados"), JSON.stringify(d));
      // antes de uma mudança grande, guarda como estava para poder desfazer
      const guardarAnterior = async (acaoFeita) => {
        const atual = await db("GET", K(cod, "dados"));
        if (atual) await db("SET", K(cod, "anterior"), JSON.stringify({ acao: acaoFeita, em: new Date().toISOString(), dados: atual }), "EX", DESFAZER_DIAS * 86400);
      };
      const resposta = async (d) => {
        const hook = (await db("GET", K(cod, "hook"))) || "";
        const alerta = (await db("GET", K(cod, "alerta-dia"))) || null;
        const ant = JSON.parse((await db("GET", K(cod, "anterior"))) || "null");
        let final = "";
        try { final = decifrar(hook, env).slice(-4); } catch { final = ""; }
        return responder(200, { codigo: cod, dados: d, hook: hook ? { configurado: true, final } : { configurado: false }, ultimoAlertaAuto: alerta, desfazer: ant ? { acao: ant.acao, em: ant.em } : null });
      };

      if (acao === "ler") return resposta(await lerDados());
      if (acao === "sair") { await db("DEL", "guild-sessao:" + token); return responder(200, { ok: true }); }

      const escreve = ["importar", "apagarImport", "apagarTudo", "cfg", "senha", "hook", "restaurar", "desfazer"].includes(acao);
      if (escreve && (await estourou("escrever:" + cod, LIMITES.escrever))) return responder(429, { erro: "Muitas mudanças seguidas. Espere alguns minutos." });

      if (acao === "importar") {
        const d = await lerDados();
        const novas = (Array.isArray(b.imports) ? b.imports : []).slice(0, 50).map(importLimpo).filter(Boolean);
        for (const im of novas) {
          d.imports = d.imports.filter((x) => !(x.guild === im.guild && x.exportedAt === im.exportedAt));
          d.imports.push(im);
        }
        d.imports = limitarImports(d.imports);
        await gravar(d);
        return resposta(d);
      }
      if (acao === "apagarImport") {
        await guardarAnterior("apagar importação");
        const d = await lerDados();
        d.imports = d.imports.filter((x) => !(x.guild === b.guild && x.exportedAt === b.exportedAt));
        await gravar(d); return resposta(d);
      }
      if (acao === "apagarTudo") {
        await guardarAnterior("apagar importações");
        const d = await lerDados(); d.imports = d.imports.filter((x) => x.guild !== b.guild);
        await gravar(d); return resposta(d);
      }
      if (acao === "cfg") {
        const d = await lerDados();
        const novo = b.cfg && typeof b.cfg === "object" && !Array.isArray(b.cfg) ? b.cfg : {};
        d.cfg = cfgLimpo({ ...d.cfg, ...novo });
        await gravar(d); return resposta(d);
      }
      // cópia de segurança: devolve imports e ajustes (sem webhook nem senha) e aceita de volta o mesmo arquivo
      if (acao === "backup") {
        const d = await lerDados();
        log("backup_baixado", { cod });
        return responder(200, { tipo: "pka-guild-backup", versao: VERSAO_DADOS, codigo: cod, geradoEm: new Date().toISOString(), dados: d });
      }
      if (acao === "restaurar") {
        const bk = b.backup;
        if (!bk || typeof bk !== "object" || bk.tipo !== "pka-guild-backup" || !bk.dados || typeof bk.dados !== "object" || !Array.isArray(bk.dados.imports)) return responder(400, { erro: "Esse arquivo não é uma cópia de segurança da Gestão da Guild." });
        if (bk.codigo !== cod) return responder(400, { erro: "Essa cópia é de outra guild (" + codigoLimpo(bk.codigo) + "). Só dá para restaurar a cópia desta guild." });
        if (!(numero(bk.versao) >= 1 && numero(bk.versao) <= VERSAO_DADOS)) return responder(400, { erro: "Essa cópia foi feita por uma versão diferente do site." });
        await guardarAnterior("restaurar cópia");
        const d = migrar(bk.dados);
        d.imports = limitarImports(d.imports);
        await gravar(d);
        log("backup_restaurado", { cod, imports: d.imports.length });
        return resposta(d);
      }
      if (acao === "desfazer") {
        const ant = JSON.parse((await db("GET", K(cod, "anterior"))) || "null");
        if (!ant || typeof ant.dados !== "string") return responder(400, { erro: "Não há nada para desfazer." });
        const agora = await db("GET", K(cod, "dados"));
        await db("SET", K(cod, "dados"), ant.dados);
        // desfazer de novo volta para o que era
        if (agora) await db("SET", K(cod, "anterior"), JSON.stringify({ acao: "desfazer", em: new Date().toISOString(), dados: agora }), "EX", DESFAZER_DIAS * 86400);
        log("desfeito", { cod, acao: ant.acao });
        return resposta(await lerDados());
      }
      if (acao === "senha") {
        const atual = typeof b.atual === "string" ? b.atual : "", nova = typeof b.nova === "string" ? b.nova : "";
        // mesmo limite de erros do login: um token vazado não serve para ficar chutando a senha atual
        const tentIp = "guild-limite:erro:" + cod + ":" + ipHash, tentG = "guild-limite:erro:" + cod;
        const errosIp = numero(await db("GET", tentIp));
        if (errosIp >= LIMITES.erroGuildIp[0] || (errosIp > 0 && numero(await db("GET", tentG)) >= LIMITES.erroGuild[0])) return responder(429, { erro: "Muitas senhas erradas. Espere 15 minutos." });
        if (atual.length > SENHA_MAX || !confere(atual, ac.sal, ac.hash)) {
          for (const [k, lim] of [[tentIp, LIMITES.erroGuildIp], [tentG, LIMITES.erroGuild]]) {
            if ((await db("INCR", k)) === 1) await db("EXPIRE", k, lim[1]);
          }
          log("troca_senha_errada", { cod });
          return responder(403, { erro: "A senha atual não confere." });
        }
        if (nova.length < SENHA_MIN || nova.length > SENHA_MAX) return responder(400, { erro: "A nova senha precisa ter de " + SENHA_MIN + " a " + SENHA_MAX + " caracteres." });
        const sal = randomBytes(16).toString("hex"), ger = (+ac.ger || 1) + 1;
        await db("SET", K(cod, "acesso"), JSON.stringify({ sal, hash: hash(nova, sal), ger, criadoEm: ac.criadoEm, trocadaEm: new Date().toISOString() }));
        // as outras sessões caem porque a geração mudou; esta ganha um token novo
        await db("DEL", "guild-sessao:" + token);
        log("senha_trocada", { cod });
        return responder(200, { ok: true, token: await novaSessao(cod, ger), codigo: cod });
      }
      if (acao === "hook") {
        const url = typeof b.url === "string" ? b.url.trim() : "";
        if (!url) { await db("DEL", K(cod, "hook")); log("hook_apagado", { cod }); return resposta(await lerDados()); }
        if (!webhookValido(url)) return responder(400, { erro: "Esse endereço não parece um webhook do Discord." });
        await db("SET", K(cod, "hook"), cifrar(url, env));
        log("hook_trocado", { cod });
        return resposta(await lerDados());
      }
      if (acao === "enviar") {
        let url = "";
        try { url = decifrar(await db("GET", K(cod, "hook")), env); } catch { url = ""; }
        if (!url || !webhookValido(url)) return responder(400, { erro: "Nenhum webhook do Discord salvo para esta guild." });
        if (b.auto !== undefined && typeof b.auto !== "boolean") return responder(400, { erro: "Pedido inválido." });
        const partes = dividirMensagem(textoLongo(b.texto, 20000)).slice(0, 10);
        if (!partes.length) return responder(400, { erro: "A mensagem está vazia." });
        // alerta automático: só o primeiro do dia (dia do horário de Brasília, que é o do server save)
        const hoje = diaBrasilia();
        if (b.auto === true) {
          const ok = await db("SET", K(cod, "alerta-dia"), hoje, "NX", "EX", 36 * 3600);
          const ja = ok !== "OK" && (await db("GET", K(cod, "alerta-dia"))) === hoje;
          if (ja) return responder(200, { ok: true, pulado: true });
          if (ok !== "OK") await db("SET", K(cod, "alerta-dia"), hoje, "EX", 36 * 3600);
        }
        if (await estourou("enviar:" + cod, LIMITES.enviar, partes.length)) {
          if (b.auto === true) await db("DEL", K(cod, "alerta-dia"));
          return responder(429, { erro: "Muitas mensagens no Discord nesta hora. Espere um pouco." });
        }
        const ids = [...new Set((Array.isArray(b.ids) ? b.ids : []).filter((x) => typeof x === "string" && /^\d{17,20}$/.test(x)))].slice(0, 100);
        // o Discord recusa nomes com "discord" ou "clyde"; aqui eles somem para o envio não falhar nem enganar
        const nome = /discord|clyde/i.test(texto(b.nome, 80)) ? "" : texto(b.nome, 80).trim();
        for (const p of partes) {
          const corpo = { content: p, allowed_mentions: { parse: [], users: ids } };
          if (nome) corpo.username = nome;
          const mandar = () => f(url + "?wait=true", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(corpo), redirect: "error" });
          let r = await mandar();
          if (r.status === 429) {
            const j = await r.json().catch(() => ({}));
            await new Promise((ok) => setTimeout(ok, Math.min(5, Math.max(0, +j.retry_after || 1)) * 1000));
            r = await mandar();
          }
          if (!r.ok) {
            if (b.auto === true) await db("DEL", K(cod, "alerta-dia"));
            log("discord_falhou", { cod, status: r.status });
            return responder(502, { erro: r.status === 401 || r.status === 404 ? "O Discord não achou esse webhook (foi apagado?)." : "O Discord respondeu " + r.status + "." });
          }
        }
        log(b.auto === true ? "alerta_auto" : "alerta_manual", { cod, partes: partes.length });
        return responder(200, { ok: true, partes: partes.length });
      }
      return responder(400, { erro: "Ação desconhecida." });
    } catch (e) {
      console.error(JSON.stringify({ guild: "erro", acao: acao.slice(0, 20), msg: String((e && e.message) || e).slice(0, 200) }));
      return responder(500, { erro: "Falha no servidor. Tente de novo em instantes." });
    }
  };
}

export default criarHandler();
