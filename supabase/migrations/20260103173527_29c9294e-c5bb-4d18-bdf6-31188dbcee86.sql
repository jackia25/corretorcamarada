-- Enum para status de solicitação
CREATE TYPE public.request_status AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- Enum para status de acordo
CREATE TYPE public.agreement_status AS ENUM ('pending', 'active', 'cancelled', 'expired');

-- Enum para tipo de imóvel
CREATE TYPE public.property_type AS ENUM ('apartamento', 'casa', 'terreno', 'comercial', 'rural', 'outro');

-- Enum para roles de usuário
CREATE TYPE public.app_role AS ENUM ('admin', 'broker');

-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  creci TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de roles de usuários
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Tabela de imóveis
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados públicos
  title TEXT NOT NULL,
  description TEXT,
  property_type public.property_type NOT NULL DEFAULT 'outro',
  neighborhood TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  price_range_min DECIMAL(15,2),
  price_range_max DECIMAL(15,2),
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_m2 DECIMAL(10,2),
  features TEXT[],
  public_photos TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Dados sensíveis (só visíveis após acordo)
  full_address TEXT NOT NULL,
  address_number TEXT,
  address_complement TEXT,
  zip_code TEXT,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  owner_email TEXT,
  sensitive_photos TEXT[],
  documents TEXT[],
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de demandas de compra
CREATE TABLE public.purchase_demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  property_types public.property_type[],
  neighborhoods TEXT[],
  cities TEXT[],
  states TEXT[],
  price_min DECIMAL(15,2),
  price_max DECIMAL(15,2),
  bedrooms_min INTEGER,
  bedrooms_max INTEGER,
  area_min DECIMAL(10,2),
  area_max DECIMAL(10,2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de solicitações de acesso
CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  requester_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  message TEXT,
  status public.request_status NOT NULL DEFAULT 'pending',
  response_message TEXT,
  
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(property_id, requester_id)
);

-- Tabela de acordos de cooperação (handshake)
CREATE TABLE public.cooperation_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_request_id UUID REFERENCES public.access_requests(id) ON DELETE CASCADE NOT NULL UNIQUE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  captador_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  buyer_broker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  
  -- Termos do acordo
  captador_commission_percent DECIMAL(5,2) NOT NULL,
  buyer_broker_commission_percent DECIMAL(5,2) NOT NULL,
  terms TEXT,
  
  -- Status
  status public.agreement_status NOT NULL DEFAULT 'pending',
  captador_accepted_at TIMESTAMPTZ,
  buyer_broker_accepted_at TIMESTAMPTZ,
  
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de logs de acesso (auditoria)
CREATE TABLE public.access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  agreement_id UUID REFERENCES public.cooperation_agreements(id) ON DELETE SET NULL,
  
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de denúncias de atravessamento
CREATE TABLE public.crossing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  agreement_id UUID REFERENCES public.cooperation_agreements(id) ON DELETE SET NULL,
  
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'pending',
  resolution TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cooperation_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crossing_reports ENABLE ROW LEVEL SECURITY;

-- Função para verificar role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Função para verificar se usuário tem acordo ativo com imóvel
CREATE OR REPLACE FUNCTION public.has_active_agreement(_user_id UUID, _property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.cooperation_agreements
    WHERE property_id = _property_id
      AND buyer_broker_id = _user_id
      AND status = 'active'
  )
$$;

-- Função para criar perfil automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, creci, phone, city, state)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'creci', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'city', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'state', '')
  );
  
  -- Adicionar role padrão de broker
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'broker');
  
  RETURN NEW;
END;
$$;

-- Trigger para criar perfil em novo usuário
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_demands_updated_at BEFORE UPDATE ON public.purchase_demands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_access_requests_updated_at BEFORE UPDATE ON public.access_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_cooperation_agreements_updated_at BEFORE UPDATE ON public.cooperation_agreements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crossing_reports_updated_at BEFORE UPDATE ON public.crossing_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== RLS POLICIES ==========

-- PROFILES
CREATE POLICY "Perfis são visíveis para usuários autenticados"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Usuários podem atualizar próprio perfil"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Usuários podem ver próprias roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins podem ver todas as roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- PROPERTIES (dados públicos)
CREATE POLICY "Imóveis ativos são visíveis para autenticados"
  ON public.properties FOR SELECT TO authenticated
  USING (is_active = true OR owner_id = auth.uid());

CREATE POLICY "Corretores podem criar imóveis"
  ON public.properties FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Donos podem atualizar próprios imóveis"
  ON public.properties FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Donos podem deletar próprios imóveis"
  ON public.properties FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- PURCHASE_DEMANDS
CREATE POLICY "Demandas ativas são visíveis para autenticados"
  ON public.purchase_demands FOR SELECT TO authenticated
  USING (is_active = true OR broker_id = auth.uid());

CREATE POLICY "Corretores podem criar demandas"
  ON public.purchase_demands FOR INSERT TO authenticated
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Donos podem atualizar próprias demandas"
  ON public.purchase_demands FOR UPDATE TO authenticated
  USING (broker_id = auth.uid());

CREATE POLICY "Donos podem deletar próprias demandas"
  ON public.purchase_demands FOR DELETE TO authenticated
  USING (broker_id = auth.uid());

-- ACCESS_REQUESTS
CREATE POLICY "Usuários podem ver solicitações que enviaram ou receberam"
  ON public.access_requests FOR SELECT TO authenticated
  USING (
    requester_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.properties 
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem criar solicitações"
  ON public.access_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Donos do imóvel podem atualizar solicitações"
  ON public.access_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE id = property_id AND owner_id = auth.uid()
    )
  );

-- COOPERATION_AGREEMENTS
CREATE POLICY "Partes podem ver acordos"
  ON public.cooperation_agreements FOR SELECT TO authenticated
  USING (captador_id = auth.uid() OR buyer_broker_id = auth.uid());

CREATE POLICY "Captador pode criar acordo após aceitar solicitação"
  ON public.cooperation_agreements FOR INSERT TO authenticated
  WITH CHECK (captador_id = auth.uid());

CREATE POLICY "Partes podem atualizar acordo"
  ON public.cooperation_agreements FOR UPDATE TO authenticated
  USING (captador_id = auth.uid() OR buyer_broker_id = auth.uid());

-- ACCESS_LOGS
CREATE POLICY "Usuários podem ver logs de suas ações"
  ON public.access_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Sistema pode inserir logs"
  ON public.access_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- CROSSING_REPORTS
CREATE POLICY "Usuários podem ver denúncias que fizeram"
  ON public.crossing_reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "Usuários podem criar denúncias"
  ON public.crossing_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "Admins podem ver todas as denúncias"
  ON public.crossing_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));