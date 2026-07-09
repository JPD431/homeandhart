"use client";

import { useRef, useState } from "react";
import ServicePhotoUploadGrid from "@/app/components/provider/ServicePhotoUploadGrid";
import { uploadServicePhoto } from "@/app/lib/provider-uploads";
import {
  getServicePhotoLimit,
  normalizeFotosArray,
  syncDetailsPhotos,
  syncServicePhotos,
} from "@/app/lib/service-photos";
import { supabase } from "@/app/lib/supabase";

/**
 * Campo de galería con subida a Media, reordenar y elegir portada.
 * Persiste en BD inmediatamente si serviceId está definido.
 */
export default function ServicePhotoUploadField({
  vertical,
  userId,
  serviceId = null,
  details,
  onChange,
  onUploadError,
  label,
  multiple = true,
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const fotos = normalizeFotosArray(details?.fotos, details?.foto_url);
  const maxCount = getServicePhotoLimit(vertical);

  async function persistFotos(nextFotos) {
    const nextDetails = syncDetailsPhotos({ ...details, fotos: nextFotos });
    onChange(nextDetails);

    if (!serviceId) return;

    const payload = syncServicePhotos({}, nextFotos);
    const { data, error: persistError } = await supabase
      .from("services")
      .update(payload)
      .eq("id", serviceId)
      .select("id, fotos, foto_url")
      .single();

    if (persistError) {
      throw new Error(
        persistError.message || "No se pudieron guardar las fotos en la base de datos.",
      );
    }

    const saved = normalizeFotosArray(data?.fotos, data?.foto_url);
    onChange(syncDetailsPhotos({ ...details, fotos: saved }));
  }

  async function applyFotos(nextFotos) {
    setError("");
    onUploadError?.("");
    try {
      await persistFotos(nextFotos);
    } catch (err) {
      const message = err?.message || "No se pudieron guardar las fotos.";
      setError(message);
      onUploadError?.(message);
      throw err;
    }
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length || !userId) return;

    const remaining = maxCount - fotos.length;
    const toAdd = files.slice(0, remaining);
    if (!toAdd.length) return;

    setUploading(true);
    setError("");
    onUploadError?.("");

    try {
      const newUrls = [];
      for (let i = 0; i < toAdd.length; i++) {
        const url = await uploadServicePhoto(
          userId,
          vertical,
          toAdd[i],
          fotos.length + i,
        );
        newUrls.push(url);
      }
      await applyFotos(normalizeFotosArray([...fotos, ...newUrls]));
    } catch (err) {
      const message = err?.message || "No se pudo subir la foto.";
      setError(message);
      onUploadError?.(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(index) {
    const next = fotos.filter((_, i) => i !== index);
    setUploading(true);
    try {
      await applyFotos(next);
    } catch {
      // error ya mostrado
    } finally {
      setUploading(false);
    }
  }

  async function handleMakeCover(index) {
    if (index <= 0 || index >= fotos.length) return;
    const next = [...fotos];
    const [photo] = next.splice(index, 1);
    next.unshift(photo);
    setUploading(true);
    try {
      await applyFotos(next);
    } catch {
      // error ya mostrado
    } finally {
      setUploading(false);
    }
  }

  async function handleMoveUp(index) {
    if (index <= 0) return;
    const next = [...fotos];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setUploading(true);
    try {
      await applyFotos(next);
    } catch {
      // error ya mostrado
    } finally {
      setUploading(false);
    }
  }

  async function handleMoveDown(index) {
    if (index >= fotos.length - 1) return;
    const next = [...fotos];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setUploading(true);
    try {
      await applyFotos(next);
    } catch {
      // error ya mostrado
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={handleFiles}
      />
      <ServicePhotoUploadGrid
        label={label}
        previews={fotos}
        maxCount={maxCount}
        multiple={multiple}
        uploading={uploading}
        disabled={!userId}
        onAdd={() => inputRef.current?.click()}
        onRemove={handleRemove}
        onMakeCover={handleMakeCover}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
      />
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
