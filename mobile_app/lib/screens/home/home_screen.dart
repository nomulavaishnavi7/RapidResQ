// lib/screens/home/home_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/auth_service.dart';
import '../../services/location_service.dart';
import '../../services/emergency_service.dart';
import '../emergency/emergency_request_screen.dart';
import '../emergency/emergency_tracking_screen.dart';
import '../profile/profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _isLocationLoading = false;
  bool _isLoggingOut = false;
  bool _hasShownProfileDialog = false;

  @override
  void initState() {
    super.initState();
    print('🏠 HomeScreen initState called');
    _initializeLocation();
    _checkProfileCompletion();
  }

  Future<void> _checkProfileCompletion() async {
    print('🔍 Checking profile completion...');
    // Wait a bit for auth to load
    await Future.delayed(const Duration(milliseconds: 500));
    
    final authService = Provider.of<AuthService>(context, listen: false);
    final userModel = authService.userModel;
    
    print('📊 Profile check - isLoggedIn: ${authService.isLoggedIn}, userModel: ${userModel != null}, name: ${userModel?.name}, phone: ${userModel?.phone}');
    
    // Check if user is logged in and profile is incomplete
    if (authService.isLoggedIn && userModel != null && !_hasShownProfileDialog) {
      if (userModel.name.isEmpty || userModel.phone.isEmpty) {
        print('⚠️ Profile incomplete, showing dialog');
        _hasShownProfileDialog = true;
        _showProfileRequiredDialog();
      }
    }
  }

  void _showProfileRequiredDialog() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        title: const Text('Complete Your Profile'),
        content: const Text(
          'Please complete your profile before requesting emergency assistance.\n\n'
          'Your name and phone number are required for emergency services.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const ProfileScreen(),
                ),
              ).then((_) {
                // Check again after returning from profile
                _checkProfileCompletion();
              });
            },
            child: const Text('Complete Profile'),
          ),
        ],
      ),
    );
  }

  Future<void> _initializeLocation() async {
    if (_isLocationLoading) return;
    
    setState(() => _isLocationLoading = true);
    
    try {
      final locationService = Provider.of<LocationService>(context, listen: false);
      await locationService.getCurrentLocation();
      
      if (mounted && locationService.currentPosition == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Unable to get location. Please enable GPS.'),
            backgroundColor: Colors.orange,
            duration: Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error getting location: ${e.toString()}'),
            backgroundColor: Colors.red,
            duration: Duration(seconds: 3),
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLocationLoading = false);
      }
    }
  }

  Future<void> _handleLogout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isLoggingOut = true);
      
      try {
        final authService = Provider.of<AuthService>(context, listen: false);
        await authService.logout();
        
        if (mounted) {
          Navigator.pushNamedAndRemoveUntil(context, '/login', (route) => false);
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Logout failed: ${e.toString()}'),
              backgroundColor: Colors.red,
            ),
          );
        }
      } finally {
        if (mounted) {
          setState(() => _isLoggingOut = false);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    print('🏠 HomeScreen build called');
    
    final authService = Provider.of<AuthService>(context);
    final locationService = Provider.of<LocationService>(context);
    final emergencyService = Provider.of<EmergencyService>(context);
    
    print('📊 HomeScreen state - isLoading: ${authService.isLoading}, isLoggedIn: ${authService.isLoggedIn}, userModel: ${authService.userModel?.name}');
    
    // Show loading if auth is still loading
    if (authService.isLoading) {
      print('⏳ Auth still loading, showing loading indicator');
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading...'),
            ],
          ),
        ),
      );
    }
    
    // If user is logged in but userModel is null, wait a bit
    if (authService.isLoggedIn && authService.userModel == null) {
      print('⚠️ User logged in but userModel is null, waiting...');
      return const Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(),
              SizedBox(height: 16),
              Text('Loading profile...'),
            ],
          ),
        ),
      );
    }
    
    final hasActiveEmergency = emergencyService.hasActiveEmergency;
    final currentEmergency = emergencyService.currentEmergency;
    final hasLocation = locationService.currentPosition != null;
    final userModel = authService.userModel;
    
    print('✅ HomeScreen rendering with user: ${userModel?.name ?? 'Unknown'}');
    
    final isProfileComplete = userModel != null && 
        userModel.name.isNotEmpty && 
        userModel.phone.isNotEmpty;

    return Scaffold(
      appBar: AppBar(
        title: const Text('RapidResQ'),
        backgroundColor: Colors.red,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          // Profile Button
          IconButton(
            icon: const Icon(Icons.person),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const ProfileScreen(),
                ),
              ).then((_) {
                // Refresh profile data after returning
                authService.refreshUserData();
                _checkProfileCompletion();
              });
            },
            tooltip: 'Profile',
          ),
          // Logout Button
          IconButton(
            icon: _isLoggingOut 
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Icon(Icons.logout),
            onPressed: _isLoggingOut ? null : _handleLogout,
            tooltip: 'Logout',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _initializeLocation,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Welcome Card
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Welcome, ${userModel?.name ?? 'User'}!',
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.red,
                              ),
                            ),
                          ),
                          // Profile avatar in welcome card
                          GestureDetector(
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const ProfileScreen(),
                                ),
                              ).then((_) {
                                authService.refreshUserData();
                                _checkProfileCompletion();
                              });
                            },
                            child: CircleAvatar(
                              backgroundColor: Colors.red.shade100,
                              radius: 20,
                              child: const Icon(
                                Icons.person,
                                color: Colors.red,
                                size: 20,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Emergency assistance is just a tap away',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey,
                        ),
                      ),
                      // Profile incomplete warning
                      if (!isProfileComplete && userModel != null)
                        const SizedBox(height: 12),
                      if (!isProfileComplete && userModel != null)
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning, color: Colors.orange, size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Please complete your profile to request emergency',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.orange.shade800,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                              TextButton(
                                onPressed: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => const ProfileScreen(),
                                    ),
                                  ).then((_) {
                                    authService.refreshUserData();
                                    _checkProfileCompletion();
                                  });
                                },
                                child: const Text(
                                  'Complete',
                                  style: TextStyle(fontSize: 12),
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (currentEmergency != null) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.warning, color: Colors.orange, size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Active emergency in progress',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.orange.shade800,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Location Status Card
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
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
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (_isLocationLoading || locationService.isLoading)
                        const Center(
                          child: Padding(
                            padding: EdgeInsets.all(20),
                            child: CircularProgressIndicator(),
                          ),
                        )
                      else if (hasLocation) ...[
                        if (locationService.currentAddress != null)
                          Text(
                            locationService.currentAddress!,
                            style: const TextStyle(fontSize: 14),
                          ),
                        const SizedBox(height: 4),
                        Text(
                          'Lat: ${locationService.currentPosition!.latitude.toStringAsFixed(6)}, '
                          'Lng: ${locationService.currentPosition!.longitude.toStringAsFixed(6)}',
                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                      ] else
                        const Text(
                          'Location not available',
                          style: TextStyle(color: Colors.red),
                        ),
                      const SizedBox(height: 12),
                      ElevatedButton.icon(
                        onPressed: _initializeLocation,
                        icon: const Icon(Icons.refresh, size: 18),
                        label: const Text('Update Location'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.blue,
                          foregroundColor: Colors.white,
                          minimumSize: const Size(double.infinity, 40),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Profile Incomplete Warning Card
              if (!isProfileComplete && userModel != null)
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.orange.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: Colors.orange.shade700, size: 24),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Profile Incomplete',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.orange.shade800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Please add your name and phone number to request emergency assistance',
                              style: TextStyle(
                                fontSize: 12,
                                color: Colors.orange.shade700,
                              ),
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => const ProfileScreen(),
                            ),
                          ).then((_) {
                            authService.refreshUserData();
                            _checkProfileCompletion();
                          });
                        },
                        child: const Text('Complete Now'),
                      ),
                    ],
                  ),
                ),

              const SizedBox(height: 20),

              // Emergency Button or Active Emergency Card
              if (!hasActiveEmergency)
                Container(
                  height: 220,
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: (!hasLocation || !isProfileComplete)
                        ? null
                        : () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => const EmergencyRequestScreen(),
                              ),
                            );
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                      ),
                      elevation: 4,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.warning,
                          size: 60,
                          color: Colors.white,
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'EMERGENCY',
                          style: TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          !hasLocation
                              ? 'Location not available'
                              : !isProfileComplete
                                  ? 'Complete profile first'
                                  : 'Tap for immediate assistance',
                          style: const TextStyle(
                            fontSize: 16,
                            color: Colors.white70,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                // Active Emergency Card
                Card(
                  elevation: 4,
                  color: Colors.orange.shade50,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                    side: BorderSide(color: Colors.orange.shade200),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        const Icon(
                          Icons.emergency,
                          color: Colors.orange,
                          size: 50,
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Active Emergency',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: Colors.orange,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          currentEmergency?.statusText ?? 'Processing...',
                          style: const TextStyle(fontSize: 14),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.orange.shade100,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            children: [
                              Text(
                                'Condition: ${currentEmergency?.condition ?? 'Unknown'}',
                                style: const TextStyle(fontSize: 12),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'Type: ${currentEmergency?.emergencyType.replaceAll('_', ' ') ?? 'Medical'}',
                                style: const TextStyle(fontSize: 12),
                                textAlign: TextAlign.center,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => const EmergencyTrackingScreen(),
                                ),
                              );
                            },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.orange,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                              ),
                            ),
                            child: const Text('Track Emergency'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 20),

              // Emergency Tips Card
              Card(
                elevation: 2,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(15),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        '📋 Emergency Tips',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 12),
                      _buildTip(
                        icon: Icons.call,
                        text: 'Stay calm and call emergency services (108/112)',
                        color: Colors.blue,
                      ),
                      const Divider(),
                      _buildTip(
                        icon: Icons.location_on,
                        text: 'Share your exact location with dispatcher',
                        color: Colors.green,
                      ),
                      const Divider(),
                      _buildTip(
                        icon: Icons.medical_services,
                        text: 'Provide basic first aid if trained',
                        color: Colors.red,
                      ),
                      const Divider(),
                      _buildTip(
                        icon: Icons.person,
                        text: 'Keep patient comfortable and warm',
                        color: Colors.orange,
                      ),
                      const Divider(),
                      _buildTip(
                        icon: Icons.info,
                        text: 'Do not move patient unless in immediate danger',
                        color: Colors.purple,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 20),

              // App Info
              Center(
                child: Text(
                  'RapidResQ v1.0 - Emergency Response System',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey.shade600,
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTip({
    required IconData icon, 
    required String text,
    required Color color,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, size: 20, color: color),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 14),
            ),
          ),
        ],
      ),
    );
  }
}