import React, { useState, useEffect } from 'react';
import { Building2, Bed, Activity, Wind, Users, Truck } from 'lucide-react';
import { adminService } from '../../services/adminService';
import type { Hospital } from '../../services/adminService';

const HospitalCapacity: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    console.log('🏥 HospitalCapacity: Setting up real-time listener');
    
    const unsubscribe = adminService.listenToHospitals((updatedHospitals) => {
      console.log('📊 HospitalCapacity: Received hospital updates:', updatedHospitals.length);
      setHospitals(updatedHospitals);
      setLastUpdate(new Date());
      setLoading(false);
    });
    
    return () => {
      console.log('🛑 HospitalCapacity: Cleaning up listener');
      unsubscribe();
    };
  }, []);

  const getCapacityStatus = (available: number, total: number) => {
    if (total === 0) return { text: 'No Data', color: 'bg-gray-500', percentage: 0, textColor: 'text-gray-600' };
    const percentage = (available / total) * 100;
    if (percentage >= 30) return { text: 'Good', color: 'bg-green-500', percentage, textColor: 'text-green-600' };
    if (percentage >= 10) return { text: 'Limited', color: 'bg-yellow-500', percentage, textColor: 'text-yellow-600' };
    return { text: 'Critical', color: 'bg-red-500 animate-pulse', percentage, textColor: 'text-red-600' };
  };

  const getOverallStatus = (hospital: Hospital) => {
    const resources = [
      hospital.resources.icuBeds,
      hospital.resources.ventilators,
      hospital.resources.emergencyDoctors,
      hospital.resources.ambulances
    ];
    
    const criticalResources = resources.filter(r => {
      if (r.total === 0) return false;
      const percentage = (r.available / r.total) * 100;
      return percentage < 10;
    }).length;
    
    const limitedResources = resources.filter(r => {
      if (r.total === 0) return false;
      const percentage = (r.available / r.total) * 100;
      return percentage >= 10 && percentage < 30;
    }).length;
    
    if (criticalResources > 0) return { text: 'Critical', color: 'bg-red-500', severity: 'critical' };
    if (limitedResources > 0) return { text: 'Limited', color: 'bg-yellow-500', severity: 'limited' };
    return { text: 'Good', color: 'bg-green-500', severity: 'good' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading hospital data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Hospital Capacity Monitoring</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time resource availability across all hospitals</p>
        </div>
        {lastUpdate && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Last update: {lastUpdate.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hospitals.map((hospital) => {
          const icuStatus = getCapacityStatus(hospital.resources.icuBeds.available, hospital.resources.icuBeds.total);
          const ventStatus = getCapacityStatus(hospital.resources.ventilators.available, hospital.resources.ventilators.total);
          const doctorStatus = getCapacityStatus(hospital.resources.emergencyDoctors.available, hospital.resources.emergencyDoctors.total);
          const ambulanceStatus = getCapacityStatus(hospital.resources.ambulances.available, hospital.resources.ambulances.total);
          const overallStatus = getOverallStatus(hospital);
          
          return (
            <div key={hospital.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300">
              {/* Header with overall status */}
              <div className={`bg-gradient-to-r ${
                overallStatus.severity === 'critical' ? 'from-red-500 to-red-600' :
                overallStatus.severity === 'limited' ? 'from-yellow-500 to-yellow-600' :
                'from-green-500 to-green-600'
              } p-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 size={28} className="text-white" />
                    <div>
                      <h3 className="text-xl font-bold text-white">{hospital.name}</h3>
                      <p className="text-white text-sm opacity-90">{hospital.address}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${overallStatus.color}`}>
                    {overallStatus.text}
                  </span>
                </div>
              </div>
              
              <div className="p-5 space-y-4">
                {/* ICU Beds */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Bed size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">ICU Beds</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${icuStatus.textColor} bg-${icuStatus.percentage >= 30 ? 'green' : icuStatus.percentage >= 10 ? 'yellow' : 'red'}-100`}>
                      {Math.round(icuStatus.percentage)}% Available
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        icuStatus.percentage >= 30 ? 'bg-green-500' :
                        icuStatus.percentage >= 10 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${icuStatus.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Available: {hospital.resources.icuBeds.available}</span>
                    <span className="text-gray-600 dark:text-gray-400">Total: {hospital.resources.icuBeds.total}</span>
                  </div>
                </div>

                {/* Ventilators */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Wind size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Ventilators</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${ventStatus.textColor} bg-${ventStatus.percentage >= 30 ? 'green' : ventStatus.percentage >= 10 ? 'yellow' : 'red'}-100`}>
                      {Math.round(ventStatus.percentage)}% Available
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        ventStatus.percentage >= 30 ? 'bg-green-500' :
                        ventStatus.percentage >= 10 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${ventStatus.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Available: {hospital.resources.ventilators.available}</span>
                    <span className="text-gray-600 dark:text-gray-400">Total: {hospital.resources.ventilators.total}</span>
                  </div>
                </div>

                {/* Emergency Doctors */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Users size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Emergency Doctors</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${doctorStatus.textColor} bg-${doctorStatus.percentage >= 30 ? 'green' : doctorStatus.percentage >= 10 ? 'yellow' : 'red'}-100`}>
                      {Math.round(doctorStatus.percentage)}% Available
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        doctorStatus.percentage >= 30 ? 'bg-green-500' :
                        doctorStatus.percentage >= 10 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${doctorStatus.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Available: {hospital.resources.emergencyDoctors.available}</span>
                    <span className="text-gray-600 dark:text-gray-400">Total: {hospital.resources.emergencyDoctors.total}</span>
                  </div>
                </div>

                {/* Ambulances */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Truck size={18} className="text-gray-500" />
                      <span className="font-medium text-gray-700 dark:text-gray-300">Ambulances</span>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${ambulanceStatus.textColor} bg-${ambulanceStatus.percentage >= 30 ? 'green' : ambulanceStatus.percentage >= 10 ? 'yellow' : 'red'}-100`}>
                      {Math.round(ambulanceStatus.percentage)}% Available
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        ambulanceStatus.percentage >= 30 ? 'bg-green-500' :
                        ambulanceStatus.percentage >= 10 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${ambulanceStatus.percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Available: {hospital.resources.ambulances.available}</span>
                    <span className="text-gray-600 dark:text-gray-400">Total: {hospital.resources.ambulances.total}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                  Last updated: {hospital.lastUpdated?.toDate().toLocaleString() || 'Just now'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hospitals.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
          <Building2 size={48} className="mx-auto text-gray-400 mb-3" />
          <p className="text-gray-500 dark:text-gray-400">No hospitals registered yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Hospitals will appear here once they are added</p>
        </div>
      )}
    </div>
  );
};

export default HospitalCapacity;