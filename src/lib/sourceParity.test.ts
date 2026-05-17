/**
 * Testes do validador de paridade origem×destino.
 * Roda com: bun run src/lib/sourceParity.test.ts
 */
import { validateSourceParity } from './sourceParity';
import { extractAdditionalSourceFields } from './sourceFields';

let passed = 0, failed = 0;
function ok(c: boolean, msg: string) {
  if (c) { passed++; console.log('  ✓', msg); }
  else { failed++; console.log('  ✗', msg); }
}
function eq(a: unknown, b: unknown, msg: string) {
  ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}`);
}

// Payload REAL do imóvel 02336 (extraído do XML novo do Lemos).
const source = {
  meta: {
    'fave_aceita-permuta': 'Sim',
    'fave_aceita-proposta': 'Sim',
    'fave_agent_display_option': 'author_info',
    'fave_banheiros': '1',
    'fave_condomc3ado': ['', 'Condomínio Ápice Park'],
    'fave_featured': '0',
    'fave_garantias-aceitas': ['Caução', 'Seguro fiança'],
    'fave_loggedintoview': '0',
    'fave_prazo-de-contrato': '30 meses',
    'fave_private_note': 'Abelardo',
    'fave_prop_homeslider': 'no',
    'fave_property_bedrooms': '2',
    'fave_property_id': '02336',
    'fave_property_images': ['27326', '27327', '27328', '27329'],
    'fave_property_land': '52',
    'fave_property_location': '25.68654,-80.431345,15',
    'fave_property_map': '1',
    'fave_property_map_street_view': 'hide',
    'fave_property_price': '6500',
    'fave_property_price_postfix': '+ despesas',
    'fave_show_price_placeholder': '0',
    'fave_single_content_area': 'global',
    'fave_single_top_area': 'global',
    'houzez_featured_listing_date': '',
    'houzez_geolocation_lat': '25.68654',
    'houzez_geolocation_long': '-80.431345',
    'houzez_manual_expire': '0',
    'houzez_recently_viewed': '2026-05-17 16:49:19',
    'houzez_total_property_views': '11',
    'houzez_views_by_date': 'a:2:{s:10:"05-15-2026";i:3;s:10:"05-17-2026";i:8;}',
    '_thumbnail_id': '27329',
    '_yoast_wpseo_focuskw': 'apartamento para alugar Ápice Park Alphaville',
  } as Record<string, string | string[]>,
  categories: {
    property_type: ['Apartamento'],
    property_status: ['Alugar'],
    property_city: ['Alphaville'],
    property_feature: [
      'Academia', 'Ar Condicionado', 'Churrasqueira', 'Cozinha Planejada',
      'Elevador', 'Mobiliado', 'Móveis Planejados', 'Piscina',
      'Portaria 24h', 'Salão de Festa', 'Salão de Jogos', 'Varanda',
    ],
  } as Record<string, string[]>,
};

console.log('\n[validateSourceParity] — payload real 02336');

// 1) Quando o destino contém EXATAMENTE a mesma meta/categories: ok
const r1 = validateSourceParity(source, source);
ok(r1.ok, 'paridade ok quando destino === origem');
eq(r1.diffs, [], 'nenhuma divergência');
ok(r1.totalKeys > 30, `${r1.totalKeys} chaves analisadas`);

// 2) Se destino esquecer um campo de negócio, deve falhar
const incompleto = {
  meta: { ...source.meta },
  categories: source.categories,
};
delete (incompleto.meta as Record<string, unknown>)['fave_aceita-permuta'];
const r2 = validateSourceParity(source, incompleto);
ok(!r2.ok, 'falha quando aceita-permuta sumir do destino');
ok(r2.diffs.some((d) => d.key === 'fave_aceita-permuta' && d.reason === 'missing_in_payload'),
   'diff aponta aceita-permuta como ausente');

// 3) Valor divergente
const mutado = {
  meta: { ...source.meta, 'fave_aceita-proposta': 'Não' },
  categories: source.categories,
};
const r3 = validateSourceParity(source, mutado);
ok(!r3.ok, 'falha com valor divergente');
ok(r3.diffs.some((d) => d.key === 'fave_aceita-proposta' && d.reason === 'value_mismatch'),
   'diff aponta value_mismatch em aceita-proposta');

// 4) Variantes hífen/underscore são equivalentes
const variante = {
  meta: { ...source.meta },
  categories: source.categories,
};
delete (variante.meta as Record<string, unknown>)['fave_aceita-permuta'];
(variante.meta as Record<string, unknown>)['fave_aceita_permuta'] = 'Sim';
const r4 = validateSourceParity(source, variante);
ok(r4.ok, 'hífen ≡ underscore na comparação');

console.log('\n[extractAdditionalSourceFields] — labels para 02336');
const fields = extractAdditionalSourceFields(source as unknown as Record<string, unknown>);
const labels = fields.map((f) => f.label);
console.log('  labels:', labels);

for (const must of ['Aceita permuta', 'Aceita proposta', 'Garantias aceitas', 'Prazo de contrato']) {
  ok(labels.includes(must), `Detalhes inclui "${must}"`);
}
const garantias = fields.find((f) => f.label === 'Garantias aceitas');
eq(garantias?.value, ['Caução', 'Seguro fiança'], 'Garantias aceitas vira array');

for (const banned of [
  'Houzez total property views', 'Houzez views by date', 'Houzez recently viewed',
  'Agent display option', 'Single top area', 'Single content area',
  'Prop homeslider', 'Map', 'Map street view', 'Featured',
  'Property location', 'Show price placeholder', 'Loggedintoview',
]) {
  ok(!labels.includes(banned), `Detalhes NÃO inclui "${banned}"`);
}

console.log(`\n${passed} passou, ${failed} falhou`);
if (failed > 0) (globalThis as { process?: { exit: (n: number) => void } }).process?.exit(1);
