import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  User,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

interface CrossingReport {
  id: string;
  description: string;
  status: string;
  resolution: string | null;
  evidence_urls: string[] | null;
  created_at: string;
  updated_at: string;
  property: {
    id: string;
    title: string;
    neighborhood: string;
    city: string;
    state: string;
  } | null;
  reported_user: {
    id: string;
    full_name: string;
    creci: string;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; icon: typeof Clock }> = {
  pending: { label: 'Em Análise', variant: 'status-pending', icon: Clock },
  investigating: { label: 'Investigando', variant: 'status-pending', icon: AlertTriangle },
  resolved: { label: 'Resolvido', variant: 'status-active', icon: CheckCircle2 },
  dismissed: { label: 'Arquivado', variant: 'status-rejected', icon: XCircle },
};

export default function CrossingReports() {
  const { profile } = useAuth();
  const [reports, setReports] = useState<CrossingReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchReports();
    }
  }, [profile]);

  async function fetchReports() {
    const { data, error } = await supabase
      .from('crossing_reports')
      .select(`
        *,
        property:properties!crossing_reports_property_id_fkey(id, title, neighborhood, city, state),
        reported_user:profiles!crossing_reports_reported_user_id_fkey(id, full_name, creci)
      `)
      .eq('reporter_id', profile?.id)
      .order('created_at', { ascending: false });

    if (data) {
      setReports(data as unknown as CrossingReport[]);
    }
    setLoading(false);
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const Icon = config.icon;
    return (
      <Badge className={`${config.variant} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const ReportCard = ({ report }: { report: CrossingReport }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="card-interactive">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
            <div className="flex-1">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="font-medium">Denúncia de Atravessamento</span>
                </div>
                {getStatusBadge(report.status)}
              </div>

              {/* Property Info */}
              {report.property && (
                <div className="flex items-center gap-2 text-sm mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Link
                    to={`/properties/${report.property.id}`}
                    className="hover:text-primary transition-colors"
                  >
                    {report.property.title}
                  </Link>
                  <span className="text-muted-foreground">
                    - {report.property.neighborhood}, {report.property.city}
                  </span>
                </div>
              )}

              {/* Reported User */}
              {report.reported_user && (
                <div className="flex items-center gap-2 text-sm mb-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Denunciado:</span>
                  <span className="font-medium">{report.reported_user.full_name}</span>
                  <span className="text-xs text-muted-foreground">
                    (CRECI: {report.reported_user.creci})
                  </span>
                </div>
              )}

              {/* Description */}
              <div className="bg-muted p-3 rounded-lg mb-3">
                <p className="text-sm whitespace-pre-wrap">{report.description}</p>
              </div>

              {/* Evidence */}
              {report.evidence_urls && report.evidence_urls.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Evidências anexadas:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {report.evidence_urls.map((url, index) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80 transition-colors"
                      >
                        {isImage(url) ? (
                          <ImageIcon className="h-3 w-3" />
                        ) : (
                          <FileText className="h-3 w-3" />
                        )}
                        Arquivo {index + 1}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Resolution */}
              {report.resolution && (
                <div className="p-3 bg-success/10 border border-success/20 rounded-lg mb-3">
                  <p className="text-xs font-medium mb-1 text-success">Resolução:</p>
                  <p className="text-sm">{report.resolution}</p>
                </div>
              )}

              {/* Dates */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Criado em {formatDate(report.created_at)}
                </span>
                {report.updated_at !== report.created_at && (
                  <span>Atualizado em {formatDate(report.updated_at)}</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const pendingCount = reports.filter((r) => r.status === 'pending' || r.status === 'investigating').length;
  const resolvedCount = reports.filter((r) => r.status === 'resolved' || r.status === 'dismissed').length;

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            Minhas Denúncias
          </h1>
          <p className="text-muted-foreground">
            Acompanhe o status das suas denúncias de atravessamento
          </p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Em Análise</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{resolvedCount}</p>
                <p className="text-sm text-muted-foreground">Resolvidas</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array(3)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-3/4 mb-2" />
                    <Skeleton className="h-4 w-1/2 mb-4" />
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
          </div>
        ) : reports.length === 0 ? (
          <Card className="p-12 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma denúncia</h3>
            <p className="text-muted-foreground mb-4">
              Você ainda não fez nenhuma denúncia de atravessamento.
              Esperamos que nunca precise usar esta funcionalidade!
            </p>
            <Link to="/agreements">
              <Button variant="outline">Ver Meus Acordos</Button>
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
