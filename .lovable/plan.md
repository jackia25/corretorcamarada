## Causa raiz confirmada (imóvel 02336 do XML novo)

As chaves Houzez do Lemos usam **hífen**, não underscore:

- `fave_aceita-permuta` = `Sim`
- `fave_aceita-proposta` = `Sim`
- `fave_garantias-aceitas` aparece duas vezes → `["Caução", "Seguro fiança"]`
- `fave_prazo-de-contrato` = `30 meses`
- `fave_condomc3ado` (duplicado, segundo valor = `Condomínio Ápice Park`)
- `fave_banheiros` = `1` (não tem `fave_property_bathrooms`)
- `fave_property_land` = `52` (não tem `fave_property_size`)

Hoje a `LABELS` em `src/lib/sourceFields.ts` só tem versões com underscore (`fave_aceita_permuta`), então a allowlist barra esses campos e o Detalhes some com `Aceita permuta`, etc.

## Plano

1. **Validador de paridade origem × destino**
   - Novo módulo `src/lib/sourceParity.ts` que recebe `source_payload` + objeto persistido e devolve `{ok, diffs[]}`.
   - Para cada chave de `meta` e `categories` da origem (exceto técnicas conhecidas), exige uma das duas: estar refletida em um campo mapeado do destino OU estar preservada em `source_payload.meta` com mesmo valor (chave/valor bate exatamente, considerando arrays e PHP serialize).
   - Normaliza hífen ↔ underscore para considerar variantes equivalentes (`fave_aceita-permuta` ≡ `fave_aceita_permuta`).

2. **Trava de importação no `ImportHouzezXml.tsx`**
   - Antes do `supabase.functions.invoke('import-houzez-xml', ...)`, rodar o validador em cada imóvel filtrado.
   - Imóveis com qualquer divergência viram bloqueados (mesma UX do `_blocking` atual). Botão só importa os 100% aprovados.
   - Tabela de auditoria por imóvel: código, total de chaves, divergências, com chave/valor esperado × encontrado.

3. **Corrigir `src/lib/sourceFields.ts`**
   - Adicionar variantes com hífen ao `LABELS` (`fave_aceita-permuta`, `fave_aceita-proposta`, `fave_garantias-aceitas`, `fave_prazo-de-contrato`, `fave_garantias-financiamento` etc.).
   - Tornar a checagem de allowlist insensível a hífen/underscore.
   - Garantir que `fave_condomc3ado` duplicado pegue o valor não vazio (já tratado, validar).

4. **Mapeamento extra na parsing**
   - Em `parseXML`: para `area_m2`, considerar `fave_property_size` e cair em `fave_property_land` quando ausente (apartamento Lemos usa só `land`).
   - Manter `fave_banheiros` como fonte primária quando presente (já tratado).

5. **Testes automatizados**
   - `src/lib/sourceParity.test.ts` com payload real do `02336`:
     - todos os campos de negócio detectados (`Aceita permuta`, `Aceita proposta`, `Garantias aceitas` como `["Caução","Seguro fiança"]`, `Prazo de contrato`).
     - técnicos (`houzez_*`, `_yoast_*`, `fave_single_*`, `fave_prop_homeslider`, `fave_agent_display_option`, `fave_property_location`, `fave_property_map`, `fave_show_price_placeholder`, `fave_loggedintoview`, `fave_featured`) ficam de fora do Detalhes mas continuam preservados em `source_payload`.
     - validador retorna `ok: true` para o payload completo do 02336.
   - Atualizar `src/lib/sourceFields.test.ts` para também passar com chaves hifenizadas.

## Critério de aceite

- Reimportar o `02336` mostra no Detalhes: `Aceita permuta = Sim`, `Aceita proposta = Sim`, `Garantias aceitas = Caução, Seguro fiança`, `Prazo de contrato = 30 meses`, `Propriedade = Condomínio Ápice Park`, `Banheiros = 1`, `Área construída = 52 m²`.
- Tela de importação reporta `validados / bloqueados / divergências` e não importa imóvel com diferença de chave/valor entre origem e destino.
- Testes passando para o payload real do 02336.