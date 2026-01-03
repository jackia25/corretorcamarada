import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ImagePlus, X, Loader2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
  userId: string;
  images: string[];
  onImagesChange: (images: string[]) => void;
  maxImages?: number;
  label?: string;
  isSensitive?: boolean;
}

export function ImageUpload({
  userId,
  images,
  onImagesChange,
  maxImages = 10,
  label = 'Fotos',
  isSensitive = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  const uploadImage = async (file: File): Promise<string | null> => {
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Tipo de arquivo não permitido',
        description: 'Use apenas JPG, PNG, WebP ou GIF.',
      });
      return null;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB.',
      });
      return null;
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('property-photos')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast({
        variant: 'destructive',
        title: 'Erro no upload',
        description: uploadError.message,
      });
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('property-photos')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      toast({
        variant: 'destructive',
        title: 'Limite atingido',
        description: `Você pode adicionar no máximo ${maxImages} fotos.`,
      });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remainingSlots);
    setUploading(true);

    const uploadPromises = filesToUpload.map((file) => uploadImage(file));
    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter((url): url is string => url !== null);

    if (successfulUploads.length > 0) {
      onImagesChange([...images, ...successfulUploads]);
      toast({
        title: 'Upload concluído',
        description: `${successfulUploads.length} foto(s) adicionada(s).`,
      });
    }

    setUploading(false);
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [images, maxImages]);

  const removeImage = async (urlToRemove: string) => {
    // Extract file path from URL
    const url = new URL(urlToRemove);
    const pathParts = url.pathname.split('/property-photos/');
    if (pathParts.length > 1) {
      const filePath = pathParts[1];
      await supabase.storage.from('property-photos').remove([filePath]);
    }
    
    onImagesChange(images.filter((url) => url !== urlToRemove));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-muted-foreground">
          {images.length}/{maxImages} fotos
        </span>
      </div>

      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          isSensitive && 'border-warning/50',
          images.length >= maxImages && 'opacity-50 pointer-events-none'
        )}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploading || images.length >= maxImages}
        />
        
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Enviando fotos...</p>
            </>
          ) : (
            <>
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arraste fotos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP ou GIF • Máximo 5MB por foto
              </p>
            </>
          )}
        </div>
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((url, index) => (
            <Card key={url} className="relative aspect-square overflow-hidden group">
              <img
                src={url}
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeImage(url)}
              >
                <X className="h-3 w-3" />
              </Button>
              {index === 0 && (
                <span className="absolute bottom-2 left-2 text-xs bg-black/70 text-white px-2 py-1 rounded">
                  Capa
                </span>
              )}
            </Card>
          ))}
          
          {/* Add More Button */}
          {images.length < maxImages && (
            <Card
              className={cn(
                'relative aspect-square flex items-center justify-center cursor-pointer border-dashed border-2',
                'hover:border-primary hover:bg-primary/5 transition-colors'
              )}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={uploading}
              />
              <ImagePlus className="h-8 w-8 text-muted-foreground" />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
