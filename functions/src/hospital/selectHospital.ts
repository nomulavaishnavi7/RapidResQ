import * as admin from 'firebase-admin';

interface HospitalScore {
  hospitalId: string;
  score: number;
  distance: number;
  resourceAvailability: number;
  capabilityScore: number;
}

export async function selectBestHospital(
  patientLocation: { latitude: number; longitude: number },
  emergencyType: string,
  patientCondition: string
) {
  try {
    // Get all active hospitals
    const hospitalsSnapshot = await admin.firestore()
      .collection('hospitals')
      .where('verified', '==', true)
      .get();
    
    const hospitalScores: HospitalScore[] = [];
    
    for (const hospitalDoc of hospitalsSnapshot.docs) {
      const hospital = hospitalDoc.data();
      const resources = hospital.resources;
      
      // Calculate distance score (0-100, closer = higher score)
      const distance = calculateDistance(
        patientLocation,
        hospital.location
      );
      const distanceScore = Math.max(0, 100 - (distance / 1000)); // Convert to km, max 100km range
      
      // Calculate resource availability score (0-100)
      const resourceScore = calculateResourceScore(resources, emergencyType);
      
      // Calculate emergency capability score (0-100)
      const capabilityScore = calculateCapabilityScore(
        hospital.capabilities,
        emergencyType,
        patientCondition
      );
      
      // Weighted final score
      const finalScore = 
        distanceScore * 0.3 +    // 30% weight for distance
        resourceScore * 0.4 +     // 40% weight for resources
        capabilityScore * 0.3;     // 30% weight for capabilities
      
      hospitalScores.push({
        hospitalId: hospitalDoc.id,
        score: finalScore,
        distance: distance,
        resourceAvailability: resourceScore,
        capabilityScore: capabilityScore
      });
    }
    
    // Sort by score descending and get best hospital
    hospitalScores.sort((a, b) => b.score - a.score);
    const bestHospital = hospitalScores[0];
    
    // Get hospital details
    const hospitalDoc = await admin.firestore()
      .collection('hospitals')
      .doc(bestHospital.hospitalId)
      .get();
    
    const hospitalData = hospitalDoc.data();
    
    // Calculate estimated travel time (assuming average speed 40 km/h in city)
    const estimatedTime = (bestHospital.distance / 1000) / 40 * 60; // in minutes
    
    return {
      hospitalId: bestHospital.hospitalId,
      hospitalName: hospitalData?.name,
      estimatedTime: Math.round(estimatedTime),
      score: bestHospital.score
    };
    
  } catch (error) {
    console.error('Error selecting hospital:', error);
    throw error;
  }
}

function calculateDistance(
  point1: { latitude: number; longitude: number },
  point2: { latitude: number; longitude: number }
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = point1.latitude * Math.PI / 180;
  const φ2 = point2.latitude * Math.PI / 180;
  const Δφ = (point2.latitude - point1.latitude) * Math.PI / 180;
  const Δλ = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

function calculateResourceScore(resources: any, emergencyType: string): number {
  let score = 0;
  let totalWeight = 0;
  
  // ICU beds availability
  if (resources.icuBeds) {
    const icuAvailability = (resources.icuBeds.available / resources.icuBeds.total) * 100;
    score += icuAvailability * 0.4; // 40% weight
    totalWeight += 40;
  }
  
  // Ventilators availability
  if (resources.ventilators) {
    const ventAvailability = (resources.ventilators.available / resources.ventilators.total) * 100;
    score += ventAvailability * 0.3; // 30% weight
    totalWeight += 30;
  }
  
  // Emergency doctors availability
  if (resources.emergencyDoctors) {
    const doctorAvailability = (resources.emergencyDoctors.available / resources.emergencyDoctors.total) * 100;
    score += doctorAvailability * 0.2; // 20% weight
    totalWeight += 20;
  }
  
  // Trauma support
  if (resources.traumaSupport && resources.traumaSupport.available) {
    score += 10; // 10% weight
    totalWeight += 10;
  }
  
  return totalWeight > 0 ? score / totalWeight * 100 : 0;
}

function calculateCapabilityScore(
  capabilities: string[],
  emergencyType: string,
  patientCondition: string
): number {
  const emergencyCapabilities: { [key: string]: string[] } = {
    'CARDIAC_EMERGENCY': ['CARDIAC_EMERGENCY', 'CARDIOLOGY', 'ICU'],
    'TRAUMA': ['TRAUMA_CENTER', 'SURGERY', 'ORTHOPEDICS'],
    'STROKE': ['STROKE_UNIT', 'NEUROLOGY', 'ICU'],
    'RESPIRATORY': ['RESPIRATORY', 'PULMONOLOGY', 'ICU'],
    'PEDIATRIC': ['PEDIATRIC_EMERGENCY', 'PEDIATRICS', 'NICU']
  };
  
  const requiredCapabilities = emergencyCapabilities[emergencyType] || [];
  if (requiredCapabilities.length === 0) return 50; // Default score
  
  let matchedCapabilities = 0;
  requiredCapabilities.forEach(capability => {
    if (capabilities.includes(capability)) {
      matchedCapabilities++;
    }
  });
  
  return (matchedCapabilities / requiredCapabilities.length) * 100;
}