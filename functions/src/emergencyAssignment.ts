// ======================================================
// FILE: functions/src/emergencyAssignment.ts
// Firebase Cloud Function - Automatically assigns hospital on emergency creation
// ======================================================

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Cloud Function triggered when a new emergency is created
 * Automatically assigns the nearest hospital
 */
export const onEmergencyCreated = functions.firestore
  .document('emergencies/{emergencyId}')
  .onCreate(async (snapshot, context) => {
    const emergencyId = context.params.emergencyId;
    const emergencyData = snapshot.data();
    
    console.log(`🆕 New emergency created: ${emergencyId}`);
    
    // Validate emergency data
    if (!emergencyData.patientLocation) {
      console.error('Emergency missing patient location');
      await snapshot.ref.update({
        status: 'error',
        errorMessage: 'Missing patient location'
      });
      return null;
    }
    
    try {
      // Fetch all hospitals
      const hospitalsSnapshot = await admin.firestore().collection('hospitals').get();
      const hospitals = hospitalsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Calculate distances and find nearest
      let nearestHospital = null;
      let shortestDistance = Infinity;
      
      for (const hospital of hospitals) {
        if (!hospital.location) continue;
        
        const distance = calculateDistance(
          emergencyData.patientLocation.latitude,
          emergencyData.patientLocation.longitude,
          hospital.location.latitude,
          hospital.location.longitude
        );
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestHospital = hospital;
        }
      }
      
      if (!nearestHospital) {
        throw new Error('No hospitals available');
      }
      
      // Update emergency with assigned hospital
      await snapshot.ref.update({
        assignedHospitalId: nearestHospital.id,
        assignedHospitalName: nearestHospital.name,
        distanceToHospital: shortestDistance,
        estimatedTravelTime: (shortestDistance / 40) * 60, // 40 km/h average speed
        hospitalAssignmentTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending'
      });
      
      console.log(`✅ Emergency ${emergencyId} assigned to ${nearestHospital.name} (${shortestDistance.toFixed(2)}km)`);
      
      // Optional: Send push notification to hospital
      // await sendHospitalNotification(nearestHospital.id, emergencyId);
      
      return null;
      
    } catch (error) {
      console.error(`❌ Error assigning hospital to ${emergencyId}:`, error);
      await snapshot.ref.update({
        status: 'error',
        errorMessage: 'Failed to assign hospital'
      });
      return null;
    }
  });

/**
 * Haversine distance calculation
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}