import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  Plus, 
  Search, 
  MapPin, 
  BedDouble, 
  Bath, 
  Maximize2,
  Eye,
  Lock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Property, PROPERTY_TYPE_LABELS, PropertyType, BRAZILIAN_STATES } from '@/lib/types';
import { optimizedImageUrl } from '@/lib/imageUrl';

export default function Properties() {
  const { profile } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [myProperties, setMyProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const { toast } = useToast();

  useEffect(() => {
    fetchProperties();
  }, [profile]);

  async function fetchProperties() {
    if (!profile) return;

    const [allRes, myRes] = await Promise.all([
      supabase
        .from('properties')
        .select(`
          id, title, description, property_type, neighborhood, city, state,
          price_range_min, price_range_max, bedrooms, bathrooms, area_m2,
          features, public_photos, is_active, owner_id, created_at, updated_at,
          owner:profiles!properties_owner_id_fkey(id, full_name, creci, avatar_url)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('properties')
        .select('*')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false }),
    ]);

    if (allRes.data) setProperties(allRes.data as unknown as Property[]);
    if (myRes.data) setMyProperties(myRes.data as Property[]);
    setLoading(false);
  }

  const formatPrice = (min: number | null, max: number | null) => {
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `A partir de ${formatter.format(min)}`;
    if (max) return `Até ${formatter.format(max)}`;
    return 'Consulte';
  };

  const filterProperties = (list: Property[]) => {
    return list.filter((property) => {
      const matchesSearch = 
        property.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.neighborhood.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || property.property_type === filterType;
      const matchesState = filterState === 'all' || property.state === filterState;
      return matchesSearch && matchesType && matchesState;
    });
  };

  const PropertyCard = ({ property, isOwner = false }: { property: Property; isOwner?: boolean }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Link to={`/properties/${property.id}`}>
        <Card className="card-interactive h-full overflow-hidden">
          <div className="aspect-video bg-muted relative">
            {property.public_photos?.[0] ? (
              <img 
                src={property.public_photos[0]} 
                alt={property.title}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center ${property.public_photos?.[0] ? 'hidden' : ''}`}>
              <Building2 className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <Badge className="absolute top-3 left-3">
              {PROPERTY_TYPE_LABELS[property.property_type as PropertyType]}
            </Badge>
            {!isOwner && (
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Dados protegidos
                </Badge>
              </div>
            )}
          </div>
          <CardContent className="p-4">
            <h3 className="font-semibold text-lg line-clamp-1 mb-1">{property.title}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1 mb-3">
              <MapPin className="h-4 w-4" />
              {property.neighborhood}, {property.city} - {property.state}
            </p>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
              {property.bedrooms && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-4 w-4" />
                  {property.bedrooms}
                </span>
              )}
              {property.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="h-4 w-4" />
                  {property.bathrooms}
                </span>
              )}
              {property.area_m2 && (
                <span className="flex items-center gap-1">
                  <Maximize2 className="h-4 w-4" />
                  {property.area_m2}m²
                </span>
              )}
            </div>

            <p className="font-semibold text-lg gradient-text">
              {formatPrice(property.price_range_min, property.price_range_max)}
            </p>

            {!isOwner && property.owner && (
              <p className="text-xs text-muted-foreground mt-2">
                por {(property.owner as { full_name: string }).full_name}
              </p>
            )}
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );

  return (
    <Layout>
      <div className="container py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold">Imóveis</h1>
            <p className="text-muted-foreground">Gerencie seus imóveis e encontre oportunidades</p>
          </div>
          <Link to="/properties/new">
            <Button className="gradient-bg gap-2">
              <Plus className="h-4 w-4" />
              Cadastrar Imóvel
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por título, cidade ou bairro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Tipo de imóvel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterState} onValueChange={setFilterState}>
                <SelectTrigger className="w-full md:w-32">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="all">
          <TabsList className="mb-6">
            <TabsTrigger value="all" className="gap-2">
              <Eye className="h-4 w-4" />
              Todos os Imóveis
            </TabsTrigger>
            <TabsTrigger value="mine" className="gap-2">
              <Building2 className="h-4 w-4" />
              Meus Imóveis ({myProperties.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(6).fill(0).map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-video" />
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-3" />
                      <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filterProperties(properties).length === 0 ? (
              <Card className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Nenhum imóvel encontrado</h3>
                <p className="text-muted-foreground">
                  Tente ajustar os filtros ou aguarde novos cadastros.
                </p>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterProperties(properties).map((property) => (
                  <PropertyCard key={property.id} property={property} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="mine">
            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array(3).fill(0).map((_, i) => (
                  <Card key={i}>
                    <Skeleton className="aspect-video" />
                    <CardContent className="p-4">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : myProperties.length === 0 ? (
              <Card className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="font-semibold text-lg mb-2">Você ainda não cadastrou imóveis</h3>
                <p className="text-muted-foreground mb-4">
                  Cadastre seu primeiro imóvel para começar a receber solicitações.
                </p>
                <Link to="/properties/new">
                  <Button className="gradient-bg gap-2">
                    <Plus className="h-4 w-4" />
                    Cadastrar Primeiro Imóvel
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filterProperties(myProperties).map((property) => (
                  <PropertyCard key={property.id} property={property} isOwner />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}