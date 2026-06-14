/**
 * Normaliza URLs de imagens para que funcionem em TODOS os navegadores/dispositivos.
 *
 * Muitas fotos importadas apontam para um site externo (ex: lemosproperties.com.br)
 * e estão no formato AVIF, que não é suportado em navegadores/dispositivos mais
 * antigos (ex: Safari/iOS antigo). Além disso, o servidor externo às vezes entrega
 * essas imagens com o tipo de arquivo errado (text/plain), o que faz alguns
 * navegadores recusarem a renderização.
 *
 * Para resolver isso de forma universal, passamos as imagens externas por um
 * otimizador de imagem (wsrv.nl / images.weserv.nl) que:
 *  - converte AVIF/qualquer formato para WebP/JPEG amplamente suportado;
 *  - corrige o content-type;
 *  - adiciona cache/CDN, reduzindo a carga no servidor de origem.
 *
 * Imagens já hospedadas no nosso próprio storage não precisam de proxy.
 */

const PROXY_BASE = 'https://wsrv.nl/';

// Hosts que já servimos diretamente (storage próprio) — não passar pelo proxy.
const DIRECT_HOSTS = ['supabase.co', 'supabase.in', 'lovableproject.com', 'lovable.app'];

interface OptimizeOptions {
  /** Largura máxima desejada (px). O proxy redimensiona mantendo proporção. */
  width?: number;
  /** Qualidade (1-100). Padrão 80. */
  quality?: number;
}

export function optimizedImageUrl(url: string | null | undefined, options: OptimizeOptions = {}): string {
  if (!url) return '';

  // Data URLs / blobs não devem ser proxados.
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;

  let isDirect = false;
  try {
    const parsed = new URL(url, window.location.origin);
    // URLs relativas ou do nosso próprio domínio/storage não precisam de proxy.
    if (parsed.origin === window.location.origin) isDirect = true;
    if (DIRECT_HOSTS.some((host) => parsed.hostname.endsWith(host))) isDirect = true;
    // Só conseguimos proxar http(s).
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;
  } catch {
    return url;
  }

  if (isDirect) return url;

  const params = new URLSearchParams();
  // wsrv aceita a URL completa (com esquema) no parâmetro `url`.
  params.set('url', url);
  params.set('output', 'webp');
  params.set('q', String(options.quality ?? 80));
  if (options.width) {
    params.set('w', String(options.width));
    params.set('fit', 'cover');
  }
  // Não falhar caso a origem esteja fora do ar — retorna a imagem original.
  params.set('default', url);

  return `${PROXY_BASE}?${params.toString()}`;
}
