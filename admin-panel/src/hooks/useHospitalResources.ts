// FILE: src/hooks/useHospitalResources.ts
import { useState, useEffect } from 'react';
import { adminService} from '../services/adminService';
import type { Hospital } from '../services/adminService';

export const useHospitalResources = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🏥 Admin panel: Setting up real-time hospital resources listener');
    
    const unsubscribe = adminService.listenToHospitals((updatedHospitals) => {
      console.log('📊 Admin panel: Hospitals updated in real-time:', updatedHospitals.length);
      setHospitals(updatedHospitals);
      setLoading(false);
    });

    return () => {
      console.log('🛑 Admin panel: Stopping hospital resources listener');
      unsubscribe();
    };
  }, []);

  return { hospitals, loading, error };
};