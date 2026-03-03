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

        // ===== PARSE PROPERTY DATA FROM MARKDOWN =====
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
          internal_notes: `Importado de: ${url}${parsed.code ? ` | Código: ${parsed.code}` : ''}${parsed.condominium ? ` | Condomínio: ${parsed.condominium}` : ''}`,
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

interface ParsedProperty {
  title: string;
  description: string;
  price: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
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
}

function parsePropertyMarkdown(md: string, metadata: any, url: string): ParsedProperty {
  // === TITLE ===
  // Pattern: "# Title – Código XXXX"
  const titleMatch = md.match(/^#\s+(.+?)$/m);
  const title = titleMatch ? titleMatch[1].replace(/\s*–\s*Código\s*\d+/, '').trim() : (metadata.title || 'Imóvel sem título');

  // === CODE ===
  const codeMatch = md.match(/(?:Código|ID do imóvel)[:\s]*(?:HZ)?(\d+)/i);
  const code = codeMatch ? codeMatch[1] : '';

  // === PRICE ===
  // Pattern: "- R$1.999.000" or "**Preço** R$1.999.000"
  const priceMatch = md.match(/R\$\s*([\d.,]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : null;

  // === AREA ===
  // Pattern: "**144 m²**" or "**Área construída** 144 m²"
  const areaMatch = md.match(/(\d+)\s*m[²2]/i);
  const area = areaMatch ? parseFloat(areaMatch[1]) : null;

  // === BEDROOMS (Dormitórios / Camas) ===
  const bedMatch = md.match(/\*\*(\d+)\*\*\s*\n\s*-\s*Dormitórios/i) ||
                   md.match(/\*\*Dormitórios\*\*\s*(\d+)/i) ||
                   md.match(/Camas[:\s]*(\d+)/i) ||
                   md.match(/(\d+)\s*(?:quartos?|suítes?|dormitórios?)/i);
  const bedrooms = bedMatch ? parseInt(bedMatch[1]) : null;

  // === BATHROOMS ===
  const bathMatch = md.match(/\*\*Banheiros\*\*\s*(\d+)/i) ||
                    md.match(/Banheiros[:\s]*(\d+)/i) ||
                    md.match(/(\d+)\s*banheiros?/i);
  const bathrooms = bathMatch ? parseInt(bathMatch[1]) : null;

  // === GARAGES ===
  const garageMatch = md.match(/\*\*(\d+)\*\*\s*\n\s*-\s*Garagens/i) ||
                      md.match(/\*\*Garagens\*\*\s*(\d+)/i) ||
                      md.match(/Garagens?[:\s]*(\d+)/i) ||
                      md.match(/(\d+)\s*(?:garagens?|vagas?)/i);
  const garages = garageMatch ? parseInt(garageMatch[1]) : null;

  // === PHOTOS ===
  // Extract all image URLs from markdown, filtering for property photos
  const photoRegex = /\[?\!\[.*?\]\((https?:\/\/lemosproperties\.com\.br\/wp-content\/uploads\/[^\s)]+)\)/gi;
  const photos: string[] = [];
  let photoMatch;
  while ((photoMatch = photoRegex.exec(md)) !== null) {
    let photoUrl = photoMatch[1];
    // Skip agent avatar images
    if (photoUrl.includes('Captura-de-tela') || photoUrl.includes('avatar') || photoUrl.includes('logo')) continue;
    // Prefer high-res versions: remove thumbnail sizing if present
    if (!photos.includes(photoUrl)) photos.push(photoUrl);
  }
  // Also catch link-wrapped images: [![](img)](link)
  const linkPhotoRegex = /\[!\[.*?\]\((https?:\/\/lemosproperties\.com\.br\/wp-content\/uploads\/[^\s)]+)\)\]/gi;
  while ((photoMatch = linkPhotoRegex.exec(md)) !== null) {
    let photoUrl = photoMatch[1];
    if (photoUrl.includes('Captura-de-tela') || photoUrl.includes('avatar') || photoUrl.includes('logo')) continue;
    if (!photos.includes(photoUrl)) photos.push(photoUrl);
  }

  // === FEATURES (Destaques) ===
  const features: string[] = [];
  const featuresSection = md.match(/## Destaques\s*\n([\s\S]*?)(?=\n## |\n---|\n\*\*|$)/i);
  if (featuresSection) {
    const featureLines = featuresSection[1].match(/\[([^\]]+)\]/g);
    if (featureLines) {
      featureLines.forEach(f => {
        const name = f.replace(/[\[\]]/g, '').trim();
        if (name && !name.startsWith('http')) features.push(name);
      });
    }
  }
  // Also try simple list format
  if (features.length === 0) {
    const featSection = md.match(/## Destaques\s*\n([\s\S]*?)(?=\n## |$)/i);
    if (featSection) {
      const items = featSection[1].match(/-\s+(.+)/g);
      if (items) {
        items.forEach(item => {
          const clean = item.replace(/^-\s+/, '').replace(/\[|\]\(.*?\)/g, '').trim();
          if (clean && clean.length < 50) features.push(clean);
        });
      }
    }
  }
  // Add garages as feature if present
  if (garages) features.push(`${garages} vaga${garages > 1 ? 's' : ''} de garagem`);

  // === DESCRIPTION ===
  const descSection = md.match(/## Descrição\s*\n([\s\S]*?)(?=\n## |\n\[Read More\]|$)/i);
  let description = '';
  if (descSection) {
    description = descSection[1]
      .replace(/\[Read More\].*$/i, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // remove links but keep text
      .trim();
  }
  // Append "Read More" continuation if present
  const descContinuation = md.match(/\[Read More\].*?\n([\s\S]*?)(?=\n## |$)/i);
  if (descContinuation) {
    description += '\n\n' + descContinuation[1].trim();
  }
  if (!description) description = metadata.description || '';

  // === PROPERTY TYPE ===
  // From "Tipo de imóvel" detail or URL
  const typeMatch = md.match(/\*\*Tipo de imóvel\*\*\s*(.+)/i) ||
                    md.match(/Tipo de imóvel\s*\n\s*-\s*(.+)/i);
  const typeStr = typeMatch ? typeMatch[1].trim().toLowerCase() : '';
  
  const lowerAll = (title + ' ' + url + ' ' + typeStr).toLowerCase();
  let propertyType = 'outro';
  if (lowerAll.includes('apartamento') || lowerAll.includes('flat') || lowerAll.includes('duplex') || lowerAll.includes('cobertura') || lowerAll.includes('studio')) propertyType = 'apartamento';
  else if (lowerAll.includes('casa') || lowerAll.includes('residência') || lowerAll.includes('residencia') || lowerAll.includes('sobrado') || lowerAll.includes('mansão') || lowerAll.includes('mansao')) propertyType = 'casa';
  else if (lowerAll.includes('terreno') || lowerAll.includes('lote')) propertyType = 'terreno';
  else if (lowerAll.includes('sala') || lowerAll.includes('comercial') || lowerAll.includes('corporativ') || lowerAll.includes('laje') || lowerAll.includes('escritório') || lowerAll.includes('escritorio')) propertyType = 'comercial';
  // "Condomínio" type from source often means apartment in a condo
  else if (lowerAll.includes('condomínio') || lowerAll.includes('condominio')) propertyType = 'apartamento';

  // === LOCATION ===
  // From "## Localização" section
  const cityMatch = md.match(/\*\*Cidade:\*\*\s*(.+)/i);
  const city = cityMatch ? cityMatch[1].trim() : 'Barueri';

  const stateMatch = md.match(/\*\*Estado\/Municipio:\*\*\s*(.+)/i);
  let state = stateMatch ? stateMatch[1].trim() : 'SP';
  // Normalize "São Paulo" → "SP"
  if (state.toLowerCase() === 'são paulo') state = 'SP';

  const zipMatch = md.match(/\*\*CEP\s*\/?\s*Código Postal:\*\*\s*(\d+)/i);
  const zipCode = zipMatch ? zipMatch[1] : '';

  const areaLocMatch = md.match(/\*\*Área:\*\*\s*(.+)/i);
  const neighborhood = areaLocMatch ? areaLocMatch[1].trim() : 'Alphaville';

  // Address from "Localidade Aproximada" or line after title
  const addrMatch = md.match(/\*\*Localidade Aproximada:\*\*\s*(.+)/i);
  let address = addrMatch ? addrMatch[1].trim() : '';
  if (!address) {
    // Fallback: line after the H1 title
    const afterTitle = md.match(/^#\s+.+\n+(.+)/m);
    if (afterTitle && !afterTitle[1].startsWith('Destaque') && !afterTitle[1].startsWith('-') && !afterTitle[1].startsWith('[')) {
      address = afterTitle[1].trim();
    }
  }
  if (!address) address = neighborhood;

  // === CONDOMINIUM ===
  const condMatch = md.match(/\*\*Propriedade\*\*\s*(.+)/i);
  const condominium = condMatch ? condMatch[1].trim() : '';

  return {
    title: code ? `${title} – Código ${code}` : title,
    description,
    price,
    area,
    bedrooms,
    bathrooms,
    garages,
    photos,
    features,
    propertyType,
    address,
    neighborhood,
    city,
    state,
    zipCode,
    condominium,
    code,
  };
}
