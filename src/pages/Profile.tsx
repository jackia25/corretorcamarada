import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User } from 'lucide-react';
import { BRAZILIAN_STATES } from '@/lib/types';

export default function Profile() {
  const { profile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [creci, setCreci] = useState(profile?.creci || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [city, setCity] = useState(profile?.city || '');
  const [state, setState] = useState(profile?.state || '');
  const [bio, setBio] = useState(profile?.bio || '');

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        creci,
        phone: phone || null,
        city: city || null,
        state: state || null,
        bio: bio || null,
      })
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } else {
      toast({ title: 'Perfil atualizado!' });
      refreshProfile?.();
    }
  };

  if (!profile) return null;

  return (
    <Layout>
      <div className="container py-8 max-w-2xl">
        <h1 className="text-3xl font-display font-bold mb-6">Meu Perfil</h1>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full gradient-bg flex items-center justify-center text-primary-foreground text-2xl font-bold">
                {fullName?.charAt(0) || 'U'}
              </div>
              <div>
                <CardTitle>{fullName}</CardTitle>
                <CardDescription>CRECI: {creci}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome Completo</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CRECI</Label>
                <Input value={creci} onChange={(e) => setCreci(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={state} onValueChange={setState}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Fale um pouco sobre você..." rows={3} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="gradient-bg gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
