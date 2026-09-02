"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { C } from "@/lib/theme";

export type MapPoint = { lat: number; lon: number; label: string; rank: number };

/** Colors match the scorecards, so a pin and its card are read as one thing. */
export const PIN_COLORS = [C.ledger, C.signal, C.ink2];

/**
 * Shows every compared market on one map, zoomed to fit them all — which is
 * how you actually see that two options sit an hour apart versus across the
 * country.
 */
export default function ComparisonMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || points.length === 0) return;

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

        layerRef.current = L.layerGroup().addTo(mapRef.current);
      }

      layerRef.current?.clearLayers();

      points.forEach((p) => {
        const color = PIN_COLORS[p.rank % PIN_COLORS.length];
        L.circleMarker([p.lat, p.lon], {
          radius: 11, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1,
        })
          .bindPopup(p.label)
          .addTo(layerRef.current!);
      });

      if (points.length === 1) {
        mapRef.current.setView([points[0].lat, points[0].lon], 10);
      } else {
        mapRef.current.fitBounds(
          L.latLngBounds(points.map((p) => [p.lat, p.lon] as [number, number])),
          { padding: [42, 42] },
        );
      }
    })();

    return () => { cancelled = true; };
  }, [points]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
  }, []);

  if (points.length === 0) return null;

  return <div ref={containerRef} style={{ height: 320, width: "100%", borderRadius: 10 }} />;
}
