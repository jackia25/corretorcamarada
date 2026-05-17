import { validateColumnCoherence } from '../src/lib/sourceParity';
import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('/tmp/props.json', 'utf-8'));
console.log(`Total imóveis no banco: ${data.length}`);

const report: any[] = [];
const diffCounts: Record<string, number> = {};

for (const row of data) {
  const sp: any = row.source_payload || {};
  const meta = sp.meta || {};
  const categories = sp.categories || {};
  const parsed = {
    price: row.price_range_min != null ? Number(row.price_range_min) : null,
    area_m2: row.area_m2 != null ? Number(row.area_m2) : null,
    land_area_m2: row.land_area_m2 != null ? Number(row.land_area_m2) : null,
    bedrooms: row.bedrooms ?? null,
    bathrooms: row.bathrooms ?? null,
    garage_spaces: row.garage_spaces ?? null,
    year_built: row.year_built ?? null,
    zip_code: row.zip_code ?? null,
    latitude: row.latitude != null ? Number(row.latitude) : null,
    longitude: row.longitude != null ? Number(row.longitude) : null,
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

console.log(`\nImóveis com divergências: ${report.length}/${data.length}`);
console.log(`\nResumo por campo (campo: nº imóveis):`);
for (const [k, v] of Object.entries(diffCounts).sort((a, b) => (b as number) - (a as number))) {
  console.log(`  ${k}: ${v}`);
}

console.log(`\nExemplos (5 primeiros imóveis com divergência):`);
for (const r of report.slice(0, 5)) {
  console.log(`\n[${r.code}] ${(r.title || '').slice(0, 70)}`);
  for (const d of r.diffs.slice(0, 8)) {
    console.log(`   • ${d.key}: esperado=${JSON.stringify(d.expected)} | atual=${JSON.stringify(d.actual)}`);
  }
}

fs.writeFileSync('/mnt/documents/import_validation_report.json', JSON.stringify({
  total: data.length,
  withDiffs: report.length,
  diffCountsByField: diffCounts,
  details: report,
}, null, 2));
console.log('\nRelatório completo: /mnt/documents/import_validation_report.json');
