// FILE: src/components/map/CityMapView.tsx
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { adminService } from '../../services/adminService';
import type { Emergency, Hospital } from '../../services/adminService';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, Building2 } from 'lucide-react';

// Fix Leaflet icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons
const emergencyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const criticalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Component to fit bounds
const FitBounds: React.FC<{ emergencies: Emergency[]; hospitals: Hospital[] }> = ({ emergencies, hospitals }) => {
  const map = useMap();
  
  useEffect(() => {
    const points = [
      ...emergencies.filter(e => e.latitude && e.longitude).map(e => [e.latitude, e.longitude]),
      ...hospitals.filter(h => h.location?.latitude && h.location?.longitude).map(h => [h.location.latitude, h.location.longitude])
    ].filter(p => p[0] !== 0 && p[1] !== 0 && p[0] !== undefined && p[1] !== undefined);
    
    if (points.length > 0) {
      try {
        const bounds = L.latLngBounds(points as L.LatLngExpression[]);
        map.fitBounds(bounds, { padding: [50, 50] });
      } catch (error) {
        console.error('Error fitting bounds:', error);
      }
    }
  }, [emergencies, hospitals, map]);
  
  return null;
};

const CityMapView: React.FC = () => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeEmergencies = adminService.listenToEmergencies((emergencies) => {
      setEmergencies(emergencies);
      setLoading(false);
    });

    const unsubscribeHospitals = adminService.listenToHospitals((hospitals) => {
      setHospitals(hospitals);
    });

    return () => {
      unsubscribeEmergencies();
      unsubscribeHospitals();
    };
  }, []);

  const getEmergencyIcon = (emergency: Emergency) => {
    if (emergency.priority === 'critical') return criticalIcon;
    return emergencyIcon;
  };

  // Check if coordinates are valid
  const isValidCoordinates = (lat: number | undefined, lng: number | undefined): boolean => {
    return lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0;
  };

  const defaultCenter: [number, number] = [20.5937, 78.9629]; // Center of India

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading map data...</p>
        </div>
      </div>
    );
  }

  // Filter out emergencies and hospitals with invalid coordinates
  const validEmergencies = emergencies.filter(e => isValidCoordinates(e.latitude, e.longitude));
  const validHospitals = hospitals.filter(h => isValidCoordinates(h.location?.latitude, h.location?.longitude));

  if (mapError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-3" />
          <p className="text-gray-700 dark:text-gray-300">Error loading map</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{mapError}</p>
          <button
            onClick={() => setMapError(null)}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">City Map View</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time emergency and hospital locations</p>
          {validEmergencies.length !== emergencies.length && (
            <p className="text-xs text-yellow-600 mt-1">
              Note: {emergencies.length - validEmergencies.length} emergencies have invalid coordinates and cannot be shown
            </p>
          )}
        </div>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Emergency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Critical Emergency</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-gray-600 dark:text-gray-400">Hospital</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden" style={{ height: '600px' }}>
        {validEmergencies.length === 0 && validHospitals.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Building2 size={48} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 dark:text-gray-400">No locations to display</p>
              <p className="text-sm text-gray-400 mt-1">Add emergencies or hospitals with valid coordinates</p>
            </div>
          </div>
        ) : (
          <MapContainer
            center={defaultCenter}
            zoom={5}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
            whenReady={() => setMapError(null)}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Emergency Markers */}
            {validEmergencies.map((emergency) => (
              <Marker
                key={`emergency-${emergency.id}`}
                position={[emergency.latitude!, emergency.longitude!]}
                icon={getEmergencyIcon(emergency)}
                eventHandlers={{
                  click: () => setSelectedEmergency(emergency),
                }}
              >
                <Popup>
                  <div className="min-w-[220px]">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle size={16} className="text-red-500" />
                      <h3 className="font-bold text-gray-900">{emergency.patientName}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-1">{emergency.emergencyType.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{emergency.description}</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Status:</span>
                        <span className="font-medium capitalize">{emergency.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Priority:</span>
                        <span className={`font-medium ${emergency.priority === 'critical' ? 'text-red-500' : 'text-orange-500'}`}>
                          {emergency.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Time:</span>
                        <span>{formatDistanceToNow(emergency.createdAt.toDate(), { addSuffix: true })}</span>
                      </div>
                    </div>
                    {emergency.status === 'pending' && (
                      <button
                        onClick={() => adminService.updateEmergencyStatus(emergency.id, 'accepted')}
                        className="mt-3 w-full px-3 py-1.5 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition"
                      >
                        Accept Emergency
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* Hospital Markers */}
            {validHospitals.map((hospital) => (
              <Marker
                key={`hospital-${hospital.id}`}
                position={[hospital.location!.latitude, hospital.location!.longitude]}
                icon={hospitalIcon}
              >
                <Popup>
                  <div className="min-w-[200px]">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={16} className="text-blue-500" />
                      <h3 className="font-bold text-gray-900">{hospital.name}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{hospital.address}</p>
                    <div className="space-y-1 text-xs">
                      <div>📞 {hospital.phone}</div>
                      <div>🛏️ ICU: {hospital.resources.icuBeds.available}/{hospital.resources.icuBeds.total}</div>
                      <div>💨 Ventilators: {hospital.resources.ventilators.available}/{hospital.resources.ventilators.total}</div>
                      <div>🚑 Ambulances: {hospital.resources.ambulances.available}/{hospital.resources.ambulances.total}</div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
            
            <FitBounds emergencies={validEmergencies} hospitals={validHospitals} />
          </MapContainer>
        )}
      </div>

      {selectedEmergency && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-5 max-w-sm border-l-4 border-red-500 animate-slideInRight z-50">
          <div className="flex justify-between items-start mb-3">
            <h3 className="font-bold text-gray-900 dark:text-white">Emergency Details</h3>
            <button onClick={() => setSelectedEmergency(null)} className="text-gray-400 hover:text-gray-600">✕</button>
          </div>
          <div className="space-y-2">
            <p><strong className="text-gray-700 dark:text-gray-300">Patient:</strong> {selectedEmergency.patientName}</p>
            <p><strong className="text-gray-700 dark:text-gray-300">Type:</strong> {selectedEmergency.emergencyType.replace('_', ' ')}</p>
            <p><strong className="text-gray-700 dark:text-gray-300">Condition:</strong> {selectedEmergency.condition}</p>
            <p><strong className="text-gray-700 dark:text-gray-300">Location:</strong> {selectedEmergency.address || `${selectedEmergency.latitude}, ${selectedEmergency.longitude}`}</p>
            <button
              onClick={() => adminService.updateEmergencyStatus(selectedEmergency.id, 'accepted')}
              className="mt-3 w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-medium"
            >
              Accept Emergency
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CityMapView;