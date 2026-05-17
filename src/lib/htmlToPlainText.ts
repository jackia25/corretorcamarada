// Converts HTML (rich text from external sources) into clean plain text
// with light markdown so it stays readable in textareas and renders
// formatted in the details screen (which understands **bold** and "- " lists).

const ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  atilde: 'ã', otilde: 'õ', Atilde: 'Ã', Otilde: 'Õ',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  Acirc: 'Â', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ucirc: 'Û',
  agrave: 'à', Agrave: 'À',
  ccedil: 'ç', Ccedil: 'Ç',
  ordf: 'ª', ordm: 'º',
  hellip: '…', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  bull: '•', middot: '·',
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name] ?? m);
}

export function htmlToPlainText(input: string | null | undefined): string {
  if (!input) return '';
  let s = String(input);

  // Strip script/style blocks entirely
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Bold / italic to markdown
  s = s.replace(/<\s*(strong|b)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_, _t, c) => `**${c.trim()}**`);
  s = s.replace(/<\s*(em|i)\b[^>]*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, (_, _t, c) => `*${c.trim()}*`);

  // List items
  s = s.replace(/<\s*li\b[^>]*>/gi, '\n- ');
  s = s.replace(/<\s*\/\s*li\s*>/gi, '');

  // Block-level breaks
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol|blockquote|tr)\s*>/gi, '\n\n');
  s = s.replace(/<\s*(p|div|h[1-6]|ul|ol|blockquote|tr)\b[^>]*>/gi, '');

  // Remove any remaining tags
  s = s.replace(/<[^>]+>/g, '');

  // Decode entities
  s = decodeEntities(s);

  // Normalize whitespace
  s = s.replace(/\r\n?/g, '\n');
  s = s.split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n');
  s = s.replace(/\n{3,}/g, '\n\n');

  return s.trim();
}

export function looksLikeHtml(s: string | null | undefined): boolean {
  if (!s) return false;
  return /<[a-zA-Z\/!][^>]*>/.test(s) || /&[a-zA-Z]+;/.test(s);
}
