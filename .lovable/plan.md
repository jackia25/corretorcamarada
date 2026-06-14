# Correções da importação Lemos + melhorias no cadastro

Diagnóstico confirmado no código e no banco:
- A importação **não usa IA** e grava os campos **fiel ao XML**. "Air Offices/Green Valley" e "troca de núcleos" vêm do **próprio XML**, que é uma foto **antiga** do site da Lemos.
- Os bugs de rótulo ("ID do OI", "Situação do loca", "Área do té", "Tipo de habitação", "área de por", "escritório") **já estão corrigidos no código atual** — os prints são da versão publicada antiga.
- O quadro "Dados da origem" **já está oculto** no código.
- Todos os 268 imóveis têm o **link de origem salvo** (`source_url`), então dá para re-sincronizar do site ao vivo.

## Fase 1 — Publicar correções já feitas
Republicar o app para que os rótulos corretos e a remoção do quadro "Dados da origem" apareçam no site real. Isso já resolve a maior parte das páginas 1 e 2 do documento.

## Fase 2 — Ajustar exibição dos detalhes (`PropertyDetail.tsx`)
- Não exibir "Área do terreno" quando ela for **igual** à área construída (caso da sala comercial: mostra só uma metragem).
- Remover a linha de área duplicada e garantir que campos vazios não apareçam.
- Revisar o título da seção de características para ficar consistente com o restante da página.

## Fase 3 — Re-sincronizar conteúdo do site da Lemos (recomendado como fonte da verdade)
Atualiza os 268 imóveis com o conteúdo **atual e em português** do site, sem perder fotos nem dados sensíveis.
- Nova rotina na função `import-properties` que percorre os imóveis pelo `source_url` já salvo, raspa a página ao vivo (Firecrawl) e sobrescreve **apenas o conteúdo público**: título, descrição, características, tipo, áreas, dormitórios, **banheiros**, suítes, garagem, IPTU, condomínio, situação.
- Melhorar o leitor (parser) para capturar corretamente **banheiros**, **suítes**, **área construída x área do terreno** e os nomes das características em PT-BR com a capitalização certa (ex.: "Área de Serviço", "Mobiliado", "Escritório").
- Preservar: fotos públicas/sensíveis, dados do proprietário, notas internas, acordos.
- Rodar primeiro em modo **simulação** (relatório do que mudaria) e depois aplicar em lotes.
- Botão na tela de importação para disparar e acompanhar o progresso.

## Fase 4 — Novos campos no formulário de cadastro (páginas 4–5)
Expor no cadastro/edição os campos que o banco **já suporta**:
- **Condomínio** (texto livre digitado pelo corretor — sem autocomplete).
- **Suítes**, **Garagem/Vagas**, **Banheiros** (já existe).
- **Área construída** e **Área total (terreno)** separadas.
- **IPTU** e **Valor do condomínio**.
- **Upload de vídeo** (do computador/celular) salvo junto do imóvel.
- Campos extras de negócio (aceita permuta, proposta, garantias de locação) como opcionais.

## Fase 5 — Código do imóvel com prefixo por corretor
- Cada corretor recebe uma **letra/sigla** (ex.: "A").
- Ao cadastrar, o sistema **sugere automaticamente** um código sequencial com o prefixo (A01, A02, …), editável pelo corretor.
- Exibir o código no detalhe e na busca, evitando códigos repetidos entre corretores diferentes.

---

## Detalhes técnicos
- **Banco**: adicionar `code_prefix` em `profiles` (letra do corretor) e, se necessário, sequência por corretor para gerar o código. Os campos de imóvel (`suites`, `land_area_m2`, `garage_spaces`, `video_url`, `extra_costs`, `external_code`) **já existem** na tabela `properties` (46 colunas).
- **Validação**: atualizar `src/lib/validations.ts` (Zod) e `src/lib/types.ts` para os novos campos do formulário.
- **Re-sync**: novo `action` na edge function `import-properties` iterando por `source_url`; usa Firecrawl scrape (markdown+html), atualiza só colunas de conteúdo público via service role; processamento em lotes com `dryRun` e relatório de divergências.
- **Vídeo**: upload para o bucket `property-photos` (ou novo bucket), gravando a URL em `properties.video_url`.
- **Detalhe**: ajuste condicional em `PropertyDetail.tsx` para áreas duplicadas.

## Ordem de execução sugerida
1. Fase 1 (publicar) — efeito imediato.
2. Fase 2 (exibição) — rápido.
3. Fase 4 + Fase 5 (formulário e código) — uma migração de banco.
4. Fase 3 (re-sync) — rodar simulação, revisar relatório, aplicar.