// lib/screens/emergency/emergency_tracking_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/emergency_service.dart';
import '../../models/emergency_model.dart';

class EmergencyTrackingScreen extends StatefulWidget {
  const EmergencyTrackingScreen({super.key});

  @override
  State<EmergencyTrackingScreen> createState() => _EmergencyTrackingScreenState();
}

class _EmergencyTrackingScreenState extends State<EmergencyTrackingScreen> {

  @override
  void initState() {
    super.initState();
    // Add debug print
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final emergency = context.read<EmergencyService>().currentEmergency;
      if (emergency != null) {
        print('🔍 Tracking screen loaded with emergency:');
        print('   assignedHospitalName: ${emergency.assignedHospitalName}');
        print('   distanceToHospital: ${emergency.distanceToHospital}');
        print('   estimatedTravelTime: ${emergency.estimatedTravelTime}');
        print('   formattedDistance: ${emergency.formattedDistance}');
        print('   formattedTravelTime: ${emergency.formattedTravelTime}');
      }
    });
  }

  Future<void> _cancelEmergency() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel Emergency?'),
        content: const Text('Are you sure you want to cancel this emergency request?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('No'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Yes, Cancel'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final emergencyService = context.read<EmergencyService>();
      final success = await emergencyService.cancelEmergency();
      
      if (success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Emergency cancelled')),
        );
        Navigator.popUntil(context, (route) => route.isFirst);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(emergencyService.lastError ?? 'Failed to cancel')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final emergencyService = context.watch<EmergencyService>();
    final emergency = emergencyService.currentEmergency;

    if (emergency == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Emergency Tracking')),
        body: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.grey),
              SizedBox(height: 16),
              Text('No active emergency found'),
            ],
          ),
        ),
      );
    }

    // Debug print on each build
    print('🔄 Building tracking screen - distance: ${emergency.distanceToHospital}, travelTime: ${emergency.estimatedTravelTime}');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Emergency Tracking'),
        backgroundColor: emergency.statusColor,
        foregroundColor: Colors.white,
        actions: [
          if (emergency.isPending)
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: _cancelEmergency,
              tooltip: 'Cancel Emergency',
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await emergencyService.refreshEmergency();
        },
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Status Card
              Card(
                elevation: 4,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    children: [
                      Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          color: emergency.statusColor.withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _getStatusIcon(emergency.status),
                          size: 40,
                          color: emergency.statusColor,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        emergency.statusText,
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: emergency.statusColor,
                        ),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Request ID: ${emergency.id.substring(0, 8)}...',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Patient Condition Card
              Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.medical_services, size: 20, color: Colors.red),
                          SizedBox(width: 8),
                          Text(
                            'Patient Condition',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        emergency.condition,
                        style: const TextStyle(fontSize: 14),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        emergency.description,
                        style: TextStyle(fontSize: 14, color: Colors.grey.shade700),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Hospital Info Card
              if (emergency.assignedHospitalId != null) ...[
                Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.local_hospital, size: 20, color: Colors.blue),
                            SizedBox(width: 8),
                            Text(
                              'Assigned Hospital',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          emergency.assignedHospitalName ?? 'Hospital Assigned',
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          emergency.address,
                          style: const TextStyle(fontSize: 14, color: Colors.grey),
                        ),
                        const SizedBox(height: 16),
                        const Divider(height: 8),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Distance',
                                    style: TextStyle(fontSize: 12, color: Colors.grey),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.straighten, size: 18, color: Colors.blue),
                                      const SizedBox(width: 6),
                                      Text(
                                        emergency.formattedDistance,
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Estimated Travel Time',
                                    style: TextStyle(fontSize: 12, color: Colors.grey),
                                  ),
                                  const SizedBox(height: 4),
                                  Row(
                                    children: [
                                      const Icon(Icons.access_time, size: 18, color: Colors.orange),
                                      const SizedBox(width: 6),
                                      Text(
                                        emergency.formattedTravelTime,
                                        style: const TextStyle(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ] else if (emergency.isPending) ...[
                Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        const CircularProgressIndicator(),
                        const SizedBox(height: 12),
                        Text(
                          emergency.statusText,
                          style: const TextStyle(fontSize: 14, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Ambulance Info Card
              if (emergency.assignedAmbulanceId != null) ...[
                Card(
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.local_taxi, size: 20, color: Colors.green),
                            SizedBox(width: 8),
                            Text(
                              'Ambulance Status',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            const Icon(Icons.check_circle, size: 16, color: Colors.green),
                            const SizedBox(width: 8),
                            const Text('Ambulance has been dispatched'),
                          ],
                        ),
                        const SizedBox(height: 8),
                        const LinearProgressIndicator(),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // Location Info
              Card(
                elevation: 2,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.location_on, size: 20, color: Colors.red),
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
                      Text(
                        emergency.address,
                        style: const TextStyle(fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Lat: ${emergency.latitude.toStringAsFixed(6)}, '
                        'Lng: ${emergency.longitude.toStringAsFixed(6)}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Requested: ${_formatTime(emergency.createdAtDateTime)}',
                        style: const TextStyle(fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Cancel Button
              if (emergency.isPending)
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton(
                    onPressed: _cancelEmergency,
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Colors.red),
                      foregroundColor: Colors.red,
                    ),
                    child: const Text('CANCEL EMERGENCY'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'pending':
        return Icons.hourglass_empty;
      case 'accepted':
        return Icons.check_circle;
      case 'ambulance_assigned':
      case 'ambulance_enroute':
        return Icons.local_taxi;
      case 'ambulance_arrived':
      case 'patient_picked':
        return Icons.people;
      case 'delivered':
        return Icons.local_hospital;
      case 'completed':
        return Icons.check_circle;
      case 'cancelled':
      case 'rejected':
        return Icons.cancel;
      default:
        return Icons.warning;
    }
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final difference = now.difference(time);
    
    if (difference.inMinutes < 1) return 'Just now';
    if (difference.inMinutes < 60) return '${difference.inMinutes} minutes ago';
    if (difference.inHours < 24) return '${difference.inHours} hours ago';
    return '${difference.inDays} days ago';
  }
}