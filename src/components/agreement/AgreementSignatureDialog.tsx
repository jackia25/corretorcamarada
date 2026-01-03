import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, FileSignature, Shield, Scale, AlertTriangle, Building2, Percent, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { getAgreementClauses } from '@/lib/agreementTemplate';
import { motion } from 'framer-motion';

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreement: {
    id: string;
    property: {
      title: string;
      neighborhood: string;
      city: string;
      state: string;
    };
    captador: {
      full_name: string;
      creci: string;
    };
    buyer_broker: {
      full_name: string;
      creci: string;
    };
    captador_commission_percent: number;
    buyer_broker_commission_percent: number;
    terms: string | null;
    created_at: string;
    expires_at: string;
  };
  onSign: (ip: string) => Promise<void>;
  role: 'captador' | 'buyer_broker';
  submitting: boolean;
}

export function AgreementSignatureDialog({
  open,
  onOpenChange,
  agreement,
  onSign,
  role,
  submitting
}: SignatureDialogProps) {
  const [acceptedClauses, setAcceptedClauses] = useState<Record<number, boolean>>({});
  const [acceptedFinal, setAcceptedFinal] = useState(false);
  const [userIp, setUserIp] = useState<string>('');
  const [loadingIp, setLoadingIp] = useState(true);

  const clauses = getAgreementClauses();
  const allClausesAccepted = clauses.every((_, index) => acceptedClauses[index]);
  const acceptedCount = Object.values(acceptedClauses).filter(Boolean).length;
  const canSign = allClausesAccepted && acceptedFinal && userIp;

  // Fetch user IP
  useEffect(() => {
    if (open) {
      setLoadingIp(true);
      fetch('https://api.ipify.org?format=json')
        .then(res => res.json())
        .then(data => {
          setUserIp(data.ip);
          setLoadingIp(false);
        })
        .catch(() => {
          setUserIp('IP não identificado');
          setLoadingIp(false);
        });
    }
  }, [open]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setAcceptedClauses({});
      setAcceptedFinal(false);
    }
  }, [open]);

  const handleSign = async () => {
    await onSign(userIp);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const currentDateTime = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const handleAcceptAll = () => {
    const allAccepted: Record<number, boolean> = {};
    clauses.forEach((_, index) => {
      allAccepted[index] = true;
    });
    setAcceptedClauses(allAccepted);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Termo de Cooperação Imobiliária
          </DialogTitle>
          <DialogDescription>
            Clique em cada cláusula para expandir e leia atentamente antes de aceitar
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-4">
            {/* Agreement Info */}
            <div className="bg-muted/50 p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{agreement.property.title}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {agreement.property.neighborhood}, {agreement.property.city} - {agreement.property.state}
              </p>
              
              <Separator />
              
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Captador:</span>
                  <p className="font-medium">{agreement.captador.full_name}</p>
                  <p className="text-xs text-muted-foreground">CRECI: {agreement.captador.creci}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Corretor do Comprador:</span>
                  <p className="font-medium">{agreement.buyer_broker.full_name}</p>
                  <p className="text-xs text-muted-foreground">CRECI: {agreement.buyer_broker.creci}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  <span>Captador: <strong>{agreement.captador_commission_percent}%</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  <span>Corretor: <strong>{agreement.buyer_broker_commission_percent}%</strong></span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4" />
                <span>Válido até: <strong>{formatDate(agreement.expires_at)}</strong></span>
              </div>
            </div>

            {/* Custom Terms */}
            {agreement.terms && (
              <div className="bg-accent/10 p-4 rounded-lg">
                <p className="text-sm font-medium mb-2">Termos Adicionais:</p>
                <p className="text-sm">{agreement.terms}</p>
              </div>
            )}

            {/* Clauses Header with Progress */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Cláusulas do Acordo
                </h4>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {acceptedCount}/{clauses.length} aceitas
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAcceptAll}
                    disabled={allClausesAccepted}
                  >
                    Aceitar Todas
                  </Button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(acceptedCount / clauses.length) * 100}%` }}
                />
              </div>
            </div>

            {/* Clauses Accordion */}
            <Accordion type="single" collapsible className="space-y-2">
              {clauses.map((clause, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <AccordionItem 
                    value={`clause-${index}`} 
                    className={`border-2 rounded-lg px-4 transition-colors ${
                      acceptedClauses[index] 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950/20' 
                        : 'border-border bg-background'
                    }`}
                  >
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center gap-3 text-left">
                        {acceptedClauses[index] ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="font-medium text-sm">{clause.title}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-2 pb-4">
                      <p className="text-sm text-muted-foreground mb-4 whitespace-pre-line">
                        {clause.content}
                      </p>
                      <div className="flex items-center gap-3 pt-2 border-t">
                        <Checkbox
                          id={`dialog-clause-${index}`}
                          checked={acceptedClauses[index] || false}
                          onCheckedChange={(checked) => 
                            setAcceptedClauses(prev => ({ ...prev, [index]: !!checked }))
                          }
                          className="h-5 w-5 border-2 border-gray-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                        />
                        <Label 
                          htmlFor={`dialog-clause-${index}`} 
                          className="cursor-pointer text-sm font-medium"
                        >
                          Li e aceito esta cláusula
                        </Label>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </motion.div>
              ))}
            </Accordion>

            {/* Warning */}
            <div className="bg-warning/10 border border-warning/30 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning">Importante:</p>
                  <p className="text-muted-foreground">
                    Este acordo tem validade jurídica. Em caso de violação das cláusulas, 
                    este documento poderá ser utilizado como prova em processos judiciais 
                    para reparação de danos e cobrança de comissões devidas.
                  </p>
                </div>
              </div>
            </div>

            {/* Final Acceptance */}
            <div className={`p-4 rounded-lg border-2 transition-colors ${
              acceptedFinal ? 'border-primary bg-primary/5' : 'border-border'
            } ${!allClausesAccepted ? 'opacity-50' : ''}`}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="final-acceptance"
                  checked={acceptedFinal}
                  onCheckedChange={(checked) => setAcceptedFinal(!!checked)}
                  disabled={!allClausesAccepted}
                  className="mt-1 h-5 w-5"
                />
                <Label htmlFor="final-acceptance" className={`cursor-pointer ${!allClausesAccepted ? 'cursor-not-allowed' : ''}`}>
                  <span className="font-medium">Declaro que li, compreendi e concordo com todas as cláusulas</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    Ao assinar, confirmo minha identidade como{' '}
                    <strong>
                      {role === 'captador' 
                        ? agreement.captador.full_name 
                        : agreement.buyer_broker.full_name}
                    </strong>{' '}
                    (CRECI: {role === 'captador' ? agreement.captador.creci : agreement.buyer_broker.creci})
                  </p>
                  {!allClausesAccepted && (
                    <p className="text-xs text-destructive mt-2">
                      ⚠️ Você precisa aceitar todas as {clauses.length} cláusulas acima antes de prosseguir
                    </p>
                  )}
                </Label>
              </div>
            </div>

            {/* Signature Info */}
            <div className="bg-muted/50 p-4 rounded-lg text-sm">
              <p className="font-medium mb-2">Dados da Assinatura Digital:</p>
              <div className="grid sm:grid-cols-2 gap-2 text-muted-foreground">
                <p>Data/Hora: <span className="text-foreground">{currentDateTime}</span></p>
                <p>
                  IP: {loadingIp ? (
                    <Loader2 className="inline h-3 w-3 animate-spin" />
                  ) : (
                    <span className="text-foreground">{userIp}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button 
            className="gap-2 gradient-bg" 
            onClick={handleSign} 
            disabled={!canSign || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSignature className="h-4 w-4" />
            )}
            Assinar Digitalmente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
