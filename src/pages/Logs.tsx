import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  ClipboardList, 
  Eye,
  Handshake,
  FileText,
  AlertTriangle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { AccessLog } from '@/lib/types';

const ACTION_LABELS: Record<string, { label: string; icon: typeof Eye; color: string }> = {
  agreement_activated: { label: 'Acordo ativado', icon: Handshake, color: 'text-success' },
  property_viewed: { label: 'Imóvel visualizado', icon: Eye, color: 'text-primary' },
  sensitive_data_accessed: { label: 'Dados sensíveis acessados', icon: FileText, color: 'text-warning' },
  crossing_report: { label: 'Denúncia registrada', icon: AlertTriangle, color: 'text-destructive' },
};

interface LogWithDetails extends AccessLog {
  property?: {
    id: string;
    title: string;
  };
}

export default function Logs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<LogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchLogs();
    }
  }, [profile]);

  async function fetchLogs() {
    if (!profile) return;

    const { data, error } = await supabase
      .from('access_logs')
      .select(`
        *,
        property:properties!access_logs_property_id_fkey(id, title)
      `)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) setLogs(data as LogWithDetails[]);
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

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Histórico de Acessos</h1>
          <p className="text-muted-foreground">
            Registro de todas as suas atividades na plataforma
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array(5).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <Card className="p-12 text-center">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhum registro ainda</h3>
            <p className="text-muted-foreground">
              Suas atividades na plataforma serão registradas aqui para auditoria.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {logs.map((log, index) => {
              const actionConfig = ACTION_LABELS[log.action] || { 
                label: log.action, 
                icon: ClipboardList, 
                color: 'text-muted-foreground' 
              };
              const Icon = actionConfig.icon;

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${actionConfig.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{actionConfig.label}</p>
                        {log.property && (
                          <p className="text-sm text-muted-foreground">
                            Imóvel: {log.property.title}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}