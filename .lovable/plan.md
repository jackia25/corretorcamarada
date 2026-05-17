
## Revisão: alinhar o esquema do Corretor Camarada ao Houzez

Boa ideia. Mas em vez de **renomear** o que já existe (quebraria todas as features do Corretor Camarada — handshake, dados sensíveis, acordos, etc.), proponho **estender** a tabela `properties` com as colunas que faltam pra cobrir 100% dos campos Houzez. Assim:

- Os 2 lados guardam exatamente a mesma informação
- Nada que já funciona no Corretor Camarada quebra
- Você pode auditar imóvel por imóvel comparando campo a campo

## Análise: o que o Houzez tem que o Corretor Camarada ainda não tem

| Campo Houzez | Hoje no CC? | Ação |
|---|---|---|
| `fave_property_price` | ✅ `price_range_min/max` | usar |
| `fave_property_size` | ✅ `area_m2` | usar |
| `fave_property_land` (área terreno) | ❌ | **adicionar `land_area_m2`** |
| `fave_property_bedrooms` | ✅ `bedrooms` | usar |
| `fave_property_bathrooms` | ✅ `bathrooms` | usar |
| `fave_property_garage` | ❌ | **adicionar `garage_spaces`** |
| `fave_property_year` (ano construção) | ❌ | **adicionar `year_built`** |
| `fave_property_address` + número | ✅ `full_address` / `address_number` | usar |
| `fave_property_zip` | ✅ `zip_code` | usar |
| `houzez_geolocation_lat/long` | ❌ | **adicionar `latitude`, `longitude`** |
| `fave_property_map_address` | ✅ (cai em `full_address`) | usar |
| taxonomy `property_city` | ✅ `city` | usar |
| taxonomy `property_state` | ✅ `state` | usar |
| taxonomy `property_area` (bairro) | ✅ `neighborhood` | usar |
| taxonomy `property_type` | ✅ `property_type` (enum) | mapear |
| taxonomy `property_status` (venda/aluguel) | ❌ | **adicionar `listing_status` ('venda' / 'aluguel' / 'venda_aluguel')** |
| taxonomy `property_label` (lançamento, etc) | ❌ | **adicionar `labels TEXT[]`** |
| taxonomy `property_feature` | ✅ `features[]` | usar |
| `fave_property_images` | ✅ `public_photos[]` | usar |
| thumbnail destacada | ❌ explícito | **adicionar `featured_photo`** (1ª foto destacada) |
| `fave_video_url` | ❌ | **adicionar `video_url`** |
| `fave_virtual_tour` | ❌ | **adicionar `virtual_tour_url`** |
| `fave_property_id` (código Houzez ex "0003") | ❌ | **adicionar `external_code`** |
| `fave_private_note` | ✅ `internal_notes` | usar |
| IPTU / condomínio (`fave_additional_features`) | ❌ | **adicionar `extra_costs JSONB`** (`{ iptu, condominio, ... }`) |
| `<post_date>` original | ❌ | **adicionar `source_published_at`** |
| `<link>` original | ❌ | **adicionar `source_url`** |
| ID externo (idempotência) | ❌ | **adicionar `source_id`** (único, evita duplicata) |

## Migration proposta

Adicionar à `properties`:

```sql
ALTER TABLE public.properties
  ADD COLUMN land_area_m2 numeric,
  ADD COLUMN garage_spaces integer,
  ADD COLUMN year_built integer,
  ADD COLUMN latitude numeric,
  ADD COLUMN longitude numeric,
  ADD COLUMN listing_status text DEFAULT 'venda',  -- 'venda' | 'aluguel' | 'venda_aluguel'
  ADD COLUMN labels text[],
  ADD COLUMN featured_photo text,
  ADD COLUMN video_url text,
  ADD COLUMN virtual_tour_url text,
  ADD COLUMN external_code text,
  ADD COLUMN extra_costs jsonb,
  ADD COLUMN source_published_at timestamptz,
  ADD COLUMN source_url text,
  ADD COLUMN source_id text UNIQUE;   -- p.ex. "houzez:0003"

CREATE INDEX idx_properties_source_id ON public.properties(source_id);
CREATE INDEX idx_properties_external_code ON public.properties(external_code);
```

Todas as colunas são **nullable** e têm defaults seguros → não quebra nenhum imóvel existente nem nenhuma feature atual.

## Atualizações em código (apenas adições, nada renomeado)

1. **`src/lib/types.ts`** — adicionar os campos novos ao interface `Property` (todos opcionais)
2. **`PropertyDetail.tsx`** — exibir os novos campos quando presentes (vídeo embed, tour virtual link, ano construção, vagas, IPTU/condomínio, mapa com lat/long)
3. **`NewProperty.tsx` / `EditProperty.tsx`** — formulário com os novos campos (numa seção "Mais detalhes" recolhível pra não poluir)
4. **Edge function `import-houzez-xml`** (nova) — popula todos os campos novos

## Auditoria de paridade (sem ambiguidade)

Após import, o relatório mostra para cada imóvel:
```
Houzez 0003 ─→ CC 7d3...
  título      ✅ idêntico
  preço       ✅ R$ 990.000
  área        ✅ 68m²
  quartos     ✅ 2
  garagem     ✅ 1
  fotos       ✅ 18 / 18
  lat/long    ✅ -23.495, -46.84
  vídeo       — (não tinha)
  IPTU        ✅ R$ 320
```

Como `source_id` é único, importar 2x não duplica nada — apenas atualiza os campos.

## Próximos passos após aprovação

1. Rodar a migration acima (adiciona 15 colunas, nada destrutivo)
2. Atualizar `types.ts` + telas de detalhe/edição para mostrar os novos campos
3. Criar a edge function `import-houzez-xml` populando 100% dos campos
4. Criar a página `/admin/import-xml` (upload do XML + relatório)
5. Você importa e validamos paridade com spot-check

---

**Confirma essa abordagem (estender em vez de renomear)?** Se sim, eu já disparo a migration na próxima mensagem.

E confirma seu email no Corretor Camarada para vincular os 288 imóveis ao seu usuário?
