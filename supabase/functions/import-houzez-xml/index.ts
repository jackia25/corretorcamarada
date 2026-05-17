import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TARGET_USER_ID = '03b76688-44d2-47e2-a509-1e6a837280e4'; // Andy Lemos

type Incoming = {
  source_id: string;
  external_code?: string | null;
  title: string;
  description?: string | null;
  property_type?: string | null;
  listing_status?: string | null;
  labels?: string[] | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  full_address?: string | null;
  address_number?: string | null;
  zip_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  price?: number | null;
  price_label?: string | null;
  area_m2?: number | null;
  land_area_m2?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  suites?: number | null;
  garage_spaces?: number | null;
  year_built?: number | null;
  features?: string[] | null;
  photos?: string[] | null;
  featured_photo?: string | null;
  video_url?: string | null;
  virtual_tour_url?: string | null;
  extra_costs?: Record<string, unknown> | null;
  source_url?: string | null;
  source_published_at?: string | null;
  internal_notes?: string | null;
  source_payload?: Record<string, unknown> | null;
};

const VALID_TYPES = new Set(['apartamento','casa','terreno','comercial','rural','outro']);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const body = await req.json();
    const properties: Incoming[] = body.properties || [];

    if (!Array.isArray(properties) || properties.length === 0) {
      return new Response(JSON.stringify({ error: 'properties array required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = {
      imported: 0,
      updated: 0,
      errors: [] as string[],
      items: [] as Array<{ source_id: string; id: string | null; status: 'inserted' | 'updated' | 'error'; error?: string }>,
    };

    for (const p of properties) {
      try {
        if (!p.source_id || !p.title) {
          results.errors.push(`Missing source_id or title for "${p.title || p.source_id}"`);
          results.items.push({ source_id: p.source_id || '', id: null, status: 'error', error: 'missing source_id/title' });
          continue;
        }

        const propertyType = VALID_TYPES.has((p.property_type || '').toLowerCase())
          ? (p.property_type as string).toLowerCase()
          : 'outro';

        const price = p.price ?? null;

        const row = {
          source_id: p.source_id,
          owner_id: TARGET_USER_ID,
          title: p.title.slice(0, 500),
          description: p.description || null,
          property_type: propertyType,
          listing_status: p.listing_status || 'venda',
          labels: p.labels && p.labels.length ? p.labels : null,
          neighborhood: p.neighborhood || 'Não informado',
          city: p.city || 'Não informado',
          state: p.state || 'SP',
          full_address: p.full_address || 'A informar',
          address_number: p.address_number || null,
          zip_code: p.zip_code || null,
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          price_range_min: price,
          price_range_max: price,
          price_label: p.price_label || null,
          area_m2: p.area_m2 ?? null,
          land_area_m2: p.land_area_m2 ?? null,
          bedrooms: p.bedrooms ?? null,
          bathrooms: p.bathrooms ?? null,
          suites: p.suites ?? null,
          garage_spaces: p.garage_spaces ?? null,
          year_built: p.year_built ?? null,
          features: p.features && p.features.length ? p.features : null,
          public_photos: p.photos && p.photos.length ? p.photos : null,
          featured_photo: p.featured_photo || (p.photos?.[0] ?? null),
          video_url: p.video_url || null,
          virtual_tour_url: p.virtual_tour_url || null,
          extra_costs: p.extra_costs || null,
          external_code: p.external_code || null,
          source_url: p.source_url || null,
          source_published_at: p.source_published_at || null,
          internal_notes: p.internal_notes || null,
          source_payload: p.source_payload || null,
          owner_name: 'A informar',
          owner_phone: 'A informar',
          is_active: true,
        };

        const { data: existing } = await supabase
          .from('properties')
          .select('id')
          .eq('source_id', p.source_id)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from('properties')
            .update(row)
            .eq('id', existing.id);
          if (error) throw error;
          results.updated++;
          results.items.push({ source_id: p.source_id, id: existing.id, status: 'updated' });
        } else {
          const { data: inserted, error } = await supabase
            .from('properties')
            .insert(row)
            .select('id')
            .single();
          if (error) throw error;
          results.imported++;
          results.items.push({ source_id: p.source_id, id: inserted?.id ?? null, status: 'inserted' });
        }
      } catch (e) {
        results.errors.push(`${p.source_id || p.title}: ${(e as Error).message}`);
        results.items.push({ source_id: p.source_id || '', id: null, status: 'error', error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
