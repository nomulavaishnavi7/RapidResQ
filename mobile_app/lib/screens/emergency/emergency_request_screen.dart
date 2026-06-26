// lib/screens/emergency/emergency_request_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import '../../services/emergency_service.dart';
import '../../services/location_service.dart';
import 'emergency_tracking_screen.dart';

class EmergencyRequestScreen extends StatefulWidget {
  const EmergencyRequestScreen({super.key});

  @override
  State<EmergencyRequestScreen> createState() => _EmergencyRequestScreenState();
}

class _EmergencyRequestScreenState extends State<EmergencyRequestScreen> {
  final TextEditingController _descriptionController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;
  bool _isLocationLoading = false;
  Position? _cachedPosition;
  String? _cachedAddress;
  String? _locationErrorMessage;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ensureLocation();
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  /// Ensures location is available before proceeding
  Future<void> _ensureLocation() async {
    if (_isLocationLoading) return;
    
    setState(() {
      _isLocationLoading = true;
      _locationErrorMessage = null;  // Clear error on new attempt
      _errorMessage = null;
    });

    try {
      final locationService = context.read<LocationService>();
      
      print('📍 Attempting to get location...');
      
      // First, check if we already have a valid cached position
      if (locationService.hasLocation && locationService.currentPosition != null) {
        final pos = locationService.currentPosition!;
        if (pos.latitude != 0 && pos.longitude != 0) {
          setState(() {
            _cachedPosition = pos;
            _cachedAddress = locationService.currentAddress;
            _locationErrorMessage = null;  // Clear error on success
          });
          print('✅ Using cached location: ${_cachedPosition!.latitude}, ${_cachedPosition!.longitude}');
          _isLocationLoading = false;
          return;
        }
      }
      
      // Force refresh location
      await locationService.getCurrentLocation(forceUpdate: true);
      
      // Wait a moment for location to be processed
      await Future.delayed(const Duration(milliseconds: 500));
      
      // Update cached values
      if (locationService.hasLocation && locationService.currentPosition != null) {
        final pos = locationService.currentPosition!;
        if (pos.latitude != 0 && pos.longitude != 0) {
          setState(() {
            _cachedPosition = pos;
            _cachedAddress = locationService.currentAddress;
            _locationErrorMessage = null;  // Clear error on success
          });
          print('✅ Location obtained: ${_cachedPosition!.latitude}, ${_cachedPosition!.longitude}');
          print('✅ Address: $_cachedAddress');
        } else {
          setState(() {
            _locationErrorMessage = 'Invalid coordinates received';
          });
        }
      } else {
        print('⚠️ Location service has no location, trying direct fetch...');
        await _getLocationDirectly();
      }
      
    } catch (e) {
      print('❌ Error ensuring location: $e');
      await _getLocationDirectly();
    } finally {
      if (mounted) {
        setState(() {
          _isLocationLoading = false;
        });
      }
    }
  }

  /// Direct location fetch using Geolocator
  Future<void> _getLocationDirectly() async {
    try {
      print('📍 Attempting direct location fetch...');
      
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        setState(() {
          _locationErrorMessage = 'GPS is turned off. Please enable location services in your phone settings.';
          _cachedPosition = null;
        });
        print('❌ Location services disabled');
        return;
      }

      // Check and request permissions
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          setState(() {
            _locationErrorMessage = 'Location permission is needed to send your location. Please allow location access.';
            _cachedPosition = null;
          });
          print('❌ Location permission denied');
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        setState(() {
          _locationErrorMessage = 'Location permission is permanently denied. Please enable in app settings.';
          _cachedPosition = null;
        });
        print('❌ Location permission permanently denied');
        return;
      }

      // Get current position
      print('📍 Requesting position from GPS...');
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 15));
      
      if (position.latitude != 0 && position.longitude != 0) {
        setState(() {
          _cachedPosition = position;
          _locationErrorMessage = null;  // Clear error on success
        });
        
        print('✅ Location fetched: ${position.latitude}, ${position.longitude}');
        
        // Try to get address
        try {
          final placemarks = await placemarkFromCoordinates(
            position.latitude, 
            position.longitude
          ).timeout(const Duration(seconds: 5));
          
          if (placemarks.isNotEmpty) {
            final place = placemarks[0];
            final parts = <String>[];
            if (place.street != null && place.street!.isNotEmpty) parts.add(place.street!);
            if (place.locality != null && place.locality!.isNotEmpty) parts.add(place.locality!);
            if (place.administrativeArea != null && place.administrativeArea!.isNotEmpty) parts.add(place.administrativeArea!);
            if (place.country != null && place.country!.isNotEmpty) parts.add(place.country!);
            setState(() {
              _cachedAddress = parts.join(', ');
            });
            print('✅ Address found: $_cachedAddress');
          } else {
            setState(() {
              _cachedAddress = 'Location available';
            });
          }
        } catch (e) {
          print('Error getting address: $e');
          setState(() {
            _cachedAddress = 'Location available';
          });
        }
        
      } else {
        setState(() {
          _locationErrorMessage = 'Invalid location coordinates received';
          _cachedPosition = null;
        });
        print('❌ Invalid coordinates: ${position.latitude}, ${position.longitude}');
      }
      
    } catch (e) {
      print('❌ Direct location fetch failed: $e');
      setState(() {
        _locationErrorMessage = 'Unable to get your location. Please enable GPS and try again.';
        _cachedPosition = null;
      });
    }
  }

  Future<void> _refreshLocation() async {
    setState(() {
      _cachedPosition = null;
      _cachedAddress = null;
      _locationErrorMessage = null;  // Clear error on refresh
      _errorMessage = null;
    });
    await _ensureLocation();
  }

  Future<void> _openLocationSettings() async {
    await Geolocator.openAppSettings();
  }

  Future<void> _submitEmergency() async {
    final description = _descriptionController.text.trim();
    
    // Validate description
    if (description.isEmpty) {
      setState(() {
        _errorMessage = 'Please describe the emergency situation';
      });
      return;
    }

    if (description.length < 10) {
      setState(() {
        _errorMessage = 'Please provide more details (at least 10 characters)';
      });
      return;
    }

    // Check if we have valid location
    if (_cachedPosition == null || 
        _cachedPosition!.latitude == 0 || 
        _cachedPosition!.longitude == 0) {
      setState(() {
        _errorMessage = 'Location not available. Please enable GPS and try again.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final emergencyService = context.read<EmergencyService>();
      final locationService = context.read<LocationService>();
      
      // Update location service with cached position if needed
      if (locationService.currentPosition == null && _cachedPosition != null) {
        await locationService.refreshLocation();
      }
      
      // Create emergency
      final success = await emergencyService.createEmergency(
        description: description,
      );

      if (!mounted) return;

      if (success) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => const EmergencyTrackingScreen(),
          ),
        );
      } else {
        setState(() {
          _errorMessage = emergencyService.lastError ?? 'Failed to send emergency request';
        });
      }
      
    } catch (e) {
      print('❌ Error submitting emergency: $e');
      setState(() {
        _errorMessage = 'Failed to send request. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locationService = context.watch<LocationService>();
    
    // Determine if location is available - use cached position first
    final currentLat = _cachedPosition?.latitude ?? locationService.currentPosition?.latitude;
    final currentLng = _cachedPosition?.longitude ?? locationService.currentPosition?.longitude;
    final currentAddress = _cachedAddress ?? locationService.currentAddress;
    
    // Check if we have valid coordinates
    final hasValidCoordinates = currentLat != null && currentLng != null && 
                               currentLat != 0 && currentLng != 0;
    
    // Determine if location is ready for submission
    final isLocationReady = hasValidCoordinates;
    
    // 🔥 IMPORTANT: Only show error if we don't have valid coordinates AND error message exists
    final showError = !hasValidCoordinates && _locationErrorMessage != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Request'),
        backgroundColor: Colors.red,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLocationLoading ? null : _refreshLocation,
            tooltip: 'Refresh Location',
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Warning Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.warning, color: Colors.red, size: 24),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        'Describe your emergency clearly. Our system will analyze and dispatch appropriate help.',
                        style: TextStyle(color: Colors.red.shade700),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Location Card
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.location_on, color: Colors.red, size: 20),
                          SizedBox(width: 8),
                          Text(
                            'Your Location',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (_isLocationLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: Column(
                              children: [
                                CircularProgressIndicator(),
                                SizedBox(height: 8),
                                Text('Getting your location...'),
                              ],
                            ),
                          ),
                        )
                      else if (showError)
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.red.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.red.shade200),
                          ),
                          child: Column(
                            children: [
                              Row(
                                children: [
                                  Icon(Icons.gps_off, color: Colors.red.shade700, size: 20),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      _locationErrorMessage!,
                                      style: TextStyle(
                                        color: Colors.red.shade700,
                                        fontSize: 13,
                                        height: 1.3,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  Expanded(
                                    child: ElevatedButton(
                                      onPressed: _refreshLocation,
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.blue,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(vertical: 10),
                                      ),
                                      child: const Text('Retry'),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: _openLocationSettings,
                                      style: OutlinedButton.styleFrom(
                                        foregroundColor: Colors.grey.shade700,
                                        padding: const EdgeInsets.symmetric(vertical: 10),
                                      ),
                                      child: const Text('Settings'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        )
                      else if (!hasValidCoordinates)
                        Column(
                          children: [
                            const Icon(
                              Icons.location_off,
                              size: 48,
                              color: Colors.grey,
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              'Location not available',
                              style: TextStyle(color: Colors.grey),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                ElevatedButton(
                                  onPressed: _refreshLocation,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.blue,
                                    foregroundColor: Colors.white,
                                  ),
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          ],
                        )
                      else
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (currentAddress != null && currentAddress.isNotEmpty)
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: Colors.green.shade50,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: Colors.green.shade200),
                                ),
                                child: Row(
                                  children: [
                                    Icon(Icons.check_circle, size: 16, color: Colors.green.shade700),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        currentAddress,
                                        style: TextStyle(fontSize: 13, color: Colors.green.shade800),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            const SizedBox(height: 8),
                            Text(
                              '📍 Coordinates: ${currentLat!.toStringAsFixed(6)}, ${currentLng!.toStringAsFixed(6)}',
                              style: const TextStyle(fontSize: 12, color: Colors.grey),
                            ),
                          ],
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Emergency Description
              const Text(
                'Describe the Emergency',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _descriptionController,
                maxLines: 6,
                decoration: InputDecoration(
                  hintText: 'Example: "Chest pain, difficulty breathing" or "Car accident with bleeding"',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                  errorText: _errorMessage,
                  errorBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: const BorderSide(color: Colors.red),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Be specific about symptoms, injuries, or situation',
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
              ),
              const SizedBox(height: 24),

              // Submit Button
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: (_isSubmitting || _isLocationLoading || !isLocationReady) 
                      ? null 
                      : _submitEmergency,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 2,
                    disabledBackgroundColor: Colors.red.shade300,
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text(
                          'SEND EMERGENCY REQUEST',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 12),
              
              // Cancel Button
              SizedBox(
                width: double.infinity,
                height: 48,
                child: TextButton(
                  onPressed: () => Navigator.pop(context),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.grey.shade700,
                  ),
                  child: const Text('Cancel'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}