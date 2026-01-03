import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FileSearch, Loader2, ArrowLeft } from 'lucide-react';
import { PROPERTY_TYPE_LABELS, BRAZILIAN_STATES, PropertyType } from '@/lib/types';
import { demandSchema } from '@/lib/validations';

export default function NewDemand() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    property_types: [] as PropertyType[],
    neighborhoods: '',
    cities: '',
    states: [] as string[],
    price_min: '',
    price_max: '',
    bedrooms_min: '',
    bedrooms_max: '',
    area_min: '',
    area_max: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validate with Zod schema
    const result = demandSchema.safeParse(formData);
    
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

    const { error } = await supabase.from('purchase_demands').insert({
      broker_id: profile.id,
      title: validData.title,
      description: validData.description || null,
      property_types: validData.property_types && validData.property_types.length > 0 ? validData.property_types : null,
      neighborhoods: validData.neighborhoods ? validData.neighborhoods.split(',').map(n => n.trim()).filter(Boolean) : null,
      cities: validData.cities ? validData.cities.split(',').map(c => c.trim()).filter(Boolean) : null,
      states: validData.states && validData.states.length > 0 ? validData.states : null,
      price_min: validData.price_min ? parseFloat(validData.price_min) : null,
      price_max: validData.price_max ? parseFloat(validData.price_max) : null,
      bedrooms_min: validData.bedrooms_min ? parseInt(validData.bedrooms_min) : null,
      bedrooms_max: validData.bedrooms_max ? parseInt(validData.bedrooms_max) : null,
      area_min: validData.area_min ? parseFloat(validData.area_min) : null,
      area_max: validData.area_max ? parseFloat(validData.area_max) : null,
    });

    setLoading(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Demanda cadastrada!', description: 'Sua demanda foi criada com sucesso.' });
      navigate('/demands');
    }
  };

  const togglePropertyType = (type: PropertyType) => {
    setFormData({
      ...formData,
      property_types: formData.property_types.includes(type)
        ? formData.property_types.filter(t => t !== type)
        : [...formData.property_types, type],
    });
  };

  const toggleState = (state: string) => {
    setFormData({
      ...formData,
      states: formData.states.includes(state)
        ? formData.states.filter(s => s !== state)
        : [...formData.states, state],
    });
  };

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate('/demands')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">Nova Demanda de Compra</h1>
          <p className="text-muted-foreground">
            Descreva o que seu cliente está buscando.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSearch className="h-5 w-5 text-primary" />
                Informações da Demanda
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Cliente busca apartamento 3 quartos na Zona Sul"
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
                  placeholder="Detalhes adicionais sobre a busca..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  maxLength={2000}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description}</p>}
              </div>

              <div className="space-y-2">
                <Label>Tipos de Imóvel</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        formData.property_types.includes(value as PropertyType)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={formData.property_types.includes(value as PropertyType)}
                        onCheckedChange={() => togglePropertyType(value as PropertyType)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cities">Cidades (vírgula)</Label>
                  <Input
                    id="cities"
                    placeholder="São Paulo, Campinas"
                    value={formData.cities}
                    onChange={(e) => setFormData({ ...formData, cities: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="neighborhoods">Bairros (vírgula)</Label>
                  <Input
                    id="neighborhoods"
                    placeholder="Pinheiros, Moema"
                    value={formData.neighborhoods}
                    onChange={(e) => setFormData({ ...formData, neighborhoods: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Estados</Label>
                <div className="flex flex-wrap gap-1">
                  {BRAZILIAN_STATES.map((state) => (
                    <label
                      key={state}
                      className={`flex items-center gap-1 px-2 py-1 rounded border cursor-pointer text-sm transition-colors ${
                        formData.states.includes(state)
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <Checkbox
                        checked={formData.states.includes(state)}
                        onCheckedChange={() => toggleState(state)}
                        className="h-3 w-3"
                      />
                      {state}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price_min">Preço Mínimo</Label>
                  <Input
                    id="price_min"
                    type="number"
                    placeholder="300000"
                    value={formData.price_min}
                    onChange={(e) => setFormData({ ...formData, price_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price_max">Preço Máximo</Label>
                  <Input
                    id="price_max"
                    type="number"
                    placeholder="800000"
                    value={formData.price_max}
                    onChange={(e) => setFormData({ ...formData, price_max: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms_min">Quartos (mín)</Label>
                  <Input
                    id="bedrooms_min"
                    type="number"
                    placeholder="2"
                    value={formData.bedrooms_min}
                    onChange={(e) => setFormData({ ...formData, bedrooms_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedrooms_max">Quartos (máx)</Label>
                  <Input
                    id="bedrooms_max"
                    type="number"
                    placeholder="4"
                    value={formData.bedrooms_max}
                    onChange={(e) => setFormData({ ...formData, bedrooms_max: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="area_min">Área mín (m²)</Label>
                  <Input
                    id="area_min"
                    type="number"
                    placeholder="80"
                    value={formData.area_min}
                    onChange={(e) => setFormData({ ...formData, area_min: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="area_max">Área máx (m²)</Label>
                  <Input
                    id="area_max"
                    type="number"
                    placeholder="150"
                    value={formData.area_max}
                    onChange={(e) => setFormData({ ...formData, area_max: e.target.value })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/demands')}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 gradient-bg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Demanda
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  );
}