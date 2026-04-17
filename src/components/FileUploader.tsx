import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

interface Props {
  /** subcarpeta dentro del bucket attachments */
  folder: string;
  /** url actual (si la hay) */
  value?: string | null;
  onChange: (url: string | null) => void;
  accept?: string;
  label?: string;
  preview?: boolean;
}

export function FileUploader({ folder, value, onChange, accept = "image/*", label = "Subir archivo", preview = true }: Props) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      toast.error("El archivo supera 20MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("attachments").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Archivo subido");
    } catch (e: any) {
      toast.error("Error al subir: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const isImage = value && /\.(png|jpe?g|gif|webp|svg)$/i.test(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      {value && preview && (
        <div className="text-xs">
          {isImage ? (
            <img src={value} alt="preview" className="max-h-32 rounded border" />
          ) : (
            <a href={value} target="_blank" rel="noreferrer" className="text-primary underline break-all">
              {value}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
