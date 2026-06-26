export async function searchCiudadesEspana(query, { signal, limit = 6 } = {}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const trimmed = query?.trim() ?? "";
  if (!token || trimmed.length < 2) return [];

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json`,
  );
  url.searchParams.set("access_token", token);
  url.searchParams.set("autocomplete", "true");
  url.searchParams.set("country", "es");
  url.searchParams.set("types", "place,locality");
  url.searchParams.set("language", "es");
  url.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];

    const data = await res.json();
    return (data.features ?? []).map((feature) => ({
      id: feature.id,
      nombre: feature.text,
      etiqueta: feature.place_name,
    }));
  } catch (err) {
    if (err?.name === "AbortError") throw err;
    return [];
  }
}
