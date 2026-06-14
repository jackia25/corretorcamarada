import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Video, X, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VideoUploadProps {
  userId: string;
  value: string;
  onChange: (url: string) => void;
}

const ALLOWED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/3gpp'];
const MAX_SIZE = 100 * 1024 * 1024; // 100MB

export function VideoUpload({ userId, value, onChange }: VideoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Tipo de arquivo não permitido',
        description: 'Use vídeos MP4, MOV, WebM ou AVI.',
      });
      return;
    }

    if (file.size > MAX_SIZE) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo do vídeo é 100MB.',
      });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const fileName = `${userId}/videos/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('property-photos')
      .upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Video upload error:', uploadError);
      toast({ variant: 'destructive', title: 'Erro no upload', description: uploadError.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(fileName);
    onChange(urlData.publicUrl);
    setUploading(false);
    toast({ title: 'Vídeo enviado', description: 'O vídeo foi adicionado ao imóvel.' });
  };

  const removeVideo = async () => {
    if (value) {
      try {
        const url = new URL(value);
        const pathParts = url.pathname.split('/property-photos/');
        if (pathParts.length > 1) {
          await supabase.storage.from('property-photos').remove([pathParts[1]]);
        }
      } catch {
        /* ignore - pode ser uma URL externa */
      }
    }
    onChange('');
  };

  if (value) {
    return (
      <div className="space-y-2">
        <div className="relative rounded-lg overflow-hidden border">
          <video src={value} controls className="w-full max-h-72 bg-black" />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={removeVideo}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative border-2 border-dashed rounded-lg p-6 transition-colors',
        'border-muted-foreground/25 hover:border-muted-foreground/50',
        uploading && 'opacity-60 pointer-events-none'
      )}
    >
      <input
        type="file"
        accept="video/*"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        disabled={uploading}
      />
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        {uploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Enviando vídeo...</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Video className="h-7 w-7" />
              <Upload className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground">
              Clique ou arraste um vídeo do computador ou celular
            </p>
            <p className="text-xs text-muted-foreground">MP4, MOV, WebM ou AVI • Máximo 100MB</p>
          </>
        )}
      </div>
    </div>
  );
}
