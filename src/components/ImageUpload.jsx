import { db } from "@/api/db";

import { useState, useRef } from "react";

import { Image } from "@/components/ui/image";
import { Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ImageUpload({ value, onChange, label, hint, aspect = "aspect-video" }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await db.integrations.Core.UploadPublicFile({ file });
      onChange(res.file_url);
    } catch (err) {
      alert(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      {label && <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>}
      <div className={cn("relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/40", aspect)}>
        {value ? (
          <>
            <Image src={value} fittingType="fill" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground"
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
            <span className="text-sm">{uploading ? "Uploading…" : "Click to upload"}</span>
            {hint && <span className="text-xs text-muted-foreground/70">{hint}</span>}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2.5 py-1 text-xs text-white hover:bg-black/80"
          >
            Replace
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
    </div>
  );
}