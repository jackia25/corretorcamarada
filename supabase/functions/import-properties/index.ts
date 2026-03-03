import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1';
const TARGET_USER_ID = '03b76688-44d2-47e2-a509-1e6a837280e4';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY');
  if (!firecrawlKey) {
    return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { action, urls } = await req.json();

  // Step 1: Map all property URLs
  if (action === 'map') {
    console.log('Mapping property URLs...');
    const mapRes = await fetch(`${FIRECRAWL_API}/map`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://lemosproperties.com.br',
        limit: 1000,
        includeSubdomains: false,
      }),
    });
    const mapData = await mapRes.json();
    
    const propertyUrls = (mapData.links || []).filter((url: string) => 
      url.includes('/imovel/')
    );
    const uniqueUrls = [...new Set(propertyUrls)];
    
    console.log(`Found ${uniqueUrls.length} property URLs`);
    return new Response(JSON.stringify({ success: true, urls: uniqueUrls, count: uniqueUrls.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Step 2: Scrape and import a batch of properties
  if (action === 'import') {
    const results = { imported: 0, errors: [] as string[] };
    
    for (const url of (urls || [])) {
      try {
        console.log(`Scraping: ${url}`);
        const scrapeRes = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });
        
        const scrapeData = await scrapeRes.json();
        const md = scrapeData?.data?.markdown || scrapeData?.markdown || '';
        const metadata = scrapeData?.data?.metadata || scrapeData?.metadata || {};
        
        if (!md || md.length < 50) {
          results.errors.push(`No content from ${url}`);
          continue;
        }

        const parsed = parsePropertyMarkdown(md, metadata, url);
        
        console.log(`Parsed: ${parsed.title} | ${parsed.city} | R$${parsed.price} | ${parsed.area}m² | ${parsed.bedrooms}q | ${parsed.photos.length} fotos`);

        const { error: insertError } = await supabaseAdmin.from('properties').insert({
          owner_id: TARGET_USER_ID,
          title: parsed.title.substring(0, 200),
          description: parsed.description || null,
          property_type: parsed.propertyType,
          full_address: parsed.address,
          neighborhood: parsed.neighborhood,
          city: parsed.city,
          state: parsed.state,
          zip_code: parsed.zipCode || null,
          bedrooms: parsed.bedrooms,
          bathrooms: parsed.bathrooms,
          area_m2: parsed.area,
          price_range_min: parsed.price,
          price_range_max: parsed.price,
          public_photos: parsed.photos.length > 0 ? parsed.photos : null,
          features: parsed.features.length > 0 ? parsed.features : null,
          owner_name: 'Andy Lemos',
          owner_phone: '+55 (11) 9 5090-3006',
          is_active: true,
          internal_notes: buildInternalNotes(parsed, url),
        });

        if (insertError) {
          results.errors.push(`Insert error for ${parsed.title}: ${insertError.message}`);
        } else {
          results.imported++;
          console.log(`Imported: ${parsed.title}`);
        }
      } catch (e) {
        results.errors.push(`Error processing ${url}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: 'Invalid action. Use "map" or "import"' }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

// ===== BUILD INTERNAL NOTES =====
function buildInternalNotes(parsed: ParsedProperty, url: string): string {
  const parts = [`Importado de: ${url}`];
  if (parsed.code) parts.push(`Código: ${parsed.code}`);
  if (parsed.condominium) parts.push(`Condomínio/Propriedade: ${parsed.condominium}`);
  if (parsed.listingStatus) parts.push(`Situação: ${parsed.listingStatus}`);
  if (parsed.iptu) parts.push(`IPTU: R$${parsed.iptu}`);
  if (parsed.areaTotal) parts.push(`Área Total: ${parsed.areaTotal}m²`);
  if (parsed.garages) parts.push(`Garagens: ${parsed.garages}`);
  if (parsed.suites) parts.push(`Suítes: ${parsed.suites}`);
  return parts.join(' | ');
}

// ===== TYPES =====
interface ParsedProperty {
  title: string;
  description: string;
  price: number | null;
  area: number | null;
  areaTotal: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  suites: number | null;
  iptu: number | null;
  photos: string[];
  features: string[];
  propertyType: string;
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  condominium: string;
  code: string;
  listingStatus: string;
}

// ===== MAIN PARSER =====
function parsePropertyMarkdown(md: string, metadata: any, url: string): ParsedProperty {
  const title = parseTitle(md, metadata);
  const code = parseCode(md);
  const price = parsePrice(md);
  const details = parseDetailsSection(md);
  const area = details.areaConstructed || parseAreaFallback(md);
  const areaTotal = details.areaTotal;
  const bedrooms = details.bedrooms || parseBedrooms(md);
  const bathrooms = details.bathrooms || parseBathrooms(md);
  const garages = details.garages || parseGarages(md);
  const suites = details.suites;
  const iptu = details.iptu;
  const listingStatus = details.listingStatus || parseListingStatus(md);
  const condominium = details.condominium;
  const photos = parsePhotos(md);
  const features = parseFeatures(md);
  const description = parseDescription(md, metadata);
  const location = parseLocation(md);
  const propertyType = determinePropertyType(title, url, details.propertyTypeRaw);

  return {
    title: code ? `${title} – Código ${code}` : title,
    description,
    price,
    area,
    areaTotal,
    bedrooms,
    bathrooms,
    garages,
    suites,
    iptu,
    photos,
    features: garages ? [...features, `${garages} vaga${garages > 1 ? 's' : ''} de garagem`] : features,
    propertyType,
    address: location.address,
    neighborhood: location.neighborhood,
    city: location.city,
    state: location.state,
    zipCode: location.zipCode,
    condominium,
    code,
    listingStatus,
  };
}

// ===== INDIVIDUAL PARSERS =====

function parseTitle(md: string, metadata: any): string {
  const match = md.match(/^#\s+(.+?)$/m);
  if (match) {
    return match[1].replace(/\s*–\s*Código\s*\w+/, '').trim();
  }
  return metadata.title || 'Imóvel sem título';
}

function parseCode(md: string): string {
  // From "ID do imóvel" in details section: "- **ID do imóvel** HZ0076"
  const detailMatch = md.match(/\*\*ID do imóvel\*\*\s*(HZ?\d+)/i);
  if (detailMatch) return detailMatch[1];
  // From title: "Código XXXX" or "Código 0076"
  const titleMatch = md.match(/Código\s+(\w+)/i);
  if (titleMatch) return titleMatch[1];
  return '';
}

function parsePrice(md: string): number | null {
  // From details: "- **Preço** R$1.999.000"
  const detailMatch = md.match(/\*\*Preço\*\*\s*R\$\s*([\d.,]+)/i);
  if (detailMatch) return parseMoneyValue(detailMatch[1]);
  // From listing: "- R$1.999.000"
  const listMatch = md.match(/^-\s*R\$\s*([\d.,]+)/m);
  if (listMatch) return parseMoneyValue(listMatch[1]);
  // General fallback
  const generalMatch = md.match(/R\$\s*([\d.,]+)/);
  if (generalMatch) return parseMoneyValue(generalMatch[1]);
  return null;
}

function parseMoneyValue(str: string): number {
  return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

// Parse the structured "## Detalhes" section with "- **Key** Value" format
function parseDetailsSection(md: string): {
  areaConstructed: number | null;
  areaTotal: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  suites: number | null;
  iptu: number | null;
  propertyTypeRaw: string;
  listingStatus: string;
  condominium: string;
} {
  const result = {
    areaConstructed: null as number | null,
    areaTotal: null as number | null,
    bedrooms: null as number | null,
    bathrooms: null as number | null,
    garages: null as number | null,
    suites: null as number | null,
    iptu: null as number | null,
    propertyTypeRaw: '',
    listingStatus: '',
    condominium: '',
  };

  // Extract details section
  const section = md.match(/## Detalhes\s*\n([\s\S]*?)(?=\n## |$)/i);
  if (!section) return result;
  const text = section[1];

  // Parse each detail line: "- **Key** Value"
  const lines = text.match(/-\s+\*\*(.+?)\*\*\s*(.+)/g);
  if (!lines) return result;

  for (const line of lines) {
    const m = line.match(/-\s+\*\*(.+?)\*\*\s*(.+)/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();

    if (key.includes('área construída') || key === 'área construida') {
      const num = val.match(/([\d.,]+)\s*m/);
      if (num) result.areaConstructed = parseFloat(num[1].replace(/\./g, '').replace(',', '.'));
    } else if (key.includes('área total')) {
      const num = val.match(/([\d.,]+)\s*m/);
      if (num) result.areaTotal = parseFloat(num[1].replace(/\./g, '').replace(',', '.'));
    } else if (key.includes('dormitório') || key.includes('suíte') || key.includes('suite')) {
      result.bedrooms = parseInt(val);
      if (key.includes('suíte') || key.includes('suite')) result.suites = parseInt(val);
    } else if (key.includes('banheiro')) {
      result.bathrooms = parseInt(val);
    } else if (key.includes('garagem') || key.includes('garagens') || key.includes('vaga')) {
      result.garages = parseInt(val);
    } else if (key.includes('iptu')) {
      const num = val.match(/([\d.,]+)/);
      if (num) result.iptu = parseMoneyValue(num[1]);
    } else if (key.includes('tipo de imóvel') || key.includes('tipo de imovel')) {
      result.propertyTypeRaw = val;
    } else if (key.includes('situação') || key.includes('situacao')) {
      result.listingStatus = val;
    } else if (key.includes('propriedade')) {
      result.condominium = val;
    }
  }

  // Also check "Visão Geral" section for dormitórios/garagens in different format:
  // "- **3**\n- Dormitórios"
  const overviewSection = md.match(/## Visão Geral\s*\n([\s\S]*?)(?=\n## |$)/i);
  if (overviewSection) {
    const ovText = overviewSection[1];
    
    if (!result.bedrooms) {
      const bedMatch = ovText.match(/\*\*(\d+)\*\*\s*\n-?\s*Dormitórios/i);
      if (bedMatch) result.bedrooms = parseInt(bedMatch[1]);
    }
    if (!result.garages) {
      const garMatch = ovText.match(/\*\*(\d+)\*\*\s*\n-?\s*Garagens?/i);
      if (garMatch) result.garages = parseInt(garMatch[1]);
    }
    if (!result.areaConstructed) {
      const areaMatch = ovText.match(/\*\*([\d.,]+)\s*m[²2]\*\*\s*\n-?\s*Área Construída/i);
      if (areaMatch) result.areaConstructed = parseFloat(areaMatch[1].replace(/\./g, '').replace(',', '.'));
    }
    if (!result.suites) {
      const suiteMatch = ovText.match(/\*\*(\d+)\*\*\s*\n-?\s*Suítes?/i);
      if (suiteMatch) {
        result.suites = parseInt(suiteMatch[1]);
        if (!result.bedrooms) result.bedrooms = result.suites;
      }
    }
  }

  return result;
}

function parseAreaFallback(md: string): number | null {
  const match = md.match(/(\d+)\s*m[²2]/i);
  return match ? parseFloat(match[1]) : null;
}

function parseBedrooms(md: string): number | null {
  const match = md.match(/Camas[:\s]*(\d+)/i) ||
                md.match(/(\d+)\s*(?:quartos?|suítes?|dormitórios?)/i);
  return match ? parseInt(match[1]) : null;
}

function parseBathrooms(md: string): number | null {
  const match = md.match(/(\d+)\s*banheiros?/i);
  return match ? parseInt(match[1]) : null;
}

function parseGarages(md: string): number | null {
  const match = md.match(/Garagens?[:\s]*(\d+)/i) ||
                md.match(/(\d+)\s*(?:garagens?|vagas?)/i);
  return match ? parseInt(match[1]) : null;
}

function parseListingStatus(md: string): string {
  if (md.includes('À Venda') || md.includes('Comprar')) return 'À Venda';
  if (md.includes('Alugar')) return 'Alugar';
  return '';
}

// ===== PHOTOS PARSER =====
// Capture ALL image URLs from wp-content/uploads, excluding avatars/logos
function parsePhotos(md: string): string[] {
  const photos: string[] = [];
  const seen = new Set<string>();
  
  // Match all URLs from wp-content/uploads in the markdown
  const urlRegex = /https?:\/\/lemosproperties\.com\.br\/wp-content\/uploads\/[^\s)\]"']+\.(?:jpg|jpeg|png|webp)/gi;
  let match;
  while ((match = urlRegex.exec(md)) !== null) {
    let photoUrl = match[0];
    
    // Skip avatar/logo/screenshot images
    if (photoUrl.includes('Captura-de-tela') || 
        photoUrl.includes('avatar') || 
        photoUrl.includes('logo') ||
        photoUrl.includes('traco-') ||
        photoUrl.includes('Perfil')) continue;
    
    // Normalize: get base URL without size suffix (e.g., -1079x785)
    const baseUrl = photoUrl.replace(/-\d+x\d+(\.\w+)$/, '$1');
    
    // Use base URL as key to deduplicate, but keep the original (possibly higher res)
    if (!seen.has(baseUrl)) {
      seen.add(baseUrl);
      // Prefer the version without size suffix (full resolution)
      photos.push(baseUrl);
    }
  }
  
  return photos;
}

// ===== FEATURES PARSER =====
// Features are links: "[Feature Name](URL)"
function parseFeatures(md: string): string[] {
  const features: string[] = [];
  const section = md.match(/## Destaques\s*\n([\s\S]*?)(?=\n## |$)/i);
  if (!section) return features;
  
  const text = section[1];
  
  // Match links: [Feature Name](URL)
  const linkRegex = /\[([^\]]+)\]\(https?:\/\/lemosproperties\.com\.br\/recurso\/[^\)]+\)/gi;
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    const name = match[1].trim();
    if (name && name.length < 60 && !name.startsWith('http')) {
      features.push(name);
    }
  }
  
  // Fallback: simple list items
  if (features.length === 0) {
    const items = text.match(/-\s+(.+)/g);
    if (items) {
      items.forEach(item => {
        const clean = item.replace(/^-\s+/, '').replace(/\[|\]\(.*?\)/g, '').trim();
        if (clean && clean.length < 60) features.push(clean);
      });
    }
  }
  
  return features;
}

// ===== DESCRIPTION PARSER =====
function parseDescription(md: string, metadata: any): string {
  const section = md.match(/## Descrição\s*\n([\s\S]*?)(?=\n## |$)/i);
  if (!section) return metadata.description || '';
  
  let desc = section[1];
  
  // Remove "[Read More](URL)" link but keep content after it
  desc = desc.replace(/\[Read More\]\([^\)]*\)\s*/gi, '');
  
  // Clean markdown links: keep text, remove URL
  desc = desc.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // Clean up excess whitespace
  desc = desc.replace(/\n{3,}/g, '\n\n').trim();
  
  return desc || metadata.description || '';
}

// ===== LOCATION PARSER =====
function parseLocation(md: string): {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
} {
  const section = md.match(/## Localização\s*\n([\s\S]*?)(?=\n## |$)/i);
  const text = section ? section[1] : md;

  const getDetail = (key: string): string => {
    const regex = new RegExp(`\\*\\*${key}:?\\*\\*\\s*(.+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };

  const address = getDetail('Localidade Aproximada') || '';
  const city = getDetail('Cidade') || 'Barueri';
  let state = getDetail('Estado\\/Municipio') || getDetail('Estado') || 'SP';
  if (state.toLowerCase() === 'são paulo') state = 'SP';
  const zipCode = getDetail('CEP \\/ Código Postal') || getDetail('CEP') || '';
  const neighborhood = getDetail('Área') || 'Alphaville';

  return {
    address: address || neighborhood,
    neighborhood,
    city,
    state,
    zipCode,
  };
}

// ===== PROPERTY TYPE DETERMINER =====
function determinePropertyType(title: string, url: string, typeRaw: string): string {
  const text = (title + ' ' + url + ' ' + typeRaw).toLowerCase();
  
  if (text.includes('apartamento') || text.includes('flat') || text.includes('duplex') || 
      text.includes('cobertura') || text.includes('studio')) return 'apartamento';
  if (text.includes('casa') || text.includes('residência') || text.includes('residencia') || 
      text.includes('sobrado') || text.includes('mansão') || text.includes('mansao')) return 'casa';
  if (text.includes('terreno') || text.includes('lote')) return 'terreno';
  if (text.includes('sala') || text.includes('comercial') || text.includes('corporativ') || 
      text.includes('laje') || text.includes('escritório') || text.includes('escritorio')) return 'comercial';
  if (text.includes('condomínio') || text.includes('condominio')) return 'apartamento';
  
  return 'outro';
}
