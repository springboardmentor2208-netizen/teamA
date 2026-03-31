import React, { useEffect, useRef, useState, useCallback } from "react";

/* ─────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────── */
const STATUS_COLORS = {
  pending:       "#d97706",
  "in-progress": "#0d9488",
  resolved:      "#16a34a",
};
const PRIORITY_COLORS = {
  low:      "#16a34a",
  medium:   "#d97706",
  high:     "#f97316",
  critical: "#ef4444",
};

/* ─────────────────────────────────────────
   CDN LOADERS
───────────────────────────────────────── */
function loadLink(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const l = document.createElement("link");
  l.rel = "stylesheet"; l.href = href;
  document.head.appendChild(l);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.setAttribute("data-src", src);
    s.src = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ─────────────────────────────────────────
   VALID POINTS HELPER
───────────────────────────────────────── */
function validPoints(issues) {
  return issues.filter(
    i => i.latitude && i.longitude &&
         !isNaN(Number(i.latitude)) && !isNaN(Number(i.longitude))
  );
}

/* ═════════════════════════════════════════
   MAP VIEW COMPONENT
═════════════════════════════════════════ */
const MapView = ({ issues }) => {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef([]);

  const [colorBy,      setColorBy]      = useState("status");
  const [leafletReady, setLeafletReady] = useState(!!window.L);

  /* ── Load Leaflet once ── */
  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    loadLink("https://unpkg.com/leaflet@1.9.4/dist/leaflet.css");
    loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js")
      .then(() => setLeafletReady(true))
      .catch(e => console.error("Leaflet failed to load:", e));
  }, []);

  /* ── Inject popup z-index fix once ── */
  useEffect(() => {
    const styleId = "cp-leaflet-popup-fix";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .leaflet-pane { z-index: 400 !important; }
      .leaflet-tile-pane { z-index: 200 !important; }
      .leaflet-overlay-pane { z-index: 400 !important; }
      .leaflet-shadow-pane { z-index: 500 !important; }
      .leaflet-marker-pane { z-index: 600 !important; }
      .leaflet-tooltip-pane { z-index: 650 !important; }
      .leaflet-popup-pane { z-index: 700 !important; }
      .leaflet-popup { z-index: 700 !important; }
      .leaflet-container { z-index: 0; }
      .cp-leaflet-popup .leaflet-popup-content-wrapper {
        border-radius: 14px !important;
        border: 1px solid #e2e8f0 !important;
        box-shadow: 0 8px 30px rgba(15,23,42,.18) !important;
        padding: 0 !important;
        font-family: 'DM Sans', sans-serif !important;
      }
      .cp-leaflet-popup .leaflet-popup-content {
        margin: 14px 16px !important;
        font-family: 'DM Sans', sans-serif !important;
        line-height: 1.5 !important;
      }
      .cp-leaflet-popup .leaflet-popup-tip-container {
        z-index: 701 !important;
      }
      .cp-leaflet-popup .leaflet-popup-tip {
        background: white !important;
        box-shadow: none !important;
      }
      .cp-leaflet-popup .leaflet-popup-close-button {
        color: #94a3b8 !important;
        font-size: 18px !important;
        top: 6px !important;
        right: 8px !important;
        z-index: 702 !important;
      }
      .cp-leaflet-popup .leaflet-popup-close-button:hover {
        color: #ef4444 !important;
      }
    `;
    document.head.appendChild(style);
  }, []);

  /* ── Init map once Leaflet is ready ── */
  useEffect(() => {
    if (!leafletReady || !containerRef.current || mapRef.current) return;

    const L   = window.L;
    const map = L.map(containerRef.current, {
      center: [20.5937, 78.9629], zoom: 5, zoomControl: false,
    });
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: "abcd", maxZoom: 19 }
    ).addTo(map);

    mapRef.current = map;

    const t = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(t);
  }, [leafletReady]);

  /* ── Cleanup on unmount ── */
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = [];
    };
  }, []);

  /* ── Draw / redraw whenever data or options change ── */
  const drawLayer = useCallback(() => {
    const L   = window.L;
    const map = mapRef.current;
    if (!L || !map) return;

    /* clear markers */
    markersRef.current.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    markersRef.current = [];

    const pts = validPoints(issues);
    if (!pts.length) return;

    pts.forEach(issue => {
      const color =
        colorBy === "priority"
          ? (PRIORITY_COLORS[issue.priority] || "#1a56db")
          : (STATUS_COLORS[issue.status]     || "#1a56db");

      const icon = L.divIcon({
        className: "",
        html: `<div style="
          width:22px;height:22px;
          border-radius:50% 50% 50% 0;
          background:${color};
          border:2.5px solid #fff;
          box-shadow:0 2px 8px rgba(0,0,0,.3);
          transform:rotate(-45deg);
          cursor:pointer;
        "></div>`,
        iconSize: [22, 22], iconAnchor: [11, 22], popupAnchor: [0, -26],
      });

      const sc = STATUS_COLORS[issue.status]     || "#64748b";
      const pc = PRIORITY_COLORS[issue.priority] || "#64748b";

      const marker = L.marker([Number(issue.latitude), Number(issue.longitude)], { icon });
      marker.bindPopup(`
        <div style="font-family:'DM Sans',sans-serif;min-width:200px;padding:4px 2px;">
          <div style="font-size:10px;font-weight:700;color:#1a56db;background:#e8f0fe;
            display:inline-block;padding:2px 8px;border-radius:5px;margin-bottom:8px;letter-spacing:.5px;">
            #${issue._id.slice(-6).toUpperCase()}
          </div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:8px;line-height:1.3;">
            ${issue.issueType}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
            <span style="background:${sc}1a;color:${sc};padding:3px 9px;border-radius:20px;
              font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
              <span style="width:5px;height:5px;border-radius:50%;background:currentColor;flex-shrink:0;"></span>
              ${issue.status}
            </span>
            <span style="background:${pc}1a;color:${pc};padding:3px 9px;border-radius:20px;
              font-size:11px;font-weight:600;">
              ${issue.priority}
            </span>
          </div>
          <div style="font-size:11.5px;color:#64748b;line-height:1.5;display:flex;gap:5px;align-items:flex-start;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2" style="flex-shrink:0;margin-top:2px;">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5z"/>
            </svg>
            ${issue.address || "Location not specified"}
          </div>
        </div>
      `, { maxWidth: 260, className: "cp-leaflet-popup" });

      marker.addTo(map);
      markersRef.current.push(marker);
    });

    const bounds = L.latLngBounds(pts.map(i => [Number(i.latitude), Number(i.longitude)]));
    map.fitBounds(bounds.pad(0.18), { maxZoom: 13, animate: false });
  }, [issues, colorBy]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    drawLayer();
  }, [drawLayer, leafletReady]);

  /* ── Derived counts ── */
  const valid = validPoints(issues);
  const sCounts = {
    pending:       issues.filter(i => i.status === "pending").length,
    "in-progress": issues.filter(i => i.status === "in-progress").length,
    resolved:      issues.filter(i => i.status === "resolved").length,
  };
  const pCounts = {
    critical: issues.filter(i => i.priority === "critical").length,
    high:     issues.filter(i => i.priority === "high").length,
    medium:   issues.filter(i => i.priority === "medium").length,
    low:      issues.filter(i => i.priority === "low").length,
  };

  const PinIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1112 6a2.5 2.5 0 010 5z"/>
    </svg>
  );

  return (
    <div className="cp-map-container">

      {/* ── CONTROLS BAR ── */}
      <div className="cp-map-controls">
        <div className="cp-map-controls-left">
          <span className="cp-map-stat">
            <PinIcon />
            {valid.length} of {issues.length} mapped
          </span>
          {valid.length < issues.length && (
            <span className="cp-map-warning">
              {issues.length - valid.length} without coordinates
            </span>
          )}
        </div>

        <div className="cp-map-controls-right">
          <div className="cp-map-toggle-group">
            <button
              className={`cp-map-toggle-btn ${colorBy === "status" ? "active" : ""}`}
              onClick={() => setColorBy("status")}
            >Status</button>
            <button
              className={`cp-map-toggle-btn ${colorBy === "priority" ? "active" : ""}`}
              onClick={() => setColorBy("priority")}
            >Priority</button>
          </div>
        </div>
      </div>

      {/* ── MAP + LEGEND ── */}
      <div className="cp-map-body">
        <div ref={containerRef} className="cp-map-leaflet" />

        <div className="cp-map-legend">
          <div className="cp-map-legend-title">
            {colorBy === "status" ? "By Status" : "By Priority"}
          </div>
          {colorBy === "status"
            ? Object.entries(STATUS_COLORS).map(([k, c]) => (
                <div key={k} className="cp-map-legend-row">
                  <span className="cp-map-legend-pin" style={{ background: c }} />
                  <span className="cp-map-legend-label">{k}</span>
                  <span className="cp-map-legend-count" style={{ color: c, background: c + "1a" }}>
                    {sCounts[k] || 0}
                  </span>
                </div>
              ))
            : Object.entries(PRIORITY_COLORS).map(([k, c]) => (
                <div key={k} className="cp-map-legend-row">
                  <span className="cp-map-legend-pin" style={{ background: c }} />
                  <span className="cp-map-legend-label">{k}</span>
                  <span className="cp-map-legend-count" style={{ color: c, background: c + "1a" }}>
                    {pCounts[k] || 0}
                  </span>
                </div>
              ))
          }
        </div>
      </div>

      {/* ── NO GPS DATA OVERLAY ── */}
      {valid.length === 0 && (
        <div className="cp-map-empty-overlay">
          <div className="cp-map-empty-icon">🗺️</div>
          <h3>No location data available</h3>
          <p>Issues need latitude &amp; longitude coordinates to appear on the map.</p>
        </div>
      )}
    </div>
  );
};

export default MapView;