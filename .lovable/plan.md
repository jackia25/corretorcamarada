## Diagnóstico

Comparando o imóvel HZ0007 no portal original (imagens) com o nosso, faltam dados e há um cálculo errado:

| Campo origem | Origem | Nosso hoje | Causa |
|---|---|---|---|
| Suíte | 1 | **não exibido** | não capturamos `fave_property_suites` / `fave_suites` nem temos coluna `suites` |
| Banheiros | 2 | 1 | no Houzez, `fave_property_bathrooms`=1 conta **apenas lavabos**; o total exibido pelo site = bathrooms + suites. Precisamos somar (ou exibir os dois separadamente como a origem) |
| Propriedade (nome do condomínio) | "Condomínio Soho Tamboré" | não exibido | vem de `fave_property_subtitle` ou taxonomy `property_county_state` — precisamos capturar e mostrar |
| Valor do Condomínio | R$ 1.300 | salvo em `extra_costs.condominio` mas **não exibido** | falta linha no bloco DETALHES |
| IPTU | (quando houver) | salvo, não exibido | mesma coisa |

## O que vou fazer

**1. Migration** — adicionar coluna `suites integer` em `properties` (nullable, não quebra nada).

**2. Parser XML (`ImportHouzezXml.tsx`)**
- Capturar suítes: `fave_property_suites` → fallback `fave_suites` → `fave_suite`
- Capturar nome do condomínio: `fave_property_subtitle` → fallback taxonomy `property_county_state`, salvar em campo novo (reaproveito `address_complement` que já existe e é texto livre, OU melhor: gravo em `extra_costs.condo_name` para não misturar com endereço)
- Confirmar fallbacks do IPTU (`fave_property_iptu_value`, `fave_iptu_value`) e condomínio (adicionar `fave_property_taxa_condominio`)

**3. PropertyDetail.tsx — bloco VISÃO GERAL**
- Adicionar ícone "Suíte" (ShowerHead) entre Dormitórios e Garagens quando `suites > 0`, igual à origem

**4. PropertyDetail.tsx — bloco DETALHES**
Reorganizar para espelhar a origem (2 colunas, ordem idêntica):
```
ID do imóvel        | Preço
Área construída     | Dormitórios
Suíte               | Garagens
Tipo de imóvel      | Situação do imóvel
Propriedade (condo) | Valor do Condomínio
Banheiros           | IPTU (quando houver)
```
- Banheiros = `bathrooms` puro (a origem mostra os dois separados; minha leitura inicial de "soma" foi errada — Suíte 1 e Banheiros 2 são campos independentes lá)
- Adicionar linhas: "Suíte", "Propriedade", "Valor do Condomínio", "IPTU"

**5. Re-importar HZ0007 e validar visualmente** que o card fica idêntico à imagem 31 da origem.

## Pergunta importante antes de codar

O Houzez tem **dois campos numéricos separados** para banheiro: `fave_property_bathrooms` e `fave_property_suites`. Na origem do seu portal aparecem como linhas separadas ("Suíte: 1", "Banheiros: 2"). Quando o seu XML do HZ0007 traz `bathrooms=1`, isso bate com o que a origem chama de "lavabo/banheiro social"? Ou a origem está somando suíte+banheiro em algum lugar?

Vou seguir a interpretação "campos independentes" (mais segura e idêntica à imagem 31). Se depois você ver imóvel onde o número não bate, ajusto o cálculo.

## Próximos passos

Aprova esse plano? Se sim, rodo a migration, atualizo parser + tela, e re-importo o HZ0007 pra você conferir lado-a-lado com a origem.