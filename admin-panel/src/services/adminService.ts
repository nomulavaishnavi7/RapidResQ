// FILE: src/services/adminService.ts
import { 
  collection, 
  doc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  Timestamp,
  getDocs,
  limit,

} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';

import { db } from '../firebase/config';

export interface Emergency {
  id: string;
  patientName: string;
  patientId: string;
  patientPhone?: string;
  condition: string;
  emergencyType: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
  status: 'pending' | 'accepted' | 'completed' | 'cancelled';
  priority: 'critical' | 'high' | 'medium' | 'low';
  assignedHospitalId?: string;
  assignedHospitalName?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  responseTime?: number;
  timeline: {
    created: Timestamp;
    accepted?: Timestamp;
    completed?: Timestamp;
  };
}

export interface HospitalResource {
  available: number;
  total: number;
}

export interface Hospital {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  location: {
    latitude: number;
    longitude: number;
  };
  resources: {
    icuBeds: HospitalResource;
    ventilators: HospitalResource;
    emergencyDoctors: HospitalResource;
    ambulances: HospitalResource;
  };
  lastUpdated?: Timestamp;
}

export interface DashboardStats {
  totalEmergenciesToday: number;
  totalEmergenciesYesterday: number;
  completedEmergencies: number;
  pendingEmergencies: number;
  acceptedEmergencies: number;
  averageResponseTime: number;
  peakHour: number;
  trendPercentage: number;
  emergenciesByType: { type: string; count: number }[];
  hourlyTrend: { hour: number; count: number }[];
}

class AdminService {
  private hospitalListeners: Map<string, Unsubscribe> = new Map();

  /**
   * Listen to emergencies in real-time
   */
  listenToEmergencies(
    callback: (emergencies: Emergency[]) => void,
    filters?: { status?: string; hospitalId?: string }
  ): () => void {
    let emergenciesQuery = query(
      collection(db, 'emergency_requests'),
      orderBy('createdAt', 'desc')
    );

    if (filters?.status && filters.status !== 'all') {
      emergenciesQuery = query(
        collection(db, 'emergency_requests'),
        where('status', '==', filters.status),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(emergenciesQuery, (snapshot) => {
      const emergencies: Emergency[] = [];
      snapshot.forEach((doc) => {
        emergencies.push(this.mapEmergencyData(doc));
      });
      callback(emergencies);
    });
    return unsubscribe;
  }

  /**
   * FIXED: Listen to hospitals in real-time with onSnapshot
   * This ensures admin panel updates instantly when hospitals update resources
   */
  listenToHospitals(callback: (hospitals: Hospital[]) => void): () => void {
    console.log('📡 Admin panel: Setting up real-time listener for hospitals');
    
    const unsubscribe = onSnapshot(
  collection(db, 'hospitals'),
  (snapshot) => {
    const hospitals: Hospital[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();

      // 🚫 SKIP invalid / empty hospitals (this removes extra blank card)
      if (!data.name || data.name.trim() === '') {
        return;
      }

      const hospital = this.mapHospitalData(doc);
      hospitals.push(hospital);
    });

    console.log(`📊 Admin panel: Received ${hospitals.length} hospitals`);
    callback(hospitals);
  },
  (error) => {
    console.error('❌ Error listening to hospitals:', error);
  }
);

return unsubscribe;
  }

  /**
   * Get single hospital by ID with real-time updates
   */
  listenToHospitalById(
    hospitalId: string,
    callback: (hospital: Hospital | null) => void
  ): () => void {
    const unsubscribe = onSnapshot(doc(db, 'hospitals', hospitalId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        callback(this.mapHospitalData(docSnapshot));
      } else {
        callback(null);
      }
    });
    return unsubscribe;
  }

  /**
   * Update hospital resources (called from hospital dashboard)
   */
  async updateHospitalResources(
    hospitalId: string,
    resources: Partial<Hospital['resources']>
  ): Promise<void> {
    try {
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      await updateDoc(hospitalRef, {
        resources: resources,
        lastUpdated: Timestamp.now()
      });
      console.log('✅ Hospital resources updated:', hospitalId);
    } catch (error) {
      console.error('❌ Error updating hospital resources:', error);
      throw error;
    }
  }

  /**
   * Get hospital resources (for initial load)
   */
  async getHospitalResources(hospitalId: string): Promise<Hospital['resources'] | null> {
    try {
      const hospitalRef = doc(db, 'hospitals', hospitalId);
      const docSnap = await getDocs(query(collection(db, 'hospitals'), where('__name__', '==', hospitalId), limit(1)));
      if (!docSnap.empty) {
        const data = docSnap.docs[0].data();
        return data.resources;
      }
      return null;
    } catch (error) {
      console.error('Error fetching hospital resources:', error);
      return null;
    }
  }

  async updateEmergencyStatus(
    emergencyId: string,
    status: string,
    hospitalId?: string,
    hospitalName?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: Timestamp.now(),
      [`timeline.${status}`]: Timestamp.now(),
    };
    
    if (status === 'accepted' && hospitalId) {
      updateData.assignedHospitalId = hospitalId;
      updateData.assignedHospitalName = hospitalName;
    }
    
    if (status === 'completed') {
      const emergency = await this.getEmergencyById(emergencyId);
      if (emergency && emergency.timeline.accepted) {
        const responseTime = (Date.now() - emergency.timeline.accepted.toDate().getTime()) / 60000;
        updateData.responseTime = Math.round(responseTime);
      }
    }
    
    await updateDoc(doc(db, 'emergency_requests', emergencyId), updateData);
  }

  async getEmergencyById(id: string): Promise<Emergency | null> {
    try {
      const docSnap = await getDocs(query(collection(db, 'emergency_requests'), where('__name__', '==', id), limit(1)));
      if (!docSnap.empty) {
        return this.mapEmergencyData(docSnap.docs[0]);
      }
      return null;
    } catch (error) {
      console.error('Error fetching emergency:', error);
      return null;
    }
  }

  async getHospitalById(id: string): Promise<Hospital | null> {
    try {
      const docSnap = await getDocs(query(collection(db, 'hospitals'), where('__name__', '==', id), limit(1)));
      if (!docSnap.empty) {
        return this.mapHospitalData(docSnap.docs[0]);
      }
      return null;
    } catch (error) {
      console.error('Error fetching hospital:', error);
      return null;
    }
  }

  private mapEmergencyData(doc: any): Emergency {
    const data = doc.data();
    const isCritical = data.condition?.toLowerCase().includes('critical') || 
                       data.emergencyType === 'CARDIAC_EMERGENCY' ||
                       data.emergencyType === 'STROKE';
    
    return {
      id: doc.id,
      patientName: data.patientName || 'Unknown',
      patientId: data.patientId || '',
      patientPhone: data.patientPhone,
      condition: data.condition || 'Not specified',
      emergencyType: data.emergencyType || 'OTHER',
      description: data.description || '',
      latitude: data.latitude || 0,
      longitude: data.longitude || 0,
      address: data.address || '',
      status: data.status || 'pending',
      priority: isCritical ? 'critical' : data.priority || 'medium',
      assignedHospitalId: data.assignedHospitalId,
      assignedHospitalName: data.assignedHospitalName,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      responseTime: data.responseTime,
      timeline: data.timeline || { created: data.createdAt },
    };
  }

  private mapHospitalData(doc: any): Hospital {
  const data = doc.data();

  return {
    id: doc.id,
    name: data.name || '',
    email: data.email || '',
    phone: data.phone || '',
    address: data.address || '',
    location: data.location || { latitude: 0, longitude: 0 },

    resources: {
  icuBeds: {
    available: Number(doc.data().resources?.icuBeds?.available) || 0,
    total: Number(doc.data().resources?.icuBeds?.total) || 0,
  },
  ventilators: {
    available: Number(doc.data().resources?.ventilators?.available) || 0,
    total: Number(doc.data().resources?.ventilators?.total) || 0,
  },
  emergencyDoctors: {
    available: Number(doc.data().resources?.emergencyDoctors?.available) || 0,
    total: Number(doc.data().resources?.emergencyDoctors?.total) || 0,
  },
  ambulances: {
    available: Number(doc.data().resources?.ambulances?.available) || 0,
    total: Number(doc.data().resources?.ambulances?.total) || 0,
  },
},

    lastUpdated: data.lastUpdated,
  };
}
}

export const adminService = new AdminService();