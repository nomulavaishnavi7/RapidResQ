// lib/services/auth_service.dart
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/user_model.dart';

class AuthService extends ChangeNotifier {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  
  User? _currentUser;
  UserModel? _userModel;
  bool _isLoading = true;
  String? _authError;
  bool _isSigningUp = false;
  bool _isLoggingIn = false;

  AuthService() {
    print('🔐 AuthService initialized');
    _auth.authStateChanges().listen(_onAuthStateChanged);
  }

  User? get currentUser => _currentUser;
  UserModel? get userModel => _userModel;
  bool get isLoading => _isLoading;
  String? get authError => _authError;
  bool get isLoggedIn => _currentUser != null;

  bool get hasCompleteProfile {
    if (_userModel == null) return false;
    return _userModel!.name.isNotEmpty && 
           _userModel!.phone.isNotEmpty;
  }

  Map<String, dynamic> getProfileCompletionStatus() {
    if (_userModel == null) {
      return {
        'isComplete': false,
        'missingFields': ['name', 'phone'],
        'message': 'Profile not found'
      };
    }
    
    final missingFields = <String>[];
    if (_userModel!.name.isEmpty) missingFields.add('name');
    if (_userModel!.phone.isEmpty) missingFields.add('phone');
    
    return {
      'isComplete': missingFields.isEmpty,
      'missingFields': missingFields,
      'message': missingFields.isEmpty 
          ? 'Profile complete' 
          : 'Missing: ${missingFields.join(', ')}'
    };
  }

  void _onAuthStateChanged(User? user) async {
    print('🔐 Auth state changed. User: ${user?.uid ?? 'null'}');
    
    _isLoading = true;
    _authError = null;
    notifyListeners();
    
    _currentUser = user;
    
    if (user != null) {
      print('📥 Loading user data for: ${user.uid}');
      await _loadUserData(user.uid);
    } else {
      print('👤 No user logged in');
      _userModel = null;
    }
    
    _isLoading = false;
    notifyListeners();
    print('✅ Auth state change complete - isLoading: $_isLoading, isLoggedIn: $isLoggedIn, userModel: ${_userModel?.name ?? 'null'}');
  }

  Future<void> _loadUserData(String uid) async {
    try {
      print('🔍 Fetching user document from Firestore...');
      final doc = await _firestore.collection('users').doc(uid).get();
      if (doc.exists) {
        _userModel = UserModel.fromMap(doc.data()!);
        print('✅ User data loaded for: ${_userModel?.name}');
        print('📧 Email: ${_userModel?.email}');
        print('📞 Phone: ${_userModel?.phone}');
      } else {
        print('⚠️ User document not found for uid: $uid, creating new user record');
        await _createUserDocument(uid);
      }
    } catch (e) {
      print('❌ Error loading user data: $e');
      if (_currentUser != null && _userModel == null) {
        _userModel = UserModel(
          uid: uid,
          email: _currentUser!.email ?? '',
          name: _currentUser!.displayName ?? '',
          phone: '',
          createdAt: DateTime.now(),
        );
        print('⚠️ Created temporary user model from Auth data');
      }
    }
  }

  Future<void> _createUserDocument(String uid) async {
    try {
      final newUser = UserModel(
        uid: uid,
        email: _currentUser?.email ?? '',
        name: _currentUser?.displayName ?? '',
        phone: '',
        createdAt: DateTime.now(),
      );
      
      await _firestore.collection('users').doc(uid).set(newUser.toMap());
      _userModel = newUser;
      print('✅ Created new user document for: ${newUser.name.isEmpty ? 'User' : newUser.name}');
    } catch (e) {
      print('❌ Error creating user document: $e');
      if (_currentUser != null) {
        _userModel = UserModel(
          uid: uid,
          email: _currentUser!.email ?? '',
          name: _currentUser!.displayName ?? '',
          phone: '',
          createdAt: DateTime.now(),
        );
      }
    }
  }

  Future<String?> signUp({
    required String email,
    required String password,
    required String name,
    required String phone,
  }) async {
    if (_isSigningUp) {
      return 'Please wait, registration in progress...';
    }
    
    try {
      _isSigningUp = true;
      
      if (email.isEmpty) return 'Email is required';
      if (password.isEmpty) return 'Password is required';
      if (name.isEmpty) return 'Name is required';
      if (phone.isEmpty) return 'Phone number is required';
      
      print('🔐 Attempting signup for: $email');
      
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );

      print('✅ User created: ${credential.user!.uid}');

      try {
        await credential.user!.updateDisplayName(name.trim());
        print('✅ Display name updated in Firebase Auth');
      } catch (e) {
        print('⚠️ Could not update display name (non-critical): $e');
      }

      final user = UserModel(
        uid: credential.user!.uid,
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim(),
        createdAt: DateTime.now(),
      );

      await _firestore
          .collection('users')
          .doc(credential.user!.uid)
          .set(user.toMap());

      _userModel = user;
      _authError = null;
      notifyListeners();
      
      print('✅ Signup completed successfully');
      return null;
      
    } on FirebaseAuthException catch (e) {
      print("FIREBASE AUTH ERROR: ${e.code} - ${e.message}");
      _isSigningUp = false;
      
      switch (e.code) {
        case 'email-already-in-use':
          return 'This email is already registered. Please use a different email or login.';
        case 'invalid-email':
          return 'Invalid email address. Please enter a valid email.';
        case 'weak-password':
          return 'Password is too weak. Please use a stronger password (at least 6 characters).';
        case 'operation-not-allowed':
          return 'Email/password sign up is not enabled. Please contact support.';
        case 'network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return e.message ?? 'Registration failed. Please try again.';
      }
    } catch (e) {
      print('Unexpected error during signup: $e');
      _isSigningUp = false;
      return 'An unexpected error occurred. Please try again.';
    }
  }

  Future<String?> login({
    required String email,
    required String password,
  }) async {
    if (_isLoggingIn) {
      return 'Please wait, login in progress...';
    }
    
    try {
      _isLoggingIn = true;
      
      if (email.isEmpty) return 'Email is required';
      if (password.isEmpty) return 'Password is required';
      
      print('🔐 Attempting login for: $email');
      
      try {
        await _auth.signInWithEmailAndPassword(
          email: email.trim(),
          password: password,
        );
        print('✅ Login API call successful for: $email');
        _authError = null;
        
        // Wait a moment for auth state to update
        await Future.delayed(const Duration(milliseconds: 500));
        
        return null;
      } catch (e) {
        // Handle the pigeon error - if user is actually signed in, return success
        print('⚠️ Caught error during login: $e');
        
        // Check if the error is the pigeon type cast issue
        if (e.toString().contains('PigeonUserDetails') || 
            e.toString().contains('List<Object?>') ||
            e.toString().contains('type cast')) {
          print('⚠️ Detected pigeon type cast error, checking if user is signed in...');
          await Future.delayed(const Duration(milliseconds: 300));
          
          if (_auth.currentUser != null) {
            print('✅ User is actually signed in despite pigeon error');
            _authError = null;
            return null;
          }
        }
        
        // Re-throw if it's a FirebaseAuthException
        if (e is FirebaseAuthException) {
          rethrow;
        }
        
        return 'Login failed. Please try again.';
      }
      
    } on FirebaseAuthException catch (e) {
      print("FIREBASE AUTH ERROR: ${e.code} - ${e.message}");
      
      switch (e.code) {
        case 'user-not-found':
          return 'No account found with this email address. Please register first.';
        case 'wrong-password':
          return 'Incorrect password. Please try again.';
        case 'invalid-email':
          return 'Invalid email address. Please enter a valid email.';
        case 'user-disabled':
          return 'This account has been disabled. Please contact support.';
        case 'too-many-requests':
          return 'Too many failed login attempts. Please try again later.';
        case 'network-request-failed':
          return 'Network error. Please check your internet connection.';
        default:
          return e.message ?? 'Login failed. Please try again.';
      }
    } catch (e) {
      print('Unexpected error during login: $e');
      print('Stack trace: ${StackTrace.current}');
      
      // Final check - if user is signed in, return success
      if (_auth.currentUser != null) {
        print('✅ User is signed in despite error');
        return null;
      }
      
      return 'An unexpected error occurred. Please try again.';
    } finally {
      _isLoggingIn = false;
    }
  }

  Future<void> logout() async {
    try {
      await _auth.signOut();
      _authError = null;
      print('User logged out successfully');
    } catch (e) {
      print('Error during logout: $e');
      rethrow;
    }
  }

  Future<String?> updateUserProfile(UserModel updatedUser) async {
    try {
      if (updatedUser.name.isEmpty) {
        return 'Name cannot be empty';
      }
      if (updatedUser.phone.isEmpty) {
        return 'Phone number cannot be empty';
      }
      
      await _firestore
          .collection('users')
          .doc(updatedUser.uid)
          .update({
            ...updatedUser.toMap(),
            'updatedAt': FieldValue.serverTimestamp(),
          });
      
      if (_currentUser != null && updatedUser.name.isNotEmpty) {
        try {
          await _currentUser!.updateDisplayName(updatedUser.name);
          print('✅ Display name updated in Firebase Auth');
        } catch (authError) {
          print('⚠️ Firebase Auth display name update failed (non-critical): $authError');
        }
      }
      
      _userModel = updatedUser;
      notifyListeners();
      
      print('✅ Profile updated in Firestore for user: ${updatedUser.name}');
      return null;
      
    } catch (e) {
      print('❌ Error updating profile: $e');
      return 'Failed to update profile. Please try again.';
    }
  }

  Future<String?> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      if (_currentUser == null) {
        return 'No user logged in';
      }
      
      final credential = EmailAuthProvider.credential(
        email: _currentUser!.email!,
        password: currentPassword,
      );
      
      await _currentUser!.reauthenticateWithCredential(credential);
      await _currentUser!.updatePassword(newPassword);
      
      return null;
      
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'wrong-password':
          return 'Current password is incorrect';
        case 'weak-password':
          return 'New password is too weak. Please use a stronger password.';
        default:
          return e.message ?? 'Failed to change password';
      }
    } catch (e) {
      print('Error changing password: $e');
      return 'An unexpected error occurred';
    }
  }

  Future<String?> resetPassword({required String email}) async {
    try {
      if (email.isEmpty) return 'Email is required';
      
      await _auth.sendPasswordResetEmail(email: email.trim());
      return null;
      
    } on FirebaseAuthException catch (e) {
      switch (e.code) {
        case 'user-not-found':
          return 'No account found with this email address';
        case 'invalid-email':
          return 'Invalid email address';
        default:
          return e.message ?? 'Failed to send reset email';
      }
    } catch (e) {
      print('Error resetting password: $e');
      return 'An unexpected error occurred';
    }
  }

  Future<void> refreshUserData() async {
    if (_currentUser != null) {
      print('🔄 Refreshing user data for: ${_currentUser!.uid}');
      await _loadUserData(_currentUser!.uid);
      notifyListeners();
    }
  }

  void clearError() {
    _authError = null;
    notifyListeners();
  }

  Future<void> createOrUpdateUserProfile({
    required String name,
    required String phone,
  }) async {
    if (_currentUser == null) return;
    
    try {
      final updatedUser = UserModel(
        uid: _currentUser!.uid,
        name: name,
        email: _currentUser!.email ?? '',
        phone: phone,
        createdAt: _userModel?.createdAt ?? DateTime.now(),
      );
      
      await updateUserProfile(updatedUser);
    } catch (e) {
      print('❌ Error creating/updating profile: $e');
    }
  }
  
  // Debug method to print current state
  void debugState() {
    print('=== AUTH SERVICE DEBUG ===');
    print('currentUser: ${_currentUser?.uid}');
    print('userModel: ${_userModel?.name}');
    print('isLoading: $_isLoading');
    print('isLoggedIn: $isLoggedIn');
    print('hasCompleteProfile: $hasCompleteProfile');
    print('===========================');
  }
}