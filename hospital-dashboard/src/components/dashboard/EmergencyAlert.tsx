// src/components/dashboard/EmergencyAlert.tsx
import React, { useState, useEffect } from 'react';
import { Emergency, isCriticalCondition, formatTimeAgo, getSeverityLevel } from '../../types';
import './EmergencyAlert.css';

interface EmergencyAlertProps {
  emergency: Emergency;
  hospitalId: string;
  hospitalName: string;
  onAccept: (emergencyId: string) => Promise<void>;
  onReject: (emergencyId: string) => Promise<void>;
  onActionComplete: () => void;
  onViewDetails: (emergency: Emergency) => void;
  isNew?: boolean;
}

const EmergencyAlert: React.FC<EmergencyAlertProps> = ({
  emergency,
  hospitalId,
  hospitalName,
  onAccept,
  onReject,
  onActionComplete,
  onViewDetails,
  isNew = false
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isNew) {
      // Auto-hide new indicator after 3 seconds
      const timer = setTimeout(() => {
        // New indicator will be removed by parent component
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isNew]);

  const handleAccept = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onAccept(emergency.id);
      onActionComplete();
    } catch (error) {
      console.error('Error accepting emergency:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onReject(emergency.id);
      onActionComplete();
    } catch (error) {
      console.error('Error rejecting emergency:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDetails = (e: React.MouseEvent) => {
    e.stopPropagation();
    onViewDetails(emergency);
  };

  const getSeverityClass = () => {
    const severity = getSeverityLevel(emergency.emergencyType || 'OTHER');
    return `severity-${severity}`;
  };

  const getStatusClass = () => {
    switch (emergency.status) {
      case 'pending':
        return 'pending';
      case 'accepted':
        return 'accepted';
      case 'rejected':
        return 'rejected';
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return '';
    }
  };

  const isCritical = emergency.isCritical || isCriticalCondition(emergency.patientCondition);
  const canAccept = emergency.status === 'pending';
  const canReject = emergency.status === 'pending';

  return (
    <div className={`emergency-alert ${getStatusClass()} ${isCritical ? 'critical' : ''} ${isNew ? 'new' : ''}`}>
      <div className="emergency-alert-header">
        <div className="patient-info">
          <h4 className="patient-name">{emergency.patientName}</h4>
          {emergency.patientAge && (
            <span className="patient-age">, {emergency.patientAge} years</span>
          )}
        </div>
        <div className="emergency-badges">
          {isCritical && (
            <span className="emergency-badge critical">CRITICAL</span>
          )}
          <span className={`emergency-badge ${getSeverityClass()}`}>
            {getSeverityLevel(emergency.emergencyType || 'OTHER')}
          </span>
          <span className={`status-badge ${emergency.status}`}>
            {emergency.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="emergency-alert-details">
        <div className="emergency-condition">
          <strong>Condition:</strong> {emergency.patientCondition}
        </div>
        {emergency.emergencyType && emergency.emergencyType !== 'OTHER' && (
          <div className="emergency-type">
            <strong>Type:</strong> {emergency.emergencyType.replace('_', ' ')}
          </div>
        )}
        {emergency.bloodType && (
          <div className="blood-type">
            <strong>Blood Type:</strong> {emergency.bloodType}
          </div>
        )}
        <div className="emergency-description">
          <strong>Description:</strong> {emergency.description}
        </div>
        <div className="emergency-location">
          📍 {emergency.address || `${emergency.latitude.toFixed(6)}, ${emergency.longitude.toFixed(6)}`}
        </div>
        <div className="emergency-time">
          🕒 {formatTimeAgo(emergency.createdAt)}
        </div>
        {emergency.assignedHospitalName && emergency.status === 'accepted' && (
          <div className="assigned-hospital">
            🏥 Assigned to: {emergency.assignedHospitalName}
          </div>
        )}
      </div>

      <div className="emergency-actions">
        {canAccept && (
          <button 
            className="accept-btn" 
            onClick={handleAccept}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner-small"></span>
                Processing...
              </>
            ) : (
              '✓ Accept Emergency'
            )}
          </button>
        )}
        {canReject && (
          <button 
            className="reject-btn" 
            onClick={handleReject}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="loading-spinner-small"></span>
                Processing...
              </>
            ) : (
              '✗ Reject'
            )}
          </button>
        )}
        <button 
          className="details-btn" 
          onClick={handleViewDetails}
          disabled={isProcessing}
        >
          📋 View Details
        </button>
      </div>
    </div>
  );
};

export default EmergencyAlert;