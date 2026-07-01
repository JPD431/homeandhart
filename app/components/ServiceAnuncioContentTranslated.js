"use client";

import ServiceAnuncioContent from "@/app/components/ServiceAnuncioContent";
import { getServiceDescription } from "@/app/lib/service-card-display";
import { useContext } from "react";
import { ProveedorTranslateContext } from "@/app/proveedor/[id]/ProveedorTraduccion";

function normalizeServiceId(serviceId) {
  return String(serviceId);
}

function getServiceTranslation(ctx, serviceId) {
  if (!ctx?.showTranslated || !ctx.translations?.services) return null;
  return ctx.translations.services[normalizeServiceId(serviceId)] ?? null;
}

export default function ServiceAnuncioContentTranslated({ service }) {
  const ctx = useContext(ProveedorTranslateContext);
  const baseDescription = getServiceDescription(service);
  const entry = service?.id ? getServiceTranslation(ctx, service.id) : null;
  const descripcion =
    (ctx?.showTranslated && entry?.descripcion) || baseDescription;

  return <ServiceAnuncioContent service={service} descripcion={descripcion} />;
}
