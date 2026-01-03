import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { 
  Inbox, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock,
  Building2,
  User,
  Handshake,
  Loader2,
  Scale,
  Shield,
  AlertTriangle,
  FileSignature,
  Percent,
  Calendar,
  Circle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AccessRequest, REQUEST_STATUS_LABELS, RequestStatus } from '@/lib/types';
import { getAgreementClauses } from '@/lib/agreementTemplate';

interface RequestWithDetails extends Omit<AccessRequest, 'property' | 'requester'> {
  property: {
    id: string;
    title: string;
    neighborhood: string;
    city: string;
    state: string;
    owner_id?: string;
  };
  requester: {
    id: string;
    full_name: string;
    creci: string;
  };
}

export default function Requests() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [receivedRequests, setReceivedRequests] = useState<RequestWithDetails[]>([]);
  const [sentRequests, setSentRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<RequestWithDetails | null>(null);
  const [actionDialog, setActionDialog] = useState<'accept' | 'reject' | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('50');
  const [agreementTerms, setAgreementTerms] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Signature states
  const [acceptedClauses, setAcceptedClauses] = useState<Record<number, boolean>>({});
  const [acceptedFinal, setAcceptedFinal] = useState(false);
  const [userIp, setUserIp] = useState<string>('');
  const [loadingIp, setLoadingIp] = useState(false);
  const [step, setStep] = useState<'terms' | 'signature'>('terms');

  useEffect(() => {
    if (profile) {
      fetchRequests();
    }
  }, [profile]);

  async function fetchRequests() {
    if (!profile) return;

    // Received requests (for my properties)
    const { data: received } = await supabase
      .from('access_requests')
      .select(`
        *,
        property:properties!access_requests_property_id_fkey(id, title, neighborhood, city, state, owner_id),
        requester:profiles!access_requests_requester_id_fkey(id, full_name, creci)
      `)
      .eq('property.owner_id', profile.id)
      .order('created_at', { ascending: false });

    // Sent requests
    const { data: sent } = await supabase
      .from('access_requests')
      .select(`
        *,
        property:properties!access_requests_property_id_fkey(id, title, neighborhood, city, state),
        requester:profiles!access_requests_requester_id_fkey(id, full_name, creci)
      `)
      .eq('requester_id', profile.id)
      .order('created_at', { ascending: false });

    if (received) {
      // Filter to only include requests for properties owned by the user
      const filteredReceived = received.filter(r => r.property && (r.property as { owner_id: string }).owner_id === profile.id);
      setReceivedRequests(filteredReceived as unknown as RequestWithDetails[]);
    }
    if (sent) setSentRequests(sent as unknown as RequestWithDetails[]);
    setLoading(false);
  }

  // Fetch IP when entering signature step
  useEffect(() => {
    if (step === 'signature' && actionDialog === 'accept') {
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
  }, [step, actionDialog]);

  const clauses = getAgreementClauses();
  const allClausesAccepted = clauses.every((_, index) => acceptedClauses[index]);
  const acceptedCount = Object.values(acceptedClauses).filter(Boolean).length;
  const canSign = allClausesAccepted && acceptedFinal && userIp;

  const handleAcceptAll = () => {
    const allAccepted: Record<number, boolean> = {};
    clauses.forEach((_, index) => {
      allAccepted[index] = true;
    });
    setAcceptedClauses(allAccepted);
  };

  const handleAccept = async () => {
    if (!selectedRequest || !profile || !userIp) return;

    setSubmitting(true);

    // Update request status
    const { error: updateError } = await supabase
      .from('access_requests')
      .update({
        status: 'accepted' as RequestStatus,
        response_message: responseMessage || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', selectedRequest.id);

    if (updateError) {
      toast({ variant: 'destructive', title: 'Erro', description: updateError.message });
      setSubmitting(false);
      return;
    }

    // Create cooperation agreement with signature
    const captadorPercent = parseFloat(commissionPercent);
    const { error: agreementError } = await supabase.from('cooperation_agreements').insert({
      access_request_id: selectedRequest.id,
      property_id: selectedRequest.property.id,
      captador_id: profile.id,
      buyer_broker_id: selectedRequest.requester.id,
      captador_commission_percent: captadorPercent,
      buyer_broker_commission_percent: 100 - captadorPercent,
      terms: agreementTerms || null,
      captador_accepted_at: new Date().toISOString(),
      captador_signature_ip: userIp,
    });

    setSubmitting(false);
    resetDialogState();

    if (agreementError) {
      toast({ variant: 'destructive', title: 'Erro ao criar acordo', description: agreementError.message });
    } else {
      toast({ 
        title: 'Acordo assinado com sucesso!', 
        description: 'Aguardando assinatura do corretor do comprador.' 
      });
      fetchRequests();
    }
  };

  const resetDialogState = () => {
    setActionDialog(null);
    setSelectedRequest(null);
    setResponseMessage('');
    setCommissionPercent('50');
    setAgreementTerms('');
    setAcceptedClauses({});
    setAcceptedFinal(false);
    setStep('terms');
    setUserIp('');
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setSubmitting(true);

    const { error } = await supabase
      .from('access_requests')
      .update({
        status: 'rejected' as RequestStatus,
        response_message: responseMessage || null,
        responded_at: new Date().toISOString(),
      })
      .eq('id', selectedRequest.id);

    setSubmitting(false);
    setActionDialog(null);
    setSelectedRequest(null);
    setResponseMessage('');

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Solicitação recusada' });
      fetchRequests();
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    const variants: Record<RequestStatus, string> = {
      pending: 'status-pending',
      accepted: 'status-active',
      rejected: 'status-rejected',
      expired: 'status-expired',
    };
    return <Badge className={variants[status]}>{REQUEST_STATUS_LABELS[status]}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const RequestCard = ({ request, type }: { request: RequestWithDetails; type: 'received' | 'sent' }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-interactive">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{request.property.title}</span>
                {getStatusBadge(request.status as RequestStatus)}
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {request.property.neighborhood}, {request.property.city} - {request.property.state}
              </p>
              {type === 'received' && (
                <p className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="text-muted-foreground">Solicitante:</span>
                  {request.requester.full_name} (CRECI: {request.requester.creci})
                </p>
              )}
              {request.message && (
                <p className="text-sm mt-2 bg-muted p-2 rounded">
                  "{request.message}"
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {formatDate(request.created_at)}
              </p>
            </div>

            {type === 'received' && request.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setSelectedRequest(request);
                    setActionDialog('reject');
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Recusar
                </Button>
                <Button
                  size="sm"
                  className="gap-2 gradient-bg"
                  onClick={() => {
                    setSelectedRequest(request);
                    setActionDialog('accept');
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Aceitar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const pendingCount = receivedRequests.filter(r => r.status === 'pending').length;

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Solicitações de Acesso</h1>
          <p className="text-muted-foreground">Gerencie as solicitações de acesso aos seus imóveis</p>
        </div>

        <Tabs defaultValue="received">
          <TabsList className="mb-6">
            <TabsTrigger value="received" className="gap-2">
              <Inbox className="h-4 w-4" />
              Recebidas
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1 bg-warning text-warning-foreground">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-2">
              <Send className="h-4 w-4" />
              Enviadas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="received">
            {loading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : receivedRequests.length === 0 ? (
              <Card className="p-12 text-center">
                <Inbox className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhuma solicitação recebida</h3>
                <p className="text-muted-foreground">
                  Quando outros corretores solicitarem acesso aos seus imóveis, aparecerão aqui.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {receivedRequests.map((request) => (
                  <RequestCard key={request.id} request={request} type="received" />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sent">
            {loading ? (
              <div className="space-y-4">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : sentRequests.length === 0 ? (
              <Card className="p-12 text-center">
                <Send className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhuma solicitação enviada</h3>
                <p className="text-muted-foreground">
                  Suas solicitações de acesso a imóveis aparecerão aqui.
                </p>
              </Card>
            ) : (
              <div className="space-y-4">
                {sentRequests.map((request) => (
                  <RequestCard key={request.id} request={request} type="sent" />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Accept Dialog - Step 1: Terms */}
        <Dialog open={actionDialog === 'accept'} onOpenChange={() => resetDialogState()}>
          <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle className="flex items-center gap-2">
                {step === 'terms' ? (
                  <>
                    <Handshake className="h-5 w-5 text-primary" />
                    Definir Termos do Acordo
                  </>
                ) : (
                  <>
                    <Scale className="h-5 w-5 text-primary" />
                    Assinar Termo de Cooperação
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {step === 'terms' 
                  ? 'Defina os termos da cooperação. Na próxima etapa você assinará o acordo.'
                  : 'Clique em cada cláusula para expandir e leia atentamente antes de aceitar.'}
              </DialogDescription>
            </DialogHeader>

            {step === 'terms' ? (
              <>
                <div className="space-y-4 px-6 py-4">
                  <div className="space-y-2">
                    <Label>Sua Comissão (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={commissionPercent}
                      onChange={(e) => setCommissionPercent(e.target.value)}
                    />
                    <p className="text-sm text-muted-foreground">
                      Corretor do comprador receberá: {100 - parseFloat(commissionPercent || '0')}%
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Termos Adicionais (opcional)</Label>
                    <Textarea
                      placeholder="Condições especiais, prazos, observações..."
                      value={agreementTerms}
                      onChange={(e) => setAgreementTerms(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem de Resposta (opcional)</Label>
                    <Textarea
                      placeholder="Mensagem para o corretor..."
                      value={responseMessage}
                      onChange={(e) => setResponseMessage(e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter className="px-6 py-4 border-t">
                  <Button variant="outline" onClick={() => resetDialogState()}>
                    Cancelar
                  </Button>
                  <Button className="gradient-bg gap-2" onClick={() => setStep('signature')}>
                    Continuar para Assinatura
                    <Scale className="h-4 w-4" />
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <ScrollArea className="flex-1 px-6">
                  <div className="space-y-4 pb-4">
                    {/* Agreement Summary */}
                    <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{selectedRequest?.property.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {selectedRequest?.property.neighborhood}, {selectedRequest?.property.city} - {selectedRequest?.property.state}
                      </p>
                      <Separator className="my-2" />
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          <span>Captador: <strong>{commissionPercent}%</strong></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          <span>Corretor: <strong>{100 - parseFloat(commissionPercent || '0')}%</strong></span>
                        </div>
                      </div>
                      {agreementTerms && (
                        <p className="text-sm mt-2 bg-background p-2 rounded">
                          <strong>Termos:</strong> {agreementTerms}
                        </p>
                      )}
                    </div>

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
                                  id={`clause-${index}`}
                                  checked={acceptedClauses[index] || false}
                                  onCheckedChange={(checked) => 
                                    setAcceptedClauses(prev => ({ ...prev, [index]: !!checked }))
                                  }
                                  className="h-5 w-5 border-2 border-gray-400 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                                />
                                <Label 
                                  htmlFor={`clause-${index}`} 
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
                    <div className="bg-warning/10 border border-warning/30 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-warning">Importante:</span> Este acordo tem validade jurídica e poderá ser usado como prova em processos judiciais.
                        </p>
                      </div>
                    </div>

                    {/* Final Acceptance */}
                    <div className={`p-3 rounded-lg border-2 transition-colors ${
                      acceptedFinal ? 'border-primary bg-primary/5' : 'border-border'
                    } ${!allClausesAccepted ? 'opacity-50' : ''}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="final-acceptance"
                          checked={acceptedFinal}
                          onCheckedChange={(checked) => setAcceptedFinal(!!checked)}
                          disabled={!allClausesAccepted}
                          className="mt-0.5 h-5 w-5"
                        />
                        <Label htmlFor="final-acceptance" className={`cursor-pointer text-sm ${!allClausesAccepted ? 'cursor-not-allowed' : ''}`}>
                          <span className="font-medium">Declaro que li, compreendi e concordo com todas as cláusulas</span>
                          <p className="text-xs text-muted-foreground mt-1">
                            Confirmo minha identidade como <strong>{profile?.full_name}</strong> (CRECI: {profile?.creci})
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
                    <div className="bg-muted/50 p-3 rounded-lg text-xs">
                      <p className="font-medium mb-1">Dados da Assinatura Digital:</p>
                      <div className="grid sm:grid-cols-2 gap-1 text-muted-foreground">
                        <p>Data/Hora: <span className="text-foreground">{new Date().toLocaleString('pt-BR')}</span></p>
                        <p>
                          IP: {loadingIp ? (
                            <Loader2 className="inline h-3 w-3 animate-spin" />
                          ) : (
                            <span className="text-foreground">{userIp || 'Carregando...'}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="px-6 py-4 border-t">
                  <Button variant="outline" onClick={() => setStep('terms')}>
                    Voltar
                  </Button>
                  <Button 
                    className="gap-2 gradient-bg" 
                    onClick={handleAccept} 
                    disabled={!canSign || submitting}
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSignature className="h-4 w-4" />
                    )}
                    Assinar Acordo
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={actionDialog === 'reject'} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Recusar Solicitação</DialogTitle>
              <DialogDescription>
                Você pode enviar uma mensagem explicando o motivo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Mensagem (opcional)</Label>
                <Textarea
                  placeholder="Motivo da recusa..."
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleReject} disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Recusar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}