// FILE: src/App.tsx (updated with dark mode support)
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Activity, 
  Building2, 
  Map, 
  AlertCircle,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  Bell,
  Search,
  TrendingUp
} from 'lucide-react';
import { auth } from './firebase/config';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import EmergencyMonitor from './components/monitoring/EmergencyMonitor';
import HospitalCapacity from './components/monitoring/HospitalCapacity';
import CityMapView from './components/map/CityMapView';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import Login from './components/auth/Login';
import { Toaster, toast } from 'react-hot-toast';

// NavItem Component
const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; collapsed: boolean }> = 
  ({ to, icon, label, collapsed }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        isActive 
          ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md' 
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
      } ${collapsed ? 'justify-center' : ''}`}
    >
      {icon}
      {!collapsed && <span className="font-medium">{label}</span>}
    </Link>
  );
};

// Main App Content
const AppContent: React.FC<{ user: User; onLogout: () => Promise<void> }> = ({ user, onLogout }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/': return 'Analytics Dashboard';
      case '/monitoring': return 'Emergency Monitoring';
      case '/hospitals': return 'Hospital Capacity';
      case '/map': return 'City Map View';
      default: return 'Admin Panel';
    }
  };

  const getPageIcon = () => {
    switch (location.pathname) {
      case '/': return <TrendingUp size={24} className="text-red-500" />;
      case '/monitoring': return <Activity size={24} className="text-red-500" />;
      case '/hospitals': return <Building2 size={24} className="text-red-500" />;
      case '/map': return <Map size={24} className="text-red-500" />;
      default: return <LayoutDashboard size={24} className="text-red-500" />;
    }
  };

  const handleLogout = async () => {
    try {
      await onLogout();
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed');
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      <aside className={`bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 ${
        sidebarCollapsed ? 'w-20' : 'w-72'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className={`flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                <AlertCircle size={22} className="text-white" />
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-xl font-bold text-gray-800 dark:text-white">RapidResQ</h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Admin Dashboard</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <NavItem to="/" icon={<LayoutDashboard size={20} />} label="Dashboard" collapsed={sidebarCollapsed} />
            <NavItem to="/monitoring" icon={<Activity size={20} />} label="Monitoring" collapsed={sidebarCollapsed} />
            <NavItem to="/hospitals" icon={<Building2 size={20} />} label="Hospitals" collapsed={sidebarCollapsed} />
            <NavItem to="/map" icon={<Map size={20} />} label="Map View" collapsed={sidebarCollapsed} />
          </nav>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              {!sidebarCollapsed && <span>{darkMode ? 'Light Mode' : 'Dark Mode'}</span>}
            </button>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition ${
                sidebarCollapsed ? 'justify-center' : ''
              }`}
            >
              <LogOut size={20} />
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              {sidebarCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
            <div className="flex items-center gap-3">
              {getPageIcon()}
              <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                {getPageTitle()}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Search Bar */}
            <div className="relative hidden md:block">
              <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
            
            {/* Notifications */}
            <button className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition">
              <Bell size={20} className="text-gray-600 dark:text-gray-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            
            {/* User Avatar */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-semibold shadow-md">
                {user.email?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{user.email}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="animate-fadeIn">
            <Routes>
              <Route path="/" element={<AnalyticsDashboard />} />
              <Route path="/monitoring" element={<EmergencyMonitor />} />
              <Route path="/hospitals" element={<HospitalCapacity />} />
              <Route path="/map" element={<CityMapView />} />
            </Routes>
          </div>
        </main>
      </div>

      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { background: '#363636', color: '#fff', borderRadius: '12px' },
          success: { style: { background: '#10b981' } },
          error: { style: { background: '#ef4444' } },
        }}
      />
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <AppContent user={user} onLogout={handleLogout} />
    </Router>
  );
};

export default App;