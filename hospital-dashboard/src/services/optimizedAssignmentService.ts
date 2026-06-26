// ======================================================
// FILE: src/services/optimizedAssignmentService.ts
// UPDATED with Fallback Radius Expansion System
// ======================================================

import { doc, getDoc, getDocs, updateDoc, collection, query, where, limit, orderBy, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { calculateDistance, calculateTravelTime } from '../utils/distance';
import { Hospital, PatientLocation } from '../types';

// Geohash utilities (simplified for demonstration)
// In production, use a library like 'geofirestore' or 'ngeohash'

interface GeoHashRange {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

interface RankedHospital {
  hospital: Hospital;
  distance: number;
  travelTime: number;
  score: number;
  resourceScore: number;
  distanceScore: number;
}

interface Ambulance {
  id: string;
  vehicleNumber: string;
  type: string;
  status: string;
  currentLocation?: { latitude: number; longitude: number };
}

class OptimizedAssignmentService {
  private static instance: OptimizedAssignmentService;
  
  // Caching for performance
  private hospitalCache: Map<string, Hospital> = new Map();
  private ambulanceCache: Map<string, Ambulance> = new Map();
  private lastHospitalCacheUpdate: number = 0;
  private lastAmbulanceCacheUpdate: number = 0;
  
  // Cache TTL (5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000;
  
  // Scoring weights
  private readonly DISTANCE_WEIGHT = 0.4;
  private readonly RESOURCE_WEIGHT = 0.6;
  private readonly MAX_DISTANCE_KM = 15;
  private readonly AMBULANCE_RADIUS_KM = 10;
  private readonly TOP_HOSPITALS_COUNT = 3;
  
  // NEW: Fallback radius tiers (km)
  private readonly RADIUS_TIERS = [15, 30, 50];

  private constructor() {}

  public static getInstance(): OptimizedAssignmentService {
    if (!OptimizedAssignmentService.instance) {
      OptimizedAssignmentService.instance = new OptimizedAssignmentService();
    }
    return OptimizedAssignmentService.instance;
  }

  /**
   * Calculate bounding box for radius search
   */
  private getBoundingBox(lat: number, lng: number, radiusKm: number): GeoHashRange {
    const latDelta = radiusKm / 111; // 1 degree ≈ 111 km
    const lngDelta = radiusKm / (111 * Math.cos(lat * (Math.PI / 180)));
    
    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta
    };
  }

  /**
   * Fetch hospitals within bounding box (optimized query)
   */
  private async getHospitalsInArea(
    lat: number,
    lng: number,
    radiusKm: number = 15
  ): Promise<Hospital[]> {
    const box = this.getBoundingBox(lat, lng, radiusKm);
    
    // Note: Requires composite index on location.latitude and location.longitude
    const hospitalsRef = collection(db, 'hospitals');
    const q = query(
      hospitalsRef,
      where('location.latitude', '>=', box.minLat),
      where('location.latitude', '<=', box.maxLat),
      where('location.longitude', '>=', box.minLng),
      where('location.longitude', '<=', box.maxLng),
      limit(100) // Limit for performance
    );
    
    const snapshot = await getDocs(q);
    const hospitals: Hospital[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      hospitals.push({
        id: doc.id,
        name: data.name || 'Unknown Hospital',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        location: data.location || { latitude: 0, longitude: 0 },
        capabilities: data.capabilities || [],
        verified: data.verified || false
      });
    });
    
    return hospitals;
  }

  /**
   * Calculate Haversine distance
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
   * Calculate hospital resource score
   */
  private calculateResourceScore(resources: any): number {
    if (!resources) return 0.5;
    
    const bedScore = (resources.availableBeds || 0) / (resources.totalBeds || 100);
    const doctorScore = (resources.availableDoctors || 0) / (resources.totalDoctors || 50);
    const ambulanceScore = (resources.availableAmbulances || 0) / (resources.totalAmbulances || 10);
    
    return (bedScore + doctorScore + ambulanceScore) / 3;
  }

  /**
   * Calculate distance score (normalized)
   */
  private calculateDistanceScore(distance: number, maxDistance: number): number {
    return 1 - Math.min(distance / maxDistance, 1);
  }

  /**
   * Calculate final hospital score with dynamic max distance
   */
  private calculateHospitalScore(distance: number, resources: any, maxDistance: number): number {
    const distanceScore = this.calculateDistanceScore(distance, maxDistance);
    const resourceScore = this.calculateResourceScore(resources);
    
    return (distanceScore * this.DISTANCE_WEIGHT) + (resourceScore * this.RESOURCE_WEIGHT);
  }

  /**
   * Check if hospital capabilities match emergency type
   */
  private checkCapabilityMatch(capabilities: string[], emergencyType: string): boolean {
    if (!capabilities || capabilities.length === 0) return true;
    
    const emergencyTypeMap: Record<string, string[]> = {
      'CARDIAC_EMERGENCY': ['CARDIAC', 'CARDIOLOGY', 'ICU', 'EMERGENCY'],
      'STROKE': ['NEUROLOGY', 'STROKE', 'ICU', 'EMERGENCY'],
      'TRAUMA': ['TRAUMA', 'EMERGENCY', 'SURGERY', 'ORTHOPEDICS'],
      'RESPIRATORY': ['RESPIRATORY', 'PULMONOLOGY', 'ICU', 'EMERGENCY'],
      'NEUROLOGICAL': ['NEUROLOGY', 'ICU', 'EMERGENCY'],
      'DIABETIC': ['ENDOCRINOLOGY', 'EMERGENCY', 'ICU'],
      'ALLERGIC': ['ALLERGY', 'EMERGENCY', 'ICU'],
      'OTHER': ['EMERGENCY']
    };
    
    const required = emergencyTypeMap[emergencyType] || ['EMERGENCY'];
    
    return required.some(req =>
      capabilities.some(cap => cap.toUpperCase().includes(req))
    );
  }

  /**
   * Get hospital resources from cache or Firestore
   */
  private async getHospitalResources(hospitalId: string): Promise<any> {
    try {
      const resourcesRef = doc(db, 'hospital_resources', hospitalId);
      const resourcesSnap = await getDoc(resourcesRef);
      return resourcesSnap.data() || {};
    } catch (error) {
      console.error('Error fetching resources:', error);
      return {};
    }
  }

  /**
   * Refresh hospital cache
   */
  async refreshHospitalCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastHospitalCacheUpdate < this.CACHE_TTL) {
      return; // Cache still fresh
    }
    
    try {
      const hospitalsSnapshot = await getDocs(collection(db, 'hospitals'));
      const newCache = new Map<string, Hospital>();
      
      hospitalsSnapshot.forEach((doc) => {
        const data = doc.data();
        newCache.set(doc.id, {
          id: doc.id,
          name: data.name || 'Unknown',
          email: data.email || '',
          phone: data.phone || '',
          address: data.address || '',
          location: data.location || { latitude: 0, longitude: 0 },
          capabilities: data.capabilities || [],
          verified: data.verified || false
        });
      });
      
      this.hospitalCache = newCache;
      this.lastHospitalCacheUpdate = now;
      console.log(`✅ Hospital cache refreshed: ${newCache.size} hospitals`);
    } catch (error) {
      console.error('Error refreshing hospital cache:', error);
    }
  }

  /**
   * Refresh ambulance cache
   */
  async refreshAmbulanceCache(): Promise<void> {
    const now = Date.now();
    if (now - this.lastAmbulanceCacheUpdate < this.CACHE_TTL) {
      return;
    }
    
    try {
      const ambulancesSnapshot = await getDocs(
        query(collection(db, 'ambulances'), where('status', '==', 'available'))
      );
      const newCache = new Map<string, Ambulance>();
      
      ambulancesSnapshot.forEach((doc) => {
        const data = doc.data();
        newCache.set(doc.id, {
          id: doc.id,
          vehicleNumber: data.vehicleNumber || '',
          type: data.type || 'BASIC',
          status: data.status || 'available',
          currentLocation: data.currentLocation
        });
      });
      
      this.ambulanceCache = newCache;
      this.lastAmbulanceCacheUpdate = now;
      console.log(`✅ Ambulance cache refreshed: ${newCache.size} ambulances`);
    } catch (error) {
      console.error('Error refreshing ambulance cache:', error);
    }
  }

  /**
   * Find top hospitals using optimized algorithm with FALLBACK RADIUS EXPANSION
   */
  async findTopHospitalsOptimized(
    patientLocation: PatientLocation,
    emergencyType: string,
    radiusKm: number = 15,
    topCount: number = 3
  ): Promise<RankedHospital[]> {
    try {
      // Refresh cache if needed
      await this.refreshHospitalCache();
      
      // NEW: Progressive radius search with fallback
      let allRankedHospitals: RankedHospital[] = [];
      let usedRadius = radiusKm;
      
      for (const currentRadius of this.RADIUS_TIERS) {
        console.log(`🔍 Searching within ${currentRadius}km radius...`);
        
        // Step 1: Get hospitals within bounding box
        const areaHospitals = await this.getHospitalsInArea(
          patientLocation.latitude,
          patientLocation.longitude,
          currentRadius
        );
        
        console.log(`📍 Found ${areaHospitals.length} hospitals within ${currentRadius}km area`);
        
        // Step 2: Filter and score
        const rankedForThisRadius: RankedHospital[] = [];
        
        for (const hospital of areaHospitals) {
          // Calculate exact distance
          const distance = this.calculateDistance(
            patientLocation.latitude,
            patientLocation.longitude,
            hospital.location.latitude,
            hospital.location.longitude
          );
          
          // Filter by exact radius
          if (distance > currentRadius) continue;
          
          // Check capability match
          if (!this.checkCapabilityMatch(hospital.capabilities, emergencyType)) continue;
          
          // Get resources (from cache or Firestore)
          const resources = await this.getHospitalResources(hospital.id);
          
          // Check if has resources (medical priority filtering)
          // CRITICAL: Check required resources based on emergency type
          const required = this.getRequiredResourcesForEmergency(emergencyType);
          if (!this.hasRequiredResources(resources, required)) continue;
          
          // Calculate scores using current radius for normalization
          const distanceScore = this.calculateDistanceScore(distance, currentRadius);
          const resourceScore = this.calculateResourceScore(resources);
          const totalScore = (distanceScore * this.DISTANCE_WEIGHT) + (resourceScore * this.RESOURCE_WEIGHT);
          
          rankedForThisRadius.push({
            hospital,
            distance,
            travelTime: this.calculateTravelTime(distance),
            score: totalScore,
            distanceScore,
            resourceScore
          });
        }
        
        // Sort by score (descending)
        rankedForThisRadius.sort((a, b) => b.score - a.score);
        
        console.log(`🏥 Found ${rankedForThisRadius.length} eligible hospitals within ${currentRadius}km`);
        
        // If we found hospitals in this radius, use them and stop expanding
        if (rankedForThisRadius.length > 0) {
          allRankedHospitals = rankedForThisRadius;
          usedRadius = currentRadius;
          console.log(`✅ Using hospitals from ${currentRadius}km radius (${rankedForThisRadius.length} found)`);
          break;
        }
        
        // If this is the last tier, log that no hospitals were found
        if (currentRadius === this.RADIUS_TIERS[this.RADIUS_TIERS.length - 1]) {
          console.log(`⚠️ No eligible hospitals found within any radius tier (up to ${currentRadius}km)`);
          allRankedHospitals = rankedForThisRadius;
        }
      }
      
      // Sort and return top N
      allRankedHospitals.sort((a, b) => b.score - a.score);
      
      console.log(`🏆 Returning top ${Math.min(topCount, allRankedHospitals.length)} hospitals (searched up to ${usedRadius}km)`);
      
      return allRankedHospitals.slice(0, topCount);
    } catch (error) {
      console.error('Error in findTopHospitalsOptimized:', error);
      return [];
    }
  }

  /**
   * Helper: Get required resources based on emergency type (Medical Priority)
   */
  private getRequiredResourcesForEmergency(emergencyType: string): Record<string, number> {
    switch (emergencyType) {
      case 'CARDIAC_EMERGENCY':
        return { icuBedsAvailable: 1, ventilatorsAvailable: 1 };
      case 'STROKE':
        return { icuBedsAvailable: 1 };
      case 'RESPIRATORY':
        return { ventilatorsAvailable: 1 };
      case 'TRAUMA':
        return { availableBeds: 1 };
      case 'NEUROLOGICAL':
        return { icuBedsAvailable: 1 };
      case 'DIABETIC':
      case 'ALLERGIC':
      default:
        return { availableBeds: 1 };
    }
  }

  /**
   * Helper: Check if hospital has required resources
   */
  private hasRequiredResources(resources: any, required: Record<string, number>): boolean {
    for (const [key, requiredAmount] of Object.entries(required)) {
      const available = resources[key] || 0;
      if (available < requiredAmount) {
        return false;
      }
    }
    return true;
  }

  /**
   * Find nearest ambulance using bounding box optimization
   */
  async findNearestAmbulanceOptimized(
    patientLocation: PatientLocation,
    radiusKm: number = 10
  ): Promise<{ ambulance: Ambulance; distance: number; travelTime: number } | null> {
    try {
      await this.refreshAmbulanceCache();
      
      const box = this.getBoundingBox(
        patientLocation.latitude,
        patientLocation.longitude,
        radiusKm
      );
      
      let nearestAmbulance: Ambulance | null = null;
      let shortestDistance = Infinity;
      
      // Check cached ambulances first
      for (const ambulance of this.ambulanceCache.values()) {
        if (!ambulance.currentLocation) continue;
        
        const location = ambulance.currentLocation;
        
        // Quick bounding box filter
        if (location.latitude < box.minLat || location.latitude > box.maxLat ||
            location.longitude < box.minLng || location.longitude > box.maxLng) {
          continue;
        }
        
        // Calculate exact distance
        const distance = this.calculateDistance(
          patientLocation.latitude,
          patientLocation.longitude,
          location.latitude,
          location.longitude
        );
        
        if (distance <= radiusKm && distance < shortestDistance) {
          shortestDistance = distance;
          nearestAmbulance = ambulance;
        }
      }
      
      if (nearestAmbulance) {
        return {
          ambulance: nearestAmbulance,
          distance: shortestDistance,
          travelTime: this.calculateTravelTime(shortestDistance, 60)
        };
      }
      
      // Fallback: query Firestore directly if cache doesn't have matches
      const ambulancesSnapshot = await getDocs(
        query(
          collection(db, 'ambulances'),
          where('status', '==', 'available'),
          limit(20)
        )
      );
      
      for (const doc of ambulancesSnapshot.docs) {
        const data = doc.data();
        const location = data.currentLocation;
        if (!location) continue;
        
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
   * Complete dispatch with optimized algorithms and fallback radius
   */
  async optimizedDispatch(
    emergencyId: string,
    patientLocation: PatientLocation,
    emergencyType: string
  ): Promise<{
    candidateHospitals: RankedHospital[];
    assignedAmbulance?: { ambulanceId: string; eta: number };
    success: boolean;
    error?: string;
  }> {
    try {
      console.log(`🚀 Optimized dispatch for emergency: ${emergencyId}`);
      
      // Step 1: Find top hospitals with fallback radius expansion
      const topHospitals = await this.findTopHospitalsOptimized(
        patientLocation,
        emergencyType,
        this.MAX_DISTANCE_KM, // Starting radius (will expand if needed)
        this.TOP_HOSPITALS_COUNT
      );
      
      if (topHospitals.length === 0) {
        console.warn('⚠️ No suitable hospitals found after expanding to max radius');
        throw new Error('No suitable hospitals found in any radius');
      }
      
      const candidateIds = topHospitals.map(h => h.hospital.id);
      const rankings: Record<string, any> = {};
      topHospitals.forEach(h => {
        rankings[h.hospital.id] = {
          score: h.score,
          distance: h.distance,
          travelTime: h.travelTime,
          distanceScore: h.distanceScore,
          resourceScore: h.resourceScore
        };
      });
      
      // Step 2: Update emergency with candidates and lock
      const emergencyRef = doc(db, 'emergency_requests', emergencyId);
      await updateDoc(emergencyRef, {
        candidateHospitals: candidateIds,
        hospitalRankings: rankings,
        isLocked: true,
        status: 'pending',
        updatedAt: Timestamp.now(),
        'timeline.dispatched': Timestamp.now()
      });
      
      console.log(`✅ Emergency locked with ${candidateIds.length} candidates`);
      
      // Step 3: Find nearest ambulance (optional - can be done after acceptance)
      const nearestAmbulance = await this.findNearestAmbulanceOptimized(patientLocation);
      
      let ambulanceResult;
      if (nearestAmbulance) {
        ambulanceResult = {
          ambulanceId: nearestAmbulance.ambulance.id,
          eta: Math.round(nearestAmbulance.travelTime)
        };
        console.log(`🚑 Found nearest ambulance: ${nearestAmbulance.ambulance.id} (${nearestAmbulance.distance.toFixed(1)}km)`);
      }
      
      return {
        candidateHospitals: topHospitals,
        assignedAmbulance: ambulanceResult,
        success: true
      };
    } catch (error: any) {
      console.error('Error in optimized dispatch:', error);
      return {
        candidateHospitals: [],
        success: false,
        error: error.message || 'Dispatch failed'
      };
    }
  }

  /**
   * Get cached hospital count (for monitoring)
   */
  getCachedHospitalsCount(): number {
    return this.hospitalCache.size;
  }

  /**
   * Get cached ambulance count (for monitoring)
   */
  getCachedAmbulancesCount(): number {
    return this.ambulanceCache.size;
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.hospitalCache.clear();
    this.ambulanceCache.clear();
    this.lastHospitalCacheUpdate = 0;
    this.lastAmbulanceCacheUpdate = 0;
    console.log('🗑️ Caches cleared');
  }
}

// Export singleton instance
export const optimizedAssignment = OptimizedAssignmentService.getInstance();