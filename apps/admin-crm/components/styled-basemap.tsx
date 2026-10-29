"use client";

import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const credit = '<a href="https://openfreemap.org/">OpenFreeMap</a> © <a href="https://openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

/** A vector background only; Leaflet still owns complaint pins and navigation. */
export function StyledBasemap() {
  const map = useMap();
  useEffect(() => {
    setWorkerUrl(new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href);
    let vector: ReturnType<typeof maplibreGL> | undefined;
    let fallback: L.TileLayer | undefined;
    let disposed = false;
    function activateRasterFallback() {
      if (disposed || fallback) return;
      vector?.remove();
      fallback = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
    }
    try {
      vector = maplibreGL({ style: "/maps/bancao-light.json", attributionControl: false });
      vector.addTo(map);
      const renderer = vector.getMaplibreMap();
      renderer.on("error", activateRasterFallback);
      renderer.once("load", () => {
        if (!disposed && !fallback) map.attributionControl.addAttribution(credit);
      });
    } catch (error) {
      console.error("Custom map background unavailable; using standard map.", error);
      activateRasterFallback();
    }
    return () => {
      disposed = true;
      vector?.remove();
      fallback?.remove();
      map.attributionControl.removeAttribution(credit);
    };
  }, [map]);
  return null;
}

