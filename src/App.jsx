import { ferramentas } from './ferramentas.js'

function Card({ ferramenta }) {
  return (
    <li className="card">
      <h2>
        {ferramenta.nome}
        {ferramenta.apelido && <span className="apelido">{ferramenta.apelido}</span>}
      </h2>
      <p>{ferramenta.descricao}</p>
      <p className="detalhe">{ferramenta.detalhe}</p>
      <a className="botao" href={ferramenta.endereco}>
        Abrir {ferramenta.nome} <span aria-hidden="true">→</span>
      </a>
    </li>
  )
}

export default function App() {
  return (
    <div className="pagina">
      <header className="topo">
        <h1>PKA-HUB</h1>
        <p>Ferramentas para jogadores de Poke Alliance.</p>
      </header>

      <main>
        <ul className="cards">
          {ferramentas.map((f) => (
            <Card key={f.endereco} ferramenta={f} />
          ))}
        </ul>
      </main>

      <footer className="rodape">
        <p>
          Site feito por fã. Não é afiliado ao Poke Alliance nem à Nintendo, Creatures Inc. ou
          GAME FREAK inc. Pokémon e os nomes relacionados pertencem aos seus respectivos donos.
        </p>
      </footer>
    </div>
  )
}
