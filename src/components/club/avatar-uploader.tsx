"use client";

import { ImageUp, LoaderCircle, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/field";
import { setAvatarAction } from "@/lib/actions/profile";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Resizes to a 256px square so avatars stay small, then uploads to the user's own folder. */
async function toSquareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const size = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? file), "image/webp", 0.88));
}

export function AvatarUploader({
  userId,
  displayName,
  emblem,
  avatarUrl,
}: {
  userId: string;
  displayName: string;
  emblem: string;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function upload(file: File) {
    setError(null);
    if (!TYPES.includes(file.type)) return setError("Use a PNG, JPEG or WebP image.");
    if (file.size > 8 * MAX_BYTES) return setError("That image is too large.");
    startTransition(async () => {
      try {
        const blob = await toSquareWebp(file);
        if (blob.size > MAX_BYTES) return setError("That image is too large after resizing.");
        const supabase = getSupabaseBrowserClient();
        const path = `${userId}/avatar.webp`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { upsert: true, contentType: "image/webp", cacheControl: "3600" });
        if (uploadError) return setError("Upload failed. Please try again.");
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        const url = `${data.publicUrl}?v=${Date.now()}`;
        const result = await setAvatarAction(url);
        if (!result.ok) return setError(result.error);
        setPreview(url);
        router.refresh();
      } catch {
        setError("Could not read that image.");
      }
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await setAvatarAction(null);
      if (!result.ok) return setError(result.error);
      setPreview(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5">
        <Avatar name={displayName} src={preview} emblem={emblem} size="xl" ring="felt" />
        <div className="flex flex-col gap-2">
          <input
            ref={input}
            type="file"
            accept={TYPES.join(",")}
            className="sr-only"
            id="avatar-file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" disabled={pending} onClick={() => input.current?.click()}>
            {pending ? <LoaderCircle className="animate-spin" /> : <ImageUp />}
            {preview ? "Change photo" : "Upload photo"}
          </Button>
          {preview ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={remove}>
              <Trash /> Use monogram instead
            </Button>
          ) : null}
        </div>
      </div>
      <p className="text-xs text-muted">Optional. Without a photo you get a monogram card with your emblem.</p>
      {error ? <FormMessage>{error}</FormMessage> : null}
    </div>
  );
}
