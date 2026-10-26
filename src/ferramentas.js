// Lista das ferramentas mostradas no hub.
// Para adicionar uma nova: coloque a pasta dela em public/ e acrescente um item aqui.
// "tema" escolhe as cores e o ícone do card (veja .card--<tema> em styles.css e Icone em App.jsx).
export const ferramentas = [
  {
    nome: 'Planejador 2x2x2',
    endereco: '/planejador-2x2x2/',
    tema: 'planejador',
    frase: 'Monte a rotação em duplas e feche o dano do hazard.',
    etiquetas: ['Rotação', 'Boost', 'Lista de compras'],
  },
  {
    nome: 'Mesa de câmbio',
    endereco: '/mesa-de-cambio/',
    tema: 'mesa',
    frase: 'Compare as rotas para conseguir KK e o lucro revendendo.',
    etiquetas: ['KK', 'Diamond', 'Revenda'],
  },
  {
    nome: 'PKA Hunt Analyzer',
    endereco: '/hunt-analyzer/',
    tema: 'hunt',
    frase: 'Importe suas hunts e acompanhe lucro, loot e shinys.',
    etiquetas: ['Lucro/h', 'Loot', 'Shinys'],
  },
]
