import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Handshake, Loader2 } from 'lucide-react';
import { BRAZILIAN_STATES } from '@/lib/types';
import { z } from 'zod';
import { lovable } from '@/integrations/lovable/index';
import { Separator } from '@/components/ui/separator';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
});

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres'),
  confirmPassword: z.string(),
  full_name: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  creci: z.string().min(4, 'CRECI inválido'),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Senhas não coincidem',
  path: ['confirmPassword'],
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'signup' ? 'signup' : 'login';
  const [activeTab, setActiveTab] = useState(initialMode);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupData, setSignupData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    creci: '',
    phone: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
      });
    } else {
      toast({
        title: 'Bem-vindo de volta!',
        description: 'Login realizado com sucesso.',
      });
      navigate('/dashboard');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    try {
      signupSchema.parse(signupData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) newErrors[err.path[0] as string] = err.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setLoading(true);
    const { error } = await signUp(signupData.email, signupData.password, {
      full_name: signupData.full_name,
      creci: signupData.creci,
      phone: signupData.phone || undefined,
      city: signupData.city || undefined,
      state: signupData.state || undefined,
    });
    setLoading(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          variant: 'destructive',
          title: 'Email já cadastrado',
          description: 'Este email já está em uso. Tente fazer login.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Erro ao cadastrar',
          description: error.message,
        });
      }
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Seu cadastro foi realizado com sucesso.',
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-xl gradient-bg flex items-center justify-center mb-4">
            <Handshake className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-display">
            <span className="gradient-text">Corretor</span>Camarada
          </CardTitle>
          <CardDescription>
            Plataforma de colaboração segura entre corretores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={errors.email ? 'border-destructive' : ''}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className={errors.password ? 'border-destructive' : ''}
                  />
                  {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                </div>
                <Button type="submit" className="w-full gradient-bg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>

                <button
                  type="button"
                  className="w-full text-sm text-muted-foreground hover:text-primary transition-colors"
                  onClick={async () => {
                    const email = loginEmail.trim();
                    if (!email) {
                      toast({ variant: 'destructive', title: 'Informe seu email', description: 'Digite seu email no campo acima para recuperar a senha.' });
                      return;
                    }
                    setLoading(true);
                    const { error } = await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: `${window.location.origin}/reset-password`,
                    });
                    setLoading(false);
                    if (error) {
                      toast({ variant: 'destructive', title: 'Erro', description: error.message });
                    } else {
                      toast({ title: 'Email enviado!', description: 'Verifique sua caixa de entrada para redefinir a senha.' });
                    }
                  }}
                >
                  Esqueci minha senha
                </button>

                <div className="relative my-4">
                  <Separator />
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                    ou continue com
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={async () => {
                      await lovable.auth.signInWithOAuth('google', {
                        redirect_uri: window.location.origin,
                      });
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={loading}
                    onClick={async () => {
                      await lovable.auth.signInWithOAuth('apple', {
                        redirect_uri: window.location.origin,
                      });
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Apple
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="full_name">Nome Completo *</Label>
                    <Input
                      id="full_name"
                      placeholder="João Silva"
                      value={signupData.full_name}
                      onChange={(e) => setSignupData({ ...signupData, full_name: e.target.value })}
                      className={errors.full_name ? 'border-destructive' : ''}
                    />
                    {errors.full_name && <p className="text-xs text-destructive">{errors.full_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="creci">CRECI *</Label>
                    <Input
                      id="creci"
                      placeholder="12345-F"
                      value={signupData.creci}
                      onChange={(e) => setSignupData({ ...signupData, creci: e.target.value })}
                      className={errors.creci ? 'border-destructive' : ''}
                    />
                    {errors.creci && <p className="text-xs text-destructive">{errors.creci}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      placeholder="(11) 99999-9999"
                      value={signupData.phone}
                      onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      placeholder="São Paulo"
                      value={signupData.city}
                      onChange={(e) => setSignupData({ ...signupData, city: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Select
                      value={signupData.state}
                      onValueChange={(value) => setSignupData({ ...signupData, state: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map((state) => (
                          <SelectItem key={state} value={state}>
                            {state}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="signup-email">Email *</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={signupData.email}
                      onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                      className={errors.email ? 'border-destructive' : ''}
                    />
                    {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha *</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.password}
                      onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                      className={errors.password ? 'border-destructive' : ''}
                    />
                    {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar *</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupData.confirmPassword}
                      onChange={(e) => setSignupData({ ...signupData, confirmPassword: e.target.value })}
                      className={errors.confirmPassword ? 'border-destructive' : ''}
                    />
                    {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
                  </div>
                </div>

                <Button type="submit" className="w-full gradient-bg" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Conta
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}