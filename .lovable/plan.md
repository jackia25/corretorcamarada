## Causa-raiz

Investiguei o HTML da fonte (Lemos Properties) e descobri que o site **renomeou** o significado dos campos padrão do Houzez. No HZ0007:

| Origem mostra | Vem do meta XML |
|---|---|
| "Suíte: 1" (na visão geral E nos detalhes) | `fave_property_bathrooms` = **1** |
| "Banheiros: 2" (só nos detalhes) | custom field `fave_condomc3ado`... não: `fave_banheiros` = **2** |
| "Propriedade: Condomínio Soho Tamboré" | custom field `fave_condomc3ado` (literal "Condomínio") |
| "Valor do Condomínio: R$ 1.300" | `fave_valor-do-condomc3adnio` ✅ já capturado |

Ou seja, **o nosso parser está invertido para este XML**: gravamos `bathrooms=1` (que na verdade é suítes) e `suites=null` (que deveria ser 1), por isso a tela não mostra a suíte.

## Correção

**1. Parser (`ImportHouzezXml.tsx`)** — inverter prioridade para refletir a semântica real do Lemos, com fallback seguro:

```ts
// Suíte: prefere as metas explícitas; se não houver, usa fave_property_bathrooms
const suites =
  int(getMeta('fave_property_suites')) ??
  int(getMeta('fave_suites')) ??
  int(getMeta('fave_suite')) ??
  int(getMeta('fave_property_bathrooms'));   // ← Lemos usa esse campo como Suíte

// Banheiros: prefere o custom field "fave_banheiros" do Lemos;
// só cai em fave_property_bathrooms se NÃO houver fave_banheiros
// E se já não tivermos usado fave_property_bathrooms como suíte
const banheirosCustom = int(getMeta('fave_banheiros'));
const bathrooms = banheirosCustom ?? (
  // fallback: se não tem suite definido explicitamente, fave_property_bathrooms cai aqui
  int(getMeta('fave_property_bathrooms')) === suites ? null : int(getMeta('fave_property_bathrooms'))
);
```

Mais simples e correto: se existir `fave_banheiros`, ele é banheiros e `fave_property_bathrooms` vira suíte. Se só existir `fave_property_bathrooms`, ele continua sendo banheiros (comportamento padrão Houzez).

**2. Nome do condomínio** — adicionar a meta `fave_condomc3ado` (literal, com encoding bizarro) à lista de fallbacks de `condoName`.

**3. Re-importar o XML** para atualizar os 288 imóveis com a interpretação certa (idempotente via `source_id`).

## Validação

Após re-import, conferir HZ0007:
- Visão geral: 2 Dormitórios · 1 Suíte · 2 Garagens · 79 m²
- Detalhes: linha "Suíte 1" e linha "Banheiros 2"
- "Propriedade: Condomínio Soho Tamboré"

Aprova?