import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Handshake, 
  Building2, 
  User, 
  CheckCircle2,
  Clock,
  Loader2,
  Eye,
  Percent
} from 'lucide-react';
import { motion } from 'framer-motion';
import { CooperationAgreement, AGREEMENT_STATUS_LABELS, AgreementStatus } from '@/lib/types';

interface AgreementWithDetails extends Omit<CooperationAgreement, 'property' | 'captador' | 'buyer_broker'> {
  property: {
    id: string;
    title: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  captador: {
    id: string;
    full_name: string;
    creci: string;
  };
  buyer_broker: {
    id: string;
    full_name: string;
    creci: string;
  };
}

export default function Agreements() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<AgreementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      fetchAgreements();
    }
  }, [profile]);

  async function fetchAgreements() {
    if (!profile) return;

    const { data, error } = await supabase
      .from('cooperation_agreements')
      .select(`
        *,
        property:properties!cooperation_agreements_property_id_fkey(id, title, neighborhood, city, state),
        captador:profiles!cooperation_agreements_captador_id_fkey(id, full_name, creci),
        buyer_broker:profiles!cooperation_agreements_buyer_broker_id_fkey(id, full_name, creci)
      `)
      .or(`captador_id.eq.${profile.id},buyer_broker_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (data) setAgreements(data as unknown as AgreementWithDetails[]);
    setLoading(false);
  }

  const handleAcceptAgreement = async (agreement: AgreementWithDetails) => {
    if (!profile) return;

    setAcceptingId(agreement.id);

    const isCaptador = agreement.captador_id === profile.id;
    const updateField = isCaptador ? 'captador_accepted_at' : 'buyer_broker_accepted_at';
    
    // Check if both will have accepted
    const otherAccepted = isCaptador ? agreement.buyer_broker_accepted_at : agreement.captador_accepted_at;
    const newStatus = otherAccepted ? 'active' : 'pending';

    const { error } = await supabase
      .from('cooperation_agreements')
      .update({
        [updateField]: new Date().toISOString(),
        status: newStatus as AgreementStatus,
      })
      .eq('id', agreement.id);

    setAcceptingId(null);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ 
        title: newStatus === 'active' ? 'Acordo Ativado!' : 'Aceite registrado',
        description: newStatus === 'active' 
          ? 'Os dados do imóvel agora estão liberados.'
          : 'Aguardando a outra parte aceitar.',
      });

      // Log access if agreement is now active
      if (newStatus === 'active') {
        await supabase.from('access_logs').insert({
          user_id: profile.id,
          property_id: agreement.property_id,
          agreement_id: agreement.id,
          action: 'agreement_activated',
          details: { activated_by: profile.id },
        });
      }

      fetchAgreements();
    }
  };

  const getStatusBadge = (status: AgreementStatus) => {
    const variants: Record<AgreementStatus, string> = {
      pending: 'status-pending',
      active: 'status-active',
      cancelled: 'status-rejected',
      expired: 'status-expired',
    };
    return <Badge className={variants[status]}>{AGREEMENT_STATUS_LABELS[status]}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const AgreementCard = ({ agreement }: { agreement: AgreementWithDetails }) => {
    const isCaptador = agreement.captador_id === profile?.id;
    const iAccepted = isCaptador ? agreement.captador_accepted_at : agreement.buyer_broker_accepted_at;
    const otherAccepted = isCaptador ? agreement.buyer_broker_accepted_at : agreement.captador_accepted_at;
    const myRole = isCaptador ? 'Captador' : 'Corretor do Comprador';
    const myCommission = isCaptador ? agreement.captador_commission_percent : agreement.buyer_broker_commission_percent;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className={`card-interactive ${agreement.status === 'active' ? 'border-success' : ''}`}>
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{agreement.property.title}</span>
                  {getStatusBadge(agreement.status as AgreementStatus)}
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {agreement.property.neighborhood}, {agreement.property.city} - {agreement.property.state}
                </p>

                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-muted-foreground">Captador:</span>
                    <span>{agreement.captador.full_name}</span>
                    {agreement.captador_accepted_at && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-accent" />
                    <span className="text-muted-foreground">Corretor Comprador:</span>
                    <span>{agreement.buyer_broker.full_name}</span>
                    {agreement.buyer_broker_accepted_at && <CheckCircle2 className="h-4 w-4 text-success" />}
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
                    <Percent className="h-4 w-4" />
                    <span>Captador: {agreement.captador_commission_percent}%</span>
                  </div>
                  <div className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-lg">
                    <Percent className="h-4 w-4" />
                    <span>Corretor: {agreement.buyer_broker_commission_percent}%</span>
                  </div>
                </div>

                {agreement.terms && (
                  <p className="text-sm mt-3 bg-muted p-2 rounded">
                    <strong>Termos:</strong> {agreement.terms}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-3">
                  Criado em {formatDate(agreement.created_at)}
                  {agreement.expires_at && ` • Expira em ${formatDate(agreement.expires_at)}`}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                {agreement.status === 'pending' && !iAccepted && (
                  <Button
                    className="gap-2 gradient-bg"
                    onClick={() => handleAcceptAgreement(agreement)}
                    disabled={acceptingId === agreement.id}
                  >
                    {acceptingId === agreement.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Aceitar Acordo
                  </Button>
                )}

                {agreement.status === 'pending' && iAccepted && !otherAccepted && (
                  <div className="text-center p-3 bg-warning/10 rounded-lg">
                    <Clock className="h-5 w-5 text-warning mx-auto mb-1" />
                    <p className="text-sm text-warning">Aguardando outra parte</p>
                  </div>
                )}

                {agreement.status === 'active' && (
                  <Link to={`/properties/${agreement.property_id}`}>
                    <Button variant="outline" className="gap-2">
                      <Eye className="h-4 w-4" />
                      Ver Imóvel
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  const activeCount = agreements.filter(a => a.status === 'active').length;
  const pendingCount = agreements.filter(a => a.status === 'pending').length;

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Acordos de Cooperação</h1>
          <p className="text-muted-foreground">
            Gerencie seus acordos com outros corretores
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-sm text-muted-foreground">Acordos Ativos</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Pendentes de Aceite</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2 mb-4" />
                  <Skeleton className="h-10 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : agreements.length === 0 ? (
          <Card className="p-12 text-center">
            <Handshake className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum acordo ainda</h3>
            <p className="text-muted-foreground mb-4">
              Quando você aceitar solicitações de acesso ou tiver suas solicitações aceitas,
              os acordos aparecerão aqui.
            </p>
            <Link to="/properties">
              <Button className="gradient-bg">Buscar Imóveis</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {agreements.map((agreement) => (
              <AgreementCard key={agreement.id} agreement={agreement} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}