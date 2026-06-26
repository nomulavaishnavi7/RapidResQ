// ======================================================
// FILE: src/components/emergency/CreateEmergencyForm.tsx
// ======================================================

import React, { useState, useEffect } from 'react';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { assignmentService } from '../services/assignmentService';
import { PatientLocation } from '../types';
import './CreateEmergencyForm.css';

interface CreateEmergencyFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface FormData {
  patientName: string;
  patientCondition: string;
  patientAge: string;
  bloodType: string;
  description: string;
  latitude: number;
  longitude: number;
  address: string;
}

const CreateEmergencyForm: React.FC<CreateEmergencyFormProps> = ({
  onSuccess,
  onError
}) => {
  const [formData, setFormData] = useState<FormData>({
    patientName: '',
    patientCondition: '',
    patientAge: '',
    bloodType: '',
    description: '',
    latitude: 0,
    longitude: 0,
    address: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [assignmentResult, setAssignmentResult] = useState<{
    hospitalName: string;
    distance: string;
    travelTime: number;
  } | null>(null);

  // Get current location on mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        setLoading(false);
      },
      (error) => {
        setError('Unable to get location. Please enter coordinates manually.');
        setLoading(false);
        console.error('Location error:', error);
      }
    );
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.patientName.trim()) {
      setError('Patient name is required');
      return false;
    }
    if (!formData.patientCondition.trim()) {
      setError('Patient condition is required');
      return false;
    }
    if (formData.latitude === 0 || formData.longitude === 0) {
      setError('Valid location is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setAssignmentResult(null);

    try {
      // Create patient location object
      const patientLocation: PatientLocation = {
        latitude: formData.latitude,
        longitude: formData.longitude,
        address: formData.address || undefined
      };

      // Step 1: Create emergency in emergency_requests collection
      const emergencyData = {
        patientName: formData.patientName.trim(),
        patientCondition: formData.patientCondition.trim(),
        patientAge: formData.patientAge ? parseInt(formData.patientAge) : null,
        bloodType: formData.bloodType || null,
        description: formData.description.trim() || null,
        patientLocation: patientLocation,
        assignedHospitalId: '',
        assignedHospitalName: '',
        status: 'pending',
        timestamp: Timestamp.now(),
        createdAt: Timestamp.now(),
        timeline: {
          created: Timestamp.now()
        }
      };

      // Add to emergency_requests collection
      const docRef = await addDoc(collection(db, 'emergency_requests'), emergencyData);
      console.log('Emergency created with ID:', docRef.id);

      // FIXED: Use assignBestHospital instead of assignNearestHospital
      const assignment = await assignmentService.assignBestHospital(
        docRef.id,
        patientLocation,
        formData.patientCondition.trim() // Use the selected condition as emergency type
      );

      // Check if assignment was successful (returns array of AssignmentResult)
      if (assignment.length > 0 && assignment[0].success) {
        setSuccess('Emergency request sent successfully!');
        setAssignmentResult({
          hospitalName: assignment[0].hospitalName,
          distance: `${assignment[0].distance.toFixed(1)} km`,
          travelTime: Math.round(assignment[0].travelTime)
        });
        
        // Reset form (keep location)
        setFormData(prev => ({
          ...prev,
          patientName: '',
          patientCondition: '',
          patientAge: '',
          bloodType: '',
          description: ''
        }));
        
        onSuccess?.();
      } else {
        const errorMsg = assignment[0]?.error || 'Emergency created but hospital assignment failed';
        setError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (err: any) {
      console.error('Error creating emergency:', err);
      setError(err.message || 'Failed to create emergency');
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-emergency-form">
      <div className="form-header">
        <h2>Create Emergency Request</h2>
        <p>Fill out the form below to create a new emergency request</p>
      </div>

      {error && (
        <div className="error-message">
          <span>⚠️</span>
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-error">×</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          <span>✅</span>
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="close-success">×</button>
        </div>
      )}

      {assignmentResult && (
        <div className="assignment-result">
          <h3>Hospital Assigned</h3>
          <div className="result-details">
            <p><strong>Hospital:</strong> {assignmentResult.hospitalName}</p>
            <p><strong>Distance:</strong> {assignmentResult.distance}</p>
            <p><strong>Estimated Travel Time:</strong> {assignmentResult.travelTime} minutes</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="patientName">Patient Name *</label>
          <input
            type="text"
            id="patientName"
            name="patientName"
            value={formData.patientName}
            onChange={handleInputChange}
            placeholder="Enter patient name"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="patientCondition">Condition *</label>
          <select
            id="patientCondition"
            name="patientCondition"
            value={formData.patientCondition}
            onChange={handleInputChange}
            required
            disabled={loading}
          >
            <option value="">Select condition</option>
            <option value="CARDIAC_EMERGENCY">Cardiac Emergency</option>
            <option value="TRAUMA">Trauma/Injury</option>
            <option value="STROKE">Stroke</option>
            <option value="RESPIRATORY">Respiratory Distress</option>
            <option value="NEUROLOGICAL">Neurological Emergency</option>
            <option value="DIABETIC">Diabetic Emergency</option>
            <option value="ALLERGIC">Allergic Reaction</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="patientAge">Age</label>
            <input
              type="number"
              id="patientAge"
              name="patientAge"
              value={formData.patientAge}
              onChange={handleInputChange}
              placeholder="Age"
              min="0"
              max="120"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bloodType">Blood Type</label>
            <select
              id="bloodType"
              name="bloodType"
              value={formData.bloodType}
              onChange={handleInputChange}
              disabled={loading}
            >
              <option value="">Select blood type</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            placeholder="Describe the emergency in detail..."
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label>Location *</label>
          <div className="location-group">
            <div className="location-field">
              <input
                type="number"
                name="latitude"
                value={formData.latitude}
                onChange={handleInputChange}
                placeholder="Latitude"
                step="any"
                disabled={loading}
                required
              />
            </div>
            <div className="location-field">
              <input
                type="number"
                name="longitude"
                value={formData.longitude}
                onChange={handleInputChange}
                placeholder="Longitude"
                step="any"
                disabled={loading}
                required
              />
            </div>
            <button
              type="button"
              onClick={getCurrentLocation}
              className="location-button"
              disabled={loading}
            >
              📍 Get Current Location
            </button>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="address">Address (Optional)</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleInputChange}
            placeholder="Street address, city, etc."
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={loading}
        >
          {loading ? (
            <span className="loading-spinner">⏳</span>
          ) : (
            'Create Emergency Request'
          )}
        </button>
      </form>
    </div>
  );
};

export default CreateEmergencyForm;