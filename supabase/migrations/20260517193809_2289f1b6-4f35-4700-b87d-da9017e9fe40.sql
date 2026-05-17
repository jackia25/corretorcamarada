
CREATE OR REPLACE FUNCTION public._tmp_html_to_text(input text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text := input;
BEGIN
  IF s IS NULL OR s = '' THEN RETURN s; END IF;

  -- Remove script/style blocks
  s := regexp_replace(s, '<(script|style)[^>]*>.*?</\1>', '', 'gis');

  -- Bold / italic -> markdown
  s := regexp_replace(s, '<\s*(strong|b)\b[^>]*>(.*?)<\s*/\s*\1\s*>', '**\2**', 'gis');
  s := regexp_replace(s, '<\s*(em|i)\b[^>]*>(.*?)<\s*/\s*\1\s*>', '*\2*', 'gis');

  -- List items
  s := regexp_replace(s, '<\s*li\b[^>]*>', E'\n- ', 'gi');
  s := regexp_replace(s, '<\s*/\s*li\s*>', '', 'gi');

  -- Breaks
  s := regexp_replace(s, '<\s*br\s*/?\s*>', E'\n', 'gi');
  s := regexp_replace(s, '<\s*/\s*(p|div|h[1-6]|ul|ol|blockquote|tr)\s*>', E'\n\n', 'gi');
  s := regexp_replace(s, '<\s*(p|div|h[1-6]|ul|ol|blockquote|tr)\b[^>]*>', '', 'gi');

  -- Any remaining tag
  s := regexp_replace(s, '<[^>]+>', '', 'g');

  -- HTML entities (common Portuguese ones)
  s := replace(s, '&nbsp;', ' ');
  s := replace(s, '&amp;', '&');
  s := replace(s, '&quot;', '"');
  s := replace(s, '&apos;', '''');
  s := replace(s, '&lt;', '<');
  s := replace(s, '&gt;', '>');
  s := replace(s, '&aacute;', 'á'); s := replace(s, '&eacute;', 'é');
  s := replace(s, '&iacute;', 'í'); s := replace(s, '&oacute;', 'ó');
  s := replace(s, '&uacute;', 'ú');
  s := replace(s, '&Aacute;', 'Á'); s := replace(s, '&Eacute;', 'É');
  s := replace(s, '&Iacute;', 'Í'); s := replace(s, '&Oacute;', 'Ó');
  s := replace(s, '&Uacute;', 'Ú');
  s := replace(s, '&atilde;', 'ã'); s := replace(s, '&otilde;', 'õ');
  s := replace(s, '&Atilde;', 'Ã'); s := replace(s, '&Otilde;', 'Õ');
  s := replace(s, '&acirc;', 'â'); s := replace(s, '&ecirc;', 'ê');
  s := replace(s, '&ocirc;', 'ô'); s := replace(s, '&Acirc;', 'Â');
  s := replace(s, '&Ecirc;', 'Ê'); s := replace(s, '&Ocirc;', 'Ô');
  s := replace(s, '&agrave;', 'à'); s := replace(s, '&Agrave;', 'À');
  s := replace(s, '&ccedil;', 'ç'); s := replace(s, '&Ccedil;', 'Ç');
  s := replace(s, '&ordf;', 'ª'); s := replace(s, '&ordm;', 'º');
  s := replace(s, '&hellip;', '…');
  s := replace(s, '&ndash;', '–'); s := replace(s, '&mdash;', '—');
  s := replace(s, '&lsquo;', '‘'); s := replace(s, '&rsquo;', '’');
  s := replace(s, '&ldquo;', '“'); s := replace(s, '&rdquo;', '”');
  s := replace(s, '&bull;', '•'); s := replace(s, '&middot;', '·');

  -- Numeric entities
  s := regexp_replace(s, '&#x[0-9a-fA-F]+;', '', 'g');
  s := regexp_replace(s, '&#[0-9]+;', '', 'g');

  -- Normalize whitespace
  s := regexp_replace(s, E'\r\n?', E'\n', 'g');
  s := regexp_replace(s, '[ \t]+', ' ', 'g');
  s := regexp_replace(s, E'[ \t]*\n[ \t]*', E'\n', 'g');
  s := regexp_replace(s, E'\n{3,}', E'\n\n', 'g');

  RETURN btrim(s);
END;
$$;

UPDATE public.properties
SET description = public._tmp_html_to_text(description)
WHERE description ~ '<[a-zA-Z/!]' OR description ~ '&[a-zA-Z]+;';

DROP FUNCTION public._tmp_html_to_text(text);
