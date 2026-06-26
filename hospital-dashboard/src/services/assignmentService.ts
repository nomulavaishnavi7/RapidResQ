// ======================================================
// FILE: src/services/assignmentService.ts
// UPDATED with Medical Priority Logic
// ======================================================

import { doc, getDoc, getDocs, updateDoc, collection, query, where, Timestamp,limit } from 'firebase/firestore';
import { db } from './firebase';
import { PatientLocation, Hospital } from '../types';
import { calculateDistance, calculateTravelTime } from '../utils/distance';

interface AssignmentResult {
  hospitalId: string;
  hospitalName: string;
  distance: number;
  travelTime: number;
  score?: number;
  success: boolean;
  error?: string;
}

interface Ambulance {
  id: string;
  vehicleNumber: string;
  type: string;
  status: string;
  currentLocation?: { latitude: number; longitude: number };
}

class AssignmentService {
  private static instance: AssignmentService;
  private readonly MAX_DISTANCE_KM = 15;

  private constructor() {}

  public static getInstance(): AssignmentService {
    if (!AssignmentService.instance) {
      AssignmentService.instance = new AssignmentService();
    }
    return AssignmentService.instance;
  }

  /**
   * Check if emergency is CRITICAL
   */
  private isCriticalEmergency(emergencyType: string): boolean {
    const criticalTypes = ['CARDIAC_EMERGENCY', 'STROKE', 'RESPIRATORY', 'NEUROLOGICAL'];
    return criticalTypes.includes(emergencyType);
  }

  /**
   * Get required resources based on emergency type
   */
  private getRequiredResources(emergencyType: string): {
    requiredCapabilities: string[];
    requiredResources: Record<string, number>;
    priorityLevel: string;
  } {
    switch (emergencyType) {
      case 'CARDIAC_EMERGENCY':
        return {
          requiredCapabilities: ['CARDIAC', 'CARDIOLOGY', 'ICU'],
          requiredResources: { icuBedsAvailable: 1, ventilatorsAvailable: 1 },
          priorityLevel: 'CRITICAL'
        };
      case 'STROKE':
        return {
          requiredCapabilities: ['NEUROLOGY', 'STROKE', 'ICU'],
          requiredResources: { icuBedsAvailable: 1 },
          priorityLevel: 'CRITICAL'
        };
      case 'RESPIRATORY':
        return {
          requiredCapabilities: ['RESPIRATORY', 'PULMONOLOGY', 'ICU'],
          requiredResources: { ventilatorsAvailable: 1 },
          priorityLevel: 'CRITICAL'
        };
      case 'NEUROLOGICAL':
        return {
          requiredCapabilities: ['NEUROLOGY', 'ICU'],
          requiredResources: { icuBedsAvailable: 1 },
          priorityLevel: 'CRITICAL'
        };
      case 'TRAUMA':
        return {
          requiredCapabilities: ['TRAUMA', 'EMERGENCY', 'SURGERY'],
          requiredResources: { availableBeds: 1 },
          priorityLevel: 'HIGH'
        };
      case 'DIABETIC':
        return {
          requiredCapabilities: ['EMERGENCY', 'ENDOCRINOLOGY'],
          requiredResources: { availableBeds: 1 },
          priorityLevel: 'MODERATE'
        };
      case 'ALLERGIC':
        return {
          requiredCapabilities: ['EMERGENCY', 'ALLERGY'],
          requiredResources: { availableBeds: 1 },
          priorityLevel: 'MODERATE'
        };
      default:
        return {
          requiredCapabilities: ['EMERGENCY'],
          requiredResources: { availableBeds: 1 },
          priorityLevel: 'NORMAL'
        };
    }
  }

  /**
   * Check if hospital capabilities match required capabilities
   */
  private checkCapabilityMatch(capabilities: string[], requiredCapabilities: string[]): boolean {
    if (!capabilities || capabilities.length === 0) {
      return requiredCapabilities.includes('EMERGENCY');
    }
    
    return requiredCapabilities.some(required =>
      capabilities.some(cap => cap.toUpperCase().includes(required))
    );
  }

  /**
   * Check if hospital has required resources
   */
  private hasRequiredResources(
    resources: any,
    requiredResources: Record<string, number>
  ): boolean {
    for (const [key, requiredAmount] of Object.entries(requiredResources)) {
      const available = resources[key] || 0;
      if (available < requiredAmount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate resource availability score (0-1)
   */
  private calculateResourceScore(resources: any, requiredResources: Record<string, number>): number {
    if (Object.keys(requiredResources).length === 0) return 0.5;
    
    let totalScore = 0;
    let count = 0;
    
    for (const [key, requiredAmount] of Object.entries(requiredResources)) {
      const available = resources[key] || 0;
      const score = Math.min(available / requiredAmount, 1.0);
      totalScore += score;
      count++;
    }
    
    return count > 0 ? totalScore / count : 0.5;
  }

  /**
   * Calculate distance score (0-1, closer is better)
   */
  private calculateDistanceScore(distance: number): number {
    return 1 - Math.min(distance / this.MAX_DISTANCE_KM, 1);
  }

  /**
   * Calculate final hospital score with dynamic weights based on criticality
   */
  private calculateHospitalScore(
    distance: number,
    resources: any,
    emergencyType: string
  ): number {
    const isCritical = this.isCriticalEmergency(emergencyType);
    const required = this.getRequiredResources(emergencyType);
    
    // Dynamic weights based on emergency criticality
    const distanceWeight = isCritical ? 0.7 : 0.3;
    const resourceWeight = isCritical ? 0.3 : 0.7;
    
    const distanceScore = this.calculateDistanceScore(distance);
    const resourceScore = this.calculateResourceScore(resources, required.requiredResources);
    
    return (distanceScore * distanceWeight) + (resourceScore * resourceWeight);
  }

  /**
   * Calculate distance
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private calculateTravelTime(distanceKm: number, speedKmh: number = 40): number {
    return (distanceKm / speedKmh) * 60;
  }

  /**
   * Find and rank top hospitals with medical priority logic
   */
  async findTopHospitals(
    patientLocation: PatientLocation,
    emergencyType: string,
    radiusKm: number = 15,
    topCount: number = 3
  ): Promise<Array<{ hospital: Hospital; distance: number; score: number; travelTime: number }>> {
    try {
      if (!patientLocation || patientLocation.latitude === 0 || patientLocation.longitude === 0) {
        throw new Error('Invalid patient location');
      }

      const isCritical = this.isCriticalEmergency(emergencyType);
      const required = this.getRequiredResources(emergencyType);
      
      console.log(`🏥 Finding top hospitals for ${emergencyType} (Critical: ${isCritical})`);
      console.log(`📋 Required capabilities: ${required.requiredCapabilities.join(', ')}`);
      console.log(`📋 Required resources:`, required.requiredResources);

      // Fetch all hospitals
      const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
      const eligibleHospitals: Array<{ hospital: Hospital; distance: number; score: number; travelTime: number }> = [];

      for (const doc of hospitalsSnapshot.docs) {
        const data = doc.data();
        
        // Check location
        if (!data.location || data.location.latitude === 0 || data.location.longitude === 0) {
          continue;
        }

        const distance = this.calculateDistance(
          patientLocation.latitude,
          patientLocation.longitude,
          data.location.latitude,
          data.location.longitude
        );

        // Filter by radius
        if (distance > radiusKm) continue;

        // Check capabilities match
        const capabilities = data.capabilities || [];
        if (!this.checkCapabilityMatch(capabilities, required.requiredCapabilities)) {
          console.log(`❌ ${data.name} - missing required capabilities`);
          continue;
        }

        // Check required resources
        const resources = data.resources || {};
        if (!this.hasRequiredResources(resources, required.requiredResources)) {
          console.log(`❌ ${data.name} - missing required resources`);
          continue;
        }

        // Calculate score
        const score = this.calculateHospitalScore(distance, resources, emergencyType);
        
        eligibleHospitals.push({
          hospital: {
            id: doc.id,
            name: data.name || 'Unknown Hospital',
            email: data.email || '',
            phone: data.phone || '',
            address: data.address || '',
            location: data.location,
            capabilities: data.capabilities || [],
            verified: data.verified || false
          },
          distance,
          score,
          travelTime: this.calculateTravelTime(distance)
        });
        
        console.log(`✅ ${data.name}: distance=${distance.toFixed(1)}km, score=${score.toFixed(2)}`);
      }

      // Sort by score (highest first)
      eligibleHospitals.sort((a, b) => b.score - a.score);
      
      console.log(`🏆 Found ${eligibleHospitals.length} eligible hospitals, returning top ${topCount}`);
      
      return eligibleHospitals.slice(0, topCount);
    } catch (error) {
      console.error('Error finding top hospitals:', error);
      return [];
    }
  }

  /**
   * Assign the best hospital to an emergency
   */
  async assignBestHospital(
    emergencyId: string,
    patientLocation: PatientLocation,
    emergencyType: string
  ): Promise<AssignmentResult[]> {
    try {
      const emergencyRef = doc(db, 'emergency_requests', emergencyId);
      const emergencySnap = await getDoc(emergencyRef);
      
      if (!emergencySnap.exists()) {
        throw new Error(`Emergency ${emergencyId} not found`);
      }

      const topHospitals = await this.findTopHospitals(patientLocation, emergencyType);
      
      if (topHospitals.length === 0) {
        throw new Error('No suitable hospitals found');
      }

      const isCritical = this.isCriticalEmergency(emergencyType);
      const required = this.getRequiredResources(emergencyType);
      
      const candidateHospitalIds = topHospitals.map(h => h.hospital.id);
      const rankings: Record<string, any> = {};
      topHospitals.forEach(h => {
        rankings[h.hospital.id] = {
          score: h.score,
          distance: h.distance,
          travelTime: h.travelTime,
          priorityLevel: required.priorityLevel
        };
      });

      await updateDoc(emergencyRef, {
        candidateHospitals: candidateHospitalIds,
        hospitalRankings: rankings,
        isLocked: true,
        isCritical: isCritical,
        priorityLevel: required.priorityLevel,
        status: 'pending',
        updatedAt: Timestamp.now(),
        'timeline.dispatched': Timestamp.now()
      });

      console.log(`✅ Emergency ${emergencyId} locked with ${candidateHospitalIds.length} candidates`);

      return topHospitals.map(h => ({
        hospitalId: h.hospital.id,
        hospitalName: h.hospital.name,
        distance: h.distance,
        travelTime: h.travelTime,
        score: h.score,
        success: true
      }));
    } catch (error: any) {
      console.error('Error assigning hospital:', error);
      return [{
        hospitalId: '',
        hospitalName: '',
        distance: 0,
        travelTime: 0,
        success: false,
        error: error.message || 'Failed to assign hospital'
      }];
    }
  }

  /**
   * Find nearest available ambulance
   */
  async findNearestAmbulance(
    patientLocation: PatientLocation,
    radiusKm: number = 10
  ): Promise<{ ambulance: Ambulance; distance: number; travelTime: number } | null> {
    try {
      const ambulancesSnapshot = await getDocs(
        query(
          collection(db, 'ambulances'),
          where('status', '==', 'available'),
          limit(50)
        )
      );
      
      if (ambulancesSnapshot.empty) {
        console.warn('No available ambulances found');
        return null;
      }
      
      let nearestAmbulance: Ambulance | null = null;
      let shortestDistance = Infinity;
      
      for (const doc of ambulancesSnapshot.docs) {
        const data = doc.data();
        const location = data.currentLocation;
        
        if (!location || !location.latitude || !location.longitude) continue;
        
        const distance = this.calculateDistance(
          patientLocation.latitude,
          patientLocation.longitude,
          location.latitude,
          location.longitude
        );
        
        if (distance <= radiusKm && distance < shortestDistance) {
          shortestDistance = distance;
          nearestAmbulance = {
            id: doc.id,
            vehicleNumber: data.vehicleNumber || '',
            type: data.type || 'BASIC',
            status: data.status || 'available',
            currentLocation: location
          };
        }
      }
      
      if (nearestAmbulance) {
        return {
          ambulance: nearestAmbulance,
          distance: shortestDistance,
          travelTime: this.calculateTravelTime(shortestDistance, 60)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error finding nearest ambulance:', error);
      return null;
    }
  }

  /**
   * Assign ambulance to emergency
   */
  async assignAmbulanceToEmergency(
    emergencyId: string,
    patientLocation: PatientLocation
  ): Promise<{ ambulanceId: string; eta: number; success: boolean; error?: string }> {
    try {
      const emergencyRef = doc(db, 'emergency_requests', emergencyId);
      const emergencySnap = await getDoc(emergencyRef);
      
      if (!emergencySnap.exists()) {
        throw new Error(`Emergency ${emergencyId} not found`);
      }
      
      const currentStatus = emergencySnap.data()?.status;
      if (currentStatus !== 'accepted') {
        throw new Error('Emergency must be accepted before assigning ambulance');
      }
      
      const nearest = await this.findNearestAmbulance(patientLocation);
      
      if (!nearest) {
        throw new Error('No available ambulances found');
      }
      
      await updateDoc(emergencyRef, {
        assignedAmbulanceId: nearest.ambulance.id,
        ambulanceDistance: nearest.distance,
        ambulanceEta: Math.round(nearest.travelTime),
        status: 'ambulance_assigned',
        updatedAt: Timestamp.now(),
        'timeline.ambulance_assigned': Timestamp.now()
      });
      
      const ambulanceRef = doc(db, 'ambulances', nearest.ambulance.id);
      await updateDoc(ambulanceRef, {
        status: 'assigned',
        assignedEmergencyId: emergencyId,
        updatedAt: Timestamp.now()
      });
      
      console.log(`🚑 Ambulance ${nearest.ambulance.id} assigned to emergency ${emergencyId}`);
      
      return {
        ambulanceId: nearest.ambulance.id,
        eta: Math.round(nearest.travelTime),
        success: true
      };
    } catch (error: any) {
      console.error('Error assigning ambulance:', error);
      return {
        ambulanceId: '',
        eta: 0,
        success: false,
        error: error.message || 'Failed to assign ambulance'
      };
    }
  }
}

export const assignmentService = AssignmentService.getInstance();