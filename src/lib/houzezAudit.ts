import * as XLSX from 'xlsx';

// Linha normalizada enviada à edge function de auditoria
export interface AuditRow {
  wpId?: string | null;
  code?: string | null;
  permalink?: string | null;
  title?: string | null;
  propertyType?: string | null;
  listingStatus?: string | null;
  price?: number | null;
  areaM2?: number | null;
  landAreaM2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  suites?: number | null;
  garageSpaces?: number | null;
  iptu?: number | null;
  neighborhood?: string | null;
  city?: string | null;
  features?: string[] | null;
  photos?: string[] | null;
}

export interface FieldDiff { field: string; source: unknown; db: unknown }

export interface AuditItem {
  status: 'ok' | 'divergent' | 'missing';
  key: string;
  title: string;
  db_id: string | null;
  source_url: string | null;
  field_diffs: FieldDiff[];
  photos_source: number;
  photos_db: number;
  photos_missing: number;
  photos_extra: number;
  features_missing: string[];
  features_extra: string[];
  warnings: string[];
}

export interface AuditExtra {
  db_id: string;
  title: string;
  source_url: string | null;
  code: string | null;
  wp_id: string | null;
}

export interface AuditSummary {
  source_total: number;
  db_total: number;
  ok: number;
  divergent: number;
  missing: number;
  extra: number;
}

export interface AuditResult {
  success: boolean;
  summary: AuditSummary;
  items: AuditItem[];
  extras: AuditExtra[];
}

// ===== Header helpers =====
function normHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// alias exatos (já normalizados) -> campo
const ALIASES: Record<string, keyof AuditRow> = {};
const define = (field: keyof AuditRow, names: string[]) => {
  for (const n of names) ALIASES[normHeader(n)] = field;
};

define('wpId', ['id', 'post id', 'post_id', 'wp id', 'wp_id', 'property id', 'property_id', 'mls id']);
define('code', ['código', 'codigo', 'reference', 'ref', 'mls', 'property code', 'property_code', 'código do imóvel', 'codigo do imovel', 'fave_property_id']);
define('permalink', ['permalink', 'url', 'link', 'property url', 'post url', 'endereço da página']);
define('title', ['title', 'post title', 'post_title', 'título', 'titulo', 'property title', 'name', 'nome']);
define('propertyType', ['property type', 'property_type', 'tipo', 'tipo de imóvel', 'tipo de imovel', 'type']);
define('listingStatus', ['status', 'property status', 'property_status', 'situação', 'situacao', 'listing status', 'action', 'finalidade', 'transação', 'transacao']);
define('price', ['price', 'property price', 'preço', 'preco', 'valor', 'fave_property_price', 'price (r$)']);
define('areaM2', ['size', 'property size', 'área', 'area', 'área construída', 'area construida', 'built area', 'fave_property_size', 'área útil', 'area util', 'area (m2)', 'm2']);
define('landAreaM2', ['land area', 'área do terreno', 'area do terreno', 'área total', 'area total', 'lot size', 'fave_property_land', 'terreno', 'land']);
define('bedrooms', ['bedrooms', 'quartos', 'dormitórios', 'dormitorios', 'beds', 'fave_property_bedrooms']);
define('bathrooms', ['bathrooms', 'banheiros', 'baths', 'fave_property_bathrooms']);
define('suites', ['suites', 'suítes', 'suite', 'suíte', 'ensuite']);
define('garageSpaces', ['garage', 'garagem', 'garagens', 'vagas', 'parking', 'fave_property_garage', 'vagas de garagem']);
define('iptu', ['iptu']);
define('neighborhood', ['neighborhood', 'bairro', 'fave_property_area', 'região', 'regiao']);
define('city', ['city', 'cidade', 'fave_property_city', 'property_city']);

// Colunas múltiplas (image 1, image 2 / feature 1, feature 2)
const PHOTO_RE = /^(image|images|photo|photos|foto|fotos|gallery|galeria|picture|pictures|imagem|imagens)\b/;
const FEATURE_RE = /^(feature|features|característica|caracteristica|caracteristicas|amenit|destaque|destaques|recurso|recursos)\b/;

function parseBrNumber(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  s = s.replace(/[^\d.,-]/g, ''); // remove R$, m², letras, espaços
  if (!s) return null;
  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    s = s.replace(/\./g, '').replace(',', '.'); // 1.999.000,00
  } else if (hasComma) {
    s = s.replace(',', '.'); // 110,5
  } else if (hasDot) {
    // 1.999.000 (milhar) vs 110.5 (decimal)
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseInt0(raw: unknown): number | null {
  const n = parseBrNumber(raw);
  return n == null ? null : Math.round(n);
}

function splitList(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  let parts: string[];
  if (/[|\n;\t]/.test(s)) parts = s.split(/[|\n;\t]+/);
  else if (s.includes(',')) parts = s.split(',');
  else parts = [s];
  return parts.map((p) => p.trim()).filter(Boolean);
}

function splitUrls(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw);
  const matches = s.match(/https?:\/\/[^\s|,;"'\]>)]+/gi) || [];
  return [...new Set(matches.map((u) => u.trim()))];
}

// Lê o arquivo (csv/xlsx/xls) -> array de objetos cru (header -> valor)
export async function parseSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: '', raw: true });
}

// Converte linhas cruas -> AuditRow normalizado
export function normalizeRows(raw: Record<string, unknown>[]): AuditRow[] {
  return raw.map((r) => {
    const row: AuditRow = {};
    const photoCols: string[] = [];
    const featureCols: string[] = [];

    for (const [header, value] of Object.entries(r)) {
      const h = normHeader(header);
      if (value === '' || value == null) {
        // ainda detecta colunas múltiplas vazias? pula
      }
      const field = ALIASES[h];
      if (field) {
        switch (field) {
          case 'price': row.price = parseBrNumber(value); break;
          case 'areaM2': row.areaM2 = parseBrNumber(value); break;
          case 'landAreaM2': row.landAreaM2 = parseBrNumber(value); break;
          case 'iptu': row.iptu = parseBrNumber(value); break;
          case 'bedrooms': row.bedrooms = parseInt0(value); break;
          case 'bathrooms': row.bathrooms = parseInt0(value); break;
          case 'suites': row.suites = parseInt0(value); break;
          case 'garageSpaces': row.garageSpaces = parseInt0(value); break;
          case 'wpId': row.wpId = value === '' ? row.wpId : String(value); break;
          default: (row[field] as unknown) = value === '' ? (row[field] ?? null) : String(value);
        }
        continue;
      }
      // colunas múltiplas de fotos
      if (PHOTO_RE.test(h)) { photoCols.push(...splitUrls(value)); continue; }
      // colunas múltiplas de características
      if (FEATURE_RE.test(h)) { featureCols.push(...splitList(value)); continue; }
    }

    if (photoCols.length) row.photos = [...new Set(photoCols)];
    if (featureCols.length) row.features = [...new Set(featureCols)];
    return row;
  }).filter((r) => r.wpId || r.permalink || r.code || r.title);
}

export async function parseAndNormalize(file: File): Promise<AuditRow[]> {
  const raw = await parseSpreadsheet(file);
  return normalizeRows(raw);
}

// ===== Geração de CSV do relatório =====
function csvCell(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildReportCsv(result: AuditResult): string {
  const header = [
    'status', 'chave', 'titulo', 'source_url',
    'divergencias', 'fotos_origem', 'fotos_banco', 'fotos_faltando', 'fotos_extra',
    'caracteristicas_faltando', 'caracteristicas_extra', 'avisos',
  ];
  const lines = [header.join(',')];

  for (const it of result.items) {
    const diffs = it.field_diffs.map((d) => `${d.field}: origem=${d.source ?? '—'} / banco=${d.db ?? '—'}`).join(' | ');
    lines.push([
      it.status, it.key, it.title, it.source_url ?? '',
      diffs, it.photos_source, it.photos_db, it.photos_missing, it.photos_extra,
      it.features_missing.join(' | '), it.features_extra.join(' | '), it.warnings.join(' | '),
    ].map(csvCell).join(','));
  }

  for (const ex of result.extras) {
    lines.push(['extra', ex.code || ex.wp_id || '', ex.title, ex.source_url ?? '', 'Imóvel no banco sem correspondência na origem', '', '', '', '', '', '', ''].map(csvCell).join(','));
  }

  return lines.join('\n');
}
