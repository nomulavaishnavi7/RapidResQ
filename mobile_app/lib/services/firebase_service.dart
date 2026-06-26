// lib/services/firebase_service.dart
import 'dart:math';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/emergency_model.dart';
import '../models/hospital_model.dart';
import '../models/ambulance_model.dart';

class FirebaseService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  // ==================== MEDICAL PRIORITY DISPATCH METHODS ====================
  
  /// Check if emergency is CRITICAL
  bool _isCriticalEmergency(String emergencyType) {
    const criticalTypes = [
      'CARDIAC_EMERGENCY',
      'STROKE',
      'RESPIRATORY',
      'NEUROLOGICAL'
    ];
    return criticalTypes.contains(emergencyType);
  }
  
  /// Get required resources based on emergency type
  Map<String, dynamic> _getRequiredResources(String emergencyType) {
    switch (emergencyType) {
      case 'CARDIAC_EMERGENCY':
        return {
          'requiredCapabilities': ['CARDIAC', 'CARDIOLOGY', 'ICU'],
          'requiredResources': {
            'icuBeds': 1,
            'ventilators': 1,
          },
          'priorityLevel': 'CRITICAL'
        };
      case 'STROKE':
        return {
          'requiredCapabilities': ['NEUROLOGY', 'STROKE', 'ICU'],
          'requiredResources': {
            'icuBeds': 1,
          },
          'priorityLevel': 'CRITICAL'
        };
      case 'RESPIRATORY':
        return {
          'requiredCapabilities': ['RESPIRATORY', 'PULMONOLOGY', 'ICU'],
          'requiredResources': {
            'ventilators': 1,
          },
          'priorityLevel': 'CRITICAL'
        };
      case 'NEUROLOGICAL':
        return {
          'requiredCapabilities': ['NEUROLOGY', 'ICU'],
          'requiredResources': {
            'icuBeds': 1,
          },
          'priorityLevel': 'CRITICAL'
        };
      case 'TRAUMA':
        return {
          'requiredCapabilities': ['TRAUMA', 'EMERGENCY', 'SURGERY'],
          'requiredResources': {
            'regularBeds': 1,
          },
          'priorityLevel': 'HIGH'
        };
      case 'DIABETIC':
        return {
          'requiredCapabilities': ['EMERGENCY', 'ENDOCRINOLOGY'],
          'requiredResources': {
            'regularBeds': 1,
          },
          'priorityLevel': 'MODERATE'
        };
      case 'ALLERGIC':
        return {
          'requiredCapabilities': ['EMERGENCY', 'ALLERGY'],
          'requiredResources': {
            'regularBeds': 1,
          },
          'priorityLevel': 'MODERATE'
        };
      default:
        return {
          'requiredCapabilities': ['EMERGENCY'],
          'requiredResources': {
            'regularBeds': 1,
          },
          'priorityLevel': 'NORMAL'
        };
    }
  }
  
  /// Extract numeric value from nested resource structure
  int _getResourceValue(Map<String, dynamic> resources, String resourceKey) {
    final resource = resources[resourceKey];
    
    if (resource == null) return 0;
    
    if (resource is Map) {
      return (resource['available'] ?? 0).toInt();
    }
    
    if (resource is num) {
      return resource.toInt();
    }
    
    return 0;
  }
  
  /// Check if hospital has required resources
  bool _hasRequiredResources(Map<String, dynamic> resources, Map<String, dynamic> required) {
    for (final entry in required.entries) {
      final resourceKey = entry.key;
      final requiredAmount = entry.value;
      
      final available = _getResourceValue(resources, resourceKey);
      
      print('  🔍 Checking resource $resourceKey: available=$available, required=$requiredAmount');
      
      if (available < requiredAmount) {
        print('  ❌ Insufficient $resourceKey: $available < $requiredAmount');
        return false;
      }
    }
    return true;
  }
  
  /// Calculate resource score
  double _calculateResourceScore(Map<String, dynamic> resources, String emergencyType) {
    final required = _getRequiredResources(emergencyType);
    final requiredResources = required['requiredResources'];
    
    if (requiredResources.isEmpty) return 0.5;
    
    double totalScore = 0;
    int count = 0;
    
    for (final entry in requiredResources.entries) {
      final resourceKey = entry.key;
      final requiredAmount = entry.value;
      
      final resource = resources[resourceKey];
      double available = 0;
      
      if (resource is Map) {
        available = (resource['available'] ?? 0).toDouble();
      } else if (resource is num) {
        available = resource.toDouble();
      }
      
      final score = (available / requiredAmount).clamp(0.0, 1.0);
      totalScore += score;
      count++;
      
      print('  📊 Resource $resourceKey: available=$available, required=$requiredAmount, score=${score.toStringAsFixed(2)}');
    }
    
    return count > 0 ? totalScore / count : 0.5;
  }
  
  /// Check if capabilities match
  bool _checkCapabilityMatch(List<String> capabilities, List<String> requiredCapabilities) {
    if (capabilities.isEmpty) return requiredCapabilities.contains('EMERGENCY');
    
    for (final required in requiredCapabilities) {
      if (capabilities.any((c) => c.toUpperCase().contains(required))) {
        return true;
      }
    }
    return false;
  }
  
  /// Calculate distance score
  double _calculateDistanceScore(double distance, double maxDistance) {
    return 1 - (distance / maxDistance).clamp(0.0, 1.0);
  }
  
  /// Calculate final hospital score
  double _calculateHospitalScore({
    required double distance,
    required Map<String, dynamic> resources,
    required String emergencyType,
    required double maxDistance,
  }) {
    final isCritical = _isCriticalEmergency(emergencyType);
    
    final double distanceWeight;
    final double resourceWeight;
    
    if (isCritical) {
      distanceWeight = 0.7;
      resourceWeight = 0.3;
    } else {
      distanceWeight = 0.3;
      resourceWeight = 0.7;
    }
    
    final distanceScore = _calculateDistanceScore(distance, maxDistance);
    final resourceScore = _calculateResourceScore(resources, emergencyType);
    
    final finalScore = (distanceScore * distanceWeight) + (resourceScore * resourceWeight);
    
    return finalScore;
  }
  
  /// Calculate distance using Haversine formula
  double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    const R = 6371;
    final dLat = _toRadians(lat2 - lat1);
    final dLon = _toRadians(lon2 - lon1);
    final a = 
        sin(dLat / 2) * sin(dLat / 2) +
        cos(_toRadians(lat1)) * cos(_toRadians(lat2)) * 
        sin(dLon / 2) * sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return R * c;
  }
  
  double _toRadians(double degrees) => degrees * pi / 180;
  
  /// Send notifications to candidate hospitals
  Future<void> _sendDispatchNotifications(
    String emergencyId,
    List<String> hospitalIds,
    Map<String, double> patientLocation,
    String emergencyType,
  ) async {
    final batch = _firestore.batch();
    final isCritical = _isCriticalEmergency(emergencyType);
    
    for (final hospitalId in hospitalIds) {
      final notificationRef = _firestore
          .collection('hospitals')
          .doc(hospitalId)
          .collection('notifications')
          .doc();
      
      batch.set(notificationRef, {
        'emergencyId': emergencyId,
        'emergencyType': emergencyType,
        'isCritical': isCritical,
        'patientLocation': {
          'latitude': patientLocation['latitude'] ?? 0.0,
          'longitude': patientLocation['longitude'] ?? 0.0,
        },
        'createdAt': FieldValue.serverTimestamp(),
        'read': false,
        'type': 'dispatch',
        'priority': isCritical ? 'CRITICAL' : 'NORMAL',
      });
    }
    
    await batch.commit();
  }
  
  /// Trigger intelligent dispatch with medical priority logic
  Future<void> triggerIntelligentDispatch({
    required String emergencyId,
    required Map<String, double> patientLocation,
    required String emergencyType,
  }) async {
    print('🚀 Triggering intelligent dispatch for emergency: $emergencyId');
    print('📋 Emergency Type: $emergencyType');
    
    final isCritical = _isCriticalEmergency(emergencyType);
    print('⚠️ Is Critical: $isCritical');
    
    final required = _getRequiredResources(emergencyType);
    print('📋 Required Resources: ${required['requiredResources']}');
    print('📋 Required Capabilities: ${required['requiredCapabilities']}');
    
    try {
      final patientLat = patientLocation['latitude'];
      final patientLng = patientLocation['longitude'];
      
      if (patientLat == null || patientLng == null) {
        print('❌ Invalid patient location');
        await _firestore.collection('emergency_requests').doc(emergencyId).update({
          'status': 'pending',
          'isLocked': false,
          'candidateHospitals': [],
        });
        return;
      }
      
      final hospitalsSnapshot = await _firestore.collection('hospitals').get();
      final List<Map<String, dynamic>> eligibleHospitals = [];
      
      for (var doc in hospitalsSnapshot.docs) {
        final data = doc.data();
        final hospitalName = data['name'] ?? 'Unknown Hospital';
        
        double hospitalLat = 0.0;
        double hospitalLng = 0.0;
        bool hasValidLocation = false;
        
        if (data['location'] is Map) {
          final location = data['location'] as Map;
          if (location['latitude'] != null && location['longitude'] != null) {
            hospitalLat = (location['latitude'] as num).toDouble();
            hospitalLng = (location['longitude'] as num).toDouble();
            hasValidLocation = true;
          }
        }
        
        if (!hasValidLocation) {
          print('⚠️ Skipping $hospitalName - invalid coordinates');
          continue;
        }
        
        final distance = _calculateDistance(
          patientLat, patientLng, hospitalLat, hospitalLng
        );
        
        const radiusKm = 15.0;
        if (distance > radiusKm) {
          print('⚠️ Skipping $hospitalName - ${distance.toStringAsFixed(1)}km away ( > $radiusKm)');
          continue;
        }
        
        final capabilities = List<String>.from(data['capabilities'] ?? []);
        final hasCapability = _checkCapabilityMatch(
          capabilities, 
          required['requiredCapabilities'] as List<String>
        );
        
        if (!hasCapability) {
          print('⚠️ Skipping $hospitalName - missing required capabilities');
          continue;
        }
        
        final resources = data['resources'] ?? {};
        final hasResources = _hasRequiredResources(
          resources, 
          required['requiredResources'] as Map<String, dynamic>
        );
        
        if (!hasResources) {
          print('⚠️ Skipping $hospitalName - missing required resources');
          continue;
        }
        
        final score = _calculateHospitalScore(
          distance: distance,
          resources: resources,
          emergencyType: emergencyType,
          maxDistance: radiusKm,
        );
        
        eligibleHospitals.add({
          'id': doc.id,
          'name': hospitalName,
          'distance': distance,
          'score': score,
          'resources': resources,
          'capabilities': capabilities,
        });
        
        print('🏥 $hospitalName: distance=${distance.toStringAsFixed(1)}km, score=${score.toStringAsFixed(2)}');
      }
      
      eligibleHospitals.sort((a, b) => (b['score'] as double).compareTo(a['score'] as double));
      
      final topHospitals = eligibleHospitals.take(3).toList();
      final candidateHospitalIds = topHospitals.map((h) => h['id'] as String).toList();
      
      print('🏆 Top ${topHospitals.length} hospitals selected: $candidateHospitalIds');
      
      final emergencyRef = _firestore.collection('emergency_requests').doc(emergencyId);
      
      final Map<String, Map<String, dynamic>> hospitalRankings = {};
      for (var h in topHospitals) {
        hospitalRankings[h['id'] as String] = {
          'score': h['score'] as double,
          'distance': h['distance'] as double,
          'priorityLevel': required['priorityLevel'],
        };
      }
      
      await emergencyRef.update({
        'candidateHospitals': candidateHospitalIds,
        'hospitalRankings': hospitalRankings,
        'isLocked': candidateHospitalIds.isNotEmpty,
        'isCritical': isCritical,
        'priorityLevel': required['priorityLevel'],
        'status': 'pending',
        'updatedAt': FieldValue.serverTimestamp(),
        'timeline.dispatched': FieldValue.serverTimestamp(),
      });
      
      print('✅ Emergency updated with ${topHospitals.length} candidates');
      
      if (candidateHospitalIds.isNotEmpty) {
        await _sendDispatchNotifications(emergencyId, candidateHospitalIds, patientLocation, emergencyType);
        print('📨 Notifications sent to ${candidateHospitalIds.length} hospitals');
      } else {
        print('⚠️ No eligible hospitals found - emergency will be visible to all hospitals');
      }
      
    } catch (e) {
      print('❌ Error in intelligent dispatch: $e');
      print('Stack trace: ${StackTrace.current}');
      await _firestore.collection('emergency_requests').doc(emergencyId).update({
        'status': 'pending',
        'isLocked': false,
        'candidateHospitals': [],
      });
    }
  }
  
  // ==================== HOSPITAL QUERY METHODS ====================
  
  /// Get nearby hospitals with radius filtering
  Stream<List<HospitalModel>> getNearbyHospitalsWithRadius(
    double lat,
    double lng,
    double radiusKm,
  ) {
    return _firestore
        .collection('hospitals')
        .snapshots()
        .map((snapshot) {
          final hospitals = <HospitalModel>[];
          
          for (var doc in snapshot.docs) {
            final data = doc.data();
            
            double hospitalLat = 0.0;
            double hospitalLng = 0.0;
            bool hasValidLocation = false;
            
            if (data['location'] is Map) {
              final location = data['location'] as Map;
              if (location['latitude'] != null && location['longitude'] != null) {
                hospitalLat = (location['latitude'] as num).toDouble();
                hospitalLng = (location['longitude'] as num).toDouble();
                hasValidLocation = true;
              }
            }
            
            if (!hasValidLocation) {
              continue;
            }
            
            final distance = _calculateDistance(
              lat, lng,
              hospitalLat, hospitalLng
            );
            
            if (distance <= radiusKm) {
              hospitals.add(HospitalModel.fromMap(data, doc.id));
            }
          }
          
          hospitals.sort((a, b) {
            final distanceA = _calculateDistance(lat, lng, a.latitude, a.longitude);
            final distanceB = _calculateDistance(lat, lng, b.latitude, b.longitude);
            return distanceA.compareTo(distanceB);
          });
          
          return hospitals;
        });
  }
  
  /// Get nearby hospitals (basic version)
  Stream<List<HospitalModel>> getNearbyHospitals(double lat, double lng) {
    return getNearbyHospitalsWithRadius(lat, lng, 15.0);
  }
  
  /// Get all hospitals
  Stream<List<HospitalModel>> getAllHospitals({int limit = 100}) {
    return _firestore
        .collection('hospitals')
        .limit(limit)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => HospitalModel.fromMap(doc.data(), doc.id))
              .toList();
        });
  }
  
  /// Get hospital by ID
  Future<HospitalModel?> getHospital(String hospitalId) async {
    try {
      final doc = await _firestore.collection('hospitals').doc(hospitalId).get();
      if (doc.exists) {
        return HospitalModel.fromMap(doc.data()!, doc.id);
      }
      return null;
    } catch (e) {
      print('❌ Error fetching hospital: $e');
      return null;
    }
  }
  
  // ==================== AMBULANCE METHODS ====================
  
  /// Get ambulance by ID
  Future<AmbulanceModel?> getAmbulance(String ambulanceId) async {
    try {
      final doc = await _firestore.collection('ambulances').doc(ambulanceId).get();
      if (doc.exists) {
        return AmbulanceModel.fromMap(doc.data()!, doc.id);
      }
      return null;
    } catch (e) {
      print('❌ Error fetching ambulance: $e');
      return null;
    }
  }
  
  /// Stream ambulance location
  Stream<AmbulanceModel?> getAmbulanceStream(String ambulanceId) {
    return _firestore
        .collection('ambulances')
        .doc(ambulanceId)
        .snapshots()
        .map((snapshot) {
          if (snapshot.exists) {
            return AmbulanceModel.fromMap(snapshot.data()!, snapshot.id);
          }
          return null;
        });
  }
  
  /// Get available ambulances
  Stream<List<AmbulanceModel>> getAvailableAmbulances() {
    return _firestore
        .collection('ambulances')
        .where('status', isEqualTo: 'available')
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => AmbulanceModel.fromMap(doc.data(), doc.id))
              .toList();
        });
  }
  
  /// Get nearby ambulances
  Stream<List<AmbulanceModel>> getNearbyAmbulances(double lat, double lng, double radiusKm) {
    return _firestore
        .collection('ambulances')
        .where('status', isEqualTo: 'available')
        .snapshots()
        .map((snapshot) {
          final ambulances = <AmbulanceModel>[];
          
          for (var doc in snapshot.docs) {
            final data = doc.data();
            final location = data['currentLocation'];
            
            if (location == null) continue;
            
            final ambulanceLat = (location['latitude'] ?? 0.0).toDouble();
            final ambulanceLng = (location['longitude'] ?? 0.0).toDouble();
            
            if (ambulanceLat == 0.0 || ambulanceLng == 0.0) continue;
            
            final distance = _calculateDistance(lat, lng, ambulanceLat, ambulanceLng);
            
            if (distance <= radiusKm) {
              ambulances.add(AmbulanceModel.fromMap(data, doc.id));
            }
          }
          
          ambulances.sort((a, b) {
            final aLat = a.latitude ?? 0.0;
            final aLng = a.longitude ?? 0.0;
            final bLat = b.latitude ?? 0.0;
            final bLng = b.longitude ?? 0.0;
            
            final distanceA = _calculateDistance(lat, lng, aLat, aLng);
            final distanceB = _calculateDistance(lat, lng, bLat, bLng);
            return distanceA.compareTo(distanceB);
          });
          
          return ambulances;
        });
  }
  
  /// Assign nearest ambulance
  Future<String?> assignNearestAmbulance(
    String emergencyId,
    double patientLat,
    double patientLng,
  ) async {
    try {
      final ambulancesSnapshot = await _firestore
          .collection('ambulances')
          .where('status', isEqualTo: 'available')
          .get();
      
      if (ambulancesSnapshot.docs.isEmpty) {
        print('⚠️ No available ambulances found');
        return null;
      }
      
      Map<String, dynamic>? nearestAmbulance;
      double shortestDistance = double.infinity;
      
      for (final doc in ambulancesSnapshot.docs) {
        final data = doc.data();
        final location = data['currentLocation'];
        
        if (location == null) continue;
        
        final ambulanceLat = (location['latitude'] ?? 0.0).toDouble();
        final ambulanceLng = (location['longitude'] ?? 0.0).toDouble();
        
        if (ambulanceLat == 0.0 || ambulanceLng == 0.0) continue;
        
        final distance = _calculateDistance(
          patientLat,
          patientLng,
          ambulanceLat,
          ambulanceLng,
        );
        
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestAmbulance = {
            'id': doc.id,
            ...data,
            'distance': distance,
          };
        }
      }
      
      if (nearestAmbulance == null) {
        print('⚠️ No suitable ambulance found');
        return null;
      }
      
      await _firestore.collection('emergency_requests').doc(emergencyId).update({
        'assignedAmbulanceId': nearestAmbulance['id'],
        'ambulanceDistance': shortestDistance,
        'ambulanceEta': (shortestDistance / 40 * 60).round(),
        'status': 'ambulance_assigned',
      });
      
      await _firestore.collection('ambulances').doc(nearestAmbulance['id']).update({
        'status': 'assigned',
        'assignedEmergencyId': emergencyId,
        'updatedAt': FieldValue.serverTimestamp(),
      });
      
      print('🚑 Ambulance assigned: ${nearestAmbulance['id']} (${shortestDistance.toStringAsFixed(1)}km)');
      return nearestAmbulance['id'];
    } catch (e) {
      print('❌ Error assigning ambulance: $e');
      return null;
    }
  }
  
  // ==================== EMERGENCY METHODS ====================
  
  /// Create emergency request
  Future<String> createEmergencyRequest(EmergencyModel emergency) async {
    try {
      final docRef = await _firestore.collection('emergency_requests').add({
        ...emergency.toMap(),
        'createdAt': FieldValue.serverTimestamp(),
        'status': 'pending',
        'isLocked': false,
        'isCritical': _isCriticalEmergency(emergency.emergencyType),
        'candidateHospitals': [],
        'timeline': {
          'created': FieldValue.serverTimestamp(),
        },
      });
      print('✅ Emergency request created: ${docRef.id}');
      return docRef.id;
    } catch (e) {
      print('❌ Error creating emergency request: $e');
      rethrow;
    }
  }

  /// Update emergency status
  Future<void> updateEmergencyStatus(
    String emergencyId, 
    String status, {
    String? assignedHospitalId,
    String? assignedHospitalName,
    String? assignedAmbulanceId,
  }) async {
    try {
      final emergencyRef = _firestore.collection('emergency_requests').doc(emergencyId);
      final emergencyDoc = await emergencyRef.get();
      
      if (!emergencyDoc.exists) {
        throw Exception('Emergency not found');
      }
      
      final currentData = emergencyDoc.data()!;
      final isLocked = currentData['isLocked'] ?? false;
      final currentStatus = currentData['status'];
      
      if (status == 'accepted' && isLocked && currentStatus == 'accepted') {
        throw Exception('Emergency already accepted by another hospital');
      }
      
      final updateData = <String, dynamic>{
        'status': status,
        'updatedAt': FieldValue.serverTimestamp(),
        'timeline.$status': FieldValue.serverTimestamp(),
      };
      
      if (assignedHospitalId != null) {
        updateData['assignedHospitalId'] = assignedHospitalId;
      }
      
      if (assignedHospitalName != null) {
        updateData['assignedHospitalName'] = assignedHospitalName;
      }
      
      if (assignedAmbulanceId != null) {
        updateData['assignedAmbulanceId'] = assignedAmbulanceId;
      }
      
      if (status == 'accepted') {
        updateData['isLocked'] = true;
        updateData['acceptedBy'] = assignedHospitalId;
        updateData['acceptedAt'] = FieldValue.serverTimestamp();
      }
      
      await emergencyRef.update(updateData);
      print('✅ Emergency status updated: $emergencyId -> $status');
    } catch (e) {
      print('❌ Error updating emergency status: $e');
      rethrow;
    }
  }

  /// Get emergency stream
  Stream<EmergencyModel> getEmergencyStream(String emergencyId) {
    return _firestore
        .collection('emergency_requests')
        .doc(emergencyId)
        .snapshots()
        .map((snapshot) {
          if (snapshot.exists) {
            return EmergencyModel.fromMap(snapshot.data()!, snapshot.id);
          }
          throw Exception('Emergency not found');
        });
  }
  
  /// Get emergency by ID
  Future<EmergencyModel?> getEmergencyById(String emergencyId) async {
    try {
      final doc = await _firestore.collection('emergency_requests').doc(emergencyId).get();
      if (doc.exists) {
        return EmergencyModel.fromMap(doc.data()!, doc.id);
      }
      return null;
    } catch (e) {
      print('❌ Error fetching emergency: $e');
      return null;
    }
  }
  
  /// Get user's emergency history
  Future<List<EmergencyModel>> getUserEmergencyHistory(String userId, {int limit = 50}) async {
    try {
      final snapshot = await _firestore
          .collection('emergency_requests')
          .where('patientId', isEqualTo: userId)
          .orderBy('createdAt', descending: true)
          .limit(limit)
          .get();
      
      return snapshot.docs
          .map((doc) => EmergencyModel.fromMap(doc.data(), doc.id))
          .toList();
    } catch (e) {
      print('❌ Error fetching user emergencies: $e');
      return [];
    }
  }
  
  /// Delete emergency
  Future<void> deleteEmergency(String emergencyId) async {
    try {
      await _firestore.collection('emergency_requests').doc(emergencyId).delete();
      print('✅ Emergency deleted: $emergencyId');
    } catch (e) {
      print('❌ Error deleting emergency: $e');
      rethrow;
    }
  }
  
  /// Lock emergency
  Future<void> lockEmergency(String emergencyId, String acceptedByHospitalId) async {
    try {
      await _firestore.collection('emergency_requests').doc(emergencyId).update({
        'isLocked': true,
        'lockedBy': acceptedByHospitalId,
        'lockedAt': FieldValue.serverTimestamp(),
      });
      print('🔒 Emergency locked: $emergencyId');
    } catch (e) {
      print('❌ Error locking emergency: $e');
      rethrow;
    }
  }
  
  // ==================== SEARCH METHODS ====================
  
  /// Search hospitals by name
  Future<List<HospitalModel>> searchHospitalsByName(String query) async {
    try {
      final snapshot = await _firestore
          .collection('hospitals')
          .where('name', isGreaterThanOrEqualTo: query)
          .where('name', isLessThanOrEqualTo: '$query\uf8ff')
          .limit(20)
          .get();
      
      return snapshot.docs
          .map((doc) => HospitalModel.fromMap(doc.data(), doc.id))
          .toList();
    } catch (e) {
      print('❌ Error searching hospitals: $e');
      return [];
    }
  }
  
  // ==================== BATCH OPERATIONS ====================
  
  /// Batch write
  Future<void> batchWrite(List<Function> operations) async {
    final batch = _firestore.batch();
    await batch.commit();
  }
}