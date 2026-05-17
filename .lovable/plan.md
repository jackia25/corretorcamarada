## Problema

Hoje o importador só persiste os campos que foram **explicitamente mapeados** no parser (bedrooms, bathrooms, IPTU, condomínio, etc.). Qualquer `wp:postmeta`, categoria ou tag custom que a imobiliária criar fica **perdido** — daí a necessidade de validar imóvel a imóvel.

## Solução: payload bruto + mapeamento genérico

Cada imóvel passa a guardar **um snapshot completo da origem** em uma coluna JSONB. O mapeamento tipado continua existindo (para colunas usadas em filtros/listagens), mas **nenhum campo é descartado**.

### 1. Banco — nova coluna `source_payload` (JSONB) em `properties`

Guarda exatamente o que veio do XML do imóvel:

```text
source_payload = {
  post: { id, title, link, pubDate, status, post_type },
  meta: { <todas as wp:postmeta key→value, sem filtro> },
  categories: { property_type: [...], property_status: [...], property_area: [...], property_feature: [...], property_label: [...], ... },
  attachments: [{ id, url, title }],   // só os referenciados pelo imóvel
  imported_at: "ISO",
  source_format: "houzez-xml-v1"
}
```

Vantagens:
- Qualquer campo novo que a Lemos adicionar no Houzez aparece automaticamente em `source_payload.meta`.
- Reimportar é idempotente: sobrescreve o snapshot pelo `source_id`.
- A página de detalhes pode mostrar uma seção "Dados originais" lendo direto desse JSON, então campos não mapeados ainda ficam visíveis para o corretor.

### 2. Parser (`src/pages/ImportHouzezXml.tsx`)

- Substituir a varredura seletiva por uma genérica: percorrer **todas** as `wp:postmeta` do `<item>` e colocar em `meta` (com merge por chave repetida).
- Percorrer **todas** as `<category>` agrupando por `domain`.
- Manter o mapeamento atual dos campos tipados (bedrooms, price, etc.) — esses continuam alimentando as colunas próprias para filtros.
- Remover as validações campo-a-campo de paridade (`_issues`) — não cabe mais ao usuário validar; o que não foi mapeado fica garantido em `source_payload`. Manter apenas erros bloqueantes reais (ex.: `external_code` ausente, título vazio).

### 3. Edge function (`supabase/functions/import-houzez-xml/index.ts`)

- Aceitar e gravar `source_payload` no upsert.
- Continuar idempotente por `source_id`.
- Em update, **sempre** sobrescrever `source_payload` (espelho da origem atual).

### 4. UI da tela de detalhes (`src/pages/PropertyDetail.tsx`)

- Adicionar uma seção colapsável "Dados da origem" (visível para o dono do imóvel) listando `source_payload.meta` e `source_payload.categories` como key/value. Assim qualquer campo extra fica acessível sem precisar criar coluna nova.

### 5. UI da tela de importação

- Remover o painel "validação de paridade" (não faz mais sentido).
- Manter o filtro por código e o limite que já existem.
- Mostrar contagem simples: X criados, Y atualizados, Z falhas (com motivo).

## Arquivos alterados

- `supabase/migrations/<novo>.sql` — `ALTER TABLE properties ADD COLUMN source_payload jsonb` + índice GIN opcional.
- `src/pages/ImportHouzezXml.tsx` — parser genérico, envia `source_payload`, remove validação campo-a-campo.
- `supabase/functions/import-houzez-xml/index.ts` — persiste `source_payload`.
- `src/lib/types.ts` — adicionar `source_payload?: Record<string, unknown> | null` em `Property`.
- `src/pages/PropertyDetail.tsx` — seção "Dados da origem" para o dono.

## Fora de escopo

- Não criar colunas tipadas para cada possível campo Houzez — `source_payload` cobre tudo.
- Não reimplementar import de URL/Firecrawl — fica para depois.

## Pergunta antes de implementar

Você prefere que a seção "Dados da origem" no detalhe do imóvel seja:
- **(a)** visível só para o dono do imóvel (admin/listador), ou
- **(b)** também visível para corretores compradores que já têm acordo ativo?
