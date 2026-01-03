import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Plus, 
  FileSearch,
  MapPin,
  DollarSign,
  BedDouble,
  Maximize2,
  Edit,
  Trash2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PurchaseDemand, PROPERTY_TYPE_LABELS, PropertyType } from '@/lib/types';

export default function Demands() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [demands, setDemands] = useState<PurchaseDemand[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDemands();
    }
  }, [profile]);

  async function fetchDemands() {
    if (!profile) return;

    const { data, error } = await supabase
      .from('purchase_demands')
      .select('*')
      .eq('broker_id', profile.id)
      .order('created_at', { ascending: false });

    if (data) setDemands(data as PurchaseDemand[]);
    setLoading(false);
  }

  const formatPrice = (min: number | null, max: number | null) => {
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `A partir de ${formatter.format(min)}`;
    if (max) return `Até ${formatter.format(max)}`;
    return 'Não informado';
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('purchase_demands')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Demanda excluída' });
      fetchDemands();
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Demandas de Compra</h1>
            <p className="text-muted-foreground">Cadastre o que seus clientes estão buscando</p>
          </div>
          <Link to="/demands/new">
            <Button className="gradient-bg gap-2">
              <Plus className="h-4 w-4" />
              Nova Demanda
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-2 gap-6">
            {Array(4).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-4" />
                  <Skeleton className="h-4 w-1/2 mb-2" />
                  <Skeleton className="h-4 w-1/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : demands.length === 0 ? (
          <Card className="p-12 text-center">
            <FileSearch className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">Nenhuma demanda cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Cadastre demandas de compra para encontrar imóveis para seus clientes.
            </p>
            <Link to="/demands/new">
              <Button className="gradient-bg gap-2">
                <Plus className="h-4 w-4" />
                Cadastrar Primeira Demanda
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {demands.map((demand, index) => (
              <motion.div
                key={demand.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="card-interactive h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-semibold text-lg mb-1">{demand.title}</h3>
                        <Badge variant={demand.is_active ? 'default' : 'secondary'}>
                          {demand.is_active ? 'Ativa' : 'Inativa'}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Link to={`/demands/${demand.id}/edit`}>
                          <Button variant="ghost" size="icon">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDelete(demand.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {demand.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                        {demand.description}
                      </p>
                    )}

                    <div className="space-y-2 text-sm">
                      {demand.property_types && demand.property_types.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {demand.property_types.map((type) => (
                            <Badge key={type} variant="outline" className="text-xs">
                              {PROPERTY_TYPE_LABELS[type as PropertyType]}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {(demand.cities || demand.neighborhoods) && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {demand.neighborhoods?.join(', ') || demand.cities?.join(', ') || 'Qualquer local'}
                          {demand.states && ` - ${demand.states.join(', ')}`}
                        </p>
                      )}

                      <p className="flex items-center gap-2 text-muted-foreground">
                        <DollarSign className="h-4 w-4" />
                        {formatPrice(demand.price_min, demand.price_max)}
                      </p>

                      {(demand.bedrooms_min || demand.bedrooms_max) && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <BedDouble className="h-4 w-4" />
                          {demand.bedrooms_min && demand.bedrooms_max 
                            ? `${demand.bedrooms_min} a ${demand.bedrooms_max} quartos`
                            : demand.bedrooms_min 
                            ? `Mín. ${demand.bedrooms_min} quartos`
                            : `Máx. ${demand.bedrooms_max} quartos`}
                        </p>
                      )}

                      {(demand.area_min || demand.area_max) && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                          <Maximize2 className="h-4 w-4" />
                          {demand.area_min && demand.area_max 
                            ? `${demand.area_min} a ${demand.area_max} m²`
                            : demand.area_min 
                            ? `Mín. ${demand.area_min} m²`
                            : `Máx. ${demand.area_max} m²`}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}