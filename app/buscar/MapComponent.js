"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

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

  function addMarkers() {
    if (!map.current) return;

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const allResults = results || [];

    allResults.forEach((servicio, i) => {
      if (!servicio.location_lng || !servicio.location_lat) return;

      const color =
        servicio.vertical === "alojamiento"
          ? "#1d4f91"
          : servicio.vertical === "ninos"
            ? "#0e7a5c"
            : "#c47d1a";

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
      el.textContent = `${servicio.precio}€`;

      el.addEventListener("mouseenter", () => onPinHover(i));
      el.addEventListener("mouseleave", () => onPinLeave());
      el.addEventListener("click", () => onPinSelect(i));

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([servicio.location_lng, servicio.location_lat])
        .addTo(map.current);

      markers.current.push(marker);
    });

    const firstWithCoords = allResults.find((s) => s.location_lng && s.location_lat);
    if (firstWithCoords) {
      map.current.flyTo({
        center: [firstWithCoords.location_lng, firstWithCoords.location_lat],
        zoom: 13,
        duration: 1000,
      });
    }
  }

  useEffect(() => {
    if (!map.current || !map.current.loaded()) {
      map.current?.on("load", () => {
        addMarkers();
      });
      return;
    }
    addMarkers();
  }, [results, extra, hoveredIndex, selectedIndex]);

  return <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />;
}
