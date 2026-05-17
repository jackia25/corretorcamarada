/**
 * Testes de validação para extractAdditionalSourceFields.
 * Rodar com: bun run src/lib/sourceFields.test.ts
 */
import { extractAdditionalSourceFields, unserializePhp, decodeMaybeSerialized } from './sourceFields';

let failed = 0;
let passed = 0;

function eq(actual: unknown, expected: unknown, msg: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}\n     expected: ${e}\n     got:      ${a}`); }
}

function ok(cond: boolean, msg: string) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); }
  else { failed++; console.log(`  ✗ ${msg}`); }
}

console.log('\n[unserializePhp]');
eq(
  unserializePhp('a:2:{i:0;s:6:"Caução";i:1;s:13:"Seguro fiança";}'),
  ['Caução', 'Seguro fiança'],
  'array PHP serializado vira array JS',
);
eq(unserializePhp('s:3:"Sim";'), 'Sim', 'string PHP');
eq(unserializePhp('b:1;'), true, 'boolean PHP true');
eq(unserializePhp('i:42;'), 42, 'int PHP');

console.log('\n[decodeMaybeSerialized]');
eq(decodeMaybeSerialized('Sim'), 'Sim', 'string crua passa direto');
eq(
  decodeMaybeSerialized('a:1:{i:0;s:6:"Caução";}'),
  ['Caução'],
  'autodetect PHP serialize',
);
eq(decodeMaybeSerialized('["a","b"]'), ['a', 'b'], 'autodetect JSON array');

console.log('\n[extractAdditionalSourceFields] — payload realista Lemos');
const payload = {
  source_format: 'houzez-xml-v1',
  meta: {
    // técnicos/Houzez — NÃO devem aparecer
    houzez_total_property_views: '6',
    houzez_views_by_date: 'a:2:{s:10:"2026-05-15";i:3;s:10:"2026-05-17";i:3;}',
    houzez_recently_viewed: '2026-05-17 12:52:05',
    fave_agent_display_option: 'author_info',
    fave_single_top_area: 'global',
    fave_single_content_area: 'global',
    fave_prop_homeslider: 'no',
    fave_property_map: '1',
    fave_property_map_street_view: 'show',
    location: '25.68654,-80.431345,15',
    houzez_geolocation_lat: '-23.5',
    houzez_geolocation_long: '-46.6',
    // WordPress interno — NÃO devem aparecer
    _thumbnail_id: '123',
    _edit_lock: '1700000000:1',
    // já mapeados em DetailRow padrão — NÃO devem duplicar
    fave_property_price: '6500',
    fave_property_bedrooms: '2',
    fave_property_bathrooms: '1',
    fave_property_size: '52',
    fave_property_id: 'HZ02336',
    fave_property_zip: '06454-000',
    fave_iptu: '120',
    fave_property_condominio: '850',
    fave_propriedade: 'Condomínio Ápice Park',
    // CAMPOS DE NEGÓCIO — DEVEM aparecer
    fave_garantias_aceitas: 'a:2:{i:0;s:6:"Caução";i:1;s:13:"Seguro fiança";}',
    fave_prazo_contrato: '30 meses',
    fave_aceita_permuta: 'Sim',
    fave_aceita_proposta: 'Sim',
    fave_mobiliado: 'Não',
    fave_aceita_animais: 'Sim',
  },
  categories: {
    // já viram seção/coluna dedicada — NÃO devem aparecer
    property_type: ['Apartamento'],
    property_status: ['Alugar'],
    property_city: ['Alphaville'],
    property_state: ['SP'],
    property_area: ['Centro'],
    property_feature: ['Piscina', 'Academia'],
  },
};

const fields = extractAdditionalSourceFields(payload);
const labels = fields.map((f) => f.label);
const labelsLower = labels.map((l) => l.toLowerCase());

console.log('  labels extraídas:', labels);

// devem estar presentes
for (const must of ['Garantias aceitas', 'Prazo de contrato', 'Aceita permuta', 'Aceita proposta', 'Mobiliado', 'Aceita animais']) {
  ok(labels.includes(must), `inclui "${must}"`);
}

// NÃO devem aparecer (técnicos/duplicados/Houzez)
for (const banned of [
  'Houzez total property views', 'Houzez views by date', 'Houzez recently viewed',
  'Agent display option', 'Single top area', 'Single content area',
  'Prop homeslider', 'Location', 'Map', 'Map street view',
  'Preço', 'Dormitórios', 'Banheiros', 'Área construída',
  'ID do imóvel', 'CEP', 'IPTU', 'Condomínio', 'Propriedade',
  'Tipo de imóvel', 'Situação', 'Bairro', 'Cidade', 'Estado', 'Característica',
]) {
  ok(!labelsLower.includes(banned.toLowerCase()), `NÃO inclui "${banned}"`);
}

// valor desserializado
const garantias = fields.find((f) => f.label === 'Garantias aceitas');
ok(!!garantias, 'garantias encontrada');
eq(garantias?.value, ['Caução', 'Seguro fiança'], 'garantias desserializadas como array');

// sem duplicatas
const unique = new Set(labelsLower);
eq(unique.size, labels.length, 'sem labels duplicadas');

console.log(`\n${passed} passou, ${failed} falhou`);
if (failed > 0) process.exit(1);
