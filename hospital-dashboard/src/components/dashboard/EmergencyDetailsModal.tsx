// src/components/dashboard/EmergencyDetailsModal.tsx
import React from 'react';
import { Emergency, formatDateTime, getEmergencyCoordinates, hasValidLocation, isCriticalCondition } from '../../types';
import './EmergencyDetailsModal.css';

interface EmergencyDetailsModalProps {
  emergency: Emergency;
  onClose: () => void;
  onAccept?: () => void;
  onReject?: () => void;
  isProcessing?: boolean;
}

const EmergencyDetailsModal: React.FC<EmergencyDetailsModalProps> = ({
  emergency,
  onClose,
  onAccept,
  onReject,
  isProcessing = false
}) => {
  const coords = getEmergencyCoordinates(emergency);
  const isValidLocation = hasValidLocation(emergency);
  const isCritical = emergency.isCritical || isCriticalCondition(emergency.patientCondition);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'pending': return '#f39c12';
      case 'accepted': return '#27ae60';
      case 'rejected': return '#e74c3c';
      case 'completed': return '#3498db';
      case 'cancelled': return '#95a5a6';
      default: return '#95a5a6';
    }
  };

  const getStatusText = (status: string): string => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Helper to format location address
  const getLocationAddress = (): string => {
    if (emergency.address) {
      return emergency.address;
    }
    if (isValidLocation) {
      return `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`;
    }
    return 'Location unavailable';
  };

  // Helper to check if emergency has any timeline events
  const hasTimelineEvents = (): boolean => {
    return !!(emergency.timeline?.created || 
              emergency.timeline?.accepted || 
              emergency.timeline?.rejected ||
              emergency.timeline?.assigned);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Emergency Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="emergency-badge-container">
            <div className="emergency-badge" style={{ backgroundColor: getStatusColor(emergency.status) }}>
              Status: {getStatusText(emergency.status).toUpperCase()}
            </div>
            {isCritical && (
              <div className="critical-tag-modal">
                ⚠️ CRITICAL CONDITION
              </div>
            )}
          </div>

          {/* Patient Information */}
          <div className="info-section">
            <h3>👤 Patient Information</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Name:</span>
                <span className="info-value">{emergency.patientName}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Condition:</span>
                <span className="info-value">{emergency.patientCondition}</span>
              </div>
              {emergency.patientAge && (
                <div className="info-item">
                  <span className="info-label">Age:</span>
                  <span className="info-value">{emergency.patientAge} years</span>
                </div>
              )}
              {emergency.bloodType && (
                <div className="info-item">
                  <span className="info-label">Blood Type:</span>
                  <span className="info-value">{emergency.bloodType}</span>
                </div>
              )}
              {emergency.emergencyType && emergency.emergencyType !== 'OTHER' && (
                <div className="info-item">
                  <span className="info-label">Emergency Type:</span>
                  <span className="info-value">{emergency.emergencyType.replace('_', ' ')}</span>
                </div>
              )}
              {emergency.description && (
                <div className="info-item full-width">
                  <span className="info-label">Description:</span>
                  <span className="info-value">{emergency.description}</span>
                </div>
              )}
            </div>
          </div>

          {/* Location Information */}
          <div className="info-section">
            <h3>📍 Location</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Coordinates:</span>
                <span className="info-value">
                  {isValidLocation 
                    ? `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}` 
                    : 'Unavailable'}
                </span>
              </div>
              <div className="info-item full-width">
                <span className="info-label">Address:</span>
                <span className="info-value">{getLocationAddress()}</span>
              </div>
            </div>
          </div>

          {/* Hospital Assignment */}
          <div className="info-section">
            <h3>🏥 Hospital Assignment</h3>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Assigned Hospital:</span>
                <span className="info-value">{emergency.assignedHospitalName || 'Not assigned'}</span>
              </div>
              {emergency.assignedHospitalId && (
                <div className="info-item">
                  <span className="info-label">Hospital ID:</span>
                  <span className="info-value">{emergency.assignedHospitalId}</span>
                </div>
              )}
            </div>
          </div>

          {/* Timeline */}
          {hasTimelineEvents() && (
            <div className="info-section">
              <h3>⏱️ Timeline</h3>
              <div className="timeline">
                {emergency.timeline?.created && (
                  <TimelineItem 
                    label="Emergency Created" 
                    timestamp={emergency.timeline.created} 
                    type="created" 
                  />
                )}
                {emergency.timeline?.assigned && (
                  <TimelineItem 
                    label="Assigned to Hospital" 
                    timestamp={emergency.timeline.assigned} 
                    type="assigned" 
                  />
                )}
                {emergency.timeline?.accepted && (
                  <TimelineItem 
                    label="Accepted by Hospital" 
                    timestamp={emergency.timeline.accepted} 
                    type="accepted" 
                  />
                )}
                {emergency.timeline?.rejected && (
                  <TimelineItem 
                    label="Rejected by Hospital" 
                    timestamp={emergency.timeline.rejected} 
                    type="rejected" 
                  />
                )}
              </div>
            </div>
          )}

          {/* Additional Info */}
          {emergency.createdAt && (
            <div className="info-section">
              <h3>📅 Request Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Request ID:</span>
                  <span className="info-value">{emergency.id}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Created At:</span>
                  <span className="info-value">{formatDateTime(emergency.createdAt)}</span>
                </div>
                {emergency.updatedAt && (
                  <div className="info-item">
                    <span className="info-label">Last Updated:</span>
                    <span className="info-value">{formatDateTime(emergency.updatedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="close-button" onClick={onClose}>
            Close
          </button>
          {emergency.status === 'pending' && onAccept && onReject && (
            <div className="action-buttons">
              <button 
                className="accept-button" 
                onClick={onAccept} 
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : '✓ Accept Emergency'}
              </button>
              <button 
                className="reject-button" 
                onClick={onReject} 
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : '✗ Reject Emergency'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface TimelineItemProps {
  label: string;
  timestamp: any; // Timestamp from Firestore
  type: string;
}

const TimelineItem: React.FC<TimelineItemProps> = ({ label, timestamp, type }) => {
  const getDotClass = () => {
    switch (type) {
      case 'created': return 'timeline-dot created';
      case 'assigned': return 'timeline-dot assigned';
      case 'accepted': return 'timeline-dot accepted';
      case 'rejected': return 'timeline-dot rejected';
      default: return 'timeline-dot';
    }
  };

  return (
    <div className="timeline-item">
      <div className={getDotClass()}></div>
      <div className="timeline-content">
        <strong>{label}</strong>
        <span>{formatDateTime(timestamp)}</span>
      </div>
    </div>
  );
};

export default EmergencyDetailsModal;