// FILE: src/components/analytics/AnalyticsDashboard.tsx
import React, { useMemo } from 'react';
import { 
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  Clock, CheckCircle, AlertCircle, Activity, Calendar, ArrowUp, ArrowDown, PieChart as PieChartIcon,
  BarChart as BarChartIcon, TrendingUp, Building2, User, Truck
} from 'lucide-react';
import { useEmergencyStream } from '../../hooks/useEmergencyStream';
import { useHospitalResources } from '../../hooks/useHospitalResources';
import { useDashboardData } from '../../hooks/useDashboardData';

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

const StatCard = ({ title, value, icon, trend, subtitle }: any) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300">
    <div className="flex items-center justify-between mb-3">
      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
        {icon}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{title}</p>
    {subtitle && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">{subtitle}</p>}
  </div>
);

const ResourceCard = ({ title, available, total, icon }: any) => {
  const percentage = total > 0 ? (available / total) * 100 : 0;
  const color = percentage > 50 ? 'text-green-500' : percentage > 20 ? 'text-yellow-500' : 'text-red-500';
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
          {icon}
        </div>
        <span className={`text-sm font-semibold ${color}`}>
          {percentage.toFixed(0)}% Utilized
        </span>
      </div>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
        {available} <span className="text-sm text-gray-500">/ {total}</span>
      </p>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${percentage > 50 ? 'bg-green-500' : percentage > 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const HospitalResourceTable = ({ hospitals }: { hospitals: any[] }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={20} className="text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hospital Resources Overview</h3>
      </div>
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Hospital</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">ICU Beds</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Ventilators</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Doctors</th>
            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">Ambulances</th>
           </tr>
        </thead>
        <tbody>
          {hospitals.map((hospital) => (
            <tr key={hospital.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">{hospital.name}</td>
              <td className="text-center py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {hospital.resources.icuBeds.available}/{hospital.resources.icuBeds.total}
              </td>
              <td className="text-center py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {hospital.resources.ventilators.available}/{hospital.resources.ventilators.total}
              </td>
              <td className="text-center py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {hospital.resources.emergencyDoctors.available}/{hospital.resources.emergencyDoctors.total}
              </td>
              <td className="text-center py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                {hospital.resources.ambulances.available}/{hospital.resources.ambulances.total}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const AnalyticsDashboard: React.FC = () => {
  const { emergencies, loading: emergenciesLoading } = useEmergencyStream();
  const { hospitals, loading: hospitalsLoading } = useHospitalResources();
  const { stats } = useDashboardData(emergencies);

  // Filter out zero values for pie chart
  const statusData = useMemo(() => {
    const data = [
      { name: 'Pending', value: stats.pendingEmergencies, color: COLORS[0] },
      { name: 'Accepted', value: stats.acceptedEmergencies, color: COLORS[1] },
      { name: 'Completed', value: stats.completedEmergencies, color: COLORS[2] },
    ];
    return data.filter(item => item.value > 0);
  }, [stats]);

  const hasData = statusData.length > 0;
  const isLoading = emergenciesLoading || hospitalsLoading;

  // Calculate total resources across all hospitals
  const totalResources = useMemo(() => {
    return hospitals.reduce((acc, hospital) => ({
      icuBeds: {
        available: acc.icuBeds.available + hospital.resources.icuBeds.available,
        total: acc.icuBeds.total + hospital.resources.icuBeds.total,
      },
      ventilators: {
        available: acc.ventilators.available + hospital.resources.ventilators.available,
        total: acc.ventilators.total + hospital.resources.ventilators.total,
      },
      doctors: {
        available: acc.doctors.available + hospital.resources.emergencyDoctors.available,
        total: acc.doctors.total + hospital.resources.emergencyDoctors.total,
      },
      ambulances: {
        available: acc.ambulances.available + hospital.resources.ambulances.available,
        total: acc.ambulances.total + hospital.resources.ambulances.total,
      },
    }), {
      icuBeds: { available: 0, total: 0 },
      ventilators: { available: 0, total: 0 },
      doctors: { available: 0, total: 0 },
      ambulances: { available: 0, total: 0 },
    });
  }, [hospitals]);

  // Tooltip formatter
  const tooltipFormatter = (value: any) => {
    if (value === undefined || value === null) return ['0 emergencies', ''];
    return [`${value} emergencies`, ''];
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-200 dark:bg-gray-700 rounded-xl h-32"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-96"></div>
          <div className="bg-gray-200 dark:bg-gray-700 rounded-xl h-96"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Command Center Dashboard</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Real-time emergency response & hospital resource analytics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Calendar size={16} />
          <span>Live Updates</span>
        </div>
      </div>

      {/* Emergency Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Emergencies Today"
          value={stats.totalEmergenciesToday}
          icon={<AlertCircle size={24} className="text-red-500" />}
          trend={stats.trendPercentage}
          subtitle={`vs ${stats.totalEmergenciesYesterday} yesterday`}
        />
        <StatCard
          title="Completed"
          value={stats.completedEmergencies}
          icon={<CheckCircle size={24} className="text-green-500" />}
        />
        <StatCard
          title="Pending"
          value={stats.pendingEmergencies}
          icon={<Clock size={24} className="text-yellow-500" />}
        />
        <StatCard
          title="Avg Response Time"
          value={`${stats.averageResponseTime} min`}
          icon={<Activity size={24} className="text-blue-500" />}
        />
      </div>

      {/* Hospital Resources Section - REAL-TIME UPDATES */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <ResourceCard
          title="Total ICU Beds"
          available={totalResources.icuBeds.available}
          total={totalResources.icuBeds.total}
          icon={<Building2 size={20} className="text-blue-500" />}
        />
        <ResourceCard
          title="Total Ventilators"
          available={totalResources.ventilators.available}
          total={totalResources.ventilators.total}
          icon={<Activity size={20} className="text-green-500" />}
        />
        <ResourceCard
          title="Emergency Doctors"
          available={totalResources.doctors.available}
          total={totalResources.doctors.total}
          icon={<User size={20} className="text-purple-500" />}
        />
        <ResourceCard
          title="Ambulances"
          available={totalResources.ambulances.available}
          total={totalResources.ambulances.total}
          icon={<Truck size={20} className="text-orange-500" />}
        />
      </div>

      {/* Hospital Resource Table - REAL-TIME UPDATES */}
      {hospitals.length > 0 && <HospitalResourceTable hospitals={hospitals} />}

      {/* Emergency Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Emergency Status Pie Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Emergency Status Distribution</h3>
          {!hasData ? (
            <div className="flex flex-col items-center justify-center h-80">
              <PieChartIcon size={48} className="text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-center">No data available</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">No emergencies recorded yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => {
                    const percentage = percent !== undefined ? (percent * 100).toFixed(0) : '0';
                    return `${name}: ${percentage}%`;
                  }}
                  outerRadius={80}
                  dataKey="value"
                  nameKey="name"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={tooltipFormatter}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, white)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
                <Legend 
                  formatter={(value) => <span className="text-gray-700 dark:text-gray-300">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Emergencies by Type Bar Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Emergencies by Type</h3>
          {stats.emergenciesByType.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80">
              <BarChartIcon size={48} className="text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-center">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.emergenciesByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="type" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80}
                  tick={{ fill: 'var(--axis-text, #6b7280)' }}
                />
                <YAxis tick={{ fill: 'var(--axis-text, #6b7280)' }} />
                <Tooltip 
                  formatter={tooltipFormatter}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, white)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Hourly Trend Area Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Emergency Volume (Last 24 Hours)</h3>
          {stats.hourlyTrend.every(h => h.count === 0) ? (
            <div className="flex flex-col items-center justify-center h-80">
              <TrendingUp size={48} className="text-gray-400 dark:text-gray-500 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 text-center">No data available</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={stats.hourlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="hour" 
                  label={{ value: 'Hour', position: 'insideBottom', offset: -5, fill: 'var(--axis-text, #6b7280)' }} 
                  tick={{ fill: 'var(--axis-text, #6b7280)' }}
                />
                <YAxis tick={{ fill: 'var(--axis-text, #6b7280)' }} />
                <Tooltip 
                  formatter={tooltipFormatter}
                  contentStyle={{
                    backgroundColor: 'var(--tooltip-bg, white)',
                    border: '1px solid var(--tooltip-border, #e5e7eb)',
                    borderRadius: '8px',
                  }}
                />
                <Area type="monotone" dataKey="count" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          {stats.peakHour > 0 && stats.hourlyTrend.some(h => h.count > 0) && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
              Peak Hour: <span className="font-semibold text-red-500">{stats.peakHour}:00</span> with {stats.hourlyTrend.find((h: { hour: number; count: number }) => h.hour === stats.peakHour)?.count} emergencies
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;