// Validador de paridade entre origem (XML Houzez) e destino (objeto que será
// importado). Garante que toda chave/valor de negócio da origem está refletida
// no destino — seja em um campo mapeado, seja preservada em `source_payload`.

import { decodeMaybeSerialized, normalizeKey } from './sourceFields';

export type ParityDiff = {
  key: string;          // chave original (origem)
  reason: 'missing_in_payload' | 'value_mismatch' | 'not_displayed' | 'column_mismatch';
  expected: unknown;    // valor da origem
  actual?: unknown;     // valor encontrado no destino (se houver)
};

export type ParityResult = {
  ok: boolean;
  totalKeys: number;
  diffs: ParityDiff[];
};

// ---------- Coerência de colunas mapeadas ----------
// Para cada coluna derivada do parser, define-se um conjunto de chaves de meta
// (em ordem de preferência) das quais o valor deve ter sido extraído. Se o
// valor parseado divergir do que esperaríamos a partir do meta, é divergência.

function numFromString(v: string | undefined | null): number | null {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
function intFromString(v: string | undefined | null): number | null {
  const n = numFromString(v);
  return n == null ? null : Math.round(n);
}
function firstMeta(meta: Record<string, string | string[]>, keys: string[]): string | null {
  // Tolera hífen/underscore
  const norm = new Map<string, string>();
  for (const [k, v] of Object.entries(meta)) {
    norm.set(normalizeKey(k), Array.isArray(v) ? (v.find((x) => x && String(x).trim()) ?? v[0] ?? '') : v);
  }
  for (const k of keys) {
    const got = norm.get(normalizeKey(k));
    if (got != null && String(got).trim() !== '') return String(got);
  }
  return null;
}

export type ColumnSpec = {
  column: string;
  expected: unknown;
  metaKeys: string[];
  parse?: 'num' | 'int' | 'string';
};

export function validateColumnCoherence(
  source: { meta: Record<string, string | string[]>; categories: Record<string, string[]> },
  parsed: {
    price: number | null;
    area_m2: number | null;
    land_area_m2: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    garage_spaces: number | null;
    year_built: number | null;
    zip_code: string | null;
    latitude: number | null;
    longitude: number | null;
    external_code: string | null;
    full_address: string | null;
    address_number: string | null;
    video_url: string | null;
    virtual_tour_url: string | null;
    price_label: string | null;
    internal_notes: string | null;
    photos: string[] | null;
  },
): ParityDiff[] {
  const diffs: ParityDiff[] = [];

  const specs: Array<{ key: string; col: keyof typeof parsed; metaKeys: string[]; kind: 'num' | 'int' | 'str' }> = [
    { key: 'price',           col: 'price',           metaKeys: ['fave_property_price'], kind: 'num' },
    { key: 'bedrooms',        col: 'bedrooms',        metaKeys: ['fave_property_bedrooms'], kind: 'int' },
    { key: 'garage_spaces',   col: 'garage_spaces',   metaKeys: ['fave_property_garage'], kind: 'int' },
    { key: 'year_built',      col: 'year_built',      metaKeys: ['fave_property_year'], kind: 'int' },
    { key: 'land_area_m2',    col: 'land_area_m2',    metaKeys: ['fave_property_land'], kind: 'num' },
    { key: 'zip_code',        col: 'zip_code',        metaKeys: ['fave_property_zip'], kind: 'str' },
    { key: 'video_url',       col: 'video_url',       metaKeys: ['fave_video_url'], kind: 'str' },
    { key: 'virtual_tour_url',col: 'virtual_tour_url',metaKeys: ['fave_virtual_tour'], kind: 'str' },
    { key: 'price_label',     col: 'price_label',     metaKeys: ['fave_property_price_postfix'], kind: 'str' },
    { key: 'internal_notes',  col: 'internal_notes',  metaKeys: ['fave_private_note'], kind: 'str' },
    { key: 'external_code',   col: 'external_code',   metaKeys: ['fave_property_id'], kind: 'str' },
    { key: 'full_address',    col: 'full_address',    metaKeys: ['fave_property_address', 'fave_property_map_address'], kind: 'str' },
    { key: 'address_number',  col: 'address_number',  metaKeys: ['fave_property_address_number'], kind: 'str' },
    { key: 'latitude',        col: 'latitude',        metaKeys: ['houzez_geolocation_lat'], kind: 'num' },
    { key: 'longitude',       col: 'longitude',       metaKeys: ['houzez_geolocation_long'], kind: 'num' },
  ];

  for (const s of specs) {
    const raw = firstMeta(source.meta, s.metaKeys);
    const expected =
      s.kind === 'num' ? numFromString(raw) :
      s.kind === 'int' ? intFromString(raw) :
      (raw && raw.trim() !== '' ? raw : null);
    const actual = parsed[s.col] as unknown;
    const actualNorm = typeof actual === 'string' && actual.trim() === '' ? null : actual;
    const expectedNorm = typeof expected === 'string' && expected.trim() === '' ? null : expected;
    if (JSON.stringify(actualNorm) !== JSON.stringify(expectedNorm)) {
      diffs.push({
        key: `column:${s.key}`,
        reason: 'column_mismatch',
        expected: expectedNorm,
        actual: actualNorm,
      });
    }
  }

  // bathrooms: aceita banheiros custom OU property_bathrooms
  {
    const banheiros = intFromString(firstMeta(source.meta, ['fave_banheiros']));
    const propBath = intFromString(firstMeta(source.meta, ['fave_property_bathrooms']));
    const expected = banheiros != null ? banheiros : propBath;
    if (expected !== parsed.bathrooms) {
      diffs.push({ key: 'column:bathrooms', reason: 'column_mismatch', expected, actual: parsed.bathrooms });
    }
  }

  // area_m2: fave_property_size com fallback para fave_property_land
  {
    const size = numFromString(firstMeta(source.meta, ['fave_property_size']));
    const land = numFromString(firstMeta(source.meta, ['fave_property_land']));
    const expected = size != null ? size : land;
    if (expected !== parsed.area_m2) {
      diffs.push({ key: 'column:area_m2', reason: 'column_mismatch', expected, actual: parsed.area_m2 });
    }
  }

  // photos: toda id de fave_property_images deve ter ao menos uma url no array
  {
    const idsRaw = source.meta['fave_property_images'];
    const ids: string[] = [];
    if (Array.isArray(idsRaw)) {
      for (const r of idsRaw) (r.match(/\d+/g) || []).forEach((m) => { if (!ids.includes(m)) ids.push(m); });
    } else if (typeof idsRaw === 'string') {
      (idsRaw.match(/\d+/g) || []).forEach((m) => { if (!ids.includes(m)) ids.push(m); });
    }
    const got = parsed.photos?.length ?? 0;
    if (ids.length > 0 && got < ids.length) {
      diffs.push({
        key: 'column:photos',
        reason: 'column_mismatch',
        expected: `${ids.length} fotos`,
        actual: `${got} fotos`,
      });
    }
  }

  return diffs;
}

// Chaves técnicas/internas que NÃO precisam ser refletidas em nenhum lugar
// visível do destino — bastam estar preservadas em `source_payload.meta`.
// (são as mesmas tratadas em sourceFields, repetidas aqui de forma simples
// para evitar acoplamento.)
const TECHNICAL_PREFIXES = [
  'houzez_', 'fave_single_', 'fave_prop_', 'fave_show_', 'fave_agent_',
  'fave_top_area', 'fave_content_area', 'fave_sidebar',
  'fave_header_', 'fave_footer_', 'fave_page_',
  '_', // todo wp interno: _yoast_, _elementor_, _edit_, _thumbnail_, ...
];
const TECHNICAL_KEYS_NORM = new Set<string>([
  'location', 'fave_property_location',
  'fave_property_map', 'fave_property_map_street_view',
  'fave_loggedintoview', 'fave_show_price_placeholder', 'fave_featured',
  'fave_agent_display_option',
].map((k) => normalizeKey(k)));

function isTechnical(key: string): boolean {
  const nk = normalizeKey(key);
  if (TECHNICAL_KEYS_NORM.has(nk)) return true;
  return TECHNICAL_PREFIXES.some((p) => nk.startsWith(normalizeKey(p)));
}

function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v)) {
    const items = v
      .map((x) => normalizeValue(x))
      .filter((x) => x !== '' && x != null);
    return items.length <= 1 ? (items[0] ?? null) : items;
  }
  if (typeof v === 'string') return v.trim();
  return v;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  const na = normalizeValue(a);
  const nb = normalizeValue(b);
  return JSON.stringify(na) === JSON.stringify(nb);
}

/**
 * Valida que TODOS os campos da origem (meta + categories) não-técnicos
 * estão preservados em `source_payload` do destino com mesma chave e
 * mesmo valor (considerando arrays, duplicatas e PHP serialize).
 *
 * Não exige que cada um esteja mapeado para coluna dedicada — a exibição
 * no Detalhes é responsabilidade de `extractAdditionalSourceFields`.
 * Aqui o foco é: nenhum dado de negócio se perde na importação.
 */
export function validateSourceParity(
  source: {
    meta: Record<string, string | string[]>;
    categories: Record<string, string[]>;
  },
  destinationPayload: {
    meta?: Record<string, string | string[]>;
    categories?: Record<string, string[]>;
  } | null | undefined,
): ParityResult {
  const diffs: ParityDiff[] = [];
  const dstMeta = (destinationPayload?.meta || {}) as Record<string, string | string[]>;
  const dstCats = (destinationPayload?.categories || {}) as Record<string, string[]>;

  let total = 0;

  // Index destino por chave normalizada para tolerar hífen ↔ underscore
  const dstMetaByNorm = new Map<string, { key: string; value: unknown }>();
  for (const [k, v] of Object.entries(dstMeta)) {
    dstMetaByNorm.set(normalizeKey(k), { key: k, value: v });
  }

  for (const [k, rawVal] of Object.entries(source.meta)) {
    total++;
    if (isTechnical(k)) {
      // técnico: basta existir no payload (preservado), valor não precisa bater
      if (!dstMetaByNorm.has(normalizeKey(k))) {
        diffs.push({ key: k, reason: 'missing_in_payload', expected: rawVal });
      }
      continue;
    }
    const found = dstMetaByNorm.get(normalizeKey(k));
    if (!found) {
      diffs.push({ key: k, reason: 'missing_in_payload', expected: rawVal });
      continue;
    }
    // Decodifica ambos para comparar arrays serializados PHP igualmente
    const expected = Array.isArray(rawVal)
      ? rawVal.map((x) => decodeMaybeSerialized(x))
      : decodeMaybeSerialized(rawVal);
    const actualRaw = found.value;
    const actual = Array.isArray(actualRaw)
      ? actualRaw.map((x) => decodeMaybeSerialized(x as string))
      : decodeMaybeSerialized(actualRaw as string);
    if (!valuesEqual(expected, actual)) {
      diffs.push({ key: k, reason: 'value_mismatch', expected, actual });
    }
  }

  for (const [domain, vals] of Object.entries(source.categories)) {
    total++;
    const dst = dstCats[domain];
    if (!dst || dst.length === 0) {
      diffs.push({ key: `category:${domain}`, reason: 'missing_in_payload', expected: vals });
      continue;
    }
    if (!valuesEqual(vals, dst)) {
      diffs.push({ key: `category:${domain}`, reason: 'value_mismatch', expected: vals, actual: dst });
    }
  }

  return { ok: diffs.length === 0, totalKeys: total, diffs };
}
