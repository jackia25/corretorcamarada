import { jsPDF } from 'jspdf';
import { getAgreementClauses, AgreementData } from './agreementTemplate';

export async function generateAgreementPdf(data: AgreementData): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // Helper to add text with word wrap
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false, align: 'left' | 'center' | 'right' = 'left') => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, contentWidth);
    
    // Check if we need a new page
    const lineHeight = fontSize * 0.5;
    const blockHeight = lines.length * lineHeight;
    if (y + blockHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    
    if (align === 'center') {
      lines.forEach((line: string) => {
        doc.text(line, pageWidth / 2, y, { align: 'center' });
        y += lineHeight;
      });
    } else {
      doc.text(lines, margin, y);
      y += blockHeight;
    }
    y += 2;
  };

  const addLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  };

  // Title
  addText('ACORDO DE COOPERAÇÃO IMOBILIÁRIA', 16, true, 'center');
  y += 5;
  addText(`ID do Acordo: ${data.id}`, 8, false, 'center');
  y += 10;

  // Property Info
  addText('DADOS DO IMÓVEL', 12, true);
  addLine();
  addText(`Título: ${data.property.title}`);
  if (data.property.fullAddress) {
    addText(`Endereço: ${data.property.fullAddress}`);
  }
  addText(`Localização: ${data.property.neighborhood}, ${data.property.city} - ${data.property.state}`);
  y += 10;

  // Parties
  addText('PARTES ENVOLVIDAS', 12, true);
  addLine();
  
  addText('CAPTADOR:', 10, true);
  addText(`Nome: ${data.captador.fullName}`);
  addText(`CRECI: ${data.captador.creci}`);
  addText(`Comissão: ${data.commissions.captador}%`);
  if (data.captador.acceptedAt) {
    addText(`Assinatura: ${new Date(data.captador.acceptedAt).toLocaleString('pt-BR')}`);
    addText(`IP da Assinatura: ${data.captador.signatureIp || 'Não registrado'}`);
  } else {
    addText('Status: PENDENTE DE ASSINATURA', 10, true);
  }
  y += 5;

  addText('CORRETOR DO COMPRADOR:', 10, true);
  addText(`Nome: ${data.buyerBroker.fullName}`);
  addText(`CRECI: ${data.buyerBroker.creci}`);
  addText(`Comissão: ${data.commissions.buyerBroker}%`);
  if (data.buyerBroker.acceptedAt) {
    addText(`Assinatura: ${new Date(data.buyerBroker.acceptedAt).toLocaleString('pt-BR')}`);
    addText(`IP da Assinatura: ${data.buyerBroker.signatureIp || 'Não registrado'}`);
  } else {
    addText('Status: PENDENTE DE ASSINATURA', 10, true);
  }
  y += 10;

  // Dates
  addText('VALIDADE', 12, true);
  addLine();
  addText(`Data de Criação: ${new Date(data.createdAt).toLocaleString('pt-BR')}`);
  addText(`Validade: ${new Date(data.expiresAt).toLocaleDateString('pt-BR')}`);
  y += 10;

  // Custom Terms
  if (data.terms || data.customTerms) {
    addText('TERMOS ADICIONAIS', 12, true);
    addLine();
    if (data.terms) {
      addText(data.terms);
    }
    if (data.customTerms) {
      addText(data.customTerms);
    }
    y += 10;
  }

  // Clauses
  doc.addPage();
  y = 20;
  addText('CLÁUSULAS DO ACORDO', 14, true, 'center');
  y += 10;

  const clauses = getAgreementClauses();
  clauses.forEach((clause) => {
    addText(clause.title, 10, true);
    addText(clause.content);
    y += 5;
  });

  // Legal Validity
  y += 10;
  addText('VALIDADE JURÍDICA', 12, true);
  addLine();
  addText(
    'Este documento digital possui validade jurídica nos termos do Marco Civil da Internet ' +
    '(Lei 12.965/2014), Lei Geral de Proteção de Dados (Lei 13.709/2018), Código Civil ' +
    'Brasileiro (Lei 10.406/2002) e Medida Provisória 2.200-2/2001 que regulamenta a ICP-Brasil.'
  );
  y += 5;
  addText(
    'As assinaturas digitais registradas neste documento, com data, hora e endereço IP, ' +
    'constituem prova inequívoca de concordância das partes com todos os termos estabelecidos.'
  );

  // Footer
  y += 15;
  addLine();
  addText(`Documento gerado em: ${new Date().toLocaleString('pt-BR')}`, 8, false, 'center');
  addText('Este documento é uma cópia fiel do acordo registrado na plataforma.', 8, false, 'center');

  return doc.output('blob');
}

export function downloadPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
