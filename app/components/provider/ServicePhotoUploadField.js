"use client";

import { useRef, useState } from "react";
import ServicePhotoUploadGrid from "@/app/components/provider/ServicePhotoUploadGrid";
import { uploadServicePhoto } from "@/app/lib/provider-uploads";
import {
  fotosArraysEqual,
  getServicePhotoLimit,
  normalizeFotosArray,
  syncDetailsPhotos,
} from "@/app/lib/service-photos";

/**
 * Campo de galería con subida a Media, reordenar y elegir portada.
 * Persiste en BD vía PATCH /api/services/[id]/fotos (inmediato si hay serviceId).
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
  const detailsRef = useRef(details);
  detailsRef.current = details;

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [successHint, setSuccessHint] = useState("");

  const fotos = normalizeFotosArray(details?.fotos, details?.foto_url);
  const maxCount = getServicePhotoLimit(vertical);

  async function persistFotos(nextFotos) {
    const normalized = normalizeFotosArray(nextFotos);
    const baseDetails = detailsRef.current ?? details;
    const nextDetails = syncDetailsPhotos({ ...baseDetails, fotos: normalized });

    console.log("[ServicePhotoUploadField] persistFotos — estado local", {
      serviceId,
      vertical,
      count: normalized.length,
      fotos: normalized,
    });

    onChange(nextDetails);
    detailsRef.current = nextDetails;

    if (!serviceId) {
      console.warn(
        "[ServicePhotoUploadField] sin serviceId — fotos solo en memoria hasta Guardar",
      );
      setSuccessHint(
        normalized.length > 0
          ? `${normalized.length} foto(s) en el formulario. Pulsa «Guardar cambios» para confirmar.`
          : "",
      );
      return nextDetails;
    }

    const patchBody = { fotos: normalized };
    console.log("[ServicePhotoUploadField] PATCH /api/services/.../fotos — body exacto", {
      serviceId,
      count: normalized.length,
      fotos: normalized,
      bodyJson: JSON.stringify(patchBody),
    });

    const res = await fetch(`/api/services/${serviceId}/fotos`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(patchBody),
    });

    const payload = await res.json().catch(() => ({}));

    console.log("[ServicePhotoUploadField] PATCH respuesta", {
      status: res.status,
      ok: res.ok,
      verified: payload.verified,
      savedCount: Array.isArray(payload.fotos) ? payload.fotos.length : null,
      payload,
    });

    if (!res.ok) {
      const detail =
        payload.saved && payload.sent
          ? ` Enviadas: ${payload.sent.length}, en BD (fotos[]): ${payload.saved?.length ?? "?"}.`
          : "";
      throw new Error(
        (payload.error ||
          `No se pudieron guardar las fotos (HTTP ${res.status}).`) + detail,
      );
    }

    if (payload.verified !== true) {
      throw new Error(
        "El servidor no confirmó la escritura en la base de datos (verified=false).",
      );
    }

    const saved = normalizeFotosArray(payload.fotos);
    if (saved.length !== normalized.length) {
      throw new Error(
        `La base de datos guardó ${saved.length} foto(s) pero se enviaron ${normalized.length}.`,
      );
    }

    if (!fotosArraysEqual(saved, normalized)) {
      throw new Error(
        "Las URLs devueltas por la BD no coinciden con las enviadas. Revisa la consola.",
      );
    }

    const synced = syncDetailsPhotos({ ...nextDetails, fotos: saved });
    onChange(synced);
    detailsRef.current = synced;
    setSuccessHint(
      saved.length === 1
        ? "1 foto guardada en el anuncio."
        : `${saved.length} fotos guardadas en el anuncio.`,
    );
    return synced;
  }

  async function applyFotos(nextFotos) {
    setError("");
    setSuccessHint("");
    onUploadError?.("");
    try {
      await persistFotos(nextFotos);
      onUploadError?.("");
    } catch (err) {
      const message = err?.message || "No se pudieron guardar las fotos.";
      console.error("[ServicePhotoUploadField] applyFotos error", err);
      setError(message);
      onUploadError?.(message);
      throw err;
    }
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";

    console.log("[ServicePhotoUploadField] archivos seleccionados", {
      count: files.length,
      names: files.map((f) => f.name),
      multiple,
      currentFotos: fotos.length,
    });

    if (!files.length || !userId) return;

    const currentFotos = normalizeFotosArray(
      detailsRef.current?.fotos,
      detailsRef.current?.foto_url,
    );
    const remaining = maxCount - currentFotos.length;
    const toAdd = files.slice(0, remaining);

    if (!toAdd.length) {
      setError(`Ya tienes el máximo de ${maxCount} fotos.`);
      onUploadError?.(`Ya tienes el máximo de ${maxCount} fotos.`);
      return;
    }

    if (files.length > remaining) {
      setError(
        `Solo caben ${remaining} foto(s) más (máximo ${maxCount}). Se subirán las primeras ${remaining}.`,
      );
    }

    setUploading(true);
    setError("");
    setSuccessHint("");
    onUploadError?.("");

    try {
      const newUrls = [];
      let workingFotos = [...currentFotos];

      for (let i = 0; i < toAdd.length; i++) {
        const file = toAdd[i];
        console.log("[ServicePhotoUploadField] subiendo", {
          index: workingFotos.length,
          fileName: file.name,
          fileSize: file.size,
        });
        const url = await uploadServicePhoto(
          userId,
          vertical,
          file,
          workingFotos.length,
        );
        console.log("[ServicePhotoUploadField] URL recibida", { index: i, url });
        newUrls.push(url);
        workingFotos = normalizeFotosArray([...workingFotos, url]);
      }

      console.log("[ServicePhotoUploadField] subida completa", {
        newUrlsCount: newUrls.length,
        newUrls,
        totalFotos: workingFotos.length,
        arrayFinalParaPatch: workingFotos,
      });

      await applyFotos(workingFotos);
    } catch (err) {
      const message = err?.message || "No se pudo subir la foto.";
      console.error("[ServicePhotoUploadField] handleFiles error", err);
      setError(message);
      onUploadError?.(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(index) {
    const currentFotos = normalizeFotosArray(
      detailsRef.current?.fotos,
      detailsRef.current?.foto_url,
    );
    const next = currentFotos.filter((_, i) => i !== index);
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
    const currentFotos = normalizeFotosArray(
      detailsRef.current?.fotos,
      detailsRef.current?.foto_url,
    );
    if (index <= 0 || index >= currentFotos.length) return;
    const next = [...currentFotos];
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
    const currentFotos = normalizeFotosArray(
      detailsRef.current?.fotos,
      detailsRef.current?.foto_url,
    );
    if (index <= 0) return;
    const next = [...currentFotos];
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
    const currentFotos = normalizeFotosArray(
      detailsRef.current?.fotos,
      detailsRef.current?.foto_url,
    );
    if (index >= currentFotos.length - 1) return;
    const next = [...currentFotos];
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
      {uploading ? (
        <p className="mt-2 text-xs text-[#666]">Subiendo fotos…</p>
      ) : null}
      {error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      {!error && successHint ? (
        <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800">
          {successHint}
        </p>
      ) : null}
    </div>
  );
}
