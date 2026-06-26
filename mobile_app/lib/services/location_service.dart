// lib/services/location_service.dart
import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:flutter/material.dart';

class LocationService extends ChangeNotifier {
  Position? _currentPosition;
  String? _currentAddress;
  bool _serviceEnabled = false;
  LocationPermission? _permission;
  bool _isLoading = false;
  String? _errorMessage;
  StreamSubscription<Position>? _positionStreamSubscription;
  bool _isStreaming = false;
  bool _isInitialized = false;
  DateTime? _lastLocationUpdate;

  // Cache for addresses to avoid repeated geocoding
  final Map<String, String> _addressCache = {};

  Position? get currentPosition => _currentPosition;
  String? get currentAddress => _currentAddress;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasLocation => _currentPosition != null;
  DateTime? get lastLocationUpdate => _lastLocationUpdate;

  LocationService() {
    _initialize();
  }

  Future<void> _initialize() async {
    try {
      await checkAndRequestPermission();
      await getCurrentLocation();
    } catch (e) {
      print('❌ Error initializing LocationService: $e');
      _errorMessage = 'Please enable GPS to use emergency services';
      _safeNotify();
    } finally {
      _isInitialized = true;
      _safeNotify();
    }
  }

  void _safeNotify() {
    if (_isInitialized) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (hasListeners) {
          notifyListeners();
        }
      });
    } else {
      if (hasListeners) {
        notifyListeners();
      }
    }
  }

  Future<bool> checkAndRequestPermission() async {
    try {
      _serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!_serviceEnabled) {
        _errorMessage = 'GPS is turned off. Please enable location services.';
        _safeNotify();
        return false;
      }

      _permission = await Geolocator.checkPermission();
      if (_permission == LocationPermission.denied) {
        _permission = await Geolocator.requestPermission();
        if (_permission == LocationPermission.denied) {
          _errorMessage = 'Location permission denied. Please allow location access.';
          _safeNotify();
          return false;
        }
      }

      if (_permission == LocationPermission.deniedForever) {
        _errorMessage = 'Location permission permanently denied. Please enable in app settings.';
        _safeNotify();
        return false;
      }

      _errorMessage = null;
      _safeNotify();
      return true;
    } catch (e) {
      print('❌ Error checking permissions: $e');
      _errorMessage = 'Error checking location permissions.';
      _safeNotify();
      return false;
    }
  }

  Future<void> getCurrentLocation({bool forceUpdate = false}) async {
    if (_isLoading) return;
    
    // Check if we have a recent location (less than 30 seconds old)
    if (!forceUpdate && 
        _currentPosition != null && 
        _lastLocationUpdate != null && 
        DateTime.now().difference(_lastLocationUpdate!).inSeconds < 30) {
      print('📍 Using cached location');
      return;
    }
    
    _isLoading = true;
    _errorMessage = null;
    _safeNotify();

    try {
      final hasPermission = await checkAndRequestPermission();
      if (!hasPermission) {
        _isLoading = false;
        _safeNotify();
        return;
      }

      // Try to get location with timeout
      _currentPosition = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 10));
      
      _lastLocationUpdate = DateTime.now();

      await _getAddressFromLatLng();
      
      print('✅ Location updated: ${_currentPosition!.latitude}, ${_currentPosition!.longitude}');
      _errorMessage = null;
      
    } on TimeoutException {
      print('❌ Location request timed out');
      _errorMessage = 'Location request timed out. Please check your GPS signal.';
    } catch (e) {
      print('❌ Error getting location: $e');
      _errorMessage = 'Unable to get your location. Please enable GPS and try again.';
    } finally {
      _isLoading = false;
      _safeNotify();
    }
  }

  Future<void> _getAddressFromLatLng() async {
    if (_currentPosition == null) return;

    // Create cache key
    final cacheKey = '${_currentPosition!.latitude.toStringAsFixed(4)}_${_currentPosition!.longitude.toStringAsFixed(4)}';
    
    // Check cache first
    if (_addressCache.containsKey(cacheKey)) {
      _currentAddress = _addressCache[cacheKey];
      print('✅ Using cached address: $_currentAddress');
      return;
    }

    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(
        _currentPosition!.latitude,
        _currentPosition!.longitude,
      ).timeout(const Duration(seconds: 5));

      if (placemarks.isNotEmpty) {
        Placemark place = placemarks[0];
        final addressParts = <String>[];
        
        if (place.name != null && place.name!.isNotEmpty) addressParts.add(place.name!);
        if (place.subThoroughfare != null && place.subThoroughfare!.isNotEmpty) addressParts.add(place.subThoroughfare!);
        if (place.thoroughfare != null && place.thoroughfare!.isNotEmpty) addressParts.add(place.thoroughfare!);
        if (place.locality != null && place.locality!.isNotEmpty) addressParts.add(place.locality!);
        if (place.administrativeArea != null && place.administrativeArea!.isNotEmpty) addressParts.add(place.administrativeArea!);
        if (place.country != null && place.country!.isNotEmpty) addressParts.add(place.country!);
        
        _currentAddress = addressParts.join(', ');
        
        // Cache the address
        _addressCache[cacheKey] = _currentAddress!;
        
        // Limit cache size to 50 entries
        if (_addressCache.length > 50) {
          _addressCache.remove(_addressCache.keys.first);
        }
        
        print('✅ Address found: $_currentAddress');
      } else {
        _currentAddress = 'Address not available';
      }
    } on TimeoutException {
      print('❌ Geocoding request timed out');
      _currentAddress = 'Address lookup timed out';
    } catch (e) {
      print('❌ Error getting address: $e');
      _currentAddress = 'Address could not be determined';
    }
  }

  Future<double> calculateDistance(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) async {
    try {
      return Geolocator.distanceBetween(
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
      );
    } catch (e) {
      print('❌ Error calculating distance: $e');
      return 0;
    }
  }

  double calculateDistanceSync(
    double startLatitude,
    double startLongitude,
    double endLatitude,
    double endLongitude,
  ) {
    return Geolocator.distanceBetween(
      startLatitude,
      startLongitude,
      endLatitude,
      endLongitude,
    );
  }

  Stream<Position> getLocationStream() {
    try {
      return Geolocator.getPositionStream(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          distanceFilter: 10,
          timeLimit: Duration(seconds: 5),
        ),
      );
    } catch (e) {
      print('❌ Error creating location stream: $e');
      _isStreaming = false;
      return Stream.empty();
    }
  }

  Future<void> startContinuousLocationUpdates() async {
    if (_isStreaming) return;
    
    final hasPermission = await checkAndRequestPermission();
    if (!hasPermission) return;
    
    await stopContinuousLocationUpdates();
    
    _positionStreamSubscription = getLocationStream().listen((position) {
      _currentPosition = position;
      _lastLocationUpdate = DateTime.now();
      _getAddressFromLatLng();
      _safeNotify();
    }, onError: (error) {
      print('❌ Location stream error: $error');
      _errorMessage = 'Error getting location updates';
      _safeNotify();
    }, onDone: () {
      _isStreaming = false;
    });
    
    _isStreaming = true;
  }

  Future<void> stopContinuousLocationUpdates() async {
    if (_positionStreamSubscription != null) {
      await _positionStreamSubscription!.cancel();
      _positionStreamSubscription = null;
    }
    _isStreaming = false;
  }

  Future<bool> openLocationSettings() async {
    return await Geolocator.openLocationSettings();
  }

  Future<bool> openAppSettings() async {
    return await Geolocator.openAppSettings();
  }

  Future<String> getFormattedAddress() async {
    if (_currentPosition == null) return 'Location not available';
    
    final cacheKey = '${_currentPosition!.latitude.toStringAsFixed(4)}_${_currentPosition!.longitude.toStringAsFixed(4)}';
    
    if (_addressCache.containsKey(cacheKey)) {
      return _addressCache[cacheKey]!;
    }
    
    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(
        _currentPosition!.latitude,
        _currentPosition!.longitude,
      );
      
      if (placemarks.isNotEmpty) {
        final place = placemarks[0];
        final parts = <String>[];
        if (place.name != null && place.name!.isNotEmpty) parts.add(place.name!);
        if (place.thoroughfare != null && place.thoroughfare!.isNotEmpty) parts.add(place.thoroughfare!);
        if (place.locality != null && place.locality!.isNotEmpty) parts.add(place.locality!);
        if (place.country != null && place.country!.isNotEmpty) parts.add(place.country!);
        final address = parts.join(', ');
        
        _addressCache[cacheKey] = address;
        
        return address;
      }
      return 'Address not found';
    } catch (e) {
      print('❌ Error getting formatted address: $e');
      return 'Address error';
    }
  }

  bool isWithinRadius(double centerLat, double centerLng, double targetLat, double targetLng, double radiusMeters) {
    final distance = Geolocator.distanceBetween(
      centerLat, centerLng, targetLat, targetLng
    );
    return distance <= radiusMeters;
  }

  void clearError() {
    _errorMessage = null;
    _safeNotify();
  }

  Future<void> refreshLocation() async {
    await getCurrentLocation(forceUpdate: true);
  }

  void clearAddressCache() {
    _addressCache.clear();
    print('🗑️ Address cache cleared');
  }

  @override
  Future<void> dispose() async {
    await stopContinuousLocationUpdates();
    _addressCache.clear();
    super.dispose();
  }
}