## Objetivo
Garantir que o Corretor Camarada preserve e mostre no destino todos os campos disponíveis na origem, sem depender de validação manual imóvel por imóvel.

## Plano
1. **Criar uma camada genérica de campos da origem**
   - Ler todos os `wp:postmeta`, categorias, dados do post, anexos e campos especiais do XML.
   - Converter cada campo em itens exibíveis com `label`, `valor`, `origem`, `chave original` e ordem.
   - Manter o `source_payload` como cópia bruta integral, mas adicionar uma versão normalizada para a UI não depender de mapeamento manual.

2. **Resolver campos compostos e repetidos**
   - Tratar valores repetidos como lista.
   - Detectar estruturas comuns do Houzez/WordPress que podem vir serializadas, incluindo arrays PHP/JSON quando existirem.
   - Isso cobre exemplos como `Propriedade / Condomínio Ápice Park`, `Garantias aceitas / Caução, Seguro fiança`, `Prazo de contrato`, `Aceita permuta`, `Aceita proposta`, e qualquer outro campo customizado.

3. **Exibir todos os campos úteis no detalhe do imóvel**
   - Substituir o bloco fixo de “Detalhes” por uma combinação de:
     - campos principais já mapeados para filtros/listagens;
     - todos os campos adicionais vindos da origem que ainda não aparecem.
   - Evitar duplicidade: se um dado já aparece como preço, dormitório, tipo etc., não repetir com chave técnica.
   - Usar labels legíveis em português quando possível e fallback para a chave original.

4. **Adicionar auditoria de paridade na importação**
   - No resumo do XML, mostrar quantos campos distintos foram detectados na origem.
   - Para cada imóvel importável, garantir que os campos detectados foram anexados ao `source_payload`/camada normalizada antes de enviar para a função.
   - Não bloquear por campo desconhecido; campo desconhecido deve ser preservado e exibido.

5. **Persistir tudo na importação**
   - Atualizar a função `import-houzez-xml` para salvar a estrutura normalizada junto ao `source_payload` dentro do JSON existente, sem criar uma coluna nova se não for necessário.
   - Reimportações continuam idempotentes por `source_id`, atualizando o imóvel sem duplicar.

## Resultado esperado
Ao importar qualquer imóvel do XML, o destino terá os campos mapeados para funcionamento do portal e também todos os campos restantes da origem visíveis no detalhe do imóvel, incluindo campos customizados diferentes entre imóveis.