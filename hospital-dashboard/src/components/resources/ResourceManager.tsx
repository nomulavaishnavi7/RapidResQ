// ======================================================
// FILE: src/components/resources/ResourceManager.tsx
// ======================================================

import React, { useState, useEffect } from 'react';
import { auth } from '../../services/firebase';
import { hospitalService } from '../../services/hospitalService';
import { HospitalResources } from '../../types';
import './ResourceManager.css';

interface ResourceManagerProps {
  // Changed: Now accepts email instead of hospitalId
  // The prop name remains the same for backward compatibility
  hospitalId?: string; // Optional now - we'll use email if provided, otherwise get from auth
}

const ResourceManager: React.FC<ResourceManagerProps> = ({ hospitalId: propHospitalId }) => {
  const [resources, setResources] = useState<HospitalResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resolvedIdentifier, setResolvedIdentifier] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    availableBeds: 0,
    availableDoctors: 0,
    availableAmbulances: 0,
    icuBedsAvailable: 0,
    ventilatorsAvailable: 0
  });

  // Get the correct identifier (email) for the logged-in hospital
  const getIdentifier = (): string | null => {
    // If propHospitalId is provided and looks like an email, use it
    if (propHospitalId && propHospitalId.includes('@')) {
      return propHospitalId;
    }
    
    // Otherwise, get the current user's email from auth
    const userEmail = auth.currentUser?.email;
    if (userEmail) {
      return userEmail;
    }
    
    // Fallback to prop if it exists (for backward compatibility, but will log warning)
    if (propHospitalId) {
      console.warn('⚠️ Using UID as identifier - this may cause issues. Please ensure email is passed instead.');
      return propHospitalId;
    }
    
    return null;
  };

  // Load resources
  useEffect(() => {
    loadResources();
  }, [propHospitalId]); // Re-run when prop changes

  const loadResources = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const identifier = getIdentifier();
      if (!identifier) {
        throw new Error('Unable to identify hospital. Please log in again.');
      }
      
      console.log('📊 Loading resources for identifier:', identifier);
      setResolvedIdentifier(identifier);
      
      // ✅ CORRECT: Pass email to getHospitalResources
      const data = await hospitalService.getHospitalResources(identifier);
      
      if (data) {
        setResources(data);
        setFormData({
          availableBeds: data.availableBeds,
          availableDoctors: data.availableDoctors,
          availableAmbulances: data.availableAmbulances,
          icuBedsAvailable: data.icuBedsAvailable,
          ventilatorsAvailable: data.ventilatorsAvailable
        });
        console.log('✅ Resources loaded successfully');
      } else {
        console.warn('⚠️ No resources found, using defaults');
        setFormData({
          availableBeds: 0,
          availableDoctors: 0,
          availableAmbulances: 0,
          icuBedsAvailable: 0,
          ventilatorsAvailable: 0
        });
      }
    } catch (err) {
      console.error('Error loading resources:', err);
      setError('Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = parseInt(value) || 0;
    
    setFormData(prev => ({
      ...prev,
      [name]: numValue
    }));
  };

  const validateForm = (): boolean => {
    if (formData.availableBeds < 0 || formData.availableBeds > (resources?.totalBeds || 100)) {
      setError('Invalid bed count');
      return false;
    }
    if (formData.availableDoctors < 0 || formData.availableDoctors > (resources?.totalDoctors || 50)) {
      setError('Invalid doctor count');
      return false;
    }
    if (formData.availableAmbulances < 0 || formData.availableAmbulances > (resources?.totalAmbulances || 10)) {
      setError('Invalid ambulance count');
      return false;
    }
    if (formData.icuBedsAvailable < 0 || formData.icuBedsAvailable > (resources?.icuBedsTotal || 20)) {
      setError('Invalid ICU bed count');
      return false;
    }
    if (formData.ventilatorsAvailable < 0 || formData.ventilatorsAvailable > (resources?.ventilatorsTotal || 30)) {
      setError('Invalid ventilator count');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const identifier = getIdentifier();
      if (!identifier) {
        throw new Error('Unable to identify hospital. Please log in again.');
      }
      
      console.log('📝 Updating resources for identifier:', identifier);
      
      // ✅ CORRECT: Pass email to updateHospitalResources (NOT UID)
      await hospitalService.updateHospitalResources(identifier, {
        availableBeds: formData.availableBeds,
        availableDoctors: formData.availableDoctors,
        availableAmbulances: formData.availableAmbulances,
        icuBedsAvailable: formData.icuBedsAvailable,
        ventilatorsAvailable: formData.ventilatorsAvailable
      });
      
      setSuccess('Resources updated successfully!');
      setEditing(false);
      
      // Reload resources to show updated values
      await loadResources();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
      
      console.log('✅ Resources updated successfully');
    } catch (err) {
      console.error('Error updating resources:', err);
      setError(err instanceof Error ? err.message : 'Failed to update resources');
    } finally {
      setSaving(false);
    }
  };

  const getUtilizationColor = (available: number, total: number): string => {
    if (total === 0) return '#95a5a6'; // Gray if no total
    const percentage = (available / total) * 100;
    if (percentage < 20) return '#e74c3c'; // Critical - red
    if (percentage < 50) return '#f39c12'; // Warning - orange
    return '#27ae60'; // Good - green
  };

  // Helper function to format timestamp
  const formatLastUpdated = (timestamp: any): string => {
    if (!timestamp) return 'Never';
    
    try {
      if (timestamp.toDate && typeof timestamp.toDate === 'function') {
        return timestamp.toDate().toLocaleString();
      }
      if (typeof timestamp === 'number') {
        return new Date(timestamp).toLocaleString();
      }
      if (typeof timestamp === 'string') {
        return new Date(timestamp).toLocaleString();
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000).toLocaleString();
      }
      return 'Invalid date';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  if (loading) {
    return (
      <div className="resource-manager loading">
        <div className="loading-spinner">⏳</div>
        <p>Loading resources...</p>
      </div>
    );
  }

  return (
    <div className="resource-manager">
      <div className="resource-header">
        <h3>🏥 Hospital Resources</h3>
        {!editing && (
          <button
            className="edit-button"
            onClick={() => setEditing(true)}
          >
            ✏️ Edit Resources
          </button>
        )}
      </div>

      {error && (
        <div className="resource-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {success && (
        <div className="resource-success">
          <span className="success-icon">✓</span>
          {success}
        </div>
      )}

      {editing ? (
        <form onSubmit={handleSubmit} className="resource-form">
          <div className="form-group">
            <label>Available Beds / {resources?.totalBeds || 100}</label>
            <input
              type="number"
              name="availableBeds"
              value={formData.availableBeds}
              onChange={handleInputChange}
              min="0"
              max={resources?.totalBeds || 100}
              required
            />
            <div className="form-hint">
              Utilization: {Math.round((formData.availableBeds / (resources?.totalBeds || 100)) * 100)}%
            </div>
          </div>

          <div className="form-group">
            <label>Available Doctors / {resources?.totalDoctors || 50}</label>
            <input
              type="number"
              name="availableDoctors"
              value={formData.availableDoctors}
              onChange={handleInputChange}
              min="0"
              max={resources?.totalDoctors || 50}
              required
            />
            <div className="form-hint">
              Utilization: {Math.round((formData.availableDoctors / (resources?.totalDoctors || 50)) * 100)}%
            </div>
          </div>

          <div className="form-group">
            <label>Available Ambulances / {resources?.totalAmbulances || 10}</label>
            <input
              type="number"
              name="availableAmbulances"
              value={formData.availableAmbulances}
              onChange={handleInputChange}
              min="0"
              max={resources?.totalAmbulances || 10}
              required
            />
            <div className="form-hint">
              Utilization: {Math.round((formData.availableAmbulances / (resources?.totalAmbulances || 10)) * 100)}%
            </div>
          </div>

          <div className="form-group">
            <label>ICU Beds Available / {resources?.icuBedsTotal || 20}</label>
            <input
              type="number"
              name="icuBedsAvailable"
              value={formData.icuBedsAvailable}
              onChange={handleInputChange}
              min="0"
              max={resources?.icuBedsTotal || 20}
              required
            />
            <div className="form-hint">
              Utilization: {Math.round((formData.icuBedsAvailable / (resources?.icuBedsTotal || 20)) * 100)}%
            </div>
          </div>

          <div className="form-group">
            <label>Ventilators Available / {resources?.ventilatorsTotal || 30}</label>
            <input
              type="number"
              name="ventilatorsAvailable"
              value={formData.ventilatorsAvailable}
              onChange={handleInputChange}
              min="0"
              max={resources?.ventilatorsTotal || 30}
              required
            />
            <div className="form-hint">
              Utilization: {Math.round((formData.ventilatorsAvailable / (resources?.ventilatorsTotal || 30)) * 100)}%
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : '💾 Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        resources && (
          <div className="resource-display">
            <div className="resource-item">
              <span className="resource-label">🛏️ Available Beds</span>
              <div className="resource-value">
                <span
                  className="resource-number"
                  style={{ color: getUtilizationColor(resources.availableBeds, resources.totalBeds) }}
                >
                  {resources.availableBeds}
                </span>
                <span className="resource-total">/ {resources.totalBeds}</span>
              </div>
              <div className="resource-progress">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${(resources.availableBeds / resources.totalBeds) * 100}%`,
                    backgroundColor: getUtilizationColor(resources.availableBeds, resources.totalBeds)
                  }}
                />
              </div>
            </div>

            <div className="resource-item">
              <span className="resource-label">👨‍⚕️ Available Doctors</span>
              <div className="resource-value">
                <span
                  className="resource-number"
                  style={{ color: getUtilizationColor(resources.availableDoctors, resources.totalDoctors) }}
                >
                  {resources.availableDoctors}
                </span>
                <span className="resource-total">/ {resources.totalDoctors}</span>
              </div>
              <div className="resource-progress">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${(resources.availableDoctors / resources.totalDoctors) * 100}%`,
                    backgroundColor: getUtilizationColor(resources.availableDoctors, resources.totalDoctors)
                  }}
                />
              </div>
            </div>

            <div className="resource-item">
              <span className="resource-label">🚑 Available Ambulances</span>
              <div className="resource-value">
                <span
                  className="resource-number"
                  style={{ color: getUtilizationColor(resources.availableAmbulances, resources.totalAmbulances) }}
                >
                  {resources.availableAmbulances}
                </span>
                <span className="resource-total">/ {resources.totalAmbulances}</span>
              </div>
              <div className="resource-progress">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${(resources.availableAmbulances / resources.totalAmbulances) * 100}%`,
                    backgroundColor: getUtilizationColor(resources.availableAmbulances, resources.totalAmbulances)
                  }}
                />
              </div>
            </div>

            <div className="resource-item">
              <span className="resource-label">🏥 ICU Beds Available</span>
              <div className="resource-value">
                <span
                  className="resource-number"
                  style={{ color: getUtilizationColor(resources.icuBedsAvailable, resources.icuBedsTotal) }}
                >
                  {resources.icuBedsAvailable}
                </span>
                <span className="resource-total">/ {resources.icuBedsTotal}</span>
              </div>
              <div className="resource-progress">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${(resources.icuBedsAvailable / resources.icuBedsTotal) * 100}%`,
                    backgroundColor: getUtilizationColor(resources.icuBedsAvailable, resources.icuBedsTotal)
                  }}
                />
              </div>
            </div>

            <div className="resource-item">
              <span className="resource-label">💨 Ventilators Available</span>
              <div className="resource-value">
                <span
                  className="resource-number"
                  style={{ color: getUtilizationColor(resources.ventilatorsAvailable, resources.ventilatorsTotal) }}
                >
                  {resources.ventilatorsAvailable}
                </span>
                <span className="resource-total">/ {resources.ventilatorsTotal}</span>
              </div>
              <div className="resource-progress">
                <div 
                  className="progress-bar"
                  style={{ 
                    width: `${(resources.ventilatorsAvailable / resources.ventilatorsTotal) * 100}%`,
                    backgroundColor: getUtilizationColor(resources.ventilatorsAvailable, resources.ventilatorsTotal)
                  }}
                />
              </div>
            </div>

            <div className="resource-footer">
              <span className="last-updated">
                📅 Last updated: {formatLastUpdated(resources.lastUpdated)}
              </span>
            </div>
          </div>
        )
      )}
    </div>
  );
};

export default ResourceManager;