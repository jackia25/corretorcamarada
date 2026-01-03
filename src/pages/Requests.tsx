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
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AccessRequest, REQUEST_STATUS_LABELS, RequestStatus } from '@/lib/types';

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

  const handleAccept = async () => {
    if (!selectedRequest || !profile) return;

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

    // Create cooperation agreement
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
    });

    setSubmitting(false);
    setActionDialog(null);
    setSelectedRequest(null);
    setResponseMessage('');
    setCommissionPercent('50');
    setAgreementTerms('');

    if (agreementError) {
      toast({ variant: 'destructive', title: 'Erro ao criar acordo', description: agreementError.message });
    } else {
      toast({ title: 'Solicitação aceita!', description: 'Um acordo de cooperação foi criado.' });
      fetchRequests();
    }
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

        {/* Accept Dialog */}
        <Dialog open={actionDialog === 'accept'} onOpenChange={() => setActionDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Handshake className="h-5 w-5 text-primary" />
                Aceitar e Criar Acordo
              </DialogTitle>
              <DialogDescription>
                Ao aceitar, você criará um acordo de cooperação. Defina os termos abaixo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
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
                <Label>Termos do Acordo (opcional)</Label>
                <Textarea
                  placeholder="Condições especiais, prazos, etc..."
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
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>
                Cancelar
              </Button>
              <Button className="gradient-bg gap-2" onClick={handleAccept} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Aceitar e Criar Acordo
              </Button>
            </DialogFooter>
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