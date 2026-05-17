import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import DOMPurify from 'dompurify';
import { htmlToPlainText } from '@/lib/htmlToPlainText';
import { validateSourceParity, type ParityDiff } from '@/lib/sourceParity';

type ParsedProperty = {
  source_id: string;
  external_code: string | null;
  title: string;
  description: string | null;
  property_type: string | null;
  listing_status: string | null;
  labels: string[] | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  full_address: string | null;
  address_number: string | null;
  zip_code: string | null;
  latitude: number | null;
  longitude: number | null;
  price: number | null;
  price_label: string | null;
  area_m2: number | null;
  land_area_m2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suites: number | null;
  garage_spaces: number | null;
  year_built: number | null;
  features: string[] | null;
  photos: string[] | null;
  featured_photo: string | null;
  video_url: string | null;
  virtual_tour_url: string | null;
  extra_costs: Record<string, unknown> | null;
  source_url: string | null;
  source_published_at: string | null;
  internal_notes: string | null;
  source_payload: Record<string, unknown>;
  _blocking: string | null;
};

function cleanDescription(html: string): string {
  if (!html) return '';
  const safe = DOMPurify.sanitize(html, { ALLOWED_ATTR: [] });
  return htmlToPlainText(safe);
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  apartamento: 'apartamento',
  casa: 'casa',
  sobrado: 'casa',
  cobertura: 'apartamento',
  flat: 'apartamento',
  studio: 'apartamento',
  kitnet: 'apartamento',
  terreno: 'terreno',
  lote: 'terreno',
  loja: 'comercial',
  sala: 'comercial',
  comercial: 'comercial',
  galpao: 'comercial',
  'sitio': 'rural',
  fazenda: 'rural',
  chacara: 'rural',
};

function text(el: Element | null | undefined): string {
  return el?.textContent?.trim() ?? '';
}

// Genérico: coleta TODAS as wp:postmeta como key → value (ou array se repetir)
function collectAllMeta(item: Element): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  const metas = item.getElementsByTagName('wp:postmeta');
  for (let i = 0; i < metas.length; i++) {
    const k = text(metas[i].getElementsByTagName('wp:meta_key')[0]);
    const v = text(metas[i].getElementsByTagName('wp:meta_value')[0]);
    if (!k) continue;
    if (k in out) {
      const cur = out[k];
      out[k] = Array.isArray(cur) ? [...cur, v] : [cur as string, v];
    } else {
      out[k] = v;
    }
  }
  return out;
}

function getMetaFirst(meta: Record<string, string | string[]>, key: string): string {
  const v = meta[key];
  if (v == null) return '';
  return Array.isArray(v) ? (v[0] ?? '') : v;
}

function getMetaAll(meta: Record<string, string | string[]>, key: string): string[] {
  const v = meta[key];
  if (v == null) return [];
  return Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []);
}

// Genérico: todas as categorias agrupadas por domain
function collectAllCategories(item: Element): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const cats = item.getElementsByTagName('category');
  for (let i = 0; i < cats.length; i++) {
    const domain = cats[i].getAttribute('domain') || 'unknown';
    const t = text(cats[i]);
    if (!t) continue;
    (out[domain] ||= []).push(t);
  }
  return out;
}

function num(v: string): number | null {
  if (!v) return null;
  const n = Number(v.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function int(v: string): number | null {
  const n = num(v);
  return n == null ? null : Math.round(n);
}

function parseXML(xmlText: string): { properties: ParsedProperty[]; totalItems: number; attachmentCount: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'text/xml');
  const items = Array.from(doc.getElementsByTagName('item'));

  // Map attachment id → { url, title }
  const attachmentMap = new Map<string, { url: string; title: string }>();
  let attachmentCount = 0;
  for (const item of items) {
    const postType = text(item.getElementsByTagName('wp:post_type')[0]);
    if (postType === 'attachment') {
      attachmentCount++;
      const postId = text(item.getElementsByTagName('wp:post_id')[0]);
      const url = text(item.getElementsByTagName('wp:attachment_url')[0]);
      const t = text(item.getElementsByTagName('title')[0]);
      if (postId && url) attachmentMap.set(postId, { url, title: t });
    }
  }

  const properties: ParsedProperty[] = [];
  for (const item of items) {
    const postType = text(item.getElementsByTagName('wp:post_type')[0]);
    if (postType !== 'property') continue;

    const status = text(item.getElementsByTagName('wp:status')[0]);
    if (status === 'trash') continue;

    const postId = text(item.getElementsByTagName('wp:post_id')[0]);
    const meta = collectAllMeta(item);
    const categories = collectAllCategories(item);
    const externalCode = getMetaFirst(meta, 'fave_property_id') || null;
    const title = text(item.getElementsByTagName('title')[0]);
    const link = text(item.getElementsByTagName('link')[0]) || null;
    const pubDate = text(item.getElementsByTagName('pubDate')[0]);
    const pubISO = pubDate ? new Date(pubDate).toISOString() : null;

    // Photos
    const imagesRawList = getMetaAll(meta, 'fave_property_images');
    const ids: string[] = [];
    for (const raw of imagesRawList) {
      const matches = raw.match(/\d+/g) || [];
      for (const m of matches) if (!ids.includes(m)) ids.push(m);
    }
    const photos: string[] = [];
    const attachmentDetails: Array<{ id: string; url: string; title: string }> = [];
    for (const id of ids) {
      const a = attachmentMap.get(id);
      if (a) {
        if (!photos.includes(a.url)) photos.push(a.url);
        attachmentDetails.push({ id, ...a });
      }
    }
    const thumbId = getMetaFirst(meta, '_thumbnail_id');
    let featured: string | null = null;
    if (thumbId && attachmentMap.has(thumbId)) {
      featured = attachmentMap.get(thumbId)!.url;
      if (!photos.includes(featured)) photos.unshift(featured);
      if (!attachmentDetails.find((a) => a.id === thumbId)) {
        attachmentDetails.unshift({ id: thumbId, ...attachmentMap.get(thumbId)! });
      }
    } else if (photos[0]) {
      featured = photos[0];
    }

    // Type
    const typeRaw = (categories['property_type']?.[0] || '').toLowerCase();
    const typeKey = Object.keys(PROPERTY_TYPE_MAP).find((k) => typeRaw.includes(k));
    const propertyType = typeKey ? PROPERTY_TYPE_MAP[typeKey] : 'outro';

    // Listing status
    const statusRaw = (categories['property_status']?.[0] || '').toLowerCase();
    let listing = 'venda';
    if (statusRaw.includes('alug') && statusRaw.includes('vend')) listing = 'venda_aluguel';
    else if (statusRaw.includes('alug')) listing = 'aluguel';

    // Extra costs heurísticos (mantidos para filtros/exibição rápida)
    const extra: Record<string, unknown> = {};
    const iptu = num(
      getMetaFirst(meta, 'fave_iptu') ||
      getMetaFirst(meta, 'fave_property_iptu') ||
      getMetaFirst(meta, 'fave_property_iptu_value') ||
      getMetaFirst(meta, 'fave_iptu_value')
    );
    const cond = num(
      getMetaFirst(meta, 'fave_valor-do-condomc3adnio') ||
      getMetaFirst(meta, 'fave_condomc3ado') ||
      getMetaFirst(meta, 'fave_property_condominio') ||
      getMetaFirst(meta, 'fave_condominio') ||
      getMetaFirst(meta, 'fave_property_taxa_condominio') ||
      getMetaFirst(meta, 'fave_valor_condominio')
    );
    const secPrice = num(getMetaFirst(meta, 'fave_property_sec_price'));
    const condoName = (
      getMetaFirst(meta, 'fave_property_subtitle') ||
      getMetaFirst(meta, 'fave_propriedade') ||
      getMetaFirst(meta, 'fave_property_name') ||
      getMetaFirst(meta, 'fave_condomc3ado') ||
      getMetaFirst(meta, 'fave_condominio_nome') ||
      ''
    ).trim() || null;
    if (iptu) extra.iptu = iptu;
    if (cond) extra.condominio = cond;
    if (secPrice) extra.sec_price = secPrice;
    if (condoName) extra.condo_name = condoName;

    const priceLabel = (getMetaFirst(meta, 'fave_property_price_postfix') || '').trim() || null;

    // Bathrooms / Suítes — heurística Lemos vs Houzez padrão
    const banheirosCustom = int(getMetaFirst(meta, 'fave_banheiros'));
    const propBathrooms = int(getMetaFirst(meta, 'fave_property_bathrooms'));
    const explicitSuites =
      int(getMetaFirst(meta, 'fave_property_suites')) ??
      int(getMetaFirst(meta, 'fave_suites')) ??
      int(getMetaFirst(meta, 'fave_suite')) ??
      int(getMetaFirst(meta, 'fave_property_suite'));
    let bathrooms: number | null;
    let suites: number | null;
    if (banheirosCustom != null) {
      bathrooms = banheirosCustom;
      suites = explicitSuites ?? propBathrooms;
    } else {
      bathrooms = propBathrooms;
      suites = explicitSuites;
    }

    const addr = getMetaFirst(meta, 'fave_property_address') || getMetaFirst(meta, 'fave_property_map_address') || null;
    const addrNum = getMetaFirst(meta, 'fave_property_address_number') || null;

    const rawDesc = text(item.getElementsByTagName('content:encoded')[0]);

    const source_payload: Record<string, unknown> = {
      source_format: 'houzez-xml-v1',
      imported_at: new Date().toISOString(),
      post: {
        id: postId,
        title,
        link,
        pubDate,
        status,
        post_type: postType,
      },
      meta,
      categories,
      attachments: attachmentDetails,
      raw_description_html: rawDesc || null,
    };

    let blocking: string | null = null;
    if (!externalCode) blocking = 'ID externo (fave_property_id) ausente';
    else if (!title) blocking = 'Título ausente';

    properties.push({
      source_id: `houzez:wp${postId}`,
      external_code: externalCode,
      title: title || `Imóvel ${externalCode || postId}`,
      description: rawDesc ? cleanDescription(rawDesc) : null,
      property_type: propertyType,
      listing_status: listing,
      labels: categories['property_label']?.length ? categories['property_label'] : null,
      neighborhood: categories['property_area']?.[0] || null,
      city: categories['property_city']?.[0] || null,
      state: categories['property_state']?.[0] || null,
      full_address: addr,
      address_number: addrNum,
      zip_code: getMetaFirst(meta, 'fave_property_zip') || null,
      latitude: num(getMetaFirst(meta, 'houzez_geolocation_lat')),
      longitude: num(getMetaFirst(meta, 'houzez_geolocation_long')),
      price: num(getMetaFirst(meta, 'fave_property_price')),
      price_label: priceLabel,
      area_m2: num(getMetaFirst(meta, 'fave_property_size')) ?? num(getMetaFirst(meta, 'fave_property_land')),
      land_area_m2: num(getMetaFirst(meta, 'fave_property_land')),
      bedrooms: int(getMetaFirst(meta, 'fave_property_bedrooms')),
      bathrooms,
      suites,
      garage_spaces: int(getMetaFirst(meta, 'fave_property_garage')),
      year_built: int(getMetaFirst(meta, 'fave_property_year')),
      features: categories['property_feature']?.length ? categories['property_feature'] : null,
      photos: photos.length ? photos : null,
      featured_photo: featured,
      video_url: getMetaFirst(meta, 'fave_video_url') || null,
      virtual_tour_url: getMetaFirst(meta, 'fave_virtual_tour') || null,
      extra_costs: Object.keys(extra).length ? extra : null,
      source_url: link,
      source_published_at: pubISO,
      internal_notes: getMetaFirst(meta, 'fave_private_note') || null,
      source_payload,
      _blocking: blocking,
    });
  }

  return { properties, totalItems: items.length, attachmentCount };
}

export default function ImportHouzezXml() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedProperty[] | null>(null);
  const [stats, setStats] = useState<{ totalItems: number; attachmentCount: number; totalPhotos: number } | null>(null);
  const [step, setStep] = useState<'idle' | 'parsing' | 'ready' | 'importing' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [limit, setLimit] = useState<string>('');
  const [codeFilter, setCodeFilter] = useState<string>('');

  const BATCH = 10;

  const effectiveList = (() => {
    if (!parsed) return null;
    let list = parsed;
    const codes = codeFilter
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    if (codes.length > 0) {
      list = list.filter((p) => p.external_code && codes.includes(p.external_code.toUpperCase()));
    }
    const n = parseInt(limit, 10);
    return Number.isFinite(n) && n > 0 ? list.slice(0, n) : list;
  })();

  const blockedCount = effectiveList?.filter((p) => p._blocking).length ?? 0;

  const handleParse = async () => {
    if (!file) return;
    setStep('parsing');
    try {
      const text = await file.text();
      const result = parseXML(text);
      const totalPhotos = result.properties.reduce((s, p) => s + (p.photos?.length || 0), 0);
      setParsed(result.properties);
      setStats({ totalItems: result.totalItems, attachmentCount: result.attachmentCount, totalPhotos });
      setStep('ready');
      toast({ title: `${result.properties.length} imóveis encontrados`, description: `${totalPhotos} fotos referenciadas` });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro ao ler XML', description: (e as Error).message });
      setStep('idle');
    }
  };

  const handleImport = async () => {
    if (!effectiveList) return;
    const list = effectiveList.filter((p) => !p._blocking);
    setStep('importing');
    setProgress(0);
    setImported(0);
    setUpdated(0);
    setErrors([]);
    let imp = 0, upd = 0;
    const errs: string[] = [];

    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH).map(({ _blocking, ...rest }) => rest);
      try {
        const { data, error } = await supabase.functions.invoke('import-houzez-xml', {
          body: { properties: batch },
        });
        if (error) throw error;
        imp += data.imported || 0;
        upd += data.updated || 0;
        if (data.errors?.length) errs.push(...data.errors);
      } catch (e) {
        errs.push(`Lote ${i / BATCH + 1}: ${(e as Error).message}`);
      }
      setImported(imp);
      setUpdated(upd);
      setErrors([...errs]);
      setProgress(Math.min(100, Math.round(((i + BATCH) / list.length) * 100)));
    }
    setStep('done');
    toast({ title: 'Importação concluída', description: `${imp} novos, ${upd} atualizados, ${errs.length} erros` });
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 py-8 px-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Importar XML do Houzez</h1>
          <p className="text-muted-foreground">
            Importação direta do arquivo exportado do site antigo. Todos os campos da origem são preservados — campos não mapeados ficam disponíveis em "Dados da origem" no detalhe do imóvel.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> 1. Selecionar arquivo XML</CardTitle>
            <CardDescription>Arquivo exportado do WordPress Houzez (Ferramentas → Exportar)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              type="file"
              accept=".xml"
              onChange={(e) => { setFile(e.target.files?.[0] || null); setParsed(null); setStats(null); setStep('idle'); }}
            />
            {file && (
              <p className="text-sm text-muted-foreground">{file.name} — {(file.size / 1024 / 1024).toFixed(1)} MB</p>
            )}
            <Button onClick={handleParse} disabled={!file || step === 'parsing'}>
              {step === 'parsing' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...</> : 'Analisar XML'}
            </Button>
          </CardContent>
        </Card>

        {stats && parsed && (
          <Card>
            <CardHeader>
              <CardTitle>2. Resumo do XML</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{parsed.length}</div>
                  <div className="text-xs text-muted-foreground">Imóveis</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{stats.totalPhotos}</div>
                  <div className="text-xs text-muted-foreground">Fotos</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{stats.attachmentCount}</div>
                  <div className="text-xs text-muted-foreground">Anexos totais</div>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-2xl font-bold">{(stats.totalPhotos / Math.max(parsed.length, 1)).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">Fotos/imóvel</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {parsed && (
          <Card>
            <CardHeader>
              <CardTitle>3. Importar para o Corretor Camarada</CardTitle>
              <CardDescription>
                Re-importação atualiza sem duplicar (chave: <code>source_id</code>). Todos os campos da origem ficam guardados — nada se perde mesmo que não esteja mapeado nos filtros.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Filtrar por código (opcional)</label>
                <Input
                  type="text"
                  placeholder="Ex: HZ0007 ou HZ0007, HZ0012"
                  value={codeFilter}
                  onChange={(e) => setCodeFilter(e.target.value)}
                  disabled={step === 'importing'}
                  className="max-w-md"
                />
                <p className="text-xs text-muted-foreground">Importa só os imóveis com os códigos informados. Vazio = todos.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Limite de imóveis (opcional)</label>
                <Input
                  type="number"
                  min={1}
                  max={parsed.length}
                  placeholder={`Em branco = todos (${parsed.length})`}
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  disabled={step === 'importing'}
                  className="max-w-xs"
                />
                <p className="text-xs text-muted-foreground">Dica: comece com <code>1</code> para conferir antes de rodar o arquivo inteiro.</p>
              </div>

              {codeFilter.trim() && effectiveList && effectiveList.length === 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  Nenhum imóvel encontrado no XML com os códigos informados.
                </div>
              )}

              {blockedCount > 0 && (
                <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3 text-xs">
                  {blockedCount} imóvel(is) será(ão) ignorado(s) por estarem sem ID externo ou título.
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={step === 'importing' || (effectiveList?.length ?? 0) - blockedCount === 0}
                className="gradient-bg"
              >
                {step === 'importing'
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
                  : <><Upload className="mr-2 h-4 w-4" /> Iniciar importação ({(effectiveList?.length ?? 0) - blockedCount})</>}
              </Button>

              {(step === 'importing' || step === 'done') && (
                <>
                  <Progress value={progress} className="h-3" />
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-green-500" /> {imported} novos</span>
                    <span className="flex items-center gap-1"><CheckCircle className="h-4 w-4 text-blue-500" /> {updated} atualizados</span>
                    {errors.length > 0 && (
                      <span className="flex items-center gap-1"><AlertCircle className="h-4 w-4 text-destructive" /> {errors.length} erros</span>
                    )}
                    <span className="ml-auto">{progress}%</span>
                  </div>
                </>
              )}

              {errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-destructive">Ver erros ({errors.length})</summary>
                  <ul className="mt-2 space-y-1 max-h-60 overflow-auto p-2 bg-muted rounded">
                    {errors.map((e, i) => <li key={i} className="text-muted-foreground font-mono">{e}</li>)}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <h3 className="text-lg font-semibold">Pronto!</h3>
              <p className="text-muted-foreground">
                {imported + updated} de {(effectiveList?.length ?? 0) - blockedCount} imóveis sincronizados com sucesso.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
