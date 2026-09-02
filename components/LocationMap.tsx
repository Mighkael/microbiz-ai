"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, CircleMarker } from "leaflet";
import { C } from "@/lib/theme";

export default function LocationMap({ lat, lon, label, highlight }: {
  lat: number; lon: number; label: string; highlight?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;

      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { attributionControl: true, scrollWheelZoom: false });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(mapRef.current);

        // Leaflet 1.9 ships a Ukrainian flag beside its name in the
        // attribution, which reads as though the map itself is of Ukraine.
        // Keep the credit (OpenStreetMap's licence requires it), drop the flag.
        mapRef.current.attributionControl.setPrefix(
          '<a href="https://leafletjs.com" title="A JavaScript library for interactive maps">Leaflet</a>',
        );
      }

      mapRef.current.setView([lat, lon], 12);

      if (markerRef.current) {
        markerRef.current.remove();
      }
      const color = highlight ? C.signal : C.ledger;
      markerRef.current = L.circleMarker([lat, lon], {
        radius: 10, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1,
      }).addTo(mapRef.current).bindPopup(label);
    })();

    return () => {
      cancelled = true;
    };
  }, [lat, lon, label, highlight]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  return <div ref={containerRef} style={{ height: 260, width: "100%", borderRadius: 10 }} />;
}
