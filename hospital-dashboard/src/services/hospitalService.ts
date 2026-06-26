// ======================================================
// FILE: src/services/hospitalService.ts
// UPDATED - Now calculates and saves distance and ETA
// ======================================================

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  getDoc,
  setDoc,
  orderBy,
  Unsubscribe,
  Timestamp,
  getDocs,
  limit,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { db } from './firebase';
import {
  Emergency,
  EmergencyStatus,
  EmergencyTimeline,
  HospitalResources,
  Hospital,
  isCriticalCondition
} from '../types';
import { calculateDistance, calculateTravelTime } from '../utils/distance';

class HospitalService {
  private static instance: HospitalService;
  private emergencyListeners: Map<string, Unsubscribe> = new Map();
  private newEmergencyCallbacks: Map<string, (emergency: Emergency) => void> = new Map();
  
  // Cache for hospital ID by email
  private hospitalIdCache: Map<string, string> = new Map();

  private constructor() {}

  public static getInstance(): HospitalService {
    if (!HospitalService.instance) {
      HospitalService.instance = new HospitalService();
    }
    return HospitalService.instance;
  }

  /**
   * 🔥 FIXED: Case-insensitive email lookup
   */
  async getCorrectHospitalId(email: string): Promise<string | null> {
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Check cache first
      if (this.hospitalIdCache.has(normalizedEmail)) {
        const cachedId = this.hospitalIdCache.get(normalizedEmail);
        console.log('📋 Using cached hospital ID:', cachedId);
        return cachedId!;
      }
      
      console.log('🔍 Looking up hospital document for email:', normalizedEmail);
      
      const hospitalsRef = collection(db, 'hospitals');
      const querySnapshot = await getDocs(hospitalsRef);
      
      let foundHospital = null;
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const docEmail = data.email;
        if (docEmail && docEmail.toLowerCase() === normalizedEmail) {
          foundHospital = { id: doc.id, ...data };
          break;
        }
      }
      
      if (foundHospital) {
        const hospitalId = foundHospital.id;
        const hospitalName = (foundHospital as any).name;
        
        this.hospitalIdCache.set(normalizedEmail, hospitalId);
        
        console.log('✅ Found hospital:', { id: hospitalId, name: hospitalName });
        return hospitalId;
      } else {
        console.error('❌ No hospital found with email:', normalizedEmail);
        return null;
      }
    } catch (error) {
      console.error('Error finding hospital by email:', error);
      return null;
    }
  }

  /**
   * Get hospital details including the correct ID
   */
  async getHospitalByEmail(email: string): Promise<{ id: string; name: string } | null> {
    try {
      const normalizedEmail = email.toLowerCase();
      const hospitalsRef = collection(db, 'hospitals');
      const querySnapshot = await getDocs(hospitalsRef);
      
      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        const docEmail = data.email;
        if (docEmail && docEmail.toLowerCase() === normalizedEmail) {
          return {
            id: doc.id,
            name: data.name || email.split('@')[0]
          };
        }
      }
      return null;
    } catch (error) {
      console.error('Error finding hospital by email:', error);
      return null;
    }
  }

  /**
   * Clear hospital ID cache (call on logout)
   */
  clearHospitalIdCache(): void {
    this.hospitalIdCache.clear();
    console.log('🗑️ Hospital ID cache cleared');
  }

  /**
   * Map Firestore document to Emergency type
   */
  private mapFirestoreToEmergency(doc: any): Emergency {
    const data = doc.data();
    const docId = doc.id;
    
    const timelineData = data.timeline || {};
    const timeline: EmergencyTimeline = {
      created: timelineData.created?.toMillis?.() || timelineData.created || data.createdAt?.toMillis?.() || Date.now(),
      assigned: timelineData.assigned?.toMillis?.(),
      accepted: timelineData.accepted?.toMillis?.(),
      rejected: timelineData.rejected?.toMillis?.(),
      completed: timelineData.completed?.toMillis?.(),
      cancelled: timelineData.cancelled?.toMillis?.()
    };
    
    const patientCondition = data.patientCondition || data.condition || 'Not specified';
    
    return {
      id: docId,
      patientId: data.patientId,
      patientName: data.patientName || 'Unknown',
      patientCondition: patientCondition,
      patientAge: data.patientAge,
      bloodType: data.bloodType,
      description: data.description || '',
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      address: data.address || '',
      assignedHospitalId: data.assignedHospitalId || '',
      assignedHospitalName: data.assignedHospitalName,
      assignedAmbulanceId: data.assignedAmbulanceId,
      status: data.status || 'pending',
      createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
      updatedAt: data.updatedAt?.toMillis?.(),
      timestamp: data.timestamp?.toMillis?.() || data.timestamp,
      timeline,
      isCritical: data.isCritical || isCriticalCondition(patientCondition),
      emergencyType: data.emergencyType,
      candidateHospitals: data.candidateHospitals ? [...data.candidateHospitals] : [],
      hospitalRankings: data.hospitalRankings ? { ...data.hospitalRankings } : {},
      isLocked: data.isLocked || false,
      acceptedBy: data.acceptedBy,
      acceptedAt: data.acceptedAt?.toMillis?.() || data.acceptedAt,
      distanceToHospital: data.distanceToHospital,
      estimatedTravelTime: data.estimatedTravelTime,
    };
  }

  /**
   * Subscribe to real-time emergency updates
   */
  subscribeToEmergencies(
    hospitalId: string,
    callback: (emergencies: Emergency[]) => void,
    onNewEmergency?: (emergency: Emergency) => void
  ): Unsubscribe {
    this.unsubscribeFromEmergencies(hospitalId);
    
    if (onNewEmergency) {
      this.newEmergencyCallbacks.set(hospitalId, onNewEmergency);
    }

    const allEmergenciesQuery = query(
      collection(db, 'emergency_requests'),
      orderBy('createdAt', 'desc')
    );
    
    let allEmergencies: Emergency[] = [];
    let previousEmergencyIds = new Set<string>();
    
    const unsubscribe = onSnapshot(allEmergenciesQuery, 
      (snapshot) => {
        const newEmergencies: Emergency[] = [];
        const newEmergencyIds = new Set<string>();
        
        snapshot.forEach((doc) => {
          try {
            const emergency = this.mapFirestoreToEmergency(doc);
            newEmergencies.push(emergency);
            newEmergencyIds.add(emergency.id);
          } catch (error) {
            console.error('Error mapping emergency:', doc.id, error);
          }
        });
        
        const newIds = [...newEmergencyIds].filter(id => !previousEmergencyIds.has(id));
        if (newIds.length > 0 && this.newEmergencyCallbacks.get(hospitalId)) {
          const newEmergenciesList = newEmergencies.filter(e => newIds.includes(e.id));
          newEmergenciesList.forEach(e => this.newEmergencyCallbacks.get(hospitalId)?.(e));
        }
        
        previousEmergencyIds = newEmergencyIds;
        allEmergencies = newEmergencies;
        
        const filteredEmergencies = allEmergencies.filter(emergency => {
          if (emergency.status === 'accepted' && emergency.assignedHospitalId === hospitalId) {
            return true;
          }
          if (emergency.status === 'pending' && emergency.candidateHospitals?.includes(hospitalId)) {
            return true;
          }
          if (emergency.assignedHospitalId === hospitalId) {
            return true;
          }
          return false;
        });
        
        callback(filteredEmergencies);
      },
      (error) => {
        console.error('❌ Error in emergencies query:', error);
      }
    );
    
    this.emergencyListeners.set(hospitalId, unsubscribe);
    
    return () => {
      unsubscribe();
      this.newEmergencyCallbacks.delete(hospitalId);
    };
  }

  /**
   * Unsubscribe from emergency updates
   */
  unsubscribeFromEmergencies(hospitalId: string): void {
    const listener = this.emergencyListeners.get(hospitalId);
    if (listener) {
      listener();
      this.emergencyListeners.delete(hospitalId);
    }
  }

  /**
   * 🔥 UPDATED: Update emergency status with distance and ETA calculation
   */
  async updateEmergencyStatus(
    emergencyId: string,
    status: EmergencyStatus,
    hospitalId?: string,
    hospitalName?: string,
    hospitalLocation?: { lat: number; lng: number },
    patientLocation?: { lat: number; lng: number }
  ): Promise<void> {
    try {
      console.log('📝 Updating emergency status:', { emergencyId, status, hospitalId, hospitalName });

      if (!emergencyId) throw new Error('Emergency ID is required');

      const emergencyRef = doc(db, 'emergency_requests', emergencyId);
      const emergencySnap = await getDoc(emergencyRef);
      
      if (!emergencySnap.exists()) {
        throw new Error(`Emergency ${emergencyId} not found`);
      }
      
      const currentData = emergencySnap.data();
      const isLocked = currentData.isLocked || false;
      const currentStatus = currentData.status;
      
      if (status === 'accepted' && isLocked && currentStatus === 'accepted') {
        throw new Error('This emergency has already been accepted by another hospital');
      }
      
      const timeline = currentData.timeline || { 
        created: currentData.createdAt || Timestamp.now() 
      };
      
      const updateData: any = {
        status,
        updatedAt: Timestamp.now()
      };
      
      if (status === 'accepted') {
        timeline.accepted = Timestamp.now();
        updateData.timeline = timeline;
        
        if (hospitalId) {
          updateData.assignedHospitalId = hospitalId;
        }
        if (hospitalName) {
          updateData.assignedHospitalName = hospitalName;
        }
        
        // 🔥 CALCULATE DISTANCE AND ETA
        if (hospitalLocation && patientLocation) {
          const distance = calculateDistance(
            hospitalLocation.lat,
            hospitalLocation.lng,
            patientLocation.lat,
            patientLocation.lng
          );
          const travelTime = calculateTravelTime(distance);
          
          updateData.distanceToHospital = distance;
          updateData.estimatedTravelTime = Math.round(travelTime);
          
          console.log(`📏 Calculated distance: ${distance.toFixed(2)}km`);
          console.log(`⏱️ Estimated travel time: ${Math.round(travelTime)} minutes`);
        } else {
          console.warn('⚠️ Missing location data for distance calculation');
        }
        
        updateData.isLocked = true;
        updateData.acceptedBy = hospitalId;
        updateData.acceptedAt = Timestamp.now();
        console.log(`✅ Accepting emergency ${emergencyId} - LOCKING`);
      } 
      else if (status === 'rejected') {
        timeline.rejected = Timestamp.now();
        updateData.timeline = timeline;
        if (currentData.assignedHospitalId === hospitalId) {
          updateData.assignedHospitalId = '';
          updateData.assignedHospitalName = '';
        }
        console.log(`❌ Rejecting emergency ${emergencyId}`);
      }
      else if (status === 'completed') {
        timeline.completed = Timestamp.now();
        updateData.timeline = timeline;
        console.log(`✅ Completing emergency ${emergencyId}`);
      }
      else if (status === 'cancelled') {
        timeline.cancelled = Timestamp.now();
        updateData.timeline = timeline;
        console.log(`🚫 Cancelling emergency ${emergencyId}`);
      }
      
      await updateDoc(emergencyRef, updateData);
      console.log(`✅ Successfully updated emergency ${emergencyId} to ${status}`);
      
    } catch (error) {
      console.error('❌ Error updating emergency status:', error);
      throw new Error(`Failed to update emergency status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get emergency by ID
   */
  async getEmergencyById(emergencyId: string): Promise<Emergency | null> {
    try {
      const emergencyRef = doc(db, 'emergency_requests', emergencyId);
      const emergencySnap = await getDoc(emergencyRef);
      
      if (emergencySnap.exists()) {
        return this.mapFirestoreToEmergency(emergencySnap);
      }
      return null;
    } catch (error) {
      console.error('Error fetching emergency:', error);
      return null;
    }
  }

  /**
   * Get hospital details by Firestore document ID
   */
  async getHospitalById(hospitalId: string): Promise<Hospital | null> {
    try {
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      const hospitalSnap = await getDoc(hospitalRef);
      
      if (hospitalSnap.exists()) {
        const data = hospitalSnap.data();
        return {
          id: hospitalSnap.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          location: data.location || { latitude: 0, longitude: 0 },
          capabilities: data.capabilities || [],
          verified: data.verified || false
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching hospital:', error);
      return null;
    }
  }

  // ======================================================
  // 🔥 RESOURCE METHODS
  // ======================================================

  async getHospitalResources(identifier: string): Promise<HospitalResources | null> {
    try {
      let hospitalId = identifier;
      
      if (identifier.includes('@')) {
        const resolvedId = await this.getCorrectHospitalId(identifier);
        if (!resolvedId) {
          console.error('Could not resolve email to hospital ID:', identifier);
          return null;
        }
        hospitalId = resolvedId;
      }
      
      console.log('📊 Getting resources for hospital ID:', hospitalId);
      
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      const hospitalSnap = await getDoc(hospitalRef);
      
      if (hospitalSnap.exists()) {
        const data = hospitalSnap.data();
        const resources = data.resources || {};
        
        return {
          hospitalId: hospitalId,
          icuBedsAvailable: resources.icuBeds?.available || 0,
          icuBedsTotal: resources.icuBeds?.total || 20,
          ventilatorsAvailable: resources.ventilators?.available || 0,
          ventilatorsTotal: resources.ventilators?.total || 30,
          availableDoctors: resources.emergencyDoctors?.available || 0,
          totalDoctors: resources.emergencyDoctors?.total || 50,
          availableAmbulances: resources.ambulances?.available || 0,
          totalAmbulances: resources.ambulances?.total || 10,
          availableBeds: resources.regularBeds?.available || 0,
          totalBeds: resources.regularBeds?.total || 100,
          lastUpdated: data.lastUpdated?.toMillis?.() || data.lastUpdated || Date.now()
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching hospital resources:', error);
      return null;
    }
  }

  async updateHospitalResources(
    identifier: string,
    resources: Partial<HospitalResources>
  ): Promise<void> {
    try {
      let hospitalId = identifier;
      
      if (identifier.includes('@')) {
        const resolvedId = await this.getCorrectHospitalId(identifier);
        if (!resolvedId) {
          throw new Error(`Could not resolve email to hospital ID: ${identifier}`);
        }
        hospitalId = resolvedId;
        console.log('📝 Resolved email to hospital ID:', hospitalId);
      }
      
      console.log('📝 Updating hospital resources for ID:', hospitalId);
      
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      const hospitalSnap = await getDoc(hospitalRef);
      
      if (!hospitalSnap.exists()) {
        throw new Error(`Hospital document not found for ID: ${hospitalId}`);
      }
      
      const currentData = hospitalSnap.data();
      const currentResources = currentData.resources || {};
      
      const updatedResources: {
        icuBeds: { available: number; total: number };
        ventilators: { available: number; total: number };
        emergencyDoctors: { available: number; total: number };
        ambulances: { available: number; total: number };
        regularBeds?: { available: number; total: number };
      } = {
        icuBeds: {
          available: resources.icuBedsAvailable ?? currentResources.icuBeds?.available ?? 0,
          total: resources.icuBedsTotal ?? currentResources.icuBeds?.total ?? 20
        },
        ventilators: {
          available: resources.ventilatorsAvailable ?? currentResources.ventilators?.available ?? 0,
          total: resources.ventilatorsTotal ?? currentResources.ventilators?.total ?? 30
        },
        emergencyDoctors: {
          available: resources.availableDoctors ?? currentResources.emergencyDoctors?.available ?? 0,
          total: resources.totalDoctors ?? currentResources.emergencyDoctors?.total ?? 50
        },
        ambulances: {
          available: resources.availableAmbulances ?? currentResources.ambulances?.available ?? 0,
          total: resources.totalAmbulances ?? currentResources.ambulances?.total ?? 10
        }
      };
      
      if (resources.availableBeds !== undefined || resources.totalBeds !== undefined) {
        updatedResources.regularBeds = {
          available: resources.availableBeds ?? currentResources.regularBeds?.available ?? 0,
          total: resources.totalBeds ?? currentResources.regularBeds?.total ?? 100
        };
      }
      
      await setDoc(hospitalRef, {
        resources: updatedResources,
        lastUpdated: Timestamp.now()
      }, { merge: true });
      
      console.log(`✅ Hospital resources updated successfully for ${hospitalId}`);
      
    } catch (error) {
      console.error('❌ Error updating hospital resources:', error);
      throw new Error(`Failed to update hospital resources: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const hospitalService = HospitalService.getInstance();