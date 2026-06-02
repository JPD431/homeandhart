"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BRAND } from "@/app/components/brand";
import { supabase } from "@/lib/supabase";

export default function PreguntarButton({
  proveedorId,
  className = "",
  style = {},
  children = "Preguntar",
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setLoading(false);
      router.push("/login");
      return;
    }

    if (user.id === proveedorId) {
      setLoading(false);
      return;
    }

    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_a_id.eq.${user.id},participant_b_id.eq.${proveedorId}),and(participant_a_id.eq.${proveedorId},participant_b_id.eq.${user.id})`,
      )
      .maybeSingle();

    if (existing?.id) {
      router.push(`/chat?conversation=${existing.id}`);
      return;
    }

    const { data: created, error } = await supabase
      .from("conversations")
      .insert({
        participant_a_id: user.id,
        participant_b_id: proveedorId,
      })
      .select("id")
      .single();

    setLoading(false);

    if (error || !created) {
      return;
    }

    router.push(`/chat?conversation=${created.id}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={className}
      style={style}
    >
      {loading ? "Abriendo…" : children}
    </button>
  );
}
