"use client";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import {
  normalizeReportStatus,
  reportStatusLabel,
  shortReportCategory
} from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";

const barangayCenter: [number, number] = [9.7392, 118.7353];

type ComplaintMapProps = {
  reports: CommunityReport[];
  selectedReport: CommunityReport | null;
  onSelect: (report: CommunityReport) => void;
};

export function ComplaintMap({ reports, selectedReport, onSelect }: ComplaintMapProps) {
  return (
    <MapContainer
      center={barangayCenter}
      zoom={13}
      scrollWheelZoom
      className="leaflet-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFocus selectedReport={selectedReport} />
      {reports.map((report) => (
        <Marker
          eventHandlers={{ click: () => onSelect(report) }}
          icon={createPinIcon(statusColor(normalizeReportStatus(report.status)), selectedReport?.id === report.id)}
          key={report.id}
          position={[report.latitude!, report.longitude!]}
        >
          <Tooltip>
            {shortReportCategory(report.category)} - {reportStatusLabel(normalizeReportStatus(report.status))}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

function MapFocus({ selectedReport }: { selectedReport: CommunityReport | null }) {
  const map = useMap();

  useEffect(() => {
    if (selectedReport?.latitude != null && selectedReport.longitude != null) {
      map.flyTo([selectedReport.latitude, selectedReport.longitude], 16, {
        duration: 0.65
      });
    }
  }, [map, selectedReport]);

  return null;
}

function createPinIcon(color: string, selected: boolean) {
  const size = selected ? 58 : 48;

  return L.divIcon({
    className: "",
    html: `
      <div class="map-pin ${selected ? "selected" : ""}" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 24 24" width="${selected ? 40 : 34}" height="${selected ? 40 : 34}" aria-hidden="true">
          <path fill="${color}" d="M12 2C8.14 2 5 5.14 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.86-3.14-7-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z"/>
        </svg>
      </div>
    `,
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

function statusColor(status: string) {
  if (status === "resolved") return "#2FB887";
  if (status === "in progress") return "#0087EF";
  return "#E4A000";
}
