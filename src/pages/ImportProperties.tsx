import { useState, useRef } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, CheckCircle, AlertCircle, Download, RefreshCw, FlaskConical, FileSpreadsheet, ClipboardCheck } from 'lucide-react';
import { parseAndNormalize, buildReportCsv, type AuditResult, type AuditItem } from '@/lib/houzezAudit';

export default function ImportProperties() {
  const [step, setStep] = useState<'idle' | 'mapping' | 'importing' | 'done'>('idle');
  const [urls, setUrls] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [imported, setImported] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const stopRef = useRef(false);
  const { toast } = useToast();

  // Re-sync state
  const [resyncStep, setResyncStep] = useState<'idle' | 'running' | 'done'>('idle');
  const [resyncProgress, setResyncProgress] = useState(0);
  const [resyncUpdated, setResyncUpdated] = useState(0);
  const [resyncCompared, setResyncCompared] = useState(0);
  const [resyncErrors, setResyncErrors] = useState<string[]>([]);
  const [resyncSample, setResyncSample] = useState<Record<string, unknown>[]>([]);
  const resyncStopRef = useRef(false);

  // Audit (Houzez CSV/Excel) state
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditFilter, setAuditFilter] = useState<'all' | 'divergent' | 'missing' | 'ok'>('all');
  const [auditFileName, setAuditFileName] = useState('');
  const auditInputRef = useRef<HTMLInputElement>(null);

  const BATCH_SIZE = 3;
  const RESYNC_BATCH = 4;

  const handleAuditFile = async (file: File | null) => {
    if (!file) return;
    setAuditLoading(true);
    setAuditResult(null);
    setAuditFileName(file.name);
    try {
      const rows = await parseAndNormalize(file);
      if (rows.length === 0) {
        toast({ variant: 'destructive', title: 'Planilha vazia', description: 'Não encontrei linhas de imóveis no arquivo.' });
        setAuditLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke('audit-houzez', { body: { rows } });
      if (error) throw error;
      setAuditResult(data as AuditResult);
      const s = (data as AuditResult).summary;
      toast({
        title: 'Auditoria concluída',
        description: `${s.ok} OK · ${s.divergent} divergentes · ${s.missing} faltando · ${s.extra} extras.`,
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro na auditoria', description: e.message });
    } finally {
      setAuditLoading(false);
    }
  };

  const downloadAuditReport = () => {
    if (!auditResult) return;
    const csv = '\uFEFF' + buildReportCsv(auditResult);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `auditoria-lemos-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


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

  const runResync = async (dryRun: boolean) => {
    setResyncStep('running');
    resyncStopRef.current = false;
    setResyncProgress(0);
    setResyncUpdated(0);
    setResyncCompared(0);
    setResyncErrors([]);
    setResyncSample([]);

    // Total de imóveis com link de origem
    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .not('source_url', 'is', null);

    const total = count || 0;
    if (total === 0) {
      toast({ variant: 'destructive', title: 'Nada para sincronizar', description: 'Nenhum imóvel com link de origem.' });
      setResyncStep('idle');
      return;
    }

    let compared = 0;
    let updated = 0;
    const allErrors: string[] = [];
    const allSamples: Record<string, unknown>[] = [];

    for (let offset = 0; offset < total; offset += RESYNC_BATCH) {
      if (resyncStopRef.current) break;
      try {
        const { data, error } = await supabase.functions.invoke('import-properties', {
          body: { action: 'resync', dryRun, limit: RESYNC_BATCH, offset },
        });
        if (error) throw error;
        compared += data.compared || 0;
        updated += data.updated || 0;
        if (data.errors?.length) allErrors.push(...data.errors);
        if (data.sample?.length && allSamples.length < 30) allSamples.push(...data.sample);
      } catch (e: any) {
        allErrors.push(`Lote ${offset}: ${e.message}`);
      }

      setResyncCompared(compared);
      setResyncUpdated(updated);
      setResyncErrors(allErrors);
      setResyncSample(allSamples);
      setResyncProgress(Math.min(100, Math.round(((offset + RESYNC_BATCH) / total) * 100)));
      await new Promise((r) => setTimeout(r, 800));
    }

    setResyncStep('done');
    toast({
      title: dryRun ? 'Simulação concluída' : 'Re-sincronização concluída',
      description: dryRun
        ? `${compared} imóveis analisados. Revise a prévia abaixo.`
        : `${updated} imóveis atualizados. ${allErrors.length} erros.`,
    });
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-3xl font-display font-bold">Importar Imóveis</h1>
        <p className="text-muted-foreground">
          Importe imóveis automaticamente do site lemosproperties.com.br
        </p>

        {/* Auditoria: comparar planilha do Houzez com o banco */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-primary" />
              Auditoria — Origem × Banco
            </CardTitle>
            <CardDescription>
              Exporte a planilha (CSV ou Excel) dos imóveis no admin do Houzez e envie aqui. Comparo
              imóvel a imóvel: faltando/extras, campos (preço, áreas, quartos…), fotos e características.
              Nada é alterado — apenas um relatório.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={auditInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => handleAuditFile(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => auditInputRef.current?.click()} disabled={auditLoading}>
                {auditLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analisando...</>
                ) : (
                  <><FileSpreadsheet className="mr-2 h-4 w-4" /> Enviar planilha do Houzez</>
                )}
              </Button>
              {auditResult && (
                <Button variant="outline" onClick={downloadAuditReport}>
                  <Download className="mr-2 h-4 w-4" /> Baixar relatório (CSV)
                </Button>
              )}
              {auditFileName && <span className="text-xs text-muted-foreground">{auditFileName}</span>}
            </div>

            {auditResult && (
              <>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 text-center">
                  <SummaryStat label="Origem" value={auditResult.summary.source_total} />
                  <SummaryStat label="Banco" value={auditResult.summary.db_total} />
                  <SummaryStat label="OK" value={auditResult.summary.ok} tone="ok" />
                  <SummaryStat label="Divergentes" value={auditResult.summary.divergent} tone="warn" />
                  <SummaryStat label="Faltando" value={auditResult.summary.missing} tone="bad" />
                  <SummaryStat label="Extras" value={auditResult.summary.extra} tone="muted" />
                </div>

                <div className="flex flex-wrap gap-2">
                  {(['all', 'divergent', 'missing', 'ok'] as const).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={auditFilter === f ? 'default' : 'outline'}
                      onClick={() => setAuditFilter(f)}
                    >
                      {f === 'all' ? 'Todos' : f === 'divergent' ? 'Divergentes' : f === 'missing' ? 'Faltando' : 'OK'}
                    </Button>
                  ))}
                </div>

                <div className="space-y-2 max-h-[28rem] overflow-auto">
                  {auditResult.items
                    .filter((it) => auditFilter === 'all' || it.status === auditFilter)
                    .map((it, i) => <AuditRowCard key={i} item={it} />)}
                  {auditFilter === 'all' && auditResult.extras.map((ex, i) => (
                    <div key={`ex-${i}`} className="rounded border p-2 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Extra</Badge>
                        <span className="font-medium">{ex.title}</span>
                      </div>
                      <div className="text-muted-foreground mt-1">
                        No banco sem correspondência na origem{ex.code ? ` · ${ex.code}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>


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

        {/* Re-sincronizar conteúdo do site ao vivo */}
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Re-sincronizar conteúdo da Lemos
            </CardTitle>
            <CardDescription>
              Atualiza título, descrição, características, áreas, dormitórios, banheiros e suítes dos imóveis já
              importados, buscando direto do site ao vivo. Fotos e dados sensíveis são preservados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => runResync(true)}
                disabled={resyncStep === 'running'}
              >
                {resyncStep === 'running' ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                ) : (
                  <><FlaskConical className="mr-2 h-4 w-4" /> Simular (sem salvar)</>
                )}
              </Button>
              <Button
                onClick={() => runResync(false)}
                disabled={resyncStep === 'running'}
                className="gradient-bg"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Re-sincronizar agora
              </Button>
              {resyncStep === 'running' && (
                <Button variant="outline" onClick={() => { resyncStopRef.current = true; }}>
                  Parar
                </Button>
              )}
            </div>

            {(resyncStep === 'running' || resyncStep === 'done') && (
              <>
                <Progress value={resyncProgress} className="h-3" />
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span>{resyncCompared} analisados</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    {resyncUpdated} atualizados
                  </span>
                  {resyncErrors.length > 0 && (
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      {resyncErrors.length} erros
                    </span>
                  )}
                  <span>{resyncProgress}%</span>
                </div>
              </>
            )}

            {resyncSample.length > 0 && (
              <details className="text-xs" open>
                <summary className="cursor-pointer text-primary">Prévia ({resyncSample.length})</summary>
                <ul className="mt-2 space-y-2 max-h-60 overflow-auto">
                  {resyncSample.map((s, i) => (
                    <li key={i} className="rounded border p-2">
                      <div className="font-medium">{String(s.new_title ?? '')}</div>
                      <div className="text-muted-foreground">
                        {String(s.bedrooms ?? '-')} dorm · {String(s.bathrooms ?? '-')} banh · {String(s.suites ?? '-')} suítes ·{' '}
                        {String(s.area_m2 ?? '-')} m² · {String(s.features_count ?? 0)} características
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {resyncErrors.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-destructive">Ver erros ({resyncErrors.length})</summary>
                <ul className="mt-2 space-y-1 max-h-40 overflow-auto">
                  {resyncErrors.map((e, i) => <li key={i} className="text-muted-foreground">{e}</li>)}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
