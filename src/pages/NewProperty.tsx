import { useState, useEffect } from 'react';
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
import { Lock, Eye, Loader2, ArrowLeft, Camera, Video } from 'lucide-react';
import { PROPERTY_TYPE_LABELS, BRAZILIAN_STATES, PropertyType } from '@/lib/types';
import { propertySchema } from '@/lib/validations';
import { ImageUpload } from '@/components/property/ImageUpload';
import { VideoUpload } from '@/components/property/VideoUpload';
import { generateNextCode } from '@/lib/propertyCode';

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
    land_area_m2: '',
    suites: '',
    garage_spaces: '',
    external_code: '',
    condominium: '',
    iptu: '',
    condo_value: '',
    video_url: '',
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

  const [publicPhotos, setPublicPhotos] = useState<string[]>([]);
  const [sensitivePhotos, setSensitivePhotos] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sugere automaticamente o próximo código com a sigla do corretor (ex.: A01)
  useEffect(() => {
    if (profile?.code_prefix) {
      generateNextCode(profile.id, profile.code_prefix).then((code) => {
        if (code) setFormData((prev) => (prev.external_code ? prev : { ...prev, external_code: code }));
      });
    }
  }, [profile?.id, profile?.code_prefix]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validate with Zod schema
    const result = propertySchema.safeParse(formData);
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      toast({
        variant: 'destructive',
        title: 'Erro de validação',
        description: result.error.errors[0]?.message || 'Verifique os campos do formulário.',
      });
      return;
    }

    setErrors({});
    setLoading(true);

    const validData = result.data;

    const extraCosts: Record<string, unknown> = {};
    if (validData.iptu) extraCosts.iptu = parseFloat(validData.iptu);
    if (validData.condo_value) extraCosts.condominio = parseFloat(validData.condo_value);
    if (validData.condominium) extraCosts.condo_name = validData.condominium;

    const { error } = await supabase.from('properties').insert({
      owner_id: profile.id,
      title: validData.title,
      description: validData.description || null,
      property_type: validData.property_type,
      neighborhood: validData.neighborhood,
      city: validData.city,
      state: validData.state,
      price_range_min: validData.price_range_min ? parseFloat(validData.price_range_min) : null,
      price_range_max: validData.price_range_max ? parseFloat(validData.price_range_max) : null,
      bedrooms: validData.bedrooms ? parseInt(validData.bedrooms) : null,
      bathrooms: validData.bathrooms ? parseInt(validData.bathrooms) : null,
      area_m2: validData.area_m2 ? parseFloat(validData.area_m2) : null,
      land_area_m2: validData.land_area_m2 ? parseFloat(validData.land_area_m2) : null,
      suites: validData.suites ? parseInt(validData.suites) : null,
      garage_spaces: validData.garage_spaces ? parseInt(validData.garage_spaces) : null,
      external_code: validData.external_code || null,
      video_url: validData.video_url || null,
      extra_costs: Object.keys(extraCosts).length > 0 ? extraCosts : null,
      features: validData.features ? validData.features.split(',').map(f => f.trim()).filter(Boolean) : null,
      public_photos: publicPhotos.length > 0 ? publicPhotos : null,
      full_address: validData.full_address,
      address_number: validData.address_number || null,
      address_complement: validData.address_complement || null,
      zip_code: validData.zip_code || null,
      owner_name: validData.owner_name,
      owner_phone: validData.owner_phone,
      owner_email: validData.owner_email || null,
      internal_notes: validData.internal_notes || null,
      sensitive_photos: sensitivePhotos.length > 0 ? sensitivePhotos : null,
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
                  className={errors.title ? 'border-destructive' : ''}
                  maxLength={200}
                />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva o imóvel..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  maxLength={2000}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
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

              <Separator />

              {/* Public Photos Upload */}
              {profile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Camera className="h-5 w-5 text-primary" />
                    <span className="font-medium">Fotos Públicas</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Estas fotos serão visíveis para todos os corretores. A primeira foto será a capa do anúncio.
                  </p>
                  <ImageUpload
                    userId={profile.id}
                    images={publicPhotos}
                    onImagesChange={setPublicPhotos}
                    maxImages={10}
                    label="Fotos do Imóvel (Públicas)"
                  />
                </div>
              )}
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

              <Separator />

              {/* Sensitive Photos Upload */}
              {profile && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="h-5 w-5 text-warning" />
                    <span className="font-medium">Fotos Sensíveis (Protegidas)</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Estas fotos só serão reveladas após acordo de cooperação. Use para documentos, detalhes internos, etc.
                  </p>
                  <ImageUpload
                    userId={profile.id}
                    images={sensitivePhotos}
                    onImagesChange={setSensitivePhotos}
                    maxImages={10}
                    label="Fotos Sensíveis"
                    isSensitive
                  />
                </div>
              )}
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