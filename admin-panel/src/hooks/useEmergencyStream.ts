import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../services/adminService';
import type { Emergency } from '../services/adminService';

export const useEmergencyStream = (filters?: { status?: string; hospitalId?: string }) => {
  const [emergencies, setEmergencies] = useState<Emergency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEmergencyAlert, setNewEmergencyAlert] = useState<Emergency | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    
    const unsubscribe = adminService.listenToEmergencies(
      (emergenciesData: Emergency[]) => {
        setEmergencies(emergenciesData);
        setLoading(false);
      },
      filters
    );

    return () => {
      unsubscribe();
    };
  }, [filters?.status, filters?.hospitalId]);

  const checkForNewEmergency = useCallback((previousEmergencies: Emergency[], currentEmergencies: Emergency[]) => {
    const previousIds = new Set(previousEmergencies.map(e => e.id));
    const newEmergency = currentEmergencies.find(e => !previousIds.has(e.id));
    
    if (newEmergency && newEmergency.status === 'pending') {
      setNewEmergencyAlert(newEmergency);
      setTimeout(() => setNewEmergencyAlert(null), 5000);
    }
  }, []);

  const clearNewAlert = useCallback(() => {
    setNewEmergencyAlert(null);
  }, []);

  const acceptEmergency = useCallback(async (emergencyId: string, hospitalId?: string, hospitalName?: string) => {
    await adminService.updateEmergencyStatus(emergencyId, 'accepted', hospitalId, hospitalName);
  }, []);

  const completeEmergency = useCallback(async (emergencyId: string) => {
    await adminService.updateEmergencyStatus(emergencyId, 'completed');
  }, []);

  const rejectEmergency = useCallback(async (emergencyId: string) => {
    await adminService.updateEmergencyStatus(emergencyId, 'cancelled');
  }, []);

  return {
    emergencies,
    loading,
    error,
    newEmergencyAlert,
    acceptEmergency,
    completeEmergency,
    rejectEmergency,
    clearNewAlert,
    checkForNewEmergency,
  };
};