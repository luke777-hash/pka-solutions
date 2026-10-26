# PKA-HUB

Ferramentas para jogadores de Poke Alliance, reunidas num site só.

Site feito por fã. Não é afiliado ao Poke Alliance nem à Nintendo, Creatures Inc. ou GAME FREAK inc.

## As ferramentas

| Ferramenta | Endereço | Arquivo |
|---|---|---|
| Planejador 2x2x2 (inclui a calculadora de boost) | `/planejador-2x2x2/` | `public/planejador-2x2x2/index.html` |
| Mesa de câmbio (KK vs Diamond) | `/mesa-de-cambio/` | `public/mesa-de-cambio/index.html` |
| PKA Hunt Analyzer | `/hunt-analyzer/` | `public/hunt-analyzer/index.html` |

- **Planejador 2x2x2:** monta a rotação 2x2x2 (Lurer + Damage em duplas), compara o dano do time com o dano necessário por hazard e runa de ataque, e planeja como fechar o dano com X-Attack, Star ou boost.
- **Mesa de câmbio:** compara comprar KK direto, diamond na revenda, diamond na loja oficial e doação com cartão, e calcula o lucro revendendo diamond/KK.
- **PKA Hunt Analyzer:** importa o JSON que o analyzer do jogo exporta por hunt (ou o backup do Critical Catch) e mostra evolução, alvos, shinys, loot e meta de lucro. As hunts ficam salvas só no navegador de cada jogador.

## Como o projeto é organizado

- `index.html` e `src/`: a página inicial (o hub), feita em React.
- `src/ferramentas.js`: a lista de cards do hub (nome, endereço, frase curta, etiquetas e o tema de cores do card).
- `public/`: as ferramentas. Cada uma é um arquivo HTML que vai para o site exatamente como está.

Na Vercel, o projeto é detectado como **Vite**: comando de build `npm run build`, pasta de saída `dist`.

## Como atualizar uma ferramenta

1. Troque o arquivo da ferramenta em `public/<pasta-da-ferramenta>/index.html` pela versão nova.
2. Se o arquivo novo veio do claude.ai, ele precisa das mesmas adaptações da versão atual: o `<head>` completo e, logo depois de `<body>`, as duas linhas do botão "← Todas as ferramentas" (`pkahub-volta`). Copie essas partes do arquivo antigo.
3. Faça commit e push para a branch `main`. A Vercel publica sozinha em um ou dois minutos.

## Como adicionar uma ferramenta nova

1. Crie a pasta `public/<nome-da-pasta>/` com o `index.html` da ferramenta.
2. Acrescente um item em `src/ferramentas.js`. Para ter cores e ícone próprios no card, crie também um tema novo em `src/styles.css` e em `Icone` (`src/App.jsx`).
3. Commit e push.

## Rodar no computador (opcional)

Precisa do Node.js instalado. No terminal, dentro da pasta do projeto:

```
npm install
npm run build
npm run preview
```

E abra o endereço que aparecer (normalmente `http://localhost:4173`).
