// lib/screens/profile/profile_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/auth_service.dart';
import '../../services/location_service.dart';
import '../../models/user_model.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameController;
  late TextEditingController _phoneController;
  late TextEditingController _emailController;
  
  bool _isEditing = true; // Start in edit mode for new users
  bool _isLoading = false;
  String? _errorMessage;
  String? _successMessage;
  UserModel? _userModel;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      
      if (authService.userModel != null) {
        _userModel = authService.userModel;
        _initializeControllers();
        
        // If user already has name and phone, switch to view mode
        if (_userModel!.name.isNotEmpty && _userModel!.phone.isNotEmpty) {
          setState(() {
            _isEditing = false;
          });
        }
      } else if (authService.currentUser != null) {
        // Create temporary user with Firebase Auth data
        _userModel = UserModel(
          uid: authService.currentUser!.uid,
          name: authService.currentUser!.displayName ?? '',
          email: authService.currentUser!.email ?? '',
          phone: '',
          createdAt: DateTime.now(),
        );
        _initializeControllers();
      } else {
        _errorMessage = 'Please log in to view your profile';
      }
    } catch (e) {
      print('❌ Error loading user data: $e');
      _errorMessage = 'Failed to load profile: ${e.toString()}';
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  void _initializeControllers() {
    _nameController = TextEditingController(text: _userModel?.name ?? '');
    _phoneController = TextEditingController(text: _userModel?.phone ?? '');
    _emailController = TextEditingController(text: _userModel?.email ?? '');
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _saveProfile() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _successMessage = null;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);
      final currentUser = authService.userModel ?? _userModel;
      
      if (currentUser == null) {
        throw Exception('User not found');
      }

      final updatedUser = UserModel(
        uid: currentUser.uid,
        name: _nameController.text.trim(),
        email: _emailController.text.trim(),
        phone: _phoneController.text.trim(),
        createdAt: currentUser.createdAt,
      );

      final error = await authService.updateUserProfile(updatedUser);
      
      if (error == null) {
        setState(() {
          _successMessage = 'Profile saved successfully!';
          _isEditing = false;
          _userModel = updatedUser;
        });
        
        // Show success message
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profile updated successfully!'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
        
        // Return to home after saving
        Future.delayed(const Duration(seconds: 1), () {
          if (mounted) {
            Navigator.pop(context);
          }
        });
      } else {
        setState(() {
          _errorMessage = error;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to save profile: ${e.toString()}';
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _userModel == null) {
      return Scaffold(
        appBar: AppBar(
          title: const Text('Complete Profile'),
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
        ),
        body: const Center(
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Complete Profile'),
        backgroundColor: Colors.red,
        foregroundColor: Colors.white,
        actions: [
          if (!_isEditing)
            IconButton(
              icon: const Icon(Icons.edit),
              onPressed: () => setState(() => _isEditing = true),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header
              const Icon(
                Icons.person,
                size: 80,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              const Text(
                'Complete Your Profile',
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: Colors.red,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              const Text(
                'Please provide your details to continue',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 32),

              // Error Message
              if (_errorMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.red.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, size: 20, color: Colors.red.shade700),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _errorMessage!,
                          style: TextStyle(color: Colors.red.shade800, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Success Message
              if (_successMessage != null)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.green.shade200),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle, size: 20, color: Colors.green.shade700),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _successMessage!,
                          style: TextStyle(color: Colors.green.shade800, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),

              // Name Field
              TextFormField(
                controller: _nameController,
                enabled: _isEditing,
                decoration: InputDecoration(
                  labelText: 'Full Name *',
                  hintText: 'Enter your full name',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.person_outline),
                  filled: true,
                  fillColor: _isEditing ? Colors.white : Colors.grey.shade50,
                ),
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your name';
                  }
                  if (value.length < 3) {
                    return 'Name must be at least 3 characters';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Phone Field
              TextFormField(
                controller: _phoneController,
                enabled: _isEditing,
                decoration: InputDecoration(
                  labelText: 'Phone Number *',
                  hintText: 'Enter your phone number',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.phone_outlined),
                  filled: true,
                  fillColor: _isEditing ? Colors.white : Colors.grey.shade50,
                ),
                keyboardType: TextInputType.phone,
                validator: (value) {
                  if (value == null || value.isEmpty) {
                    return 'Please enter your phone number';
                  }
                  final digitsOnly = value.replaceAll(RegExp(r'\D'), '');
                  if (digitsOnly.length < 10) {
                    return 'Please enter a valid phone number (10+ digits)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Email Field (read-only)
              TextFormField(
                controller: _emailController,
                enabled: false,
                decoration: InputDecoration(
                  labelText: 'Email Address',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  prefixIcon: const Icon(Icons.email_outlined),
                  filled: true,
                  fillColor: Colors.grey.shade50,
                ),
              ),
              const SizedBox(height: 24),

              // Save Button
              if (_isEditing)
                SizedBox(
                  height: 50,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _saveProfile,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.red,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text(
                            'Save Profile',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),

              if (!_isEditing)
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Go Back'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}