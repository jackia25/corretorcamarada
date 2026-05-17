// Utilidades para normalizar o `source_payload` da importação em uma lista
// de campos exibíveis no detalhe do imóvel, sem depender de mapeamento manual.

export type SourceField = {
  key: string;            // chave original (ex: fave_garantias_aceitas)
  label: string;          // rótulo amigável em PT-BR (fallback: derivado da chave)
  value: string | string[]; // valor já tratado para exibição
  group: 'categoria' | 'meta'; // origem
};

// ---------- PHP unserialize (subset suficiente p/ Houzez/Houzez Pro) ----------
// Suporta: s (string), i (int), d (float), b (bool), N (null), a (array)
export function unserializePhp(input: string): unknown {
  if (typeof input !== 'string') return input;
  const s = input;
  let i = 0;

  function readUntil(ch: string): string {
    const start = i;
    while (i < s.length && s[i] !== ch) i++;
    return s.slice(start, i);
  }

  function expect(ch: string) {
    if (s[i] !== ch) throw new Error(`Expected '${ch}' at ${i}`);
    i++;
  }

  function parse(): unknown {
    const type = s[i];
    if (type === undefined) throw new Error('EOF');
    if (type === 'N') { i += 2; return null; } // N;
    i++; // consume type
    if (type === 'b') {
      expect(':');
      const v = s[i] === '1';
      i += 1; // 0 or 1
      expect(';');
      return v;
    }
    if (type === 'i') {
      expect(':');
      const numStr = readUntil(';');
      expect(';');
      return parseInt(numStr, 10);
    }
    if (type === 'd') {
      expect(':');
      const numStr = readUntil(';');
      expect(';');
      return parseFloat(numStr);
    }
    if (type === 's') {
      expect(':');
      const lenStr = readUntil(':');
      expect(':');
      const len = parseInt(lenStr, 10);
      expect('"');
      // length is in bytes (UTF-8). For our purposes string char count is approximate;
      // safest: find closing `";` after `len` bytes. Use a byte-aware slice.
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const bytes = enc.encode(s.slice(i));
      const slice = dec.decode(bytes.slice(0, len));
      // Advance `i` by char count equivalent to `len` bytes.
      // Re-encode the decoded slice to know exact byte length we consumed.
      const consumedBytes = enc.encode(slice).length;
      // Walk character by character until we've consumed consumedBytes bytes.
      let consumedSoFar = 0;
      let j = i;
      while (j < s.length && consumedSoFar < consumedBytes) {
        consumedSoFar += enc.encode(s[j]).length;
        j++;
      }
      i = j;
      expect('"');
      expect(';');
      return slice;
    }
    if (type === 'a') {
      expect(':');
      const countStr = readUntil(':');
      expect(':');
      const count = parseInt(countStr, 10);
      expect('{');
      const isSequential = (() => true)();
      const arr: unknown[] = [];
      const obj: Record<string, unknown> = {};
      let sequential = true;
      for (let k = 0; k < count; k++) {
        const key = parse();
        const val = parse();
        if (typeof key === 'number' && key === k && sequential) {
          arr.push(val);
        } else {
          sequential = false;
          obj[String(key)] = val;
        }
      }
      expect('}');
      // If we accumulated obj along the way, merge any arr-built items
      if (!sequential) {
        arr.forEach((v, idx) => { if (!(String(idx) in obj)) obj[String(idx)] = v; });
        return obj;
      }
      return arr;
      void isSequential;
    }
    throw new Error(`Unknown type '${type}' at ${i}`);
  }

  try {
    return parse();
  } catch {
    return input; // fallback: devolve string original
  }
}

// Tenta decodificar valores que parecem serializados (PHP ou JSON)
export function decodeMaybeSerialized(raw: string): unknown {
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (!t) return raw;
  // PHP serialize
  if (/^a:\d+:\{/.test(t) || /^s:\d+:"/.test(t) || /^b:[01];$/.test(t) || /^i:-?\d+;$/.test(t) || /^d:-?\d/.test(t)) {
    const v = unserializePhp(t);
    if (v !== t) return v;
  }
  // JSON
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try { return JSON.parse(t); } catch { /* ignore */ }
  }
  return raw;
}

// ---------- Rótulos amigáveis ----------
// Cobre o vocabulário Houzez padrão + customizações típicas em PT-BR (Lemos).
const LABELS: Record<string, string> = {
  // Houzez core
  fave_property_price: 'Preço',
  fave_property_sec_price: 'Preço secundário',
  fave_property_price_postfix: 'Sufixo do preço',
  fave_property_size: 'Área construída',
  fave_property_size_prefix: 'Unidade de área',
  fave_property_land: 'Área do terreno',
  fave_property_land_postfix: 'Unidade do terreno',
  fave_property_bedrooms: 'Dormitórios',
  fave_property_bathrooms: 'Banheiros',
  fave_property_garage: 'Vagas de garagem',
  fave_property_garage_size: 'Tamanho da garagem',
  fave_property_year: 'Ano de construção',
  fave_property_id: 'ID do imóvel',
  fave_property_address: 'Endereço',
  fave_property_address_number: 'Número',
  fave_property_map_address: 'Endereço (mapa)',
  fave_property_zip: 'CEP',
  fave_property_country: 'País',
  fave_property_map: 'Mostrar mapa',
  fave_property_map_street_view: 'Street view',
  fave_video_url: 'Vídeo',
  fave_virtual_tour: 'Tour virtual',
  fave_energy_class: 'Classe energética',
  fave_property_images: 'Fotos (IDs)',
  fave_attachments: 'Anexos',
  fave_floor_plans: 'Plantas',
  fave_private_note: 'Observação interna',
  fave_featured: 'Destaque',
  // Customizações comuns em PT-BR
  fave_iptu: 'IPTU',
  fave_property_iptu: 'IPTU',
  fave_property_iptu_value: 'IPTU',
  fave_iptu_value: 'IPTU',
  fave_condominio: 'Condomínio',
  fave_property_condominio: 'Condomínio',
  fave_property_taxa_condominio: 'Taxa de condomínio',
  fave_valor_condominio: 'Valor do condomínio',
  'fave_valor-do-condomc3adnio': 'Valor do condomínio',
  fave_condomc3ado: 'Condomínio',
  fave_propriedade: 'Propriedade',
  fave_property_name: 'Nome do empreendimento',
  fave_property_subtitle: 'Subtítulo',
  fave_condominio_nome: 'Nome do condomínio',
  fave_banheiros: 'Banheiros',
  fave_suite: 'Suíte',
  fave_suites: 'Suítes',
  fave_property_suite: 'Suíte',
  fave_property_suites: 'Suítes',
  fave_garantias: 'Garantias aceitas',
  fave_garantias_aceitas: 'Garantias aceitas',
  fave_property_garantias: 'Garantias aceitas',
  fave_aceita_permuta: 'Aceita permuta',
  fave_permuta: 'Aceita permuta',
  fave_property_permuta: 'Aceita permuta',
  fave_aceita_proposta: 'Aceita proposta',
  fave_proposta: 'Aceita proposta',
  fave_property_proposta: 'Aceita proposta',
  fave_prazo_contrato: 'Prazo de contrato',
  fave_property_prazo_contrato: 'Prazo de contrato',
  fave_prazo: 'Prazo de contrato',
  fave_finalidade: 'Finalidade',
  fave_orientacao: 'Orientação solar',
  fave_property_orientacao: 'Orientação solar',
  fave_andar: 'Andar',
  fave_property_andar: 'Andar',
  fave_numero_andares: 'Nº de andares',
  fave_property_numero_andares: 'Nº de andares',
  fave_mobiliado: 'Mobiliado',
  fave_property_mobiliado: 'Mobiliado',
  fave_aceita_animais: 'Aceita animais',
  fave_pet_friendly: 'Pet friendly',
  fave_proximidades: 'Proximidades',
  fave_lazer: 'Lazer',
  fave_seguranca: 'Segurança',
  fave_aceita_financiamento: 'Aceita financiamento',
  fave_property_aceita_financiamento: 'Aceita financiamento',
  fave_property_label: 'Rótulo',
  fave_property_status: 'Situação',
  fave_property_type: 'Tipo de imóvel',
  fave_property_feature: 'Característica',
  // Categorias (domain)
  property_label: 'Rótulo',
  property_status: 'Situação',
  property_type: 'Tipo de imóvel',
  property_feature: 'Característica',
  property_area: 'Bairro',
  property_city: 'Cidade',
  property_state: 'Estado',
  property_country: 'País',
};

function humanizeKey(key: string): string {
  let k = key;
  if (k.startsWith('fave_property_')) k = k.slice('fave_property_'.length);
  else if (k.startsWith('fave_')) k = k.slice('fave_'.length);
  k = k.replace(/[_-]+/g, ' ').trim();
  if (!k) return key;
  return k.charAt(0).toUpperCase() + k.slice(1);
}

// Chaves que NÃO devem aparecer em "Informações adicionais" porque já são
// exibidas/usadas em outros blocos do detalhe ou são puramente internas.
const SKIP_META = new Set<string>([
  // já mapeadas em campos principais
  'fave_property_price',
  'fave_property_sec_price',
  'fave_property_price_postfix',
  'fave_property_size',
  'fave_property_land',
  'fave_property_bedrooms',
  'fave_property_bathrooms',
  'fave_property_garage',
  'fave_property_year',
  'fave_property_id',
  'fave_property_address',
  'fave_property_address_number',
  'fave_property_map_address',
  'fave_property_zip',
  'fave_video_url',
  'fave_virtual_tour',
  'fave_private_note',
  // IPTU/condomínio já entram em DetailRow via extra_costs
  'fave_iptu', 'fave_property_iptu', 'fave_property_iptu_value', 'fave_iptu_value',
  'fave_condominio', 'fave_property_condominio', 'fave_property_taxa_condominio',
  'fave_valor_condominio', 'fave_valor-do-condomc3adnio',
  // suites/banheiros já mapeados
  'fave_suite', 'fave_suites', 'fave_property_suite', 'fave_property_suites',
  'fave_banheiros',
  // nome do condomínio já mostrado como "Propriedade"
  'fave_property_subtitle', 'fave_propriedade', 'fave_property_name',
  'fave_condomc3ado', 'fave_condominio_nome',
  // técnicos/ruído visual
  'fave_property_images', 'fave_attachments', 'fave_floor_plans',
  'fave_property_map', 'fave_property_map_street_view',
  'houzez_geolocation_lat', 'houzez_geolocation_long',
  'fave_property_country',
  '_thumbnail_id', '_edit_lock', '_edit_last', '_wp_old_slug',
  '_wp_page_template', '_yoast_wpseo_primary_property_type',
  '_oembed_time', '_encloseme',
]);

// Categorias que já viram colunas/seções dedicadas do app
const SKIP_CATEGORIES = new Set<string>([
  'property_type', 'property_status', 'property_city', 'property_state',
  'property_area', 'property_country', 'property_feature', 'property_label',
]);

// Palavras-chave (PT-BR) que indicam campo de negócio do imóvel
const BUSINESS_KEYWORDS = [
  'garantia', 'permuta', 'proposta', 'prazo', 'finalidade',
  'orientacao', 'orientação', 'andar', 'andares', 'mobiliad',
  'animais', 'pet', 'proximidade', 'lazer', 'seguranca', 'segurança',
  'financiamento', 'iptu', 'condomin', 'condomín', 'aceita',
  'fundo', 'frente', 'piscina', 'churrasq', 'elevador', 'escritura',
  'documenta', 'reformad', 'aluguel', 'venda', 'vista', 'sol',
  'sacada', 'varanda', 'quintal', 'jardim', 'churrasqueira',
];

// Prefixos/sufixos técnicos do Houzez/WordPress que NUNCA devem ser exibidos
const TECHNICAL_PREFIXES = [
  'houzez_', 'fave_single_', 'fave_prop_', 'fave_show_',
  'fave_agent_', 'fave_top_area', 'fave_content_area', 'fave_sidebar',
  'fave_header_', 'fave_footer_', 'fave_page_',
];
const TECHNICAL_KEYS = new Set<string>([
  'location', 'agent_display_option', 'fave_agent_display_option',
  'single_top_area', 'single_content_area', 'fave_single_top_area',
  'fave_single_content_area', 'prop_homeslider', 'fave_prop_homeslider',
  'houzez_total_property_views', 'houzez_views_by_date',
  'houzez_recently_viewed', 'fave_property_map',
  'fave_property_map_street_view',
  'fave_property_location', 'fave_loggedintoview',
  'fave_show_price_placeholder', 'fave_featured',
  'houzez_featured_listing_date', 'houzez_manual_expire',
  '_houzez_expiration_date_status', '_elementor_page_assets',
]);

// Normaliza variantes hífen/underscore e case (Houzez/Lemos usa as duas)
export function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/-/g, '_');
}

// Mapa de labels normalizado (uma vez, no carregamento) para tolerar hífens
const NORMALIZED_LABELS: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(LABELS)) out[normalizeKey(k)] = v;
  return out;
})();
const NORMALIZED_SKIP_META = new Set<string>(
  Array.from(SKIP_META).map((k) => normalizeKey(k))
);
const NORMALIZED_TECHNICAL_KEYS = new Set<string>(
  Array.from(TECHNICAL_KEYS).map((k) => normalizeKey(k))
);

function isTechnical(key: string): boolean {
  const nk = normalizeKey(key);
  if (NORMALIZED_TECHNICAL_KEYS.has(nk)) return true;
  return TECHNICAL_PREFIXES.some((p) => nk.startsWith(normalizeKey(p)));
}

function isBusinessKey(key: string): boolean {
  const lk = normalizeKey(key);
  return BUSINESS_KEYWORDS.some((kw) => lk.includes(kw));
}

function isLikelyHidden(key: string): boolean {
  if (NORMALIZED_SKIP_META.has(normalizeKey(key))) return true;
  if (isTechnical(key)) return true;
  if (key.startsWith('_')) return true; // WordPress interno
  return false;
}

// Decide se um campo desconhecido (sem label) deve aparecer.
// Regra: mostrar somente se for um campo de negócio (label mapeada OU keyword PT-BR).
function isWhitelisted(key: string): boolean {
  if (normalizeKey(key) in NORMALIZED_LABELS) return true;
  if (isBusinessKey(key)) return true;
  return false;
}

function labelFor(key: string): string {
  return NORMALIZED_LABELS[normalizeKey(key)] || humanizeKey(key);
}


function formatValue(v: unknown): string | string[] | null {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    // Heurística: "1" / "0" comumente representam sim/não em flags Houzez
    return t;
  }
  if (Array.isArray(v)) {
    const items = v.map((x) => formatValue(x)).filter(Boolean) as (string | string[])[];
    const flat: string[] = [];
    for (const it of items) Array.isArray(it) ? flat.push(...it) : flat.push(it);
    return flat.length ? flat : null;
  }
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    const parts: string[] = [];
    for (const [k, val] of Object.entries(obj)) {
      const fv = formatValue(val);
      if (!fv) continue;
      const s = Array.isArray(fv) ? fv.join(', ') : fv;
      parts.push(`${k}: ${s}`);
    }
    return parts.length ? parts : null;
  }
  return null;
}

export function extractAdditionalSourceFields(
  payload: Record<string, unknown> | null | undefined
): SourceField[] {
  if (!payload) return [];
  const meta = (payload.meta || {}) as Record<string, string | string[]>;
  const categories = (payload.categories || {}) as Record<string, string[]>;
  const out: SourceField[] = [];

  // Categorias adicionais
  for (const [domain, values] of Object.entries(categories)) {
    if (SKIP_CATEGORIES.has(domain)) continue;
    if (!values || values.length === 0) continue;
    out.push({
      key: domain,
      label: labelFor(domain),
      value: values.length === 1 ? values[0] : values,
      group: 'categoria',
    });
  }

  // Metadados adicionais
  for (const [key, rawVal] of Object.entries(meta)) {
    if (isLikelyHidden(key)) continue;
    if (key.startsWith('_')) continue;
    if (!isWhitelisted(key)) continue;
    const candidates = Array.isArray(rawVal) ? rawVal : [rawVal];
    const decoded = candidates.map((c) => decodeMaybeSerialized(c));
    const single = decoded.length === 1 ? decoded[0] : decoded;
    const formatted = formatValue(single);
    if (formatted == null) continue;
    if (typeof formatted === 'string' && (formatted === '0' || formatted === '')) continue;
    out.push({
      key,
      label: labelFor(key),
      value: formatted,
      group: 'meta',
    });
  }

  // Ordena: categorias primeiro, depois por label
  out.sort((a, b) => {
    if (a.group !== b.group) return a.group === 'categoria' ? -1 : 1;
    return a.label.localeCompare(b.label, 'pt-BR');
  });

  // Deduplica pelo label (preserva o primeiro)
  const seen = new Set<string>();
  return out.filter((f) => {
    const k = f.label.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
