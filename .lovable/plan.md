## O que muda

Na tela **Importar XML Houzez**, adicionar um campo opcional **"Filtrar por código (ex: HZ0007)"** antes do botão de upload.

## Comportamento

- Campo vazio → fluxo atual (importa todos os imóveis do XML).
- Campo preenchido com 1 ou mais códigos (separados por vírgula ou espaço, ex: `HZ0007` ou `HZ0007, HZ0012`) → após parsear o XML, filtra para manter **apenas** os imóveis cujo `external_code` (campo `fave_property_id`) bate com algum dos códigos.
- A filtragem é case-insensitive e ignora espaços.
- Se nenhum imóvel do XML bater com os códigos digitados, mostra toast de erro "Nenhum imóvel encontrado com os códigos informados" e não importa nada.
- Validação, amostra e importação seguem exatamente o fluxo atual, só sobre o subconjunto filtrado.
- Como a importação é idempotente por `source_id`, importar só o HZ0007 vai criar (se novo) ou atualizar (se já existir) apenas esse imóvel — os outros 287 ficam intactos.

## Arquivo alterado

- `src/pages/ImportHouzezXml.tsx` — adicionar input controlado `codeFilter`, aplicar `filter` na lista de propriedades parseadas antes da validação, e mostrar quantos foram filtrados no resumo.

Nada de banco, nada de edge function — só UI sobre a infraestrutura existente.
