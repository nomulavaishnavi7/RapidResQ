// FILE: src/components/monitoring/EmergencyMonitor.tsx
import React, { useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { 
  MapPin,  CheckCircle, XCircle, 
  Search, ChevronDown
} from 'lucide-react';
import { useEmergencyStream } from '../../hooks/useEmergencyStream';
import type { Hospital } from '../../services/adminService';

interface EmergencyMonitorProps {
  hospitals?: Hospital[];
}

const EmergencyMonitor: React.FC<EmergencyMonitorProps> = ({ hospitals = [] }) => {
  const { emergencies, loading, acceptEmergency, completeEmergency, rejectEmergency } = useEmergencyStream();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmergencies = useMemo(() => {
    let filtered = emergencies;
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(e => e.status === filterStatus);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(e => 
        e.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.emergencyType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  }, [emergencies, filterStatus, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'accepted': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'critical': return <span className="px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse">CRITICAL</span>;
      case 'high': return <span className="px-2 py-1 text-xs font-bold text-white bg-orange-500 rounded-full">HIGH</span>;
      case 'medium': return <span className="px-2 py-1 text-xs font-bold text-white bg-yellow-500 rounded-full">MEDIUM</span>;
      default: return <span className="px-2 py-1 text-xs font-bold text-white bg-blue-500 rounded-full">LOW</span>;
    }
  };

  const handleAccept = async (emergencyId: string) => {
    const nearestHospital = hospitals.length > 0 ? hospitals[0] : null;
    await acceptEmergency(emergencyId, nearestHospital?.id, nearestHospital?.name);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading emergencies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Emergency Monitor</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time emergency response tracking</p>
        </div>
        
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search emergencies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="pl-4 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 appearance-none"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="completed">Completed</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{emergencies.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-2xl font-bold text-yellow-600">{emergencies.filter(e => e.status === 'pending').length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Pending</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-2xl font-bold text-blue-600">{emergencies.filter(e => e.status === 'accepted').length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Accepted</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
          <p className="text-2xl font-bold text-green-600">{emergencies.filter(e => e.status === 'completed').length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
        </div>
      </div>

      {/* Emergency Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Location</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Time</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredEmergencies.map((emergency) => (
                <tr key={emergency.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{emergency.id.slice(0, 8)}</td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{emergency.patientName}</p>
                      {emergency.patientPhone && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{emergency.patientPhone}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {emergency.emergencyType.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(emergency.status)}`}>
                      {emergency.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {getPriorityBadge(emergency.priority)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin size={14} />
                      <span className="truncate max-w-[150px]">{emergency.address || `${emergency.latitude.toFixed(4)}, ${emergency.longitude.toFixed(4)}`}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {formatDistanceToNow(emergency.createdAt.toDate(), { addSuffix: true })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      {emergency.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAccept(emergency.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition"
                            title="Accept"
                          >
                            <CheckCircle size={18} />
                          </button>
                          <button
                            onClick={() => rejectEmergency(emergency.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition"
                            title="Reject"
                          >
                            <XCircle size={18} />
                          </button>
                        </>
                      )}
                      {emergency.status === 'accepted' && (
                        <button
                          onClick={() => completeEmergency(emergency.id)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition"
                          title="Mark Complete"
                        >
                            <CheckCircle size={18} />
                          </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredEmergencies.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle size={48} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No emergencies found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencyMonitor;