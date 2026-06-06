"use client";

import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ProveedorPreguntarButton({
  proveedorId,
  className = "",
  style = {},
  children = "Preguntar",
}) {
  const router = useRouter();

  const handlePreguntar = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: convExistente } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_a_id.eq.${user.id},participant_b_id.eq.${proveedorId}),and(participant_a_id.eq.${proveedorId},participant_b_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (convExistente) {
      router.push(`/chat?conversation=${convExistente.id}`);
      return;
    }

    const { data: nuevaConv } = await supabase
      .from("conversations")
      .insert({ participant_a_id: user.id, participant_b_id: proveedorId })
      .select("id")
      .single();

    if (nuevaConv) {
      router.push(`/chat?conversation=${nuevaConv.id}`);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePreguntar}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
