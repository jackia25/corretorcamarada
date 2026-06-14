import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TARGET_USER_ID = '03b76688-44d2-47e2-a509-1e6a837280e4'; // Andy Lemos

// Linha já normalizada pelo cliente
interface AuditRow {
  wpId?: string | null;        // ID do post no WordPress (do export Houzez)
  code?: string | null;        // Código (HZ....)
  permalink?: string | null;   // URL/permalink
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

interface FieldDiff {
  field: string;
  source: unknown;
  db: unknown;
}

interface AuditItem {
  status: 'ok' | 'divergent' | 'missing';
  key: string;
  title: string;
  db_id: string | null;
  source_url: string | null;
  field_diffs: FieldDiff[];
  photos_source: number;
  photos_db: number;
  photos_missing: number;   // na origem, faltando no banco
  photos_extra: number;     // no banco, ausentes na origem
  features_missing: string[];
  features_extra: string[];
  warnings: string[];
}

// ===== Normalizadores =====
function normText(s: unknown): string {
  if (s == null) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normUrl(u: unknown): string {
  if (!u) return '';
  let s = String(u).trim().toLowerCase();
  s = s.replace(/^http:\/\//, 'https://');
  try { s = decodeURIComponent(s); } catch (_e) { /* ignore */ }
  s = s.replace(/[?#].*$/, '');
  s = s.replace(/\/+$/, '');
  return s;
}

function normPhoto(u: unknown): string {
  if (!u) return '';
  let s = String(u).trim();
  s = s.replace(/[?#].*$/, '');
  s = s.replace(/-\d+x\d+(\.\w+)$/, '$1'); // remove sufixo -800x600
  return s.toLowerCase();
}

function wpIdFromSourceId(sourceId: unknown): string | null {
  if (!sourceId) return null;
  const m = String(sourceId).match(/wp[_-]?(\d+)/i) || String(sourceId).match(/(\d+)/);
  return m ? m[1] : null;
}

function codeFromNotes(notes: unknown): string | null {
  if (!notes) return null;
  const m = String(notes).match(/c[oó]digo[:\s]*([A-Za-z]*\d+)/i);
  return m ? m[1].toUpperCase() : null;
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function mapType(raw: unknown): string | null {
  const t = normText(raw);
  if (!t) return null;
  if (t.includes('apart') || t.includes('flat') || t.includes('studio') || t.includes('cobertura') || t.includes('loft')) return 'apartamento';
  if (t.includes('casa') || t.includes('sobrado') || t.includes('house') || t.includes('residenc')) return 'casa';
  if (t.includes('terreno') || t.includes('lote') || t.includes('land')) return 'terreno';
  if (t.includes('comerc') || t.includes('sala') || t.includes('loja') || t.includes('galpao') || t.includes('office')) return 'comercial';
  if (t.includes('rural') || t.includes('fazenda') || t.includes('chacar') || t.includes('sitio')) return 'rural';
  return null;
}

function mapStatus(raw: unknown): string | null {
  const t = normText(raw);
  if (!t) return null;
  if (t.includes('alug') || t.includes('rent') || t.includes('locac')) return 'aluguel';
  if (t.includes('vend') || t.includes('sale') || t.includes('comprar')) return 'venda';
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json();
    const rows: AuditRow[] = Array.isArray(body?.rows) ? body.rows : [];
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Carrega todos os imóveis do destino
    const { data: dbProps, error: dbErr } = await supabase
      .from('properties')
      .select('id,source_id,source_url,internal_notes,title,property_type,listing_status,neighborhood,city,price_range_min,area_m2,land_area_m2,bedrooms,bathrooms,suites,garage_spaces,features,public_photos')
      .eq('owner_id', TARGET_USER_ID);

    if (dbErr) {
      return new Response(JSON.stringify({ error: dbErr.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const byWpId = new Map<string, any>();
    const byPermalink = new Map<string, any>();
    const byCode = new Map<string, any>();
    for (const p of dbProps || []) {
      const wp = wpIdFromSourceId(p.source_id);
      if (wp) byWpId.set(wp, p);
      const pl = normUrl(p.source_url);
      if (pl) byPermalink.set(pl, p);
      const code = codeFromNotes(p.internal_notes) || codeFromNotes(p.title);
      if (code) byCode.set(code, p);
    }

    const matchedDbIds = new Set<string>();
    const items: AuditItem[] = [];

    for (const row of rows) {
      const wp = row.wpId ? String(row.wpId).replace(/\D/g, '') : '';
      const pl = normUrl(row.permalink);
      const code = row.code ? String(row.code).toUpperCase().trim() : '';

      let db: any = null;
      if (wp && byWpId.has(wp)) db = byWpId.get(wp);
      else if (pl && byPermalink.has(pl)) db = byPermalink.get(pl);
      else if (code && byCode.has(code)) db = byCode.get(code);

      const key = code || wp || row.permalink || (row.title ?? '—');
      const title = row.title || db?.title || '—';

      if (!db) {
        items.push({
          status: 'missing', key, title, db_id: null,
          source_url: row.permalink || null,
          field_diffs: [], photos_source: row.photos?.length || 0, photos_db: 0,
          photos_missing: row.photos?.length || 0, photos_extra: 0,
          features_missing: row.features || [], features_extra: [], warnings: [],
        });
        continue;
      }

      matchedDbIds.add(db.id);

      const diffs: FieldDiff[] = [];
      const warnings: string[] = [];

      // Aviso: título corrompido no banco (ex.: scrape pegou página 404)
      if (normText(db.title).includes('nao encontrada') || normText(db.title).includes('page not found') || normText(db.title).includes('oh oh')) {
        warnings.push('Título do banco parece inválido (página de erro capturada).');
      }

      // ===== Campos numéricos / categóricos (só compara quando a origem informa) =====
      const cmpNum = (field: string, src: number | null | undefined, dbVal: unknown, tol = 0) => {
        const s = num(src);
        if (s == null) return;
        const d = num(dbVal);
        if (d == null || Math.abs(s - d) > tol) diffs.push({ field, source: s, db: d });
      };
      const cmpText = (field: string, src: string | null | undefined, dbVal: unknown) => {
        const s = normText(src);
        if (!s) return;
        if (s !== normText(dbVal)) diffs.push({ field, source: src, db: dbVal ?? null });
      };

      cmpNum('preço', row.price, db.price_range_min, 0);
      cmpNum('área construída (m²)', row.areaM2, db.area_m2, 1);
      cmpNum('área do terreno (m²)', row.landAreaM2, db.land_area_m2, 1);
      cmpNum('quartos', row.bedrooms, db.bedrooms, 0);
      cmpNum('banheiros', row.bathrooms, db.bathrooms, 0);
      cmpNum('suítes', row.suites, db.suites, 0);
      cmpNum('vagas', row.garageSpaces, db.garage_spaces, 0);

      const srcType = mapType(row.propertyType);
      if (srcType && srcType !== db.property_type) diffs.push({ field: 'tipo', source: srcType, db: db.property_type });
      const srcStatus = mapStatus(row.listingStatus);
      if (srcStatus && srcStatus !== db.listing_status) diffs.push({ field: 'situação', source: srcStatus, db: db.listing_status });

      cmpText('bairro', row.neighborhood, db.neighborhood);
      cmpText('cidade', row.city, db.city);

      // ===== Fotos =====
      let photosMissing = 0, photosExtra = 0;
      const photosSource = row.photos?.length || 0;
      const photosDb = (db.public_photos || []).length;
      if (photosSource > 0) {
        const srcSet = new Set((row.photos || []).map(normPhoto).filter(Boolean));
        const dbSet = new Set((db.public_photos || []).map(normPhoto).filter(Boolean));
        for (const u of srcSet) if (!dbSet.has(u)) photosMissing++;
        for (const u of dbSet) if (!srcSet.has(u)) photosExtra++;
      }

      // ===== Características / destaques =====
      let featMissing: string[] = [];
      let featExtra: string[] = [];
      if (row.features && row.features.length > 0) {
        const dbFeats = (db.features || []) as string[];
        const dbNorm = new Map(dbFeats.map((f) => [normText(f), f]));
        const srcNorm = new Map(row.features.map((f) => [normText(f), f]));
        for (const [n, original] of srcNorm) if (n && !dbNorm.has(n)) featMissing.push(original);
        for (const [n, original] of dbNorm) if (n && !srcNorm.has(n)) featExtra.push(original);
      }

      const hasDiff = diffs.length > 0 || photosMissing > 0 || featMissing.length > 0 || warnings.length > 0;

      items.push({
        status: hasDiff ? 'divergent' : 'ok',
        key, title, db_id: db.id,
        source_url: db.source_url || row.permalink || null,
        field_diffs: diffs,
        photos_source: photosSource, photos_db: photosDb,
        photos_missing: photosMissing, photos_extra: photosExtra,
        features_missing: featMissing, features_extra: featExtra,
        warnings,
      });
    }

    // ===== Extras: imóveis no banco sem correspondência na origem =====
    const extras = (dbProps || [])
      .filter((p) => !matchedDbIds.has(p.id))
      .map((p) => ({
        db_id: p.id,
        title: p.title,
        source_url: p.source_url,
        code: codeFromNotes(p.internal_notes) || codeFromNotes(p.title),
        wp_id: wpIdFromSourceId(p.source_id),
      }));

    const summary = {
      source_total: rows.length,
      db_total: (dbProps || []).length,
      ok: items.filter((i) => i.status === 'ok').length,
      divergent: items.filter((i) => i.status === 'divergent').length,
      missing: items.filter((i) => i.status === 'missing').length,
      extra: extras.length,
    };

    return new Response(JSON.stringify({ success: true, summary, items, extras }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
