import { supabase } from '@/integrations/supabase/client';

/**
 * Gera o próximo código sequencial para um corretor a partir da sua sigla.
 * Ex.: prefixo "A" -> A01, A02, A03...
 * Procura o maior número já usado pelo corretor com esse prefixo e incrementa.
 */
export async function generateNextCode(ownerId: string, prefix: string): Promise<string> {
  const cleanPrefix = (prefix || '').trim().toUpperCase();
  if (!cleanPrefix) return '';

  const { data, error } = await supabase
    .from('properties')
    .select('external_code')
    .eq('owner_id', ownerId)
    .ilike('external_code', `${cleanPrefix}%`);

  let maxNum = 0;
  if (!error && data) {
    const re = new RegExp(`^${cleanPrefix}0*(\\d+)$`, 'i');
    for (const row of data) {
      const code = (row.external_code || '').trim();
      const m = code.match(re);
      if (m) {
        const n = parseInt(m[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }
  }

  const next = maxNum + 1;
  const padded = next < 100 ? String(next).padStart(2, '0') : String(next);
  return `${cleanPrefix}${padded}`;
}
