// Template padrão do Acordo de Cooperação Imobiliária
export const DEFAULT_AGREEMENT_TEMPLATE = `ACORDO DE COOPERAÇÃO IMOBILIÁRIA

CLÁUSULA 1ª - DO OBJETO
Este acordo estabelece os termos de cooperação entre os corretores identificados para a intermediação do imóvel especificado, visando garantir a transparência, ética e segurança nas operações imobiliárias.

CLÁUSULA 2ª - DAS PARTES
O presente acordo é firmado entre:
- CAPTADOR: Corretor responsável pela captação e autorização de venda do imóvel.
- CORRETOR DO COMPRADOR: Corretor que apresenta o cliente interessado na aquisição.

CLÁUSULA 3ª - DA COMISSÃO
A comissão total será dividida conforme percentuais acordados entre as partes, devidamente registrados neste instrumento.

CLÁUSULA 4ª - DO COMPROMISSO ÉTICO
As partes se comprometem a:
a) Não realizar qualquer contato direto com o proprietário ou cliente da outra parte sem prévia autorização;
b) Não divulgar informações sensíveis do imóvel a terceiros;
c) Manter sigilo sobre dados pessoais e comerciais obtidos durante a negociação;
d) Não "atravessar" a negociação, ou seja, não excluir a outra parte da intermediação.

CLÁUSULA 5ª - DA EXCLUSIVIDADE NA PARCERIA
Durante a vigência deste acordo, as partes comprometem-se a trabalhar exclusivamente através desta parceria para o imóvel em questão.

CLÁUSULA 6ª - DAS PENALIDADES
Em caso de violação das cláusulas deste acordo ("atravessamento"), a parte infratora:
a) Será responsável pelo pagamento integral da comissão devida à parte prejudicada;
b) Poderá ser responsabilizada civilmente por perdas e danos;
c) O presente instrumento servirá como prova documental em eventuais ações judiciais.

CLÁUSULA 7ª - DA VALIDADE JURÍDICA
Este acordo digital possui validade jurídica nos termos do:
- Marco Civil da Internet (Lei 12.965/2014);
- Lei Geral de Proteção de Dados (Lei 13.709/2018);
- Código Civil Brasileiro (Lei 10.406/2002);
- Medida Provisória 2.200-2/2001 que regulamenta a ICP-Brasil.

CLÁUSULA 8ª - DA PROVA DE AUTENTICIDADE
A assinatura digital das partes, registrada com data, hora, IP e dados de identificação, constitui prova inequívoca de concordância com todos os termos deste instrumento.

CLÁUSULA 9ª - DO FORO
Fica eleito o foro da comarca onde se localiza o imóvel para dirimir quaisquer questões oriundas deste acordo.`;

export const getAgreementClauses = () => [
  {
    title: "Cláusula 1ª - Do Objeto",
    content: "Este acordo estabelece os termos de cooperação entre os corretores identificados para a intermediação do imóvel especificado, visando garantir a transparência, ética e segurança nas operações imobiliárias."
  },
  {
    title: "Cláusula 2ª - Das Partes",
    content: "O presente acordo é firmado entre o CAPTADOR (corretor responsável pela captação) e o CORRETOR DO COMPRADOR (corretor que apresenta o cliente interessado)."
  },
  {
    title: "Cláusula 3ª - Da Comissão",
    content: "A comissão total será dividida conforme percentuais acordados entre as partes, devidamente registrados neste instrumento."
  },
  {
    title: "Cláusula 4ª - Do Compromisso Ético",
    content: "As partes comprometem-se a: a) Não realizar contato direto com o proprietário/cliente da outra parte sem autorização; b) Não divulgar informações sensíveis; c) Manter sigilo sobre dados pessoais e comerciais; d) Não 'atravessar' a negociação."
  },
  {
    title: "Cláusula 5ª - Da Exclusividade",
    content: "Durante a vigência, as partes trabalharão exclusivamente através desta parceria para o imóvel em questão."
  },
  {
    title: "Cláusula 6ª - Das Penalidades",
    content: "Em caso de violação ('atravessamento'), a parte infratora será responsável pelo pagamento integral da comissão à parte prejudicada, podendo ser responsabilizada civilmente. Este instrumento servirá como prova documental."
  },
  {
    title: "Cláusula 7ª - Da Validade Jurídica",
    content: "Este acordo digital possui validade jurídica conforme: Marco Civil da Internet (Lei 12.965/2014), LGPD (Lei 13.709/2018), Código Civil (Lei 10.406/2002) e MP 2.200-2/2001."
  },
  {
    title: "Cláusula 8ª - Da Prova de Autenticidade",
    content: "A assinatura digital com data, hora, IP e dados de identificação constitui prova inequívoca de concordância."
  },
  {
    title: "Cláusula 9ª - Do Foro",
    content: "Fica eleito o foro da comarca onde se localiza o imóvel para dirimir questões oriundas deste acordo."
  }
];

export interface AgreementData {
  id: string;
  createdAt: string;
  expiresAt: string;
  property: {
    title: string;
    fullAddress?: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  captador: {
    fullName: string;
    creci: string;
    acceptedAt: string | null;
    signatureIp: string | null;
  };
  buyerBroker: {
    fullName: string;
    creci: string;
    acceptedAt: string | null;
    signatureIp: string | null;
  };
  commissions: {
    captador: number;
    buyerBroker: number;
  };
  terms: string | null;
  customTerms: string | null;
}
