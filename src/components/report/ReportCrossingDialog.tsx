import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Loader2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface ReportCrossingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreementId: string;
  propertyId: string;
  reportedUserId: string;
  reportedUserName: string;
  onSuccess?: () => void;
}

export function ReportCrossingDialog({
  open,
  onOpenChange,
  agreementId,
  propertyId,
  reportedUserId,
  reportedUserName,
  onSuccess,
}: ReportCrossingDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [description, setDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEvidenceFiles((prev) => [...prev, ...newFiles].slice(0, 5)); // Max 5 files
    }
  };

  const removeFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadEvidence = async (): Promise<string[]> => {
    if (evidenceFiles.length === 0) return [];

    setUploading(true);
    const urls: string[] = [];

    for (const file of evidenceFiles) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile?.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('property-photos')
        .upload(`evidence/${fileName}`, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from('property-photos')
        .getPublicUrl(`evidence/${fileName}`);

      urls.push(urlData.publicUrl);
    }

    setUploading(false);
    return urls;
  };

  const handleSubmit = async () => {
    if (!profile || !description.trim()) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, descreva o ocorrido.',
      });
      return;
    }

    setSubmitting(true);

    try {
      // Upload evidence files first
      const evidenceUrls = await uploadEvidence();

      // Create the report
      const { error } = await supabase.from('crossing_reports').insert({
        reporter_id: profile.id,
        reported_user_id: reportedUserId,
        agreement_id: agreementId,
        property_id: propertyId,
        description: description.trim(),
        evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Denúncia registrada',
        description: 'Sua denúncia foi enviada para análise.',
      });

      setDescription('');
      setEvidenceFiles([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar denúncia',
        description: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Denunciar Atravessamento
          </DialogTitle>
          <DialogDescription>
            Relate uma suspeita de atravessamento envolvendo <strong>{reportedUserName}</strong>.
            Sua denúncia será analisada por nossa equipe.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="description">Descreva o ocorrido *</Label>
            <Textarea
              id="description"
              placeholder="Descreva detalhadamente o que aconteceu, incluindo datas, circunstâncias e como você descobriu o possível atravessamento..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Seja o mais detalhado possível para facilitar a análise.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Evidências (opcional)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="evidence-upload"
                multiple
              />
              <Label
                htmlFor="evidence-upload"
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg hover:bg-muted transition-colors"
              >
                <Upload className="h-4 w-4" />
                Adicionar arquivos
              </Label>
              <span className="text-xs text-muted-foreground">
                Máx. 5 arquivos (imagens, PDFs)
              </span>
            </div>

            {evidenceFiles.length > 0 && (
              <div className="space-y-2 mt-2">
                {evidenceFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg"
                  >
                    <span className="text-sm truncate flex-1">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      className="h-6 w-6 p-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 bg-warning/10 rounded-lg border border-warning/20">
            <p className="text-sm text-warning-foreground">
              <strong>Importante:</strong> Denúncias falsas podem resultar em
              penalidades. Certifique-se de que sua denúncia é legítima.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !description.trim()}
            className="bg-destructive hover:bg-destructive/90"
          >
            {submitting || uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {uploading ? 'Enviando arquivos...' : 'Enviando...'}
              </>
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Enviar Denúncia
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
