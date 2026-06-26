// lib/screens/map/map_view_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:geolocator/geolocator.dart';
import '../../services/location_service.dart';
import '../../services/firebase_service.dart';
import '../../models/hospital_model.dart';

class MapViewScreen extends StatefulWidget {
  const MapViewScreen({super.key});

  @override
  State<MapViewScreen> createState() => _MapViewScreenState();
}

class _MapViewScreenState extends State<MapViewScreen> {
  final FirebaseService _firebaseService = FirebaseService();
  final MapController _mapController = MapController();
  List<HospitalModel> _nearbyHospitals = [];
  List<Marker> _markers = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadNearbyHospitals();
  }

  Future<void> _loadNearbyHospitals() async {
    final locationService = Provider.of<LocationService>(context, listen: false);
    
    if (locationService.currentPosition == null) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Location not available. Please enable GPS.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      // Use getNearbyHospitalsWithRadius for better filtering
      final stream = _firebaseService.getNearbyHospitalsWithRadius(
        locationService.currentPosition!.latitude,
        locationService.currentPosition!.longitude,
        15.0, // 15km radius
      );
      
      stream.listen((hospitals) {
        if (mounted) {
          setState(() {
            _nearbyHospitals = hospitals;
            _isLoading = false;
          });
          _updateMapMarkers();
        }
      }, onError: (error) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Failed to load hospitals: ${error.toString()}';
          });
        }
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Error loading hospitals: ${e.toString()}';
      });
    }
  }

  void _updateMapMarkers() {
    final List<Marker> updatedMarkers = [];
    final locationService = Provider.of<LocationService>(context, listen: false);

    // Add user current location marker
    if (locationService.currentPosition != null) {
      updatedMarkers.add(
        Marker(
          point: LatLng(
            locationService.currentPosition!.latitude,
            locationService.currentPosition!.longitude,
          ),
          width: 40,
          height: 40,
          child: Container(
            decoration: BoxDecoration(
              color: Colors.blue,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.3),
                  blurRadius: 4,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Icon(
              Icons.my_location,
              color: Colors.white,
              size: 20,
            ),
          ),
        ),
      );
    }

    // Add hospital markers
    for (var hospital in _nearbyHospitals) {
      final availableBeds = _getAvailableResource(hospital, 'icuBeds');
      final isAvailable = availableBeds > 0;
      
      updatedMarkers.add(
        Marker(
          point: LatLng(hospital.latitude, hospital.longitude),
          width: 50,
          height: 50,
          child: GestureDetector(
            onTap: () {
              _showHospitalDetails(hospital);
            },
            child: Container(
              decoration: BoxDecoration(
                color: isAvailable ? Colors.green : Colors.red,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.3),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(
                Icons.local_hospital,
                color: Colors.white,
                size: 24,
              ),
            ),
          ),
        ),
      );
    }

    setState(() {
      _markers = updatedMarkers;
    });
  }

  // Helper methods to access hospital resources
  int _getAvailableResource(HospitalModel hospital, String resourceType) {
    final resources = hospital.resources;
    if (resources == null) return 0;
    
    if (resourceType == 'icuBeds') {
      return resources['icuBeds']?['available'] ?? 0;
    } else if (resourceType == 'ventilators') {
      return resources['ventilators']?['available'] ?? 0;
    } else if (resourceType == 'ambulances') {
      return resources['ambulances']?['available'] ?? 0;
    }
    return 0;
  }

  int _getTotalResource(HospitalModel hospital, String resourceType) {
    final resources = hospital.resources;
    if (resources == null) return 0;
    
    if (resourceType == 'icuBeds') {
      return resources['icuBeds']?['total'] ?? 0;
    } else if (resourceType == 'ventilators') {
      return resources['ventilators']?['total'] ?? 0;
    } else if (resourceType == 'ambulances') {
      return resources['ambulances']?['total'] ?? 0;
    }
    return 0;
  }

  void _showHospitalDetails(HospitalModel hospital) {
    final availableBeds = _getAvailableResource(hospital, 'icuBeds');
    final totalBeds = _getTotalResource(hospital, 'icuBeds');
    final availableVents = _getAvailableResource(hospital, 'ventilators');
    final totalVents = _getTotalResource(hospital, 'ventilators');
    final availableAmbulances = _getAvailableResource(hospital, 'ambulances');
    final totalAmbulances = _getTotalResource(hospital, 'ambulances');

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  Icons.local_hospital,
                  color: availableBeds > 0 ? Colors.green : Colors.red,
                  size: 32,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    hospital.name,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            _buildInfoRow(Icons.location_on, 'Address', hospital.address),
            const SizedBox(height: 12),
            _buildInfoRow(Icons.phone, 'Phone', hospital.phone),
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.medical_services,
              'ICU Beds',
              '$availableBeds / $totalBeds available',
              color: availableBeds > 0 ? Colors.green : Colors.red,
            ),
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.air,
              'Ventilators',
              '$availableVents / $totalVents available',
              color: availableVents > 0 ? Colors.green : Colors.red,
            ),
            const SizedBox(height: 12),
            _buildInfoRow(
              Icons.local_taxi,
              'Ambulances',
              '$availableAmbulances / $totalAmbulances available',
              color: availableAmbulances > 0 ? Colors.green : Colors.red,
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _centerMapOnHospital(hospital);
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text('Center Map on Hospital'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String label, String value, {Color? color}) {
    return Row(
      children: [
        Icon(icon, size: 20, color: Colors.grey.shade600),
        const SizedBox(width: 12),
        SizedBox(
          width: 100,
          child: Text(
            label,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: Colors.grey.shade700,
            ),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 14,
              color: color ?? Colors.grey.shade900,
              fontWeight: color != null ? FontWeight.w500 : FontWeight.normal,
            ),
          ),
        ),
      ],
    );
  }

  void _centerMapOnHospital(HospitalModel hospital) {
    _mapController.move(
      LatLng(hospital.latitude, hospital.longitude),
      15.0,
    );
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Centered on ${hospital.name}'),
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _centerOnUserLocation() async {
    final locationService = Provider.of<LocationService>(context, listen: false);
    
    if (locationService.currentPosition != null) {
      _mapController.move(
        LatLng(
          locationService.currentPosition!.latitude,
          locationService.currentPosition!.longitude,
        ),
        14.0,
      );
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Centered on your location'),
          duration: Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to get your location'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  double _calculateDistance(double lat1, double lon1, double lat2, double lon2) {
    return Geolocator.distanceBetween(lat1, lon1, lat2, lon2) / 1000;
  }

  @override
  Widget build(BuildContext context) {
    final locationService = Provider.of<LocationService>(context);
    final hasLocation = locationService.currentPosition != null;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Nearby Hospitals'),
        backgroundColor: Colors.red,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.my_location),
            onPressed: _centerOnUserLocation,
            tooltip: 'Center on my location',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadNearbyHospitals,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: Stack(
        children: [
          // Map
          if (hasLocation)
            FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: LatLng(
                  locationService.currentPosition!.latitude,
                  locationService.currentPosition!.longitude,
                ),
                initialZoom: 13.0,
                maxZoom: 18.0,
                minZoom: 3.0,
                onTap: (tapPosition, point) {
                  // Dismiss keyboard if any
                  FocusScope.of(context).unfocus();
                },
              ),
              children: [
                // OpenStreetMap tiles
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.rapidresq.patient',
                  additionalOptions: const {
                    'attribution': '© OpenStreetMap contributors',
                  },
                ),
                
                // Markers layer
                MarkerLayer(
                  markers: _markers,
                ),
              ],
            )
          else
            Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const CircularProgressIndicator(),
                  const SizedBox(height: 16),
                  Text(
                    _errorMessage ?? 'Getting your location...',
                    style: const TextStyle(color: Colors.grey),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () async {
                      final locationService = Provider.of<LocationService>(context, listen: false);
                      await locationService.getCurrentLocation();
                      _loadNearbyHospitals();
                    },
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),

          // Loading Overlay
          if (_isLoading && hasLocation)
            Container(
              color: Colors.black.withValues(alpha: 0.3),
              child: const Center(
                child: Card(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 16),
                        Text('Loading hospitals...'),
                      ],
                    ),
                  ),
                ),
              ),
            ),

          // Error Message
          if (_errorMessage != null && !_isLoading)
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Material(
                elevation: 4,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, color: Colors.red.shade700),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, size: 16, color: Colors.red.shade700),
                        onPressed: () => setState(() => _errorMessage = null),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // Hospital List (Draggable)
          if (hasLocation && !_isLoading)
            DraggableScrollableSheet(
              initialChildSize: 0.3,
              minChildSize: 0.15,
              maxChildSize: 0.7,
              builder: (context, scrollController) {
                return Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.1),
                        blurRadius: 10,
                        spreadRadius: 0,
                        offset: const Offset(0, -5),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Drag handle
                      Container(
                        margin: const EdgeInsets.symmetric(vertical: 12),
                        width: 40,
                        height: 4,
                        decoration: BoxDecoration(
                          color: Colors.grey[300],
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                      
                      // Header
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Nearby Hospitals (${_nearbyHospitals.length})',
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            TextButton.icon(
                              onPressed: _loadNearbyHospitals,
                              icon: const Icon(Icons.refresh, size: 18),
                              label: const Text('Refresh'),
                            ),
                          ],
                        ),
                      ),
                      
                      const Divider(),
                      
                      // Hospital list
                      Expanded(
                        child: _nearbyHospitals.isEmpty
                            ? const Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(Icons.local_hospital, size: 48, color: Colors.grey),
                                    SizedBox(height: 16),
                                    Text('No hospitals found nearby'),
                                    SizedBox(height: 8),
                                    Text(
                                      'Try refreshing or check your location',
                                      style: TextStyle(fontSize: 12, color: Colors.grey),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                controller: scrollController,
                                itemCount: _nearbyHospitals.length,
                                itemBuilder: (context, index) {
                                  final hospital = _nearbyHospitals[index];
                                  final availableBeds = _getAvailableResource(hospital, 'icuBeds');
                                  final availableVents = _getAvailableResource(hospital, 'ventilators');
                                  final distance = _calculateDistance(
                                    locationService.currentPosition!.latitude,
                                    locationService.currentPosition!.longitude,
                                    hospital.latitude,
                                    hospital.longitude,
                                  );
                                  
                                  return Card(
                                    margin: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 4,
                                    ),
                                    elevation: 2,
                                    child: ListTile(
                                      leading: CircleAvatar(
                                        backgroundColor: availableBeds > 0 
                                            ? Colors.green 
                                            : Colors.red,
                                        child: const Icon(
                                          Icons.local_hospital,
                                          color: Colors.white,
                                        ),
                                      ),
                                      title: Text(
                                        hospital.name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      subtitle: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            hospital.address,
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Row(
                                            children: [
                                              Container(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 8,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: Colors.blue.withValues(alpha: 0.1),
                                                  borderRadius: BorderRadius.circular(12),
                                                ),
                                                child: Text(
                                                  '$availableBeds ICU',
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.blue,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Container(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 8,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: Colors.purple.withValues(alpha: 0.1),
                                                  borderRadius: BorderRadius.circular(12),
                                                ),
                                                child: Text(
                                                  '$availableVents Vent',
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.purple,
                                                  ),
                                                ),
                                              ),
                                              const SizedBox(width: 8),
                                              Container(
                                                padding: const EdgeInsets.symmetric(
                                                  horizontal: 8,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color: Colors.orange.withValues(alpha: 0.1),
                                                  borderRadius: BorderRadius.circular(12),
                                                ),
                                                child: Text(
                                                  '${distance.toStringAsFixed(1)} km',
                                                  style: const TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.orange,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                      trailing: const Icon(
                                        Icons.chevron_right,
                                        color: Colors.grey,
                                      ),
                                      onTap: () {
                                        _centerMapOnHospital(hospital);
                                        _showHospitalDetails(hospital);
                                      },
                                    ),
                                  );
                                },
                              ),
                      ),
                    ],
                  ),
                );
              },
            ),
        ],
      ),
    );
  }
}