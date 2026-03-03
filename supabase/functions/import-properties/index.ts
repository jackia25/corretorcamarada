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
    console.log('Map response links count:', (mapData.links || []).length);
    
    // Filter only property URLs
    const propertyUrls = (mapData.links || []).filter((url: string) => 
      url.includes('/imovel/')
    );
    // Deduplicate
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
            formats: ['markdown', 'links'],
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

        // Parse data from markdown
        const title = metadata.title || extractBetween(md, '# ', '\n') || 'Imóvel sem título';
        const description = metadata.description || extractSection(md, 'Descrição') || extractSection(md, 'Sobre') || '';
        
        // Extract price
        const priceMatch = md.match(/R\$\s*([\d.,]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.')) : null;
        
        // Extract area
        const areaMatch = md.match(/(\d+)\s*m[²2]/i);
        const area = areaMatch ? parseFloat(areaMatch[1]) : null;
        
        // Extract bedrooms
        const bedMatch = md.match(/(\d+)\s*(?:quartos?|dorm|suítes?|camas?)/i);
        const bedrooms = bedMatch ? parseInt(bedMatch[1]) : null;
        
        // Extract bathrooms
        const bathMatch = md.match(/(\d+)\s*(?:banheiros?|wc)/i);
        const bathrooms = bathMatch ? parseInt(bathMatch[1]) : null;
        
        // Extract photos
        const photoRegex = /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi;
        const photos: string[] = [];
        let photoMatch;
        while ((photoMatch = photoRegex.exec(md)) !== null) {
          if (!photos.includes(photoMatch[1])) photos.push(photoMatch[1]);
        }
        
        // Determine property type from title/URL
        const lowerTitle = (title + ' ' + url).toLowerCase();
        let propType = 'outro';
        if (lowerTitle.includes('apartamento') || lowerTitle.includes('flat') || lowerTitle.includes('duplex') || lowerTitle.includes('cobertura') || lowerTitle.includes('studio')) propType = 'apartamento';
        else if (lowerTitle.includes('casa') || lowerTitle.includes('residencia') || lowerTitle.includes('residência') || lowerTitle.includes('mansao') || lowerTitle.includes('mansão') || lowerTitle.includes('sobrado')) propType = 'casa';
        else if (lowerTitle.includes('terreno')) propType = 'terreno';
        else if (lowerTitle.includes('sala') || lowerTitle.includes('comercial') || lowerTitle.includes('corporativ') || lowerTitle.includes('laje') || lowerTitle.includes('escritorio')) propType = 'comercial';
        
        // Extract neighborhood from content
        const neighMatch = md.match(/(?:Condomínio|Bairro|Localização)[:\s]*([^\n,]+)/i);
        const neighborhood = neighMatch ? neighMatch[1].trim() : 'Alphaville';
        
        // Extract code
        const codeMatch = md.match(/[Cc]ódigo[:\s]*(\d+)/);
        const code = codeMatch ? codeMatch[1] : '';

        // Extract address
        const addrMatch = md.match(/(?:Endereço|Rua|Avenida|Alameda|Estrada)[:\s]*([^\n]+)/i);
        const address = addrMatch ? addrMatch[1].trim() : neighborhood;

        const { error: insertError } = await supabaseAdmin.from('properties').insert({
          owner_id: TARGET_USER_ID,
          title: title.substring(0, 200),
          description: description || null,
          property_type: propType,
          full_address: address,
          neighborhood: neighborhood,
          city: 'Barueri',
          state: 'SP',
          bedrooms: bedrooms,
          bathrooms: bathrooms,
          area_m2: area,
          price_range_min: price,
          price_range_max: price,
          public_photos: photos.length > 0 ? photos : null,
          owner_name: 'Andy Lemos',
          owner_phone: '+55 (11) 9 5090-3006',
          is_active: true,
          internal_notes: `Importado de: ${url}${code ? ` | Código: ${code}` : ''}`,
        });

        if (insertError) {
          results.errors.push(`Insert error for ${title}: ${insertError.message}`);
        } else {
          results.imported++;
          console.log(`Imported: ${title}`);
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

function extractBetween(text: string, start: string, end: string): string {
  const startIdx = text.indexOf(start);
  if (startIdx === -1) return '';
  const afterStart = startIdx + start.length;
  const endIdx = text.indexOf(end, afterStart);
  return endIdx === -1 ? text.substring(afterStart) : text.substring(afterStart, endIdx);
}

function extractSection(text: string, heading: string): string {
  const regex = new RegExp(`(?:#{1,3}\\s*)?${heading}[:\\s]*\\n([\\s\\S]*?)(?=\\n#{1,3}|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim().substring(0, 500) : '';
}
