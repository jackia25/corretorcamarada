import { useState, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, CheckCircle, AlertCircle, Download } from 'lucide-react';

export default function ImportProperties() {
  const [step, setStep] = useState<'idle' | 'mapping' | 'importing' | 'done'>('idle');
  const [urls, setUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const stopRef = useRef(false);
  const { toast } = useToast();

  const BATCH_SIZE = 3;

  const handleMap = async () => {
    setStep('mapping');
    try {
      const { data, error } = await supabase.functions.invoke('import-properties', {
        body: { action: 'map' },
      });
      if (error) throw error;
      setUrls(data.urls || []);
      toast({ title: `${data.count} imóveis encontrados!`, description: 'Clique em "Importar" para iniciar.' });
      setStep('idle');
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao mapear', description: e.message });
      setStep('idle');
    }
  };

  const handleImport = async () => {
    setStep('importing');
    stopRef.current = false;
    let totalImported = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      if (stopRef.current) break;

      const batch = urls.slice(i, i + BATCH_SIZE);
      try {
        const { data, error } = await supabase.functions.invoke('import-properties', {
          body: { action: 'import', urls: batch },
        });
        if (error) throw error;
        totalImported += data.imported || 0;
        if (data.errors?.length) allErrors.push(...data.errors);
      } catch (e: any) {
        allErrors.push(`Batch error: ${e.message}`);
      }

      setImported(totalImported);
      setErrors(allErrors);
      setProgress(Math.min(100, Math.round(((i + BATCH_SIZE) / urls.length) * 100)));

      // Small delay between batches
      await new Promise(r => setTimeout(r, 1000));
    }

    setStep('done');
    toast({
      title: 'Importação concluída!',
      description: `${totalImported} imóveis importados. ${allErrors.length} erros.`,
    });
  };

  const handleStop = () => {
    stopRef.current = true;
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-display font-bold">Importar Imóveis</h1>
        <p className="text-muted-foreground">
          Importe imóveis automaticamente do site lemosproperties.com.br
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Passo 1: Mapear imóveis</CardTitle>
            <CardDescription>Buscar todas as URLs de imóveis no site</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleMap} disabled={step === 'mapping' || step === 'importing'}>
              {step === 'mapping' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mapeando...</>
              ) : (
                <><Download className="mr-2 h-4 w-4" /> Mapear Imóveis</>
              )}
            </Button>
            {urls.length > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                ✅ {urls.length} imóveis encontrados
              </p>
            )}
          </CardContent>
        </Card>

        {urls.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Passo 2: Importar</CardTitle>
              <CardDescription>
                Importar {urls.length} imóveis em lotes de {BATCH_SIZE} (pode levar alguns minutos)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={handleImport}
                  disabled={step === 'importing' || step === 'done'}
                  className="gradient-bg"
                >
                  {step === 'importing' ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
                  ) : (
                    <><Play className="mr-2 h-4 w-4" /> Iniciar Importação</>
                  )}
                </Button>
                {step === 'importing' && (
                  <Button variant="outline" onClick={handleStop}>Parar</Button>
                )}
              </div>

              {(step === 'importing' || step === 'done') && (
                <>
                  <Progress value={progress} className="h-3" />
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {imported} importados
                    </span>
                    {errors.length > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4 text-destructive" />
                        {errors.length} erros
                      </span>
                    )}
                    <span>{progress}%</span>
                  </div>
                </>
              )}

              {errors.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-destructive">Ver erros</summary>
                  <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                    {errors.map((e, i) => <li key={i} className="text-muted-foreground">{e}</li>)}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>
        )}

        {step === 'done' && (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-2" />
              <h3 className="text-lg font-semibold">Importação concluída!</h3>
              <p className="text-muted-foreground">
                {imported} imóveis foram importados com sucesso.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
