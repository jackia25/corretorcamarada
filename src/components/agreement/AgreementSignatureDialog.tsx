import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSignature, Shield, Scale, AlertTriangle, Building2, User, Percent, Calendar } from 'lucide-react';
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Termo de Cooperação Imobiliária
          </DialogTitle>
          <DialogDescription>
            Leia atentamente e aceite cada cláusula para assinar digitalmente
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-6">
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

            {/* Clauses */}
            <div className="space-y-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Cláusulas do Acordo
              </h4>
              
                {clauses.map((clause, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      acceptedClauses[index] ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={`dialog-clause-${index}`}
                        checked={acceptedClauses[index] || false}
                        onCheckedChange={(checked) => 
                          setAcceptedClauses(prev => ({ ...prev, [index]: !!checked }))
                        }
                        className="mt-1 h-5 w-5 border-2 border-gray-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                      <div className="flex-1">
                        <Label htmlFor={`dialog-clause-${index}`} className="font-medium cursor-pointer">
                          {clause.title}
                        </Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {clause.content}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
            </div>

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
            }`}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="final-acceptance"
                  checked={acceptedFinal}
                  onCheckedChange={(checked) => setAcceptedFinal(!!checked)}
                  disabled={!allClausesAccepted}
                  className="mt-1"
                />
                <Label htmlFor="final-acceptance" className="cursor-pointer">
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

        <DialogFooter className="mt-4">
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
