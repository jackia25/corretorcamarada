## Problema

A função `formatPrice` em `PropertyDetail.tsx` (linha 222) só checa `min && max` separadamente, então quando o importador grava `price_range_min = price_range_max` (caso de imóvel com preço fixo, como o HZ0007 = R$ 1.150.000), o resultado é `"R$ 1.150.000 - R$ 1.150.000"` — aparece duas vezes tanto no bloco DETALHES quanto no card lateral de preço.

## Correção

Ajustar `formatPrice` para detectar quando `min === max` e retornar apenas um valor:

```ts
if (min && max && min === max) return formatter.format(min);
if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
```

Mudança 1 linha. Não afeta imóveis com faixa real (min ≠ max).

Aprova?