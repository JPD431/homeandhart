import { LEGAL_DOCS_VERSION } from "@/app/lib/legal-versions";

/**
 * Versión del aviso de cookies (banner + política de trabajo).
 * Al cambiar el texto sustancial del aviso, sube esta versión para
 * volver a mostrar el banner a quien ya lo había aceptado.
 */
export const COOKIE_NOTICE_VERSION = LEGAL_DOCS_VERSION;

export const COOKIE_NOTICE_STORAGE_KEY = "cookie_consent";
