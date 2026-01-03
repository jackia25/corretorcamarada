import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Building2, Lock, Eye, Loader2, ArrowLeft } from 'lucide-react';
import { PROPERTY_TYPE_LABELS, BRAZILIAN_STATES, PropertyType } from '@/lib/types';

export default function NewProperty() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    // Public data
    title: '',
    description: '',
    property_type: '' as PropertyType | '',
    neighborhood: '',
    city: '',
    state: '',
    price_range_min: '',
    price_range_max: '',
    bedrooms: '',
    bathrooms: '',
    area_m2: '',
    features: '',
    // Sensitive data
    full_address: '',
    address_number: '',
    address_complement: '',
    zip_code: '',
    owner_name: '',
    owner_phone: '',
    owner_email: '',
    internal_notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    if (!formData.title || !formData.property_type || !formData.neighborhood || !formData.city || !formData.state) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios.',
      });
      return;
    }

    if (!formData.full_address || !formData.owner_name || !formData.owner_phone) {
      toast({
        variant: 'destructive',
        title: 'Dados sensíveis obrigatórios',
        description: 'Endereço completo, nome e telefone do proprietário são obrigatórios.',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.from('properties').insert({
      owner_id: profile.id,
      title: formData.title,
      description: formData.description || null,
      property_type: formData.property_type,
      neighborhood: formData.neighborhood,
      city: formData.city,
      state: formData.state,
      price_range_min: formData.price_range_min ? parseFloat(formData.price_range_min) : null,
      price_range_max: formData.price_range_max ? parseFloat(formData.price_range_max) : null,
      bedrooms: formData.bedrooms ? parseInt(formData.bedrooms) : null,
      bathrooms: formData.bathrooms ? parseInt(formData.bathrooms) : null,
      area_m2: formData.area_m2 ? parseFloat(formData.area_m2) : null,
      features: formData.features ? formData.features.split(',').map(f => f.trim()) : null,
      full_address: formData.full_address,
      address_number: formData.address_number || null,
      address_complement: formData.address_complement || null,
      zip_code: formData.zip_code || null,
      owner_name: formData.owner_name,
      owner_phone: formData.owner_phone,
      owner_email: formData.owner_email || null,
      internal_notes: formData.internal_notes || null,
    });

    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar',
        description: error.message,
      });
    } else {
      toast({
        title: 'Imóvel cadastrado!',
        description: 'Seu imóvel foi cadastrado com sucesso.',
      });
      navigate('/properties');
    }
  };

  return (
    <Layout>
      <div className="container py-8 max-w-3xl">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Cadastrar Imóvel</h1>
          <p className="text-muted-foreground">
            Preencha os dados do imóvel. Os dados sensíveis só serão compartilhados após acordo de cooperação.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Public Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Dados Públicos
              </CardTitle>
              <CardDescription>
                Estas informações serão visíveis para todos os corretores na busca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título do Anúncio *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Apartamento 3 quartos com vista para o mar"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o imóvel..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_type">Tipo *</Label>
                  <Select
                    value={formData.property_type}
                    onValueChange={(value) => setFormData({ ...formData, property_type: value as PropertyType })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="neighborhood">Bairro *</Label>
                  <Input
                    id="neighborhood"
                    placeholder="Centro"
                    value={formData.neighborhood}
                    onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">Cidade *</Label>
                  <Input
                    id="city"
                    placeholder="São Paulo"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">Estado *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(value) => setFormData({ ...formData, state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_min">Preço Mínimo</Label>
                  <Input
                    id="price_min"
                    type="number"
                    placeholder="500000"
                    value={formData.price_range_min}
                    onChange={(e) => setFormData({ ...formData, price_range_min: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price_max">Preço Máximo</Label>
                  <Input
                    id="price_max"
                    type="number"
                    placeholder="800000"
                    value={formData.price_range_max}
                    onChange={(e) => setFormData({ ...formData, price_range_max: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bedrooms">Quartos</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    placeholder="3"
                    value={formData.bedrooms}
                    onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bathrooms">Banheiros</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    placeholder="2"
                    value={formData.bathrooms}
                    onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area_m2">Área (m²)</Label>
                  <Input
                    id="area_m2"
                    type="number"
                    placeholder="120"
                    value={formData.area_m2}
                    onChange={(e) => setFormData({ ...formData, area_m2: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="features">Características (separadas por vírgula)</Label>
                <Input
                  id="features"
                  placeholder="Piscina, Churrasqueira, Portaria 24h"
                  value={formData.features}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sensitive Data */}
          <Card className="border-warning/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5 text-warning" />
                Dados Sensíveis (Protegidos)
              </CardTitle>
              <CardDescription>
                Estas informações só serão reveladas após acordo de cooperação com outro corretor.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="full_address">Endereço Completo *</Label>
                  <Input
                    id="full_address"
                    placeholder="Rua das Flores"
                    value={formData.full_address}
                    onChange={(e) => setFormData({ ...formData, full_address: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_number">Número</Label>
                  <Input
                    id="address_number"
                    placeholder="123"
                    value={formData.address_number}
                    onChange={(e) => setFormData({ ...formData, address_number: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento</Label>
                  <Input
                    id="address_complement"
                    placeholder="Apto 101"
                    value={formData.address_complement}
                    onChange={(e) => setFormData({ ...formData, address_complement: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zip_code">CEP</Label>
                  <Input
                    id="zip_code"
                    placeholder="01234-567"
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner_name">Nome do Proprietário *</Label>
                  <Input
                    id="owner_name"
                    placeholder="José Silva"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_phone">Telefone do Proprietário *</Label>
                  <Input
                    id="owner_phone"
                    placeholder="(11) 99999-9999"
                    value={formData.owner_phone}
                    onChange={(e) => setFormData({ ...formData, owner_phone: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_email">Email do Proprietário</Label>
                  <Input
                    id="owner_email"
                    type="email"
                    placeholder="proprietario@email.com"
                    value={formData.owner_email}
                    onChange={(e) => setFormData({ ...formData, owner_email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal_notes">Notas Internas</Label>
                <Textarea
                  id="internal_notes"
                  placeholder="Observações que só você verá..."
                  value={formData.internal_notes}
                  onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/properties')}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gradient-bg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Imóvel
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}