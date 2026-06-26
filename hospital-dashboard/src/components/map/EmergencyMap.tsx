// ======================================================
// FILE: src/components/map/EmergencyMap.tsx
// ======================================================

import React, { useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Emergency, getEmergencyCoordinates, hasValidLocation, isCriticalCondition } from '../../types';
import './EmergencyMap.css';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom marker icons
const createPatientIcon = (isCritical: boolean, isSelected: boolean): L.DivIcon => {
  const size = isSelected ? 44 : 36;
  const color = isCritical ? '#e74c3c' : '#f39c12';
  const pulseAnimation = isCritical ? 'pulse 1.5s infinite' : 'none';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background-color: ${color};
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid white;
        box-shadow: 0 2px 12px rgba(0,0,0,0.3);
        animation: ${pulseAnimation};
        ${isSelected ? 'box-shadow: 0 0 0 4px rgba(52,152,219,0.6);' : ''}
      ">
        <span style="font-size: ${size * 0.5}px;">🚑</span>
      </div>
    `,
    iconSize: [size, size],
    popupAnchor: [0, -size / 2]
  });
};

const hospitalIcon = L.divIcon({
  className: 'custom-marker',
  html: `
    <div style="
      background-color: #27ae60;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
      <span style="font-size: 22px;">🏥</span>
    </div>
  `,
  iconSize: [40, 40],
  popupAnchor: [0, -20]
});

// Component to fit bounds
const FitBounds: React.FC<{
  patientLocations: Array<{ lat: number; lng: number }>;
  hospitalLocation?: { lat: number; lng: number };
  selectedEmergency?: Emergency | null;
}> = ({ patientLocations, hospitalLocation, selectedEmergency }) => {
  const map = useMap();
  
  useEffect(() => {
    const points: L.LatLngTuple[] = [];
    
    if (selectedEmergency && hasValidLocation(selectedEmergency)) {
      const coords = getEmergencyCoordinates(selectedEmergency);
      points.push([coords.lat, coords.lng]);
    } else {
      if (hospitalLocation) {
        points.push([hospitalLocation.lat, hospitalLocation.lng]);
      }
      patientLocations.forEach(loc => {
        points.push([loc.lat, loc.lng]);
      });
    }
    
    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, patientLocations, hospitalLocation, selectedEmergency]);
  
  return null;
};

// Component to draw route
const RoutePolyline: React.FC<{
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
}> = ({ start, end }) => {
  const positions: L.LatLngTuple[] = [[start.lat, start.lng], [end.lat, end.lng]];
  
  return (
    <Polyline
      positions={positions}
      color="#3498db"
      weight={4}
      opacity={0.8}
      dashArray="10, 10"
    />
  );
};

interface EmergencyMapProps {
  emergencies: Emergency[];
  selectedEmergency?: Emergency | null;
  hospitalLocation?: { lat: number; lng: number; name: string };
}

const EmergencyMap: React.FC<EmergencyMapProps> = ({
  emergencies,
  selectedEmergency,
  hospitalLocation
}) => {
  const validEmergencies = emergencies.filter(e => hasValidLocation(e) && e.status === 'pending');
  const patientLocations = validEmergencies.map(e => getEmergencyCoordinates(e));
  
  const initialCenter: [number, number] = hospitalLocation 
    ? [hospitalLocation.lat, hospitalLocation.lng]
    : patientLocations.length > 0 
      ? [patientLocations[0].lat, patientLocations[0].lng]
      : [20.5937, 78.9629];

  // Get selected emergency coordinates for route
  const selectedCoords = selectedEmergency && hasValidLocation(selectedEmergency)
    ? getEmergencyCoordinates(selectedEmergency)
    : null;

  return (
    <div className="emergency-map-container">
      <div className="map-header">
        <h3>Emergency Locations</h3>
        <div className="map-legend">
          <div className="legend-item"><span className="legend-dot hospital"></span>Hospital</div>
          <div className="legend-item"><span className="legend-dot emergency"></span>Emergency</div>
          <div className="legend-item"><span className="legend-dot critical"></span>Critical</div>
          <div className="legend-item"><span className="legend-dot selected"></span>Selected</div>
          <div className="legend-item"><span className="legend-dot route"></span>Route</div>
        </div>
      </div>
      
      <MapContainer
        center={initialCenter}
        zoom={13}
        style={{ height: '450px', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        <TileLayer 
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        
        <FitBounds
          patientLocations={patientLocations}
          hospitalLocation={hospitalLocation}
          selectedEmergency={selectedEmergency}
        />
        
        {/* Hospital Marker */}
        {hospitalLocation && (
          <Marker position={[hospitalLocation.lat, hospitalLocation.lng]} icon={hospitalIcon}>
            <Popup>
              <strong>🏥 {hospitalLocation.name}</strong><br />
              <span>Hospital Location</span>
            </Popup>
          </Marker>
        )}
        
        {/* Route from Hospital to Selected Emergency */}
        {selectedCoords && hospitalLocation && (
          <RoutePolyline start={hospitalLocation} end={selectedCoords} />
        )}
        
        {/* Patient Markers */}
        {validEmergencies.map((emergency) => {
          const coords = getEmergencyCoordinates(emergency);
          const isSelected = selectedEmergency?.id === emergency.id;
          const isCritical = emergency.isCritical || false;
          const icon = createPatientIcon(isCritical, isSelected);
          
          return (
            <Marker
              key={emergency.id}
              position={[coords.lat, coords.lng]}
              icon={icon}
            >
              <Popup>
                <div className="popup-content">
                  <strong>🚑 Emergency #{emergency.id.slice(-6)}</strong><br />
                  <strong>Condition:</strong> {emergency.patientCondition}<br />
                  <strong>Patient:</strong> {emergency.patientName}<br />
                  <strong>Status:</strong> 
                  <span className={`status-badge ${emergency.status}`}>{emergency.status}</span>
                  {isCritical && <span className="critical-badge">⚠️ CRITICAL</span>}
                  <hr />
                  <small>📍 {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}</small>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {validEmergencies.length > 0 && (
        <div className="map-emergency-count">
          {validEmergencies.length} active {validEmergencies.length === 1 ? 'emergency' : 'emergencies'}
        </div>
      )}
    </div>
  );
};

export default EmergencyMap;