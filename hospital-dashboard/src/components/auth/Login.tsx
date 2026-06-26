// ======================================================
// FILE: src/components/auth/Login.tsx
// ======================================================
/// <reference types="react" />

import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import './Login.css';

interface LoginProps {
  onLoginSuccess: (hospitalId: string, hospitalName: string) => void;
}

const Login = ({ onLoginSuccess }: LoginProps) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Step 1: Sign in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('✅ User logged in:', user.uid, user.email);
      
      // Step 2: Find the hospital document that matches this email
      // The hospital document should have an 'email' field matching the login email
      const hospitalsRef = collection(db, 'hospitals');
      const q = query(hospitalsRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      
      let hospitalId: string;
      let hospitalName: string;
      
      if (!querySnapshot.empty) {
        // Found hospital with matching email - use its document ID
        const hospitalDoc = querySnapshot.docs[0];
        hospitalId = hospitalDoc.id;
        hospitalName = hospitalDoc.data().name || email.split('@')[0];
        console.log('🏥 Found hospital:', hospitalId, hospitalName);
      } else {
        // No hospital found with this email - this shouldn't happen in production
        console.error('❌ No hospital found with email:', email);
        console.log('💡 Make sure your hospitals collection has a document with email field matching:', email);
        
        // Fallback: use email as identifier (will not work for filtering)
        hospitalId = user.uid;
        hospitalName = email.split('@')[0] || 'Hospital';
        setError('Hospital account not found. Please contact administrator.');
        setLoading(false);
        return;
      }
      
      onLoginSuccess(hospitalId, hospitalName);
      
    } catch (err: any) {
      console.error('Login error:', err);
      
      // Handle different Firebase error codes
      if (err.code) {
        switch (err.code) {
          case 'auth/invalid-email':
            setError('Invalid email address');
            break;
          case 'auth/user-disabled':
            setError('This account has been disabled');
            break;
          case 'auth/user-not-found':
            setError('No account found with this email');
            break;
          case 'auth/wrong-password':
            setError('Incorrect password');
            break;
          case 'auth/too-many-requests':
            setError('Too many failed attempts. Please try again later');
            break;
          case 'auth/network-request-failed':
            setError('Network error. Please check your connection');
            break;
          default:
            setError('Failed to login. Please try again.');
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>RapidResQ</h1>
          <h2>Hospital Dashboard</h2>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              placeholder="hospital@example.com"
              disabled={loading}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setPassword(e.target.value)
              }
              placeholder="••••••••"
              disabled={loading}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner">⏳</span>
            ) : (
              'Login to Dashboard'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>Secure hospital access only</p>
        </div>
      </div>
    </div>
  );
};

// CSS Styles
const styles = `
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  color: #e74c3c;
  font-size: 28px;
  margin: 0;
}

.login-header h2 {
  color: #666;
  font-size: 16px;
  font-weight: normal;
  margin: 5px 0 0;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #e74c3c;
}

.form-group input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

.login-button {
  background: #e74c3c;
  color: white;
  border: none;
  padding: 14px;
  border-radius: 6px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-button:hover:not(:disabled) {
  background: #c0392b;
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fde8e8;
  border: 1px solid #f8b4b4;
  color: #c81e1e;
  padding: 12px;
  border-radius: 6px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-icon {
  font-size: 16px;
}

.loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
  font-size: 20px;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.login-footer {
  text-align: center;
  margin-top: 20px;
  color: #999;
  font-size: 12px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .login-card {
    background: #2d2d2d;
  }
  
  .login-header h1 {
    color: #e74c3c;
  }
  
  .login-header h2 {
    color: #b0b0b0;
  }
  
  .form-group label {
    color: #e0e0e0;
  }
  
  .form-group input {
    background: #363636;
    border-color: #404040;
    color: #e0e0e0;
  }
  
  .form-group input:focus {
    border-color: #e74c3c;
  }
  
  .form-group input::placeholder {
    color: #666;
  }
  
  .login-footer p {
    color: #666;
  }
}

/* Responsive design */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }
  
  .login-header h1 {
    font-size: 24px;
  }
  
  .login-header h2 {
    font-size: 14px;
  }
  
  .form-group input {
    padding: 10px;
  }
  
  .login-button {
    padding: 12px;
  }
}
`;

// Create a separate CSS file instead of injecting
// This is better practice for production
export const loginStyles = styles;

export default Login;