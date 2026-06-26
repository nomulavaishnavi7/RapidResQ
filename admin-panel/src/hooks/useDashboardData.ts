// FILE: src/hooks/useDashboardData.ts
import { useState, useEffect } from 'react';
import type { Emergency, DashboardStats } from '../services/adminService';

export const useDashboardData = (emergencies: Emergency[]) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmergenciesToday: 0,
    totalEmergenciesYesterday: 0,
    completedEmergencies: 0,
    pendingEmergencies: 0,
    acceptedEmergencies: 0,
    averageResponseTime: 0,
    peakHour: 0,
    trendPercentage: 0,
    emergenciesByType: [],
    hourlyTrend: [],
  });

  useEffect(() => {
    if (!emergencies.length) return;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    
    const todayEmergencies = emergencies.filter(e => e.createdAt.toDate() >= today);
    const yesterdayEmergencies = emergencies.filter(e => {
      const date = e.createdAt.toDate();
      return date >= yesterday && date < today;
    });
    
    const completed = emergencies.filter(e => e.status === 'completed');
    const pending = emergencies.filter(e => e.status === 'pending');
    const accepted = emergencies.filter(e => e.status === 'accepted');
    
    const respondedEmergencies = emergencies.filter(e => e.timeline.accepted);
    const avgResponseTime = respondedEmergencies.length > 0
      ? respondedEmergencies.reduce((sum, e) => {
          const responseTime = e.timeline.accepted 
            ? (e.timeline.accepted.toDate().getTime() - e.createdAt.toDate().getTime()) / 60000
            : 0;
          return sum + responseTime;
        }, 0) / respondedEmergencies.length
      : 0;
    
    const hourlyCount = new Array(24).fill(0);
    emergencies.forEach(e => {
      const hour = e.createdAt.toDate().getHours();
      hourlyCount[hour]++;
    });
    const peakHour = hourlyCount.indexOf(Math.max(...hourlyCount));
    
    const trendPercentage = yesterdayEmergencies.length > 0
      ? ((todayEmergencies.length - yesterdayEmergencies.length) / yesterdayEmergencies.length) * 100
      : 0;
    
    const typeMap = new Map<string, number>();
    emergencies.forEach(e => {
      const type = e.emergencyType;
      typeMap.set(type, (typeMap.get(type) || 0) + 1);
    });
    const emergenciesByType = Array.from(typeMap.entries()).map(([type, count]) => ({ type, count }));
    
    const hourlyTrend = hourlyCount.map((count, hour) => ({ hour, count }));
    
    setStats({
      totalEmergenciesToday: todayEmergencies.length,
      totalEmergenciesYesterday: yesterdayEmergencies.length,
      completedEmergencies: completed.length,
      pendingEmergencies: pending.length,
      acceptedEmergencies: accepted.length,
      averageResponseTime: Math.round(avgResponseTime),
      peakHour,
      trendPercentage: Math.round(trendPercentage),
      emergenciesByType,
      hourlyTrend,
    });
  }, [emergencies]);

  return { stats };
};