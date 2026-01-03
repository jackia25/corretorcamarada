import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Building2, 
  FileSearch, 
  Handshake, 
  Clock, 
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { motion } from 'framer-motion';

interface DashboardStats {
  myProperties: number;
  myDemands: number;
  pendingRequests: number;
  activeAgreements: number;
  sentRequests: number;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!profile) return;

      const [
        propertiesRes,
        demandsRes,
        receivedRequestsRes,
        sentRequestsRes,
        agreementsRes,
      ] = await Promise.all([
        supabase.from('properties').select('id', { count: 'exact' }).eq('owner_id', profile.id),
        supabase.from('purchase_demands').select('id', { count: 'exact' }).eq('broker_id', profile.id),
        supabase.from('access_requests').select('id, property_id, properties!inner(owner_id)', { count: 'exact' })
          .eq('status', 'pending')
          .eq('properties.owner_id', profile.id),
        supabase.from('access_requests').select('id', { count: 'exact' }).eq('requester_id', profile.id),
        supabase.from('cooperation_agreements').select('id', { count: 'exact' })
          .eq('status', 'active')
          .or(`captador_id.eq.${profile.id},buyer_broker_id.eq.${profile.id}`),
      ]);

      setStats({
        myProperties: propertiesRes.count || 0,
        myDemands: demandsRes.count || 0,
        pendingRequests: receivedRequestsRes.count || 0,
        activeAgreements: agreementsRes.count || 0,
        sentRequests: sentRequestsRes.count || 0,
      });
      setLoading(false);
    }

    fetchStats();
  }, [profile]);

  const statCards = [
    {
      title: 'Meus Imóveis',
      value: stats?.myProperties || 0,
      icon: Building2,
      href: '/properties',
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Minhas Demandas',
      value: stats?.myDemands || 0,
      icon: FileSearch,
      href: '/demands',
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Solicitações Pendentes',
      value: stats?.pendingRequests || 0,
      icon: Clock,
      href: '/requests',
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      highlight: (stats?.pendingRequests || 0) > 0,
    },
    {
      title: 'Acordos Ativos',
      value: stats?.activeAgreements || 0,
      icon: Handshake,
      href: '/agreements',
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  const quickActions = [
    {
      title: 'Cadastrar Imóvel',
      description: 'Adicione um novo imóvel ao seu portfólio',
      icon: Building2,
      href: '/properties/new',
      gradient: true,
    },
    {
      title: 'Nova Demanda',
      description: 'Cadastre uma demanda de compra',
      icon: FileSearch,
      href: '/demands/new',
    },
    {
      title: 'Buscar Imóveis',
      description: 'Encontre imóveis para seus clientes',
      icon: TrendingUp,
      href: '/properties',
    },
  ];

  return (
    <Layout>
      <div className="container py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold mb-2">
            Olá, {profile?.full_name?.split(' ')[0] || 'Corretor'}! 👋
          </h1>
          <p className="text-muted-foreground">
            Aqui está o resumo da sua atividade na plataforma.
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {loading ? (
            Array(4).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-12 w-12 rounded-lg mb-4" />
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))
          ) : (
            statCards.map((stat, index) => (
              <motion.div
                key={stat.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link to={stat.href}>
                  <Card className={`card-interactive ${stat.highlight ? 'ring-2 ring-warning' : ''}`}>
                    <CardContent className="p-6">
                      <div className={`h-12 w-12 rounded-lg ${stat.bgColor} flex items-center justify-center mb-4`}>
                        <stat.icon className={`h-6 w-6 ${stat.color}`} />
                      </div>
                      <p className="text-3xl font-bold mb-1">{stat.value}</p>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        {stat.title}
                        {stat.highlight && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                            Novo
                          </Badge>
                        )}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))
          )}
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-xl font-semibold mb-4">Ações Rápidas</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <Link key={action.title} to={action.href}>
                <Card className={`card-interactive h-full ${action.gradient ? 'gradient-border' : ''}`}>
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className={`h-12 w-12 rounded-lg ${action.gradient ? 'gradient-bg' : 'bg-muted'} flex items-center justify-center mb-4`}>
                      <action.icon className={`h-6 w-6 ${action.gradient ? 'text-primary-foreground' : 'text-foreground'}`} />
                    </div>
                    <h3 className="font-semibold mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground flex-1">{action.description}</p>
                    <div className="flex items-center gap-2 mt-4 text-primary text-sm font-medium">
                      Acessar
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Tips Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8"
        >
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Dica de Segurança
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Lembre-se: os dados sensíveis dos seus imóveis (endereço completo, contato do proprietário) 
                só são compartilhados após você aceitar uma solicitação de acesso e ambas as partes 
                concordarem com o acordo de cooperação. Isso protege você contra atravessamentos.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}