"use client";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

type ReportLocationMapProps = {
  latitude: number;
  longitude: number;
};

export function ReportLocationMap({ latitude, longitude }: ReportLocationMapProps) {
  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={17}
      scrollWheelZoom
      dragging
      doubleClickZoom
      touchZoom
      keyboard
      zoomControl
      attributionControl={false}
      className="report-location-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        icon={createBluePinIcon()}
        position={[latitude, longitude]}
      />
    </MapContainer>
  );
}

function createBluePinIcon() {
  const size = 44;

  return L.divIcon({
    className: "",
    html: `
      <div class="map-pin selected" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
          <path fill="#0077D9" d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
        </svg>
      </div>
    `,
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}
