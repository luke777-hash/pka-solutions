// Lista das ferramentas mostradas no hub.
// Para adicionar uma nova: coloque a pasta dela em public/ e acrescente um item aqui.
export const ferramentas = [
  {
    nome: 'Planejador 2x2x2',
    endereco: '/planejador-2x2x2/',
    descricao:
      'Monta a rotação 2x2x2 (Lurer + Damage em duplas), compara o dano do time com o dano necessário por hazard e runa de ataque, e planeja como fechar o dano com X-Attack, Star ou boost.',
    detalhe: 'Passos: Time e rotação, Preços, Melhorar o time e Lista de compras. Inclui a calculadora de boost.',
  },
  {
    nome: 'Mesa de câmbio',
    apelido: 'KK vs Diamond',
    endereco: '/mesa-de-cambio/',
    descricao:
      'Compara comprar KK direto, diamond na revenda, diamond na loja oficial e doação com cartão.',
    detalhe: 'Tem também um modo para calcular o lucro revendendo diamond/KK para outros jogadores.',
  },
  {
    nome: 'PKA Hunt Analyzer',
    endereco: '/hunt-analyzer/',
    descricao:
      'Importa o JSON que o analyzer do jogo exporta por hunt (ou o backup do site Critical Catch) e mostra evolução, alvos, shinys, loot e meta de lucro.',
    detalhe: 'Junta hunts exportadas em partes. As hunts ficam salvas só no seu navegador.',
  },
]
