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
};

function cleanDescription(html: string): string {
  if (!html) return '';
  // Sanitize keeping only safe formatting tags
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'h4', 'blockquote'],
    ALLOWED_ATTR: [],
  });
  // Collapse extra whitespace and empty paragraphs
  return clean
    .replace(/<p>\s*<\/p>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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

function getMeta(item: Element, key: string): string {
  const metas = item.getElementsByTagName('wp:postmeta');
  for (let i = 0; i < metas.length; i++) {
    const k = text(metas[i].getElementsByTagName('wp:meta_key')[0]);
    if (k === key) return text(metas[i].getElementsByTagName('wp:meta_value')[0]);
  }
  return '';
}

function getMetaAll(item: Element, key: string): string[] {
  const metas = item.getElementsByTagName('wp:postmeta');
  const out: string[] = [];
  for (let i = 0; i < metas.length; i++) {
    const k = text(metas[i].getElementsByTagName('wp:meta_key')[0]);
    if (k === key) {
      const v = text(metas[i].getElementsByTagName('wp:meta_value')[0]);
      if (v) out.push(v);
    }
  }
  return out;
}

function getCategories(item: Element, domain: string): string[] {
  const cats = item.getElementsByTagName('category');
  const out: string[] = [];
  for (let i = 0; i < cats.length; i++) {
    if (cats[i].getAttribute('domain') === domain) {
      const t = text(cats[i]);
      if (t) out.push(t);
    }
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

  // Build attachment map: post_id -> url
  const attachmentMap = new Map<string, string>();
  let attachmentCount = 0;
  for (const item of items) {
    const postType = text(item.getElementsByTagName('wp:post_type')[0]);
    if (postType === 'attachment') {
      attachmentCount++;
      const postId = text(item.getElementsByTagName('wp:post_id')[0]);
      const url = text(item.getElementsByTagName('wp:attachment_url')[0]);
      if (postId && url) attachmentMap.set(postId, url);
    }
  }

  const properties: ParsedProperty[] = [];
  for (const item of items) {
    const postType = text(item.getElementsByTagName('wp:post_type')[0]);
    if (postType !== 'property') continue;

    const status = text(item.getElementsByTagName('wp:status')[0]);
    if (status === 'trash') continue;

    const postId = text(item.getElementsByTagName('wp:post_id')[0]);
    const externalCode = getMeta(item, 'fave_property_id') || null;
    const title = text(item.getElementsByTagName('title')[0]);

    // Photos: Houzez stores ONE attachment ID per <wp:postmeta> entry with key 'fave_property_images'
    // (NOT a serialized PHP array). May also contain fallback serialized IDs.
    const imagesRawList = getMetaAll(item, 'fave_property_images');
    const ids: string[] = [];
    for (const raw of imagesRawList) {
      const matches = raw.match(/\d+/g) || [];
      for (const m of matches) if (!ids.includes(m)) ids.push(m);
    }
    const photos: string[] = [];
    for (const id of ids) {
      const url = attachmentMap.get(id);
      if (url && !photos.includes(url)) photos.push(url);
    }
    // Thumbnail
    const thumbId = getMeta(item, '_thumbnail_id');
    let featured: string | null = null;
    if (thumbId && attachmentMap.has(thumbId)) {
      featured = attachmentMap.get(thumbId)!;
      if (!photos.includes(featured)) photos.unshift(featured);
    } else if (photos[0]) {
      featured = photos[0];
    }

    // Type
    const typeRaw = (getCategories(item, 'property_type')[0] || '').toLowerCase();
    const typeKey = Object.keys(PROPERTY_TYPE_MAP).find(k => typeRaw.includes(k));
    const propertyType = typeKey ? PROPERTY_TYPE_MAP[typeKey] : 'outro';

    // Listing status
    const statusRaw = (getCategories(item, 'property_status')[0] || '').toLowerCase();
    let listing = 'venda';
    if (statusRaw.includes('alug') && statusRaw.includes('vend')) listing = 'venda_aluguel';
    else if (statusRaw.includes('alug')) listing = 'aluguel';

    // Extra costs (IPTU, condomínio — Houzez tem várias chaves possíveis, inclusive com encoding bizarro)
    const extra: Record<string, unknown> = {};
    const iptu = num(getMeta(item, 'fave_iptu') || getMeta(item, 'fave_property_iptu'));
    const cond = num(
      getMeta(item, 'fave_valor-do-condomc3adnio') ||
      getMeta(item, 'fave_condomc3ado') ||
      getMeta(item, 'fave_property_condominio') ||
      getMeta(item, 'fave_condominio')
    );
    const secPrice = num(getMeta(item, 'fave_property_sec_price'));
    if (iptu) extra.iptu = iptu;
    if (cond) extra.condominio = cond;
    if (secPrice) extra.sec_price = secPrice;

    // Price label (postfix): "Venda", "Locação", "Pacote", "+ despesas"
    const priceLabel = (getMeta(item, 'fave_property_price_postfix') || '').trim() || null;

    // Bathrooms — fallback para fave_banheiros (variação Lemos Properties)
    const bathrooms = int(getMeta(item, 'fave_property_bathrooms')) ?? int(getMeta(item, 'fave_banheiros'));

    // Address
    const addr = getMeta(item, 'fave_property_address') || getMeta(item, 'fave_property_map_address') || null;
    const addrNum = getMeta(item, 'fave_property_address_number') || null;

    const pubDate = text(item.getElementsByTagName('pubDate')[0]);
    const pubISO = pubDate ? new Date(pubDate).toISOString() : null;

    const rawDesc = text(item.getElementsByTagName('content:encoded')[0]);

    properties.push({
      source_id: `houzez:wp${postId}`,
      external_code: externalCode,
      title: title || `Imóvel ${externalCode || postId}`,
      description: rawDesc ? cleanDescription(rawDesc) : null,
      property_type: propertyType,
      listing_status: listing,
      labels: getCategories(item, 'property_label').length ? getCategories(item, 'property_label') : null,
      neighborhood: getCategories(item, 'property_area')[0] || null,
      city: getCategories(item, 'property_city')[0] || null,
      state: getCategories(item, 'property_state')[0] || null,
      full_address: addr,
      address_number: addrNum,
      zip_code: getMeta(item, 'fave_property_zip') || null,
      latitude: num(getMeta(item, 'houzez_geolocation_lat')),
      longitude: num(getMeta(item, 'houzez_geolocation_long')),
      price: num(getMeta(item, 'fave_property_price')),
      price_label: priceLabel,
      area_m2: num(getMeta(item, 'fave_property_size')),
      land_area_m2: num(getMeta(item, 'fave_property_land')),
      bedrooms: int(getMeta(item, 'fave_property_bedrooms')),
      bathrooms,
      garage_spaces: int(getMeta(item, 'fave_property_garage')),
      year_built: int(getMeta(item, 'fave_property_year')),
      features: getCategories(item, 'property_feature').length ? getCategories(item, 'property_feature') : null,
      photos: photos.length ? photos : null,
      featured_photo: featured,
      video_url: getMeta(item, 'fave_video_url') || null,
      virtual_tour_url: getMeta(item, 'fave_virtual_tour') || null,
      extra_costs: Object.keys(extra).length ? extra : null,
      source_url: text(item.getElementsByTagName('link')[0]) || null,
      source_published_at: pubISO,
      internal_notes: getMeta(item, 'fave_private_note') || null,
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

  const BATCH = 10;

  const effectiveList = (() => {
    if (!parsed) return null;
    const n = parseInt(limit, 10);
    return Number.isFinite(n) && n > 0 ? parsed.slice(0, n) : parsed;
  })();

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
    const list = effectiveList;
    setStep('importing');
    setProgress(0);
    setImported(0);
    setUpdated(0);
    setErrors([]);
    let imp = 0, upd = 0;
    const errs: string[] = [];

    for (let i = 0; i < list.length; i += BATCH) {
      const batch = list.slice(i, i + BATCH);
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
          <p className="text-muted-foreground">Importação direta do arquivo exportado do site antigo (paridade 100%)</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> 1. Selecionar arquivo XML</CardTitle>
            <CardDescription>Arquivo exportado do WordPress Houzez (Ferramentas → Exportar)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input type="file" accept=".xml" onChange={(e) => { setFile(e.target.files?.[0] || null); setParsed(null); setStats(null); setStep('idle'); }} />
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
                Todos serão vinculados ao seu usuário, fotos como públicas. Re-importação atualiza sem duplicar (chave: <code>source_id</code>).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                <p className="text-xs text-muted-foreground">
                  Dica: comece com <code>1</code> para validar 1 imóvel antes de rodar o arquivo inteiro.
                </p>
              </div>
              <Button onClick={handleImport} disabled={step === 'importing'} className="gradient-bg">
                {step === 'importing'
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
                  : <><Upload className="mr-2 h-4 w-4" /> Iniciar importação ({effectiveList?.length ?? parsed.length})</>}
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
                {imported + updated} de {effectiveList?.length ?? parsed?.length} imóveis sincronizados com sucesso.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
