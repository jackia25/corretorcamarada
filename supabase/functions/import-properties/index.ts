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
            formats: [{ type: 'json', schema: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Property title' },
                description: { type: 'string', description: 'Full property description' },
                price: { type: 'number', description: 'Price in BRL (number only, no currency symbol)' },
                property_type: { type: 'string', description: 'Type: apartamento, casa, terreno, comercial, or outro' },
                address: { type: 'string', description: 'Full address' },
                neighborhood: { type: 'string', description: 'Neighborhood name' },
                city: { type: 'string', description: 'City name' },
                state: { type: 'string', description: 'State abbreviation (e.g. SP)' },
                bedrooms: { type: 'number', description: 'Number of bedrooms' },
                bathrooms: { type: 'number', description: 'Number of bathrooms' },
                area_m2: { type: 'number', description: 'Area in square meters' },
                garages: { type: 'number', description: 'Number of parking spots' },
                photos: { type: 'array', items: { type: 'string' }, description: 'Array of photo URLs' },
                features: { type: 'array', items: { type: 'string' }, description: 'Array of property features/amenities' },
                condominium: { type: 'string', description: 'Condominium name if applicable' },
                status: { type: 'string', description: 'Sale status: comprar (for sale) or alugar (for rent)' },
                code: { type: 'string', description: 'Property code (e.g. 0076)' },
              },
              required: ['title']
            }}],
            onlyMainContent: true,
          }),
        });
        
        const scrapeData = await scrapeRes.json();
        const property = scrapeData?.data?.json || scrapeData?.json;
        
        if (!property || !property.title) {
          results.errors.push(`No data extracted from ${url}`);
          continue;
        }

        // Map property_type
        const typeMap: Record<string, string> = {
          'apartamento': 'apartamento', 'casa': 'casa', 'terreno': 'terreno',
          'comercial': 'comercial', 'rural': 'rural', 'flat': 'apartamento',
          'cobertura': 'apartamento', 'studio': 'apartamento', 'escritório': 'comercial',
          'escritorios': 'comercial', 'salas': 'comercial', 'residência': 'casa',
          'residencial': 'casa', 'prédio': 'comercial', 'corporativo': 'comercial',
        };
        
        const rawType = (property.property_type || 'outro').toLowerCase();
        const mappedType = typeMap[rawType] || 'outro';

        const { error: insertError } = await supabaseAdmin.from('properties').insert({
          owner_id: TARGET_USER_ID,
          title: property.title.substring(0, 200),
          description: property.description || null,
          property_type: mappedType,
          full_address: property.address || 'Alphaville',
          neighborhood: property.neighborhood || 'Alphaville',
          city: property.city || 'Barueri',
          state: property.state || 'SP',
          bedrooms: property.bedrooms || null,
          bathrooms: property.bathrooms || null,
          area_m2: property.area_m2 || null,
          price_range_min: property.price || null,
          price_range_max: property.price || null,
          public_photos: property.photos || null,
          features: property.features || null,
          owner_name: 'Andy Lemos',
          owner_phone: '+55 (11) 9 5090-3006',
          is_active: true,
          internal_notes: `Importado de: ${url}${property.code ? ` | Código: ${property.code}` : ''}${property.condominium ? ` | Condomínio: ${property.condominium}` : ''}`,
        });

        if (insertError) {
          results.errors.push(`Insert error for ${property.title}: ${insertError.message}`);
        } else {
          results.imported++;
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
