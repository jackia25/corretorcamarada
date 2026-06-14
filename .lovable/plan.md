# Auditoria "Origem × Banco" (Lemos)

Objetivo: garantir que cada imóvel do site Lemos esteja cadastrado e **idêntico** no Corretor Camarada, usando a **exportação CSV/Excel do Houzez** (que você gera no admin) como fonte da verdade.

## Diagnóstico atual
- Site Lemos: **278 imóveis** no `property-sitemap.xml`.
- Banco: **268 imóveis** importados (todos com `source_url`).
- Há **~10 imóveis na origem que ainda não estão no banco**.
- A importação atual depende de *scraping* de texto (regex sobre markdown), frágil para garantir "exatamente igual". A planilha nativa do Houzez resolve isso porque traz os campos estruturados.

## Como vai funcionar (fluxo)

```text
Você exporta CSV/Excel no Houzez
        │
        ▼
Tela "Auditoria de Importação" (admin)  ── upload do arquivo
        │
        ▼
Edge function "audit-houzez" compara linha a linha com o banco
        │
        ▼
Relatório de divergências (na tela + download CSV)
        │
        ▼
Botão "Corrigir" → cria faltantes / atualiza divergentes
   (preservando fotos enviadas e dados sensíveis)
```

## O que a auditoria verifica
1. **Imóveis faltando / extras** — quem existe na origem e não no banco (e vice‑versa).
2. **Campos** — preço, área construída, área do terreno, quartos, suítes, banheiros, vagas, tipo, situação, bairro/cidade, IPTU, condomínio. Lista cada divergência (valor origem × valor banco).
3. **Fotos** — compara quantidade e o conjunto de URLs (normalizando o sufixo `-LARGxALT`), apontando fotos faltando ou a mais.
4. **Características/destaques** — compara a lista de *features* item a item (faltando / a mais).

Cada imóvel recebe um status: **OK**, **Divergente**, **Faltando**, **Extra**.

## Etapas de implementação

### Fase 0 — Mapear o export (precisa de 1 amostra)
- Você gera e me envia **uma** exportação do Houzez (pode ser de poucos imóveis).
- Defino o mapeamento exato das colunas do Houzez → campos do banco (chave de match: **código/ID do imóvel** do Houzez; fallback: **permalink → `source_url`**).

### Fase 1 — Edge function `audit-houzez` (somente leitura)
- Recebe as linhas do CSV/Excel já normalizadas, busca os imóveis correspondentes no banco e devolve o relatório estruturado (faltando, extras, divergências de campo, fotos e features). **Não grava nada.**

### Fase 2 — Tela de Auditoria (admin)
- Upload do arquivo (parse de CSV/XLSX no cliente), envio para a function, e exibição:
  - Resumo (Total origem, Total banco, OK, Divergentes, Faltando, Extras).
  - Tabela filtrável por status, com detalhe de cada divergência.
  - Botão **"Baixar relatório (CSV)"**.

### Fase 3 — Correção controlada
- Botão **"Simular correção"** e **"Aplicar correção"** reaproveitando a function `import-houzez-xml` já existente:
  - **Faltando** → cria o imóvel com os dados da planilha.
  - **Divergente** → atualiza apenas os campos públicos divergentes, **preservando fotos já enviadas ao storage e dados sensíveis** (mesma regra do resync atual).
  - **Extra** → apenas listado para revisão manual (não remove automaticamente).

## Detalhes técnicos
- Match por código Houzez (armazenado hoje em `internal_notes: "Código: HZ..."`) com fallback por `source_url`/permalink. Na Fase 0 valido qual identificador o export traz.
- Normalização antes de comparar: números (área/preço sem separador), texto (trim/lowercase), fotos (remoção do sufixo `-\d+x\d+`), features como conjunto.
- Relatório também salvo como arquivo em `/mnt/documents` para download.
- Nenhuma mudança em RLS/segurança nesta etapa; a function de auditoria roda com service role e só é acionada por admin na tela de importação.

## O que preciso de você para começar
- Uma **amostra da exportação CSV/Excel do Houzez** para travar o mapeamento de colunas (Fase 0). Assim que enviar, sigo para as Fases 1–3.