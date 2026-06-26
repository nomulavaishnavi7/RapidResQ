import 'package:geolocator/geolocator.dart';
class AppConstants {
  // Collection names
  static const String usersCollection = 'users';
  static const String emergenciesCollection = 'emergency_requests';
  static const String hospitalsCollection = 'hospitals';
  static const String ambulancesCollection = 'ambulances';
  static const String resourcesCollection = 'hospital_resources';

  // Emergency statuses
  static const String statusPending = 'pending';
  static const String statusAmbulanceAssigned = 'ambulance_assigned';
  static const String statusAmbulanceEnroute = 'ambulance_enroute';
  static const String statusAmbulanceArrived = 'ambulance_arrived';
  static const String statusPatientPicked = 'patient_picked';
  static const String statusDelivered = 'delivered';
  static const String statusCompleted = 'completed';
  static const String statusCancelled = 'cancelled';

  // Emergency types
  static const String typeCardiac = 'CARDIAC_EMERGENCY';
  static const String typeTrauma = 'TRAUMA';
  static const String typeStroke = 'STROKE';
  static const String typeRespiratory = 'RESPIRATORY';
  static const String typePediatric = 'PEDIATRIC';
  static const String typeOther = 'OTHER';

  // Map defaults
  static const double defaultMapZoom = 14.0;
  static const double defaultCameraTilt = 0.0;
  static const double defaultCameraBearing = 0.0;

  // Location settings
  static const double locationDistanceFilter = 10; // meters
  static const LocationAccuracy locationAccuracy = LocationAccuracy.high;

  // Timeouts
  static const int emergencyTimeoutSeconds = 30;
  static const int locationTimeoutSeconds = 10;
}

class ErrorMessages {
  static const String locationPermissionDenied = 'Location permission is required for emergency services';
  static const String locationServicesDisabled = 'Please enable location services';
  static const String networkError = 'Network error. Please check your connection';
  static const String genericError = 'Something went wrong. Please try again';
  static const String noActiveEmergency = 'No active emergency found';
}

class AssetConstants {
  // Add asset paths if you add images
  static const String logo = 'assets/logo.png';
  static const String ambulanceIcon = 'assets/ambulance.png';
  static const String hospitalIcon = 'assets/hospital.png';
}