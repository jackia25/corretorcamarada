import { createClient } from '@supabase/supabase-js';
import { validateColumnCoherence } from '../src/lib/sourceParity';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const OWNER = '03b76688-44d2-47e2-a509-1e6a837280e4';

async function main() {
  const { data, error } = await supabase
    .from('properties')
    .select('id,source_id,external_code,title,price_range_min,price_range_max,area_m2,land_area_m2,bedrooms,bathrooms,garage_spaces,year_built,zip_code,latitude,longitude,full_address,address_number,video_url,virtual_tour_url,price_label,internal_notes,public_photos,source_payload')
    .eq('owner_id', OWNER)
    .limit(2000);
  if (error) throw error;
  console.log(`Total imóveis no banco: ${data!.length}`);

  const report: Array<{ code: string; id: string; title: string; diffs: any[] }> = [];
  const diffCounts: Record<string, number> = {};

  for (const row of data!) {
    const sp: any = row.source_payload || {};
    const meta = sp.meta || {};
    const categories = sp.categories || {};
    const parsed = {
      price: row.price_range_min ?? null,
      area_m2: row.area_m2 ?? null,
      land_area_m2: row.land_area_m2 ?? null,
      bedrooms: row.bedrooms ?? null,
      bathrooms: row.bathrooms ?? null,
      garage_spaces: row.garage_spaces ?? null,
      year_built: row.year_built ?? null,
      zip_code: row.zip_code ?? null,
      latitude: row.latitude ?? null,
      longitude: row.longitude ?? null,
      external_code: row.external_code ?? null,
      full_address: row.full_address && row.full_address !== 'A informar' ? row.full_address : null,
      address_number: row.address_number ?? null,
      video_url: row.video_url ?? null,
      virtual_tour_url: row.virtual_tour_url ?? null,
      price_label: row.price_label ?? null,
      internal_notes: row.internal_notes ?? null,
      photos: row.public_photos ?? null,
    };
    const diffs = validateColumnCoherence({ meta, categories }, parsed as any);
    if (diffs.length) {
      report.push({ code: row.external_code || row.source_id, id: row.id, title: row.title, diffs });
      for (const d of diffs) diffCounts[d.key] = (diffCounts[d.key] || 0) + 1;
    }
  }

  console.log(`\nImóveis com divergências: ${report.length}/${data!.length}`);
  console.log(`\nResumo por campo (campo: nº imóveis com divergência):`);
  for (const [k, v] of Object.entries(diffCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }

  // amostra
  console.log(`\nExemplos (5 primeiros):`);
  for (const r of report.slice(0, 5)) {
    console.log(`\n[${r.code}] ${r.title.slice(0, 60)}`);
    for (const d of r.diffs.slice(0, 6)) {
      console.log(`   - ${d.key}: esperado=${JSON.stringify(d.expected)} | atual=${JSON.stringify(d.actual)}`);
    }
  }

  const fs = await import('fs');
  fs.writeFileSync('/mnt/documents/import_validation_report.json', JSON.stringify({
    total: data!.length,
    withDiffs: report.length,
    diffCountsByField: diffCounts,
    details: report,
  }, null, 2));
  console.log('\nRelatório completo: /mnt/documents/import_validation_report.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
