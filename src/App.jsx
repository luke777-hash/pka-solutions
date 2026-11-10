import { ferramentas } from './ferramentas.js'

// Cada ícone lembra o cabeçalho da própria ferramenta.
function Icone({ tema }) {
  if (tema === 'planejador') {
    return (
      <svg className="icone" viewBox="0 0 66 44" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <rect key={'l' + i} x={i * 23} y="0" width="20" height="20" rx="3" className="i-lurer" />
        ))}
        {[0, 1, 2].map((i) => (
          <rect key={'d' + i} x={i * 23} y="24" width="20" height="20" rx="3" className="i-damage" />
        ))}
      </svg>
    )
  }
  if (tema === 'mesa') {
    return (
      <svg className="icone" viewBox="0 0 48 44" aria-hidden="true">
        <path className="i-traco" d="M6 14h32m-8-8 8 8-8 8M42 30H10m8-8-8 8 8 8" />
      </svg>
    )
  }
  if (tema === 'pokelog') {
    return (
      <svg className="icone" viewBox="0 0 70 44" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx="8" cy={7 + i * 15} r="6" className={i < 2 ? 'i-check' : 'i-check-vazio'} />
            {i < 2 && <path d={`M5 ${7 + i * 15}l2 2 4-4`} className="i-check-traco" />}
            <rect x="20" y={4 + i * 15} width={i === 1 ? 34 : 48} height="6" rx="3" className="i-linha" />
          </g>
        ))}
      </svg>
    )
  }
  return (
    <svg className="icone" viewBox="0 0 76 44" aria-hidden="true">
      <circle cx="22" cy="22" r="18" className="i-lente-borda" />
      <circle cx="22" cy="22" r="12" className="i-lente" />
      <circle cx="52" cy="12" r="5" fill="#ff5c5c" />
      <circle cx="64" cy="12" r="5" fill="#ffd23f" />
      <circle cx="58" cy="26" r="5" fill="#43d17a" />
    </svg>
  )
}

function Card({ ferramenta }) {
  return (
    <li>
      <a className={`card card--${ferramenta.tema}`} href={ferramenta.endereco}>
        <div className="capa">
          <Icone tema={ferramenta.tema} />
        </div>
        <div className="corpo">
          <h2>{ferramenta.nome}</h2>
          <p>{ferramenta.frase}</p>
          <ul className="etiquetas" aria-label="Recursos">
            {ferramenta.etiquetas.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
        <span className="seta" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M5 12h13m-5-6 6 6-6 6" />
          </svg>
        </span>
      </a>
    </li>
  )
}

export default function App() {
  return (
    <div className="pagina">
      {/* a barra de navegação vem de public/nav/nav.js, a mesma das ferramentas */}
      <header className="topo">
        <div className="topo-dentro">
          <span className="contagem">{ferramentas.length} ferramentas</span>
          <h1>PKA-HUB</h1>
          <p className="sub">Ferramentas para jogadores de Poke Alliance.</p>
        </div>
      </header>

      <main className="conteudo">
        <ul className="cards">
          {ferramentas.map((f) => (
            <Card key={f.endereco} ferramenta={f} />
          ))}
        </ul>
      </main>

      <footer className="rodape">
        <p className="rodape-apoio">
          O PKA-HUB é gratuito.{' '}
          <button type="button" className="link-apoio" data-apoio="">
            Apoie pelo Pix
          </button>
        </p>
        <p>
          Site feito por fã. Não é afiliado ao Poke Alliance nem à Nintendo, Creatures Inc. ou
          GAME FREAK inc. Pokémon e os nomes relacionados pertencem aos seus respectivos donos.
        </p>
      </footer>
    </div>
  )
}
