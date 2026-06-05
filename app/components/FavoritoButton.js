"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// -- CREATE TABLE favoritos (
// --   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
// --   cliente_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
// --   proveedor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
// --   created_at timestamp with time zone DEFAULT now(),
// --   UNIQUE(cliente_id, proveedor_id)
// -- );

export default function FavoritoButton({
  proveedorId,
  className = "",
  onChange,
}) {
  const router = useRouter();
  const [isFavorito, setIsFavorito] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const checkFavorito = useCallback(async () => {
    if (!proveedorId) {
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsFavorito(false);
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("favoritos")
      .select("id")
      .eq("cliente_id", user.id)
      .eq("proveedor_id", proveedorId)
      .maybeSingle();

    setIsFavorito(!!data);
    setLoading(false);
  }, [proveedorId]);

  useEffect(() => {
    checkFavorito();
  }, [checkFavorito]);

  async function handleToggle(e) {
    e.preventDefault();
    e.stopPropagation();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      router.push("/login");
      return;
    }

    setToggling(true);

    if (isFavorito) {
      const { error } = await supabase
        .from("favoritos")
        .delete()
        .eq("cliente_id", user.id)
        .eq("proveedor_id", proveedorId);

      if (!error) {
        setIsFavorito(false);
        onChange?.(false);
      }
    } else {
      const { error } = await supabase.from("favoritos").insert({
        cliente_id: user.id,
        proveedor_id: proveedorId,
      });

      if (!error) {
        setIsFavorito(true);
        onChange?.(true);
      }
    }

    setToggling(false);
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading || toggling}
      aria-label={isFavorito ? "Quitar de favoritos" : "Añadir a favoritos"}
      className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white/90 text-lg shadow-sm transition-transform hover:scale-110 disabled:cursor-wait disabled:opacity-60 ${className}`}
      style={{ borderColor: "#e8e4df" }}
    >
      {isFavorito ? "❤️" : "🤍"}
    </button>
  );
}
