## Problema

A imagem 1 (correta) é a seção **Destaques** — grid de 3 colunas com ícone de check, sem caixas. A imagem 2 (errada) é a seção **Descrição**, onde o `formatDescription` envolve **cada bloco** num card com borda (`rounded-lg border bg-muted/30 p-4`), inclusive cada item de lista virou um card separado. Resultado: a lista "Destaques do imóvel" dentro da descrição aparece como uma pilha de caixas.

## Solução

Reescrever `formatDescription` em `src/pages/PropertyDetail.tsx` para seguir o mesmo padrão visual da seção Destaques:

- **Remover** o wrapper com borda/fundo (`rounded-lg border bg-muted/30 p-4`).
- **Títulos** (`**Texto:**` em linha própria) → `<h3>` discreto, sem caixa.
- **Parágrafos** → texto corrido, sem caixa.
- **Listas com `- `** → renderizar como grid de 1–3 colunas com `CheckCircle2` (mesmo componente, mesmo `strokeWidth={1.5}`, mesma cor `text-primary`) — idêntico à seção Destaques.
- **Espaçamento** entre seções via `space-y-6` em vez de cards empilhados.
- Detectar emoji/pin no início da linha (📍, 🏠 etc.) e renderizar inline sem virar bullet.

## Resultado esperado (HZ0007)

A descrição vai mostrar:
- "Destaques do imóvel:" como subtítulo limpo
- Itens "Área Total", "Quartos", "Pé-direito Duplo"… num grid com checkmark, igual à seção Destaques de cima
- A linha "📍 Localização privilegiada…" como parágrafo normal
- Sem caixinhas com borda em volta de cada item

## Arquivo alterado

- `src/pages/PropertyDetail.tsx` — apenas a função `formatDescription` (linhas ~232–279). Nenhuma mudança em dados, importação ou banco.
