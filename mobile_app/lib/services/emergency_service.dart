// lib/services/emergency_service.dart
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import '../models/emergency_model.dart';
import 'auth_service.dart';
import 'location_service.dart';
import 'firebase_service.dart';

class EmergencyService extends ChangeNotifier {
  final AuthService _authService;
  final LocationService _locationService;
  final FirebaseService _firebaseService = FirebaseService();
  
  EmergencyModel? _currentEmergency;
  bool _isLoading = false;
  String? _lastError;
  StreamSubscription<EmergencyModel>? _emergencySubscription;
  bool _isListening = false;

  EmergencyService({
    required AuthService authService,
    required LocationService locationService,
  })  : _authService = authService,
        _locationService = locationService;

  EmergencyModel? get currentEmergency => _currentEmergency;
  bool get isLoading => _isLoading;
  String? get lastError => _lastError;
  bool get hasActiveEmergency => _currentEmergency != null && _currentEmergency!.isActive;

  void clearError() {
    _lastError = null;
    notifyListeners();
  }

  /// Derive condition from emergency type
  String _getConditionFromType(String emergencyType) {
    switch (emergencyType) {
      case 'CARDIAC_EMERGENCY':
        return 'CRITICAL - Possible heart attack or cardiac event';
      case 'STROKE':
        return 'CRITICAL - Possible stroke requiring immediate attention';
      case 'TRAUMA':
        return 'SERIOUS - Physical injury requiring urgent care';
      case 'RESPIRATORY':
        return 'URGENT - Breathing difficulty or respiratory distress';
      case 'NEUROLOGICAL':
        return 'SERIOUS - Neurological issue (seizure, loss of consciousness)';
      case 'DIABETIC':
        return 'URGENT - Diabetic emergency (blood sugar issues)';
      case 'ALLERGIC':
        return 'URGENT - Severe allergic reaction';
      default:
        return 'STABLE - Requires medical evaluation';
    }
  }

  /// Detect emergency type from description with improved scoring
  String _detectEmergencyType(String description) {
    if (description.isEmpty) return 'OTHER';
    
    final lowerDesc = description.toLowerCase();
    
    final Map<String, List<String>> keywords = {
      'CARDIAC_EMERGENCY': [
        'chest pain', 'heart attack', 'cardiac', 'heart pain', 
        'chest pressure', 'heart racing', 'palpitations', 'heart stopping'
      ],
      'STROKE': [
        'stroke', 'facial droop', 'slurred speech', 'weakness on one side', 
        'facial paralysis', 'sudden numbness', 'arm weakness', 'difficulty speaking'
      ],
      'TRAUMA': [
        'accident', 'injury', 'bleeding', 'wound', 'fall', 'broken', 
        'fracture', 'crash', 'collision', 'cut', 'stab', 'gunshot', 'burn'
      ],
      'RESPIRATORY': [
        'breathing', 'difficulty breathing', 'shortness of breath', 
        'choking', 'asthma', 'wheezing', 'not breathing', 'suffocating'
      ],
      'NEUROLOGICAL': [
        'seizure', 'convulsion', 'unresponsive', 'fainted', 
        'blackout', 'passed out', 'unconscious'
      ],
      'DIABETIC': [
        'diabetic', 'low blood sugar', 'high blood sugar', 
        'insulin', 'sugar level', 'diabetes'
      ],
      'ALLERGIC': [
        'allergic', 'allergy', 'anaphylaxis', 'hives', 
        'swelling', 'throat closing', 'food allergy', 'bee sting'
      ],
    };
    
    final scores = <String, int>{};
    for (var entry in keywords.entries) {
      int score = 0;
      for (var keyword in entry.value) {
        if (lowerDesc.contains(keyword)) {
          if (lowerDesc.contains(' $keyword ') || 
              lowerDesc.startsWith(keyword) || 
              lowerDesc.endsWith(keyword)) {
            score += 2;
          } else {
            score += 1;
          }
        }
      }
      if (score > 0) {
        scores[entry.key] = score;
      }
    }
    
    if (scores.isNotEmpty) {
      return scores.entries.reduce((a, b) => a.value > b.value ? a : b).key;
    }
    
    return 'OTHER';
  }

  /// Validate prerequisites before creating emergency
  String? _validatePrerequisites() {
    if (_authService.currentUser == null) {
      return 'Please log in to request emergency';
    }
    
    if (_locationService.currentPosition == null) {
      return 'Unable to get your location. Please enable GPS and try again.';
    }
    
    final userModel = _authService.userModel;
    if (userModel == null) {
      return 'Please complete your profile before requesting emergency';
    }
    
    if (userModel.name.isEmpty || userModel.phone.isEmpty) {
      _onProfileRequired?.call();
      return 'Please complete your profile for better assistance';
    }
    
    return null;
  }

  bool get isProfileComplete {
    final userModel = _authService.userModel;
    if (userModel == null) return false;
    return userModel.name.isNotEmpty && userModel.phone.isNotEmpty;
  }

  /// Create emergency request with intelligent dispatch
  Future<bool> createEmergency({
    required String description,
  }) async {
    if (_isLoading) return false;
    
    _isLoading = true;
    _lastError = null;
    notifyListeners();

    try {
      if (description.trim().isEmpty) {
        _lastError = 'Please describe the emergency situation';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      if (description.trim().length < 10) {
        _lastError = 'Please provide more details about the emergency (at least 10 characters)';
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final validationError = _validatePrerequisites();
      if (validationError != null) {
        _lastError = validationError;
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final detectedType = _detectEmergencyType(description);
      final condition = _getConditionFromType(detectedType);
      
      print('📝 Emergency detected: Type=$detectedType, Condition=$condition');

      final emergency = EmergencyModel(
        id: '',
        patientId: _authService.currentUser!.uid,
        patientName: _authService.userModel?.name ?? 'User',
        emergencyType: detectedType,
        condition: condition,
        description: description,
        latitude: _locationService.currentPosition!.latitude,
        longitude: _locationService.currentPosition!.longitude,
        address: _locationService.currentAddress ?? 'Location available',
        status: 'pending',
        createdAt: Timestamp.now(),
      );

      final emergencyId = await _firebaseService.createEmergencyRequest(emergency);
      
      if (emergencyId.isEmpty) {
        throw Exception('Failed to create emergency record');
      }

      print('✅ Emergency created successfully: $emergencyId');
      
      // Trigger intelligent dispatch with fallback radius (handled by FirebaseService)
      await _firebaseService.triggerIntelligentDispatch(
        emergencyId: emergencyId,
        patientLocation: {
          'latitude': _locationService.currentPosition!.latitude,
          'longitude': _locationService.currentPosition!.longitude,
        },
        emergencyType: detectedType,
      );

      _currentEmergency = emergency.copyWith(id: emergencyId);
      
      _stopListening();
      _listenToEmergency(emergencyId);
      
      _isLoading = false;
      notifyListeners();
      return true;
      
    } catch (e) {
      print('❌ Error creating emergency: $e');
      _lastError = 'Failed to send emergency request: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  VoidCallback? _onProfileRequired;
  
  void setOnProfileRequired(VoidCallback callback) {
    _onProfileRequired = callback;
  }

  void _listenToEmergency(String emergencyId) {
    _isListening = true;
    _emergencySubscription = _firebaseService.getEmergencyStream(emergencyId).listen(
      (emergency) {
        if (_currentEmergency?.id == emergency.id) {
          print('🔄 Emergency updated: ${emergency.status}');
          _currentEmergency = emergency;
          notifyListeners();
        }
      },
      onError: (error) {
        print('❌ Error tracking emergency: $error');
        _lastError = 'Error tracking emergency status: ${error.toString()}';
        _isListening = false;
        notifyListeners();
      },
      onDone: () {
        _isListening = false;
        print('Emergency stream closed');
      },
    );
  }

  void _stopListening() {
    if (_emergencySubscription != null) {
      _emergencySubscription!.cancel();
      _emergencySubscription = null;
    }
    _isListening = false;
  }

  Future<bool> cancelEmergency() async {
    if (_currentEmergency == null) {
      _lastError = 'No active emergency to cancel';
      return false;
    }
    
    if (!_currentEmergency!.isActive) {
      _lastError = 'Cannot cancel emergency that is already completed or cancelled';
      return false;
    }
    
    _isLoading = true;
    notifyListeners();
    
    try {
      await _firebaseService.updateEmergencyStatus(
        _currentEmergency!.id,
        'cancelled',
      );
      
      print('✅ Emergency cancelled: ${_currentEmergency!.id}');
      
      _stopListening();
      _currentEmergency = null;
      _isLoading = false;
      notifyListeners();
      return true;
      
    } catch (e) {
      print('❌ Error cancelling emergency: $e');
      _lastError = 'Failed to cancel emergency: ${e.toString()}';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  void clearEmergency() {
    _stopListening();
    _currentEmergency = null;
    _lastError = null;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> refreshEmergency() async {
    if (_currentEmergency != null) {
      _stopListening();
      _listenToEmergency(_currentEmergency!.id);
    }
  }

  bool isEmergencyValid() {
    if (_currentEmergency == null) return false;
    final now = DateTime.now();
    final emergencyTime = _currentEmergency!.createdAtDateTime;
    final difference = now.difference(emergencyTime);
    return difference.inHours < 24;
  }

  @override
  void dispose() {
    _stopListening();
    super.dispose();
  }
}