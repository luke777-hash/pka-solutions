// Busca as estatísticas de captura de shiny do site Critical Catch (criticalcatch-pkatools.app)
// e devolve só o que o Hunt Analyzer usa. Roda na Vercel, no mesmo endereço do hub, então o navegador não esbarra em bloqueio de outro site.
// A resposta fica guardada por 30 minutos na Vercel para não pedir o arquivo ao Critical Catch a cada visita.
const FONTE = "https://pub-39e03f3f3c374a939b6572a9ec039dcc.r2.dev/stats-v2.json";

// [nome, capturas, média, mediana, P80, P95, máximo] de cada shiny
export function resumir(d) {
  if (!d || !Array.isArray(d.shinyStats)) return null;
  const n = v => (Number.isFinite(+v) ? +v : null);
  return {
    fonte: "Critical Catch",
    atualizadoEm: d.updatedAt || null,
    mediasDesde: d.averagesSince || null,
    ultimoCatch: d.lastCatchAt || null,
    shiny: d.shinyStats
      .filter(s => s && typeof s.pokemon === "string")
      .map(s => [s.pokemon, n(s.captures), n(s.avgBalls), n(s.medianBalls), n(s.p80Balls), n(s.p95Balls), n(s.maxBalls)]),
  };
}

export default async function handler(req, res) {
  try {
    const r = await fetch(FONTE, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error("Critical Catch respondeu " + r.status);
    const dados = resumir(await r.json());
    if (!dados) throw new Error("formato inesperado");
    res.setHeader("Cache-Control", "public, s-maxage=1800, stale-while-revalidate=86400");
    res.status(200).json(dados);
  } catch (e) {
    res.setHeader("Cache-Control", "no-store");
    res.status(502).json({ erro: "Não consegui buscar os dados do Critical Catch.", detalhe: String((e && e.message) || e) });
  }
}
