"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";

export default function ProveedorPreguntarButton({
  proveedorId,
  className = "",
  style = {},
  children = "Preguntar",
  onError,
  onSuccess,
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePreguntar = async () => {
    if (!proveedorId || loading) return;
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: convExistente, error: findError } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_a_id.eq.${user.id},participant_b_id.eq.${proveedorId}),and(participant_a_id.eq.${proveedorId},participant_b_id.eq.${user.id})`,
        )
        .maybeSingle();

      if (findError) {
        throw findError;
      }

      if (convExistente) {
        onSuccess?.("Abriendo el chat…");
        router.push(`/chat?conversation=${convExistente.id}`);
        return;
      }

      const { data: nuevaConv, error: insertError } = await supabase
        .from("conversations")
        .insert({ participant_a_id: user.id, participant_b_id: proveedorId })
        .select("id")
        .single();

      if (insertError || !nuevaConv) {
        throw insertError || new Error("No se pudo abrir el chat.");
      }

      onSuccess?.("Chat creado. Redirigiendo…");
      router.push(`/chat?conversation=${nuevaConv.id}`);
    } catch (err) {
      const msg =
        err?.message || "No se pudo abrir el chat. Inténtalo de nuevo.";
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePreguntar}
      disabled={loading}
      className={className}
      style={{ ...style, opacity: loading ? 0.65 : style?.opacity }}
    >
      {loading ? "Abriendo chat…" : children}
    </button>
  );
}
