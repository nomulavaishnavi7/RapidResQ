// src/components/dashboard/Dashboard.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { hospitalService } from '../../services/hospitalService';
import { Emergency, isCriticalCondition } from '../../types';
import EmergencyAlert from './EmergencyAlert';
import ResourceManager from '../resources/ResourceManager';
import EmergencyMap from '../map/EmergencyMap';
import EmergencyDetailsModal from './EmergencyDetailsModal';
import './Dashboard.css';

interface DashboardProps {
  hospitalId: string;
  hospitalName: string;
  onLogout: () => void;
}

// Helper function to safely get timestamp value
const getTimestampValue = (timestamp: any): number => {
  if (!timestamp) return Date.now();
  if (timestamp.toMillis) return timestamp.toMillis();
  if (typeof timestamp === 'number') return timestamp;
  if (timestamp.seconds) return timestamp.seconds * 1000;
  return Date.now();
};

const Dashboard: React.FC<DashboardProps> = ({
  hospitalId,
  hospitalName,
  onLogout
}) => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmergency, setSelectedEmergency] = useState<Emergency | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [modalProcessing, setModalProcessing] = useState(false);
  const [hospitalLocation, setHospitalLocation] = useState<{
    lat: number;
    lng: number;
    name: string;
  } | undefined>(undefined);
  const [newEmergencyIds, setNewEmergencyIds] = useState<Set<string>>(new Set());
  
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    accepted: 0,
    rejected: 0,
    critical: 0
  });
  
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted'>('all');
  const [showMap, setShowMap] = useState(true);

  // DEBUG: Log hospitalId on mount and when it changes
  useEffect(() => {
    console.log('🏥 Dashboard mounted/updated with hospitalId:', hospitalId);
    console.log('🏥 Dashboard mounted/updated with hospitalName:', hospitalName);
    console.log('📋 Expected filtering:');
    console.log('   - candidateHospitals.includes("' + hospitalId + '")');
    console.log('   - assignedHospitalId === "' + hospitalId + '"');
  }, [hospitalId, hospitalName]);

  // Track previous emergencies for notifications
  const previousEmergenciesRef = useRef<Emergency[]>([]);

  // Notification handler
  const handleNewEmergency = useCallback((emergency: Emergency) => {
    console.log('🔔 New emergency detected:', emergency.id, emergency.patientCondition);
    setNewEmergencyIds(prev => new Set(prev).add(emergency.id));
    
    // Auto-select new emergency briefly
    setTimeout(() => {
      setSelectedEmergency(emergency);
    }, 500);
  }, []);

  // Check for new emergencies
  const checkForNewEmergencies = useCallback((currentEmergencies: Emergency[]) => {
    const previousIds = new Set(previousEmergenciesRef.current.map(e => e.id));
    const newEmergencies = currentEmergencies.filter(e => !previousIds.has(e.id));
    
    newEmergencies.forEach(emergency => {
      handleNewEmergency(emergency);
    });
    
    previousEmergenciesRef.current = currentEmergencies;
  }, [handleNewEmergency]);

  // Fetch hospital location
  useEffect(() => {
    const fetchHospitalLocation = async () => {
      try {
        const hospital = await hospitalService.getHospitalById(hospitalId);
        if (hospital && hospital.location) {
          setHospitalLocation({
            lat: hospital.location.latitude,
            lng: hospital.location.longitude,
            name: hospital.name
          });
          console.log('📍 Hospital location loaded for:', hospital.name);
        } else {
          console.warn('⚠️ Hospital not found for ID:', hospitalId);
        }
      } catch (error) {
        console.error('Error fetching hospital location:', error);
      }
    };
    fetchHospitalLocation();
  }, [hospitalId]);

  // Subscribe to emergencies using hospitalService (which handles filtering)
  useEffect(() => {
    setLoading(true);
    
    console.log('📡 Subscribing to emergencies for hospitalId:', hospitalId);
    
    const unsubscribe = hospitalService.subscribeToEmergencies(
      hospitalId,
      (filteredEmergencies: Emergency[]) => {
        console.log('📊 Received filtered emergencies count:', filteredEmergencies.length);
        
        // Log each emergency's filtering details
        filteredEmergencies.forEach(emergency => {
          console.log(`   - Emergency ${emergency.id}: status=${emergency.status}, assignedTo=${emergency.assignedHospitalId}, candidateHospitals=${emergency.candidateHospitals?.join(',') || 'none'}`);
        });
        
        setEmergencies(filteredEmergencies);
        setLoading(false);
        
        // Check for new emergencies for notifications
        checkForNewEmergencies(filteredEmergencies);
        
        // Calculate stats based on filtered emergencies
        const pending = filteredEmergencies.filter(e => e.status === 'pending').length;
        const accepted = filteredEmergencies.filter(e => 
          e.status === 'accepted' && e.assignedHospitalId === hospitalId
        ).length;
        const rejected = filteredEmergencies.filter(e => e.status === 'rejected').length;
        const critical = filteredEmergencies.filter(e => 
          e.status === 'pending' && (e.isCritical || isCriticalCondition(e.patientCondition))
        ).length;
        
        setStats({ 
          total: filteredEmergencies.length, 
          pending, 
          accepted, 
          rejected, 
          critical 
        });
      },
      handleNewEmergency // Pass the callback for new emergencies
    );

    return () => {
      console.log('🛑 Unsubscribing from emergencies');
      hospitalService.unsubscribeFromEmergencies(hospitalId);
    };
  }, [hospitalId, hospitalName, checkForNewEmergencies, handleNewEmergency]);

  // Filter emergencies for UI (client-side filtering based on status)
  const filteredEmergencies = useCallback(() => {
    if (filter === 'all') return emergencies;
    if (filter === 'pending') return emergencies.filter(e => e.status === 'pending');
    if (filter === 'accepted') return emergencies.filter(e => 
      e.status === 'accepted' && e.assignedHospitalId === hospitalId
    );
    return emergencies;
  }, [emergencies, filter, hospitalId]);

  // Sort emergencies: critical pending first, then pending, then by timestamp
  const sortedEmergencies = useCallback(() => {
    return [...filteredEmergencies()].sort((a, b) => {
      const aIsCritical = a.status === 'pending' && (a.isCritical || isCriticalCondition(a.patientCondition));
      const bIsCritical = b.status === 'pending' && (b.isCritical || isCriticalCondition(b.patientCondition));
      if (aIsCritical && !bIsCritical) return -1;
      if (!aIsCritical && bIsCritical) return 1;
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      
      const aTime = getTimestampValue(a.createdAt);
      const bTime = getTimestampValue(b.createdAt);
      return bTime - aTime;
    });
  }, [filteredEmergencies]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleActionComplete = () => {
    console.log('🔄 Emergency action completed');
  };

  const handleEmergencySelect = (emergency: Emergency) => {
    setSelectedEmergency(emergency);
    const element = document.getElementById(`emergency-${emergency.id}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleViewDetails = (emergency: Emergency) => {
    setSelectedEmergency(emergency);
    setShowDetailsModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailsModal(false);
    setSelectedEmergency(null);
    setModalProcessing(false);
  };

  // 🔥 UPDATED: Accept from modal with location data
  const handleAcceptFromModal = async () => {
    if (!selectedEmergency) return;
    setModalProcessing(true);
    try {
      await hospitalService.updateEmergencyStatus(
        selectedEmergency.id, 
        'accepted', 
        hospitalId, 
        hospitalName,
        hospitalLocation,  // Pass hospital location for distance calculation
        { lat: selectedEmergency.latitude, lng: selectedEmergency.longitude }  // Pass patient location
      );
      handleCloseModal();
      handleActionComplete();
    } catch (error) {
      console.error('Error accepting emergency:', error);
    } finally {
      setModalProcessing(false);
    }
  };

  const handleRejectFromModal = async () => {
    if (!selectedEmergency) return;
    setModalProcessing(true);
    try {
      await hospitalService.updateEmergencyStatus(selectedEmergency.id, 'rejected', hospitalId);
      handleCloseModal();
      handleActionComplete();
    } catch (error) {
      console.error('Error rejecting emergency:', error);
    } finally {
      setModalProcessing(false);
    }
  };

  if (loading && emergencies.length === 0) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading emergencies...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1>RapidResQ Dashboard</h1>
          <span className="hospital-name">{hospitalName}</span>
          {/* DEBUG: Show hospital ID for verification */}
          <span style={{ fontSize: '12px', color: '#999', marginLeft: '10px' }}>
            (ID: {hospitalId.substring(0, 8)}...)
          </span>
        </div>
        <div className="header-right">
          <button className="map-toggle-button" onClick={() => setShowMap(!showMap)}>
            {showMap ? '🗺️ Hide Map' : '🗺️ Show Map'}
          </button>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Requests</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card accepted">
          <div className="stat-value">{stats.accepted}</div>
          <div className="stat-label">Accepted</div>
        </div>
        <div className="stat-card critical">
          <div className="stat-value">{stats.critical}</div>
          <div className="stat-label">Critical</div>
        </div>
      </div>

      <ResourceManager hospitalId={hospitalId} />

      {showMap && (
        <EmergencyMap 
          emergencies={emergencies} 
          selectedEmergency={selectedEmergency} 
          hospitalLocation={hospitalLocation} 
        />
      )}

      <div className="dashboard-main">
        <div className="emergencies-section">
          <div className="section-header">
            <h2>Emergency Requests</h2>
            <div className="filter-buttons">
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`} 
                onClick={() => setFilter('all')}
              >
                All ({stats.total})
              </button>
              <button 
                className={`filter-btn ${filter === 'pending' ? 'active' : ''}`} 
                onClick={() => setFilter('pending')}
              >
                Pending ({stats.pending})
              </button>
              <button 
                className={`filter-btn ${filter === 'accepted' ? 'active' : ''}`} 
                onClick={() => setFilter('accepted')}
              >
                Accepted ({stats.accepted})
              </button>
            </div>
          </div>

          <div className="emergency-summary">
            <div className="summary-item">
              <span className="summary-label">Critical Pending:</span>
              <span className="summary-value critical">{stats.critical}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Response Rate:</span>
              <span className="summary-value">
                {stats.total > 0 ? Math.round(((stats.accepted + stats.rejected) / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Your Acceptance Rate:</span>
              <span className="summary-value success">
                {stats.pending + stats.accepted > 0 
                  ? Math.round((stats.accepted / (stats.pending + stats.accepted)) * 100) 
                  : 0}%
              </span>
            </div>
          </div>

          <div className="emergencies-list">
            {sortedEmergencies().length === 0 ? (
              <div className="no-emergencies">
                <p>No emergencies to display</p>
              </div>
            ) : (
              sortedEmergencies().map((emergency) => (
                <div 
                  key={emergency.id} 
                  id={`emergency-${emergency.id}`} 
                  className={`emergency-wrapper ${selectedEmergency?.id === emergency.id ? 'selected' : ''}`} 
                  onClick={() => handleEmergencySelect(emergency)}
                >
                  <EmergencyAlert
                    emergency={emergency}
                    hospitalId={hospitalId}
                    hospitalName={hospitalName}
                    onAccept={(emergencyId) => hospitalService.updateEmergencyStatus(
                      emergencyId, 
                      'accepted', 
                      hospitalId, 
                      hospitalName,
                      hospitalLocation,  // Pass hospital location for distance calculation
                      { lat: emergency.latitude, lng: emergency.longitude }  // Pass patient location
                    )}
                    onReject={(emergencyId) => hospitalService.updateEmergencyStatus(emergencyId, 'rejected', hospitalId)}
                    onActionComplete={handleActionComplete}
                    onViewDetails={handleViewDetails}
                    isNew={newEmergencyIds.has(emergency.id)}
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showDetailsModal && selectedEmergency && (
        <EmergencyDetailsModal
          emergency={selectedEmergency}
          onClose={handleCloseModal}
          onAccept={handleAcceptFromModal}
          onReject={handleRejectFromModal}
          isProcessing={modalProcessing}
        />
      )}
    </div>
  );
};

export default Dashboard;