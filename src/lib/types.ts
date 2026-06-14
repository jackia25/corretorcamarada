export type RequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired';
export type AgreementStatus = 'pending' | 'active' | 'cancelled' | 'expired';
export type PropertyType = 'apartamento' | 'casa' | 'terreno' | 'comercial' | 'rural' | 'outro';
export type AppRole = 'admin' | 'broker';

export interface Profile {
  id: string;
  full_name: string;
  creci: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  avatar_url: string | null;
  bio: string | null;
  code_prefix: string | null;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  property_type: PropertyType;
  neighborhood: string;
  city: string;
  state: string;
  price_range_min: number | null;
  price_range_max: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number | null;
  features: string[] | null;
  public_photos: string[] | null;
  is_active: boolean;
  // Dados sensíveis
  full_address: string;
  address_number: string | null;
  address_complement: string | null;
  zip_code: string | null;
  owner_name: string;
  owner_phone: string;
  owner_email: string | null;
  sensitive_photos: string[] | null;
  documents: string[] | null;
  internal_notes: string | null;
  // Campos estendidos (paridade Houzez)
  suites?: number | null;
  land_area_m2?: number | null;
  garage_spaces?: number | null;
  year_built?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  listing_status?: string | null;
  price_label?: string | null;
  labels?: string[] | null;
  featured_photo?: string | null;
  video_url?: string | null;
  virtual_tour_url?: string | null;
  external_code?: string | null;
  extra_costs?: Record<string, unknown> | null;
  source_published_at?: string | null;
  source_url?: string | null;
  source_id?: string | null;
  source_payload?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  // Joined data
  owner?: Profile;
}

export interface PublicProperty extends Omit<Property, 
  'full_address' | 'address_number' | 'address_complement' | 'zip_code' | 
  'owner_name' | 'owner_phone' | 'owner_email' | 'sensitive_photos' | 
  'documents' | 'internal_notes'
> {
  has_access?: boolean;
}

export interface PurchaseDemand {
  id: string;
  broker_id: string;
  title: string;
  description: string | null;
  property_types: PropertyType[] | null;
  neighborhoods: string[] | null;
  cities: string[] | null;
  states: string[] | null;
  price_min: number | null;
  price_max: number | null;
  bedrooms_min: number | null;
  bedrooms_max: number | null;
  area_min: number | null;
  area_max: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  broker?: Profile;
}

export interface AccessRequest {
  id: string;
  property_id: string;
  requester_id: string;
  message: string | null;
  status: RequestStatus;
  response_message: string | null;
  expires_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  property?: Property;
  requester?: Profile;
}

export interface CooperationAgreement {
  id: string;
  access_request_id: string;
  property_id: string;
  captador_id: string;
  buyer_broker_id: string;
  captador_commission_percent: number;
  buyer_broker_commission_percent: number;
  terms: string | null;
  status: AgreementStatus;
  captador_accepted_at: string | null;
  buyer_broker_accepted_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
  property?: Property;
  captador?: Profile;
  buyer_broker?: Profile;
}

export interface AccessLog {
  id: string;
  user_id: string | null;
  property_id: string | null;
  agreement_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface CrossingReport {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  property_id: string | null;
  agreement_id: string | null;
  description: string;
  evidence_urls: string[] | null;
  status: string;
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartamento: 'Apartamento',
  casa: 'Casa',
  terreno: 'Terreno',
  comercial: 'Comercial',
  rural: 'Rural',
  outro: 'Outro',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pendente',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
};

export const AGREEMENT_STATUS_LABELS: Record<AgreementStatus, string> = {
  pending: 'Pendente',
  active: 'Ativo',
  cancelled: 'Cancelado',
  expired: 'Expirado',
};

export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;