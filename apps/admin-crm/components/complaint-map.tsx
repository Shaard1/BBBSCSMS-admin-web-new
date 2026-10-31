"use client";

import L from "leaflet";
import { StyledBasemap } from "./styled-basemap";
import { reportCategoryPaths } from "./report-category-icon";
import { useEffect } from "react";
import {
  MapContainer,
  Marker,
  Tooltip,
  useMap,
} from "react-leaflet";
import {
  normalizeReportStatus,
  reportStatusLabel,
  shortReportCategory,
} from "@/lib/report-utils";
import type { CommunityReport } from "@/lib/types";

const barangayCenter: [number, number] = [9.7392, 118.7353];

type ComplaintMapProps = {
  reports: CommunityReport[];
  selectedReport: CommunityReport | null;
  onSelect: (report: CommunityReport) => void;
};

export function ComplaintMap({
  reports,
  selectedReport,
  onSelect,
}: ComplaintMapProps) {
  return (
    <MapContainer
      center={barangayCenter}
      zoom={13}
      minZoom={1}
      maxZoom={19}
      scrollWheelZoom={true}
      zoomSnap={0}
      zoomDelta={0.5}
      wheelPxPerZoomLevel={240}
      className="leaflet-map"
    >
      <StyledBasemap />
      <MapFocus selectedReport={selectedReport} />
      {reports.map((report) => (
        <Marker
          eventHandlers={{ click: () => onSelect(report) }}
          icon={createPinIcon(
            statusColor(normalizeReportStatus(report.status)),
            selectedReport?.id === report.id,
            report.category,
          )}
          title={`${shortReportCategory(report.category)}: ${report.reporter_name ?? "Resident"}`}
          alt={`${shortReportCategory(report.category)} report marker`}
          key={report.id}
          position={[report.latitude!, report.longitude!]}
        >
          <Tooltip>
            {shortReportCategory(report.category)} -{" "}
            {reportStatusLabel(normalizeReportStatus(report.status))}
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  );
}

function MapFocus({
  selectedReport,
}: {
  selectedReport: CommunityReport | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedReport?.latitude != null && selectedReport.longitude != null) {
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      map.flyTo([selectedReport.latitude, selectedReport.longitude], 16, {
        animate: !reduceMotion,
        duration: reduceMotion ? 0 : 0.65,
      });
    }
  }, [map, selectedReport]);

  return null;
}

function createPinIcon(color: string, selected: boolean, category?: string) {
  const size = selected ? 58 : 48;

  return L.divIcon({
    className: "",
    html: `
      <div class="map-pin ${selected ? "selected" : ""}" style="width:${size}px;height:${size}px">
        <span class="map-category-pin" style="border-color:${color};color:${color}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${reportCategoryPaths(category).map(d => '<path d="'+d+'"/>').join('')}</svg></span>
      </div>
    `,
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function statusColor(status: string) {
  if (status === "resolved") return "#2FB887";
  if (status === "in progress") return "#0087EF";
  return "#E4A000";
}
