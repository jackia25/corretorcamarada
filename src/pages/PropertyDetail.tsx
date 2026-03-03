import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  Building2, 
  MapPin, 
  BedDouble, 
  Bath, 
  Maximize2,
  ArrowLeft,
  Lock,
  Send,
  User,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Loader2,
  FileText
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Property, AccessRequest, CooperationAgreement, PROPERTY_TYPE_LABELS, PropertyType } from '@/lib/types';

export default function PropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<AccessRequest | null>(null);
  const [activeAgreement, setActiveAgreement] = useState<CooperationAgreement | null>(null);
  const [requestMessage, setRequestMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (id && profile) {
      fetchProperty();
    }
  }, [id, profile]);

  useEffect(() => {
    if (property?.public_photos?.length) {
      setSelectedPhoto(property.public_photos[0]);
    }
  }, [property?.id]);

  async function fetchProperty() {
    if (!id || !profile) return;

    // Fetch only public property fields - NOT sensitive data like owner contact info
    const { data: propertyData, error } = await supabase
      .from('properties')
      .select(`
        id, title, description, property_type, neighborhood, city, state,
        price_range_min, price_range_max, bedrooms, bathrooms, area_m2,
        features, public_photos, is_active, owner_id, created_at, updated_at,
        owner:profiles!properties_owner_id_fkey(id, full_name, creci, avatar_url, city, state)
      `)
      .eq('id', id)
      .single();

    if (error || !propertyData) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Imóvel não encontrado.',
      });
      navigate('/properties');
      return;
    }

    // Check existing request
    const { data: requestData } = await supabase
      .from('access_requests')
      .select('*')
      .eq('property_id', id)
      .eq('requester_id', profile.id)
      .maybeSingle();

    if (requestData) {
      setExistingRequest(requestData as AccessRequest);
    }

    // Check active agreement
    const { data: agreementData } = await supabase
      .from('cooperation_agreements')
      .select('*')
      .eq('property_id', id)
      .eq('buyer_broker_id', profile.id)
      .eq('status', 'active')
      .maybeSingle();

    if (agreementData) {
      setActiveAgreement(agreementData as CooperationAgreement);
    }

    const isUserOwner = propertyData.owner_id === profile.id;
    const hasActiveAgreement = agreementData !== null;

    // Only fetch sensitive data if user has access (owner or active agreement)
    if (isUserOwner || hasActiveAgreement) {
      const { data: sensitiveData } = await supabase
        .from('properties')
        .select('owner_name, owner_phone, owner_email, full_address, address_number, address_complement, zip_code, sensitive_photos, documents, internal_notes')
        .eq('id', id)
        .single();

      if (sensitiveData) {
        // Merge sensitive data with public data
        setProperty({
          ...propertyData,
          ...sensitiveData,
        } as unknown as Property);
      } else {
        setProperty(propertyData as unknown as Property);
      }
    } else {
      // No access to sensitive data - set null values for sensitive fields
      setProperty({
        ...propertyData,
        owner_name: null,
        owner_phone: null,
        owner_email: null,
        full_address: null,
        address_number: null,
        address_complement: null,
        zip_code: null,
        sensitive_photos: null,
        documents: null,
        internal_notes: null,
      } as unknown as Property);
    }

    setLoading(false);
  }

  const handleRequestAccess = async () => {
    if (!property || !profile) return;

    setSubmitting(true);

    const { error } = await supabase.from('access_requests').insert({
      property_id: property.id,
      requester_id: profile.id,
      message: requestMessage || null,
    });

    setSubmitting(false);
    setDialogOpen(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    } else {
      toast({
        title: 'Solicitação enviada!',
        description: 'O corretor captador receberá sua solicitação.',
      });
      fetchProperty();
    }
  };

  const formatPrice = (min: number | null, max: number | null) => {
    const formatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (min && max) return `${formatter.format(min)} - ${formatter.format(max)}`;
    if (min) return `A partir de ${formatter.format(min)}`;
    if (max) return `Até ${formatter.format(max)}`;
    return 'Consulte';
  };

  const formatDescription = (text: string) => {
    const sections = text
      .split(/\n{2,}/)
      .map((section) => section.trim())
      .filter(Boolean);

    const normalizeInline = (value: string) => value.replace(/\*\*(.*?)\*\*/g, '$1').trim();

    return (
      <div className="space-y-4">
        {sections.map((section, sectionIndex) => {
          const lines = section
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

          const bulletItems = lines
            .filter((line) => line.startsWith('- '))
            .map((line) => normalizeInline(line.replace(/^-\s*/, '')));

          const titleLine = lines.find((line) => /^\*\*.+\*\*:?$/.test(line));
          const title = titleLine ? normalizeInline(titleLine.replace(/:$/, '')) : null;

          const paragraphLines = lines.filter((line) => !line.startsWith('- ') && line !== titleLine);
          const paragraph = normalizeInline(paragraphLines.join(' '));

          return (
            <div key={`${sectionIndex}-${title ?? 'section'}`} className="rounded-lg border bg-muted/30 p-4 space-y-3">
              {title && <h3 className="font-semibold text-base">{title}</h3>}

              {paragraph && <p className="text-sm md:text-base leading-relaxed text-foreground/90">{paragraph}</p>}

              {bulletItems.length > 0 && (
                <ul className="space-y-2">
                  {bulletItems.map((item, itemIndex) => (
                    <li key={`${sectionIndex}-${itemIndex}`} className="flex items-start gap-2 text-sm md:text-base text-foreground/90">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const hasAccess = activeAgreement !== null;
  const isOwner = property?.owner_id === profile?.id;
  const photos = property.public_photos?.filter(Boolean) ?? [];

  if (loading) {
    return (
      <Layout>
        <div className="container py-8 max-w-4xl">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-64 w-full rounded-xl mb-6" />
          <Skeleton className="h-8 w-3/4 mb-4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Layout>
    );
  }

  if (!property) return null;

  return (
    <Layout>
      <div className="container py-8 max-w-4xl">
        <Button variant="ghost" className="mb-4 gap-2" onClick={() => navigate('/properties')}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Header Image + Gallery */}
          <div className="space-y-3">
            <div className="aspect-video bg-muted rounded-xl overflow-hidden relative">
              {photos[0] ? (
                <img
                  src={selectedPhoto || photos[0]}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="h-24 w-24 text-muted-foreground/50" />
                </div>
              )}
              <Badge className="absolute top-4 left-4 text-base px-4 py-2">
                {PROPERTY_TYPE_LABELS[property.property_type as PropertyType]}
              </Badge>
            </div>

            {photos.length > 1 && (
              <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                {photos.map((photo, index) => (
                  <button
                    key={`${photo}-${index}`}
                    type="button"
                    onClick={() => setSelectedPhoto(photo)}
                    className={`aspect-video overflow-hidden rounded-md border transition-all ${
                      (selectedPhoto || photos[0]) === photo ? 'border-primary ring-1 ring-primary' : 'border-border'
                    }`}
                  >
                    <img src={photo} alt={`${property.title} - foto ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              <div>
                <h1 className="text-3xl font-display font-bold mb-2">{property.title}</h1>
                <p className="text-lg text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  {property.neighborhood}, {property.city} - {property.state}
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                {property.bedrooms && (
                  <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                    <BedDouble className="h-5 w-5 text-primary" />
                    <span>{property.bedrooms} quartos</span>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                    <Bath className="h-5 w-5 text-primary" />
                    <span>{property.bathrooms} banheiros</span>
                  </div>
                )}
                {property.area_m2 && (
                  <div className="flex items-center gap-2 bg-muted px-4 py-2 rounded-lg">
                    <Maximize2 className="h-5 w-5 text-primary" />
                    <span>{property.area_m2} m²</span>
                  </div>
                )}
              </div>

              {property.description && (
                <Card>
                  <CardHeader>
                    <CardTitle>Descrição</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-wrap">{property.description}</p>
                  </CardContent>
                </Card>
              )}

              {property.features && property.features.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Características</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {property.features.map((feature, i) => (
                        <Badge key={i} variant="secondary">{feature}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Sensitive Data Section */}
              {!isOwner && (
                <Card className={hasAccess ? "border-success" : "border-amber-500/50 bg-gradient-to-br from-amber-500/5 to-transparent"}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${hasAccess ? "text-success" : "text-amber-600"}`}>
                      {hasAccess ? (
                        <>
                          <CheckCircle2 className="h-5 w-5" />
                          Dados Desbloqueados
                        </>
                      ) : (
                        <>
                          <Lock className="h-5 w-5" />
                          Informações Exclusivas
                        </>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {hasAccess 
                        ? "Você tem um acordo ativo com o corretor captador."
                        : "Dados disponíveis após acordo de cooperação com o corretor captador."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Address field */}
                    <div>
                      <Label className="text-muted-foreground flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        Endereço Completo
                      </Label>
                      {hasAccess ? (
                        <p className="font-medium mt-1">
                          {property.full_address}, {property.address_number}
                          {property.address_complement && ` - ${property.address_complement}`}
                          {property.zip_code && ` - CEP: ${property.zip_code}`}
                        </p>
                      ) : (
                        <p className="font-medium mt-1 blur-sm select-none pointer-events-none text-muted-foreground">
                          {property.neighborhood}, {property.city} - Número 000, Complemento Exemplo - CEP: 00000-000
                        </p>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Owner name field */}
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <User className="h-3 w-3" />
                          Nome do Proprietário
                        </Label>
                        {hasAccess ? (
                          <p className="font-medium mt-1">{property.owner_name}</p>
                        ) : (
                          <p className="font-medium mt-1 blur-sm select-none pointer-events-none text-muted-foreground">
                            Nome do Proprietário Exemplo
                          </p>
                        )}
                      </div>

                      {/* Phone field */}
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          Telefone do Proprietário
                        </Label>
                        {hasAccess ? (
                          <p className="font-medium mt-1">{property.owner_phone}</p>
                        ) : (
                          <p className="font-medium mt-1 blur-sm select-none pointer-events-none text-muted-foreground">
                            (00) 00000-0000
                          </p>
                        )}
                      </div>

                      {/* Email field */}
                      <div>
                        <Label className="text-muted-foreground flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          Email do Proprietário
                        </Label>
                        {hasAccess ? (
                          <p className="font-medium mt-1">{property.owner_email || "Não informado"}</p>
                        ) : (
                          <p className="font-medium mt-1 blur-sm select-none pointer-events-none text-muted-foreground">
                            email@exemplo.com.br
                          </p>
                        )}
                      </div>

                      {/* Internal notes field - only show if has access and notes exist */}
                      {hasAccess && property.internal_notes && (
                        <div className="md:col-span-2">
                          <Label className="text-muted-foreground flex items-center gap-2">
                            <FileText className="h-3 w-3" />
                            Observações Internas
                          </Label>
                          <p className="font-medium mt-1 text-sm">{property.internal_notes}</p>
                        </div>
                      )}
                    </div>

                    {/* CTA Button when no access */}
                    {!hasAccess && (
                      <div className="pt-4 border-t border-border">
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full gradient-bg gap-2" size="lg">
                              <Lock className="h-4 w-4" />
                              Solicitar Acesso aos Dados
                            </Button>
                          </DialogTrigger>
                        </Dialog>
                        <p className="text-xs text-muted-foreground text-center mt-2">
                          Após aprovação e assinatura do acordo, você terá acesso completo
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Owner view - always show real data */}
              {isOwner && (
                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Dados do Proprietário
                    </CardTitle>
                    <CardDescription>
                      Você é o corretor captador deste imóvel.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Endereço Completo</Label>
                      <p className="font-medium">
                        {property.full_address}, {property.address_number}
                        {property.address_complement && ` - ${property.address_complement}`}
                        {property.zip_code && ` - CEP: ${property.zip_code}`}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-muted-foreground">Proprietário</Label>
                        <p className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {property.owner_name}
                        </p>
                      </div>
                      <div>
                        <Label className="text-muted-foreground">Telefone</Label>
                        <p className="font-medium flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {property.owner_phone}
                        </p>
                      </div>
                      {property.owner_email && (
                        <div>
                          <Label className="text-muted-foreground">Email</Label>
                          <p className="font-medium flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {property.owner_email}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <p className="text-3xl font-bold gradient-text mb-4">
                    {formatPrice(property.price_range_min, property.price_range_max)}
                  </p>

                  {!isOwner && (
                    <>
                      {hasAccess ? (
                        <div className="p-4 bg-success/10 rounded-lg text-center">
                          <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
                          <p className="font-semibold text-success">Acesso Liberado</p>
                          <p className="text-sm text-muted-foreground">
                            Você pode ver os dados sensíveis
                          </p>
                        </div>
                      ) : existingRequest ? (
                        <div className="p-4 bg-warning/10 rounded-lg text-center">
                          <Clock className="h-8 w-8 text-warning mx-auto mb-2" />
                          <p className="font-semibold text-warning">
                            {existingRequest.status === 'pending' ? 'Solicitação Pendente' : 
                             existingRequest.status === 'rejected' ? 'Solicitação Recusada' : 'Expirada'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {existingRequest.status === 'pending' 
                              ? 'Aguardando resposta do captador'
                              : existingRequest.status === 'accepted'
                              ? 'Aguardando acordo de cooperação'
                              : 'Sua solicitação foi recusada'}
                          </p>
                        </div>
                      ) : (
                        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                          <DialogTrigger asChild>
                            <Button className="w-full gradient-bg gap-2" size="lg">
                              <Lock className="h-4 w-4" />
                              Solicitar Acesso
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Solicitar Acesso ao Imóvel</DialogTitle>
                              <DialogDescription>
                                Envie uma mensagem ao corretor captador explicando seu interesse.
                                Os dados sensíveis só serão liberados após acordo de cooperação.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Mensagem (opcional)</Label>
                                <Textarea
                                  placeholder="Tenho um cliente interessado em imóveis nesta região..."
                                  value={requestMessage}
                                  onChange={(e) => setRequestMessage(e.target.value)}
                                  rows={4}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancelar
                              </Button>
                              <Button 
                                className="gradient-bg gap-2" 
                                onClick={handleRequestAccess}
                                disabled={submitting}
                              >
                                {submitting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                                Enviar Solicitação
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Broker Info */}
              {property.owner && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Corretor Captador</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full gradient-bg flex items-center justify-center text-primary-foreground font-semibold">
                        {(property.owner as { full_name: string }).full_name?.charAt(0) || 'C'}
                      </div>
                      <div>
                        <p className="font-medium">{(property.owner as { full_name: string }).full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          CRECI: {(property.owner as { creci: string }).creci}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!hasAccess && !isOwner && (
                <Card className="bg-muted/50">
                  <CardContent className="pt-6 text-center">
                    <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Endereço e contatos do proprietário protegidos até acordo de cooperação.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}