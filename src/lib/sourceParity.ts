// Validador de paridade entre origem (XML Houzez) e destino (objeto que será
// importado). Garante que toda chave/valor de negócio da origem está refletida
// no destino — seja em um campo mapeado, seja preservada em `source_payload`.

import { decodeMaybeSerialized, normalizeKey } from './sourceFields';

export type ParityDiff = {
  key: string;          // chave original (origem)
  reason: 'missing_in_payload' | 'value_mismatch' | 'not_displayed';
  expected: unknown;    // valor da origem
  actual?: unknown;     // valor encontrado no destino (se houver)
};

export type ParityResult = {
  ok: boolean;
  totalKeys: number;
  diffs: ParityDiff[];
};

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
