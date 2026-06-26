// ======================================================
// FILE: src/types/index.ts
// ======================================================

// Location Types
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface PatientLocation extends Location {
  address?: string;
}

// Emergency Types
export type EmergencyStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface EmergencyTimeline {
  created: number;
  assigned?: number;
  accepted?: number;
  rejected?: number;
  completed?: number;
  cancelled?: number;
}

export interface Emergency {
  id: string;
  patientId?: string;
  patientName: string;
  patientCondition: string;
  patientAge?: number;
  bloodType?: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  assignedHospitalId: string;
  assignedHospitalName?: string;
  assignedAmbulanceId?: string;
  status: EmergencyStatus;
  createdAt: number;
  updatedAt?: number;
  timestamp?: number;
  timeline: EmergencyTimeline;
  isCritical?: boolean;
  emergencyType?: string;
  
  // NEW DISPATCH FIELDS
  candidateHospitals?: string[];
  hospitalRankings?: Record<string, { score: number; distance: number }>;
  isLocked?: boolean;
  acceptedBy?: string;
  acceptedAt?: number;
  
  // 🔥 NEW: Distance and ETA fields (for patient app display)
  distanceToHospital?: number;      // Distance in kilometers from patient to hospital
  estimatedTravelTime?: number;     // Estimated travel time in minutes
}

// Hospital Types
export interface Hospital {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: Location;
  capabilities: string[];
  verified: boolean;
}

// Resource Types
export interface HospitalResources {
  hospitalId: string;
  availableBeds: number;
  totalBeds: number;
  availableDoctors: number;
  totalDoctors: number;
  availableAmbulances: number;
  totalAmbulances: number;
  icuBedsAvailable: number;
  icuBedsTotal: number;
  ventilatorsAvailable: number;
  ventilatorsTotal: number;
  lastUpdated: number;
}

// Auth Types
export interface HospitalUser {
  uid: string;
  email: string;
  hospitalId: string;
  hospitalName: string;
}

// Utility Functions
export const isCriticalCondition = (condition: string): boolean => {
  const criticalKeywords = [
    'cardiac', 'heart', 'stroke', 'trauma', 'severe',
    'critical', 'bleeding', 'unconscious', 'arrest', 'respiratory'
  ];
  return criticalKeywords.some(keyword => 
    condition?.toLowerCase().includes(keyword) || false
  );
};

export const hasValidLocation = (emergency: Emergency): boolean => {
  if (!emergency.latitude || !emergency.longitude) return false;
  return emergency.latitude !== 0 && emergency.longitude !== 0 && 
         !isNaN(emergency.latitude) && !isNaN(emergency.longitude);
};

export const getEmergencyCoordinates = (emergency: Emergency): { lat: number; lng: number } => {
  return {
    lat: emergency.latitude || 0,
    lng: emergency.longitude || 0
  };
};

export const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

export const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

export function getSeverityLevel(condition: string): 'low' | 'medium' | 'high' | 'critical' {
  const lower = condition.toLowerCase();

  if (
    lower.includes('critical') ||
    lower.includes('heart') ||
    lower.includes('stroke')
  ) {
    return 'critical';
  }

  if (
    lower.includes('serious') ||
    lower.includes('trauma') ||
    lower.includes('neurological')
  ) {
    return 'high';
  }

  if (
    lower.includes('urgent') ||
    lower.includes('breathing') ||
    lower.includes('respiratory')
  ) {
    return 'medium';
  }

  return 'low';
}

// 🔥 NEW: Helper function to format distance for display
export const formatDistance = (distanceKm?: number): string => {
  if (distanceKm === undefined || distanceKm === null) return 'Calculating...';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} meters`;
  }
  return `${distanceKm.toFixed(1)} km`;
};

// 🔥 NEW: Helper function to format travel time for display
export const formatTravelTime = (minutes?: number): string => {
  if (minutes === undefined || minutes === null) return 'Calculating...';
  if (minutes < 60) {
    return `${minutes} minutes`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
};