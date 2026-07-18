"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { resolveServiceCardPricing } from "@/app/lib/service-card-display";
import {
  PUBLIC_MAP_RADIUS_METERS,
  circlePolygon,
  resolvePublicMapCenter,
} from "@/app/lib/location-privacy";

const AREA_SOURCE = "hh-approx-areas";
const AREA_FILL = "hh-approx-areas-fill";
const AREA_LINE = "hh-approx-areas-line";

function verticalColor(vertical) {
  if (vertical === "alojamiento") return "#1d4f91";
  if (vertical === "ninos") return "#0e7a5c";
  return "#c47d1a";
}

/**
 * Mapa público de búsqueda.
 * No usa coordenadas exactas del servicio: geocodifica zona/ciudad y dibuja
 * un círculo aproximado (~600 m), estilo Airbnb — sin revelar la casa.
 */
export default function RealMap({
  results,
  hoveredIndex,
  selectedIndex,
  onPinHover,
  onPinLeave,
  onPinSelect,
  extra,
  bundleMode,
  origenId,
  onBundleAdd,
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const centersCache = useRef(new Map());
  const renderGen = useRef(0);

  useEffect(() => {
    if (map.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-3.7038, 40.4168],
      zoom: 12,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;

    const gen = ++renderGen.current;
    let cancelled = false;

    async function renderApproxAreas() {
      // Esperar a que el estilo esté listo
      if (!m.isStyleLoaded()) {
        await new Promise((resolve) => {
          m.once("load", resolve);
        });
      }
      if (cancelled || gen !== renderGen.current) return;

      markers.current.forEach((marker) => marker.remove());
      markers.current = [];

      const allResults = results || [];
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      const features = [];
      const centers = [];

      for (let i = 0; i < allResults.length; i += 1) {
        const servicio = allResults[i];
        const cacheKey = [
          servicio.id,
          servicio.location_zone || "",
          servicio.ciudad || "",
        ].join("|");

        let center = centersCache.current.get(cacheKey);
        if (!center) {
          center = await resolvePublicMapCenter(servicio, token);
          if (center) centersCache.current.set(cacheKey, center);
        }
        if (cancelled || gen !== renderGen.current) return;
        if (!center) continue;

        centers.push({ ...center, index: i, servicio });

        const color = verticalColor(servicio.vertical);
        const poly = circlePolygon(
          center.lng,
          center.lat,
          PUBLIC_MAP_RADIUS_METERS,
        );
        poly.properties = {
          color,
          index: i,
          serviceId: servicio.id,
        };
        features.push(poly);

        const pricing = resolveServiceCardPricing(servicio, "es");
        const el = document.createElement("div");
        el.style.cssText = `
          background: ${color};
          color: white;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,.2);
          white-space: nowrap;
        `;
        el.textContent =
          pricing.precio != null
            ? pricing.useDesde
              ? `desde ${pricing.precio}€`
              : `${pricing.precio}€`
            : "·";
        el.title = "Zona aproximada (la dirección exacta se comparte tras reservar)";

        el.addEventListener("mouseenter", () => onPinHover?.(i));
        el.addEventListener("mouseleave", () => onPinLeave?.());
        el.addEventListener("click", () => onPinSelect?.(i));

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([center.lng, center.lat])
          .addTo(m);
        markers.current.push(marker);
      }

      const geojson = {
        type: "FeatureCollection",
        features,
      };

      if (m.getSource(AREA_SOURCE)) {
        m.getSource(AREA_SOURCE).setData(geojson);
      } else {
        m.addSource(AREA_SOURCE, { type: "geojson", data: geojson });
        m.addLayer({
          id: AREA_FILL,
          type: "fill",
          source: AREA_SOURCE,
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.18,
          },
        });
        m.addLayer({
          id: AREA_LINE,
          type: "line",
          source: AREA_SOURCE,
          paint: {
            "line-color": ["get", "color"],
            "line-width": 1.5,
            "line-opacity": 0.55,
          },
        });
      }

      if (centers.length > 0) {
        const first = centers[0];
        m.flyTo({
          center: [first.lng, first.lat],
          zoom: 12.5,
          duration: 1000,
        });
      }
    }

    renderApproxAreas();

    return () => {
      cancelled = true;
    };
  }, [results, extra, hoveredIndex, selectedIndex, onPinHover, onPinLeave, onPinSelect]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
}
