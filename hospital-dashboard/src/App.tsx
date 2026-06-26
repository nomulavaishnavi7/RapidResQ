// ======================================================
// FILE: src/App.tsx
// ======================================================

import { useState, useEffect } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "./services/firebase";
import Login from "./components/auth/Login";
import Dashboard from "./components/dashboard/Dashboard";
import "./App.css";

interface HospitalSession {
  id: string;
  name: string;
}

const App = () => {
  const [hospital, setHospital] = useState<HospitalSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setHospital({
          id: user.uid,
          name: user.email?.split("@")[0] || "Hospital",
        });
      } else {
        setHospital(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSuccess = (hospitalId: string, hospitalName: string) => {
    setHospital({ id: hospitalId, name: hospitalName });
  };

  const handleLogout = () => {
    setHospital(null);
  };

  // 🔄 Loading screen
  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading RapidResQ...</p>
      </div>
    );
  }

  // 🔐 Auth routing
  return (
    <div className="app">
      {hospital ? (
        <Dashboard
          hospitalId={hospital.id}
          hospitalName={hospital.name}
          onLogout={handleLogout}
        />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
};

export default App;