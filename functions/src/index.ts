import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { processEmergencyRequest } from './emergency/processEmergency';
import { selectBestHospital } from './hospital/selectHospital';
import { assignNearestAmbulance } from './emergency/assignAmbulance';

admin.initializeApp();

// Trigger when emergency request is created
export const onEmergencyCreated = functions.firestore
  .document('emergency_requests/{emergencyId}')
  .onCreate(async (snap, context) => {
    const emergencyData = snap.data();
    
    // Step 1: Select best hospital
    const selectedHospital = await selectBestHospital(
      emergencyData.patientLocation,
      emergencyData.emergencyType,
      emergencyData.patientCondition
    );
    
    // Step 2: Assign nearest available ambulance
    const assignedAmbulance = await assignNearestAmbulance(
      emergencyData.patientLocation,
      selectedHospital.hospitalId
    );
    
    // Step 3: Update emergency request with assignments
    await snap.ref.update({
      assignedHospital: selectedHospital.hospitalId,
      assignedAmbulance: assignedAmbulance.ambulanceId,
      estimatedArrivalTime: assignedAmbulance.estimatedTime,
      hospitalEta: selectedHospital.estimatedTime,
      status: 'ambulance_assigned',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Step 4: Notify hospital
    await admin.firestore().collection('hospital_notifications').add({
      hospitalId: selectedHospital.hospitalId,
      emergencyId: context.params.emergencyId,
      patientInfo: {
        name: emergencyData.patientName,
        condition: emergencyData.patientCondition,
        location: emergencyData.patientLocation
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return null;
  });

// Trigger when ambulance location updates
export const onAmbulanceLocationUpdate = functions.firestore
  .document('ambulance_locations/{ambulanceId}')
  .onWrite(async (change, context) => {
    const after = change.after.data();
    if (!after) return null;
    
    // Find active emergency for this ambulance
    const emergencies = await admin.firestore()
      .collection('emergency_requests')
      .where('assignedAmbulance', '==', context.params.ambulanceId)
      .where('status', 'in', ['ambulance_assigned', 'ambulance_enroute', 'patient_picked'])
      .limit(1)
      .get();
    
    if (!emergencies.empty) {
      const emergency = emergencies.docs[0];
      
      // Update emergency with latest ambulance location
      await emergency.ref.update({
        ambulanceCurrentLocation: after.location,
        lastLocationUpdate: after.timestamp
      });
      
      // Calculate updated ETA
      const patientLocation = emergency.data().patientLocation;
      // Update ETA logic here
    }
    
    return null;
  });

// Scheduled function to check hospital capacity
export const checkHospitalCapacity = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async (context) => {
    const hospitals = await admin.firestore().collection('hospitals').get();
    
    hospitals.docs.forEach(async (hospitalDoc) => {
      const hospital = hospitalDoc.data();
      const resources = hospital.resources;
      
      // Check if resources are critically low
      if (resources.icuBeds.available < resources.icuBeds.total * 0.1 ||
          resources.ventilators.available < resources.ventilators.total * 0.1) {
        
        // Send alert to admin
        await admin.firestore().collection('admin_alerts').add({
          type: 'CRITICAL_RESOURCES',
          hospitalId: hospitalDoc.id,
          hospitalName: hospital.name,
          resources: resources,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    return null;
  });