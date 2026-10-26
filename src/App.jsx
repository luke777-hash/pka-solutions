import { useEffect, useState } from 'react'
import { ferramentas } from './ferramentas.js'

const CHAVE_TEMA = 'pkahub-tema'

function temaInicial() {
  try {
    const salvo = localStorage.getItem(CHAVE_TEMA)
    if (salvo === 'claro' || salvo === 'escuro') return salvo
  } catch (_) {}
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

function BotaoTema() {
  const [tema, setTema] = useState(temaInicial)

  useEffect(() => {
    document.documentElement.dataset.theme = tema === 'escuro' ? 'dark' : 'light'
  }, [tema])

  function alternar() {
    const novo = tema === 'escuro' ? 'claro' : 'escuro'
    setTema(novo)
    try {
      localStorage.setItem(CHAVE_TEMA, novo)
    } catch (_) {}
  }

  const proximo = tema === 'escuro' ? 'claro' : 'escuro'
  return (
    <button
      type="button"
      className="tema"
      onClick={alternar}
      aria-label={`Mudar para o tema ${proximo}`}
      title={`Mudar para o tema ${proximo}`}
    >
      {tema === 'escuro' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      )}
      <span>{tema === 'escuro' ? 'Escuro' : 'Claro'}</span>
    </button>
  )
}

function Coracao() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 20s-7.5-4.6-9.3-9.2C1.4 7.4 3.6 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8C19.5 15.4 12 20 12 20Z" />
    </svg>
  )
}

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
      <header className="topo">
        <div className="topo-dentro">
          <div className="barra">
            <span className="contagem">{ferramentas.length} ferramentas</span>
            <div className="acoes">
              {/* abre a janela de apoio (public/apoio/apoio.js) */}
              <button type="button" className="tema apoiar" data-apoio="">
                <Coracao />
                <span>Apoiar</span>
              </button>
              <BotaoTema />
            </div>
          </div>
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
