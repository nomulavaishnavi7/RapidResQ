// lib/main.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'services/auth_service.dart';
import 'services/location_service.dart';
import 'services/emergency_service.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/map/map_view_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    print('✅ Firebase initialized successfully');
  } catch (e) {
    print('❌ Error initializing Firebase: $e');
    runApp(const FirebaseErrorApp());
    return;
  }
  
  runApp(const MyApp());
}

class FirebaseErrorApp extends StatelessWidget {
  const FirebaseErrorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 80, color: Colors.red),
                const SizedBox(height: 16),
                const Text(
                  'Firebase Initialization Error',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.red),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Please check your Firebase configuration and internet connection.',
                  style: TextStyle(fontSize: 16),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () async {
                    try {
                      await Firebase.initializeApp(
                        options: DefaultFirebaseOptions.currentPlatform,
                      );
                      runApp(const MyApp());
                    } catch (e) {
                      print('Retry failed: $e');
                    }
                  },
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthService()),
        ChangeNotifierProxyProvider<AuthService, LocationService>(
          create: (_) => LocationService(),
          update: (_, authService, locationService) => locationService ?? LocationService(),
        ),
        ChangeNotifierProxyProvider2<AuthService, LocationService, EmergencyService>(
          create: (_) => EmergencyService(
            authService: AuthService(),
            locationService: LocationService(),
          ),
          update: (_, authService, locationService, emergencyService) =>
              emergencyService ?? EmergencyService(
                authService: authService,
                locationService: locationService,
              ),
        ),
      ],
      child: MaterialApp(
        title: 'RapidResQ',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          primarySwatch: Colors.red,
          appBarTheme: const AppBarTheme(
            backgroundColor: Colors.red,
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          cardTheme: CardThemeData(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        initialRoute: '/',
        onGenerateRoute: _generateRoute,
      ),
    );
  }

  static Route<dynamic>? _generateRoute(RouteSettings settings) {
    switch (settings.name) {
      case '/':
        return MaterialPageRoute(builder: (_) => const AuthWrapper(), settings: settings);
      case '/login':
        return MaterialPageRoute(builder: (_) => const LoginScreen(), settings: settings);
      case '/home':
        return MaterialPageRoute(builder: (_) => const HomeScreen(), settings: settings);
      case '/profile':
        return MaterialPageRoute(builder: (_) => const ProfileScreen(), settings: settings);
      case '/map':
        return MaterialPageRoute(builder: (_) => const MapViewScreen(), settings: settings);
      default:
        return MaterialPageRoute(builder: (_) => const NotFoundScreen(), settings: settings);
    }
  }
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _initialized = false;

  @override
  void initState() {
    super.initState();
    // Wait for auth to be ready
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initialize();
    });
  }

  Future<void> _initialize() async {
    print('🔵 AuthWrapper initializing...');
    
    final authService = Provider.of<AuthService>(context, listen: false);
    
    // Wait for auth to finish loading
    if (authService.isLoading) {
      print('⏳ AuthService is loading, waiting...');
      await Future.delayed(const Duration(milliseconds: 500));
    }
    
    // If user is logged in but userModel is null, wait a bit more
    if (authService.isLoggedIn && authService.userModel == null) {
      print('⏳ User logged in but userModel null, waiting for data...');
      await Future.delayed(const Duration(milliseconds: 1000));
    }
    
    print('🔵 Initialization complete - isLoggedIn: ${authService.isLoggedIn}, isLoading: ${authService.isLoading}');
    
    if (mounted) {
      setState(() {
        _initialized = true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authService = Provider.of<AuthService>(context);
    
    print('🏠 AuthWrapper build - isLoading: ${authService.isLoading}, isLoggedIn: ${authService.isLoggedIn}, userModel: ${authService.userModel != null}, _initialized: $_initialized');
    
    // Show loading while initializing or while auth is loading
    if (authService.isLoading || !_initialized) {
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
    
    if (authService.isLoggedIn && authService.userModel != null) {
      print('✅ User logged in, showing HomeScreen');
      return const HomeScreen();
    }
    
    if (authService.isLoggedIn && authService.userModel == null) {
      print('⚠️ User logged in but userModel is null, still showing loading...');
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
    
    print('❌ User not logged in, showing LoginScreen');
    return const LoginScreen();
  }
}

class NotFoundScreen extends StatelessWidget {
  const NotFoundScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Page Not Found'),
        backgroundColor: Colors.red,
        foregroundColor: Colors.white,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline, size: 80, color: Colors.red),
            const SizedBox(height: 16),
            const Text(
              '404 - Page Not Found',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'The page you are looking for does not exist.',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pushReplacementNamed(context, '/'),
              child: const Text('Go to Home'),
            ),
          ],
        ),
      ),
    );
  }
}