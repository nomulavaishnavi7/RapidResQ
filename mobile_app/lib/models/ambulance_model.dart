// lib/models/ambulance_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class AmbulanceModel {
  final String id;
  final String vehicleNumber;
  final String type;
  final String status;
  final double? latitude;
  final double? longitude;
  final String? driverName;
  final String? driverPhone;
  final String? assignedHospitalId;
  final String? assignedEmergencyId;
  final Timestamp? lastUpdated;
  final Timestamp? createdAt;

  AmbulanceModel({
    required this.id,
    required this.vehicleNumber,
    required this.type,
    required this.status,
    this.latitude,
    this.longitude,
    this.driverName,
    this.driverPhone,
    this.assignedHospitalId,
    this.assignedEmergencyId,
    this.lastUpdated,
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'vehicleNumber': vehicleNumber,
      'type': type,
      'status': status,
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (driverName != null) 'driverName': driverName,
      if (driverPhone != null) 'driverPhone': driverPhone,
      if (assignedHospitalId != null) 'assignedHospitalId': assignedHospitalId,
      if (assignedEmergencyId != null) 'assignedEmergencyId': assignedEmergencyId,
      if (lastUpdated != null) 'lastUpdated': lastUpdated,
      if (createdAt != null) 'createdAt': createdAt,
    };
  }

  factory AmbulanceModel.fromMap(Map<String, dynamic> map, String docId) {
    // Handle location - could be flat or nested in currentLocation
    double? latitude;
    double? longitude;
    
    // Check for flat latitude/longitude
    if (map['latitude'] != null) {
      latitude = (map['latitude'] as num).toDouble();
    }
    if (map['longitude'] != null) {
      longitude = (map['longitude'] as num).toDouble();
    }
    
    // Check for nested currentLocation (backward compatibility)
    if (map['currentLocation'] != null) {
      final location = map['currentLocation'];
      if (location['latitude'] != null) {
        latitude = (location['latitude'] as num).toDouble();
      }
      if (location['longitude'] != null) {
        longitude = (location['longitude'] as num).toDouble();
      }
    }
    
    // Parse timestamps - handle both Timestamp and String
    Timestamp? parseTimestamp(dynamic timestamp) {
      if (timestamp == null) return null;
      if (timestamp is Timestamp) return timestamp;
      if (timestamp is String) {
        try {
          return Timestamp.fromDate(DateTime.parse(timestamp));
        } catch (e) {
          return null;
        }
      }
      return null;
    }
    
    return AmbulanceModel(
      id: docId,
      vehicleNumber: map['vehicleNumber'] ?? '',
      type: map['type'] ?? 'basic',
      status: map['status'] ?? 'available',
      latitude: latitude,
      longitude: longitude,
      driverName: map['driverName'],
      driverPhone: map['driverPhone'],
      assignedHospitalId: map['assignedHospitalId'],
      assignedEmergencyId: map['assignedEmergencyId'],
      lastUpdated: parseTimestamp(map['lastUpdated']),
      createdAt: parseTimestamp(map['createdAt']),
    );
  }

  AmbulanceModel copyWith({
    String? id,
    String? vehicleNumber,
    String? type,
    String? status,
    double? latitude,
    double? longitude,
    String? driverName,
    String? driverPhone,
    String? assignedHospitalId,
    String? assignedEmergencyId,
    Timestamp? lastUpdated,
    Timestamp? createdAt,
  }) {
    return AmbulanceModel(
      id: id ?? this.id,
      vehicleNumber: vehicleNumber ?? this.vehicleNumber,
      type: type ?? this.type,
      status: status ?? this.status,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      driverName: driverName ?? this.driverName,
      driverPhone: driverPhone ?? this.driverPhone,
      assignedHospitalId: assignedHospitalId ?? this.assignedHospitalId,
      assignedEmergencyId: assignedEmergencyId ?? this.assignedEmergencyId,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  // Helper getters
  bool get isAvailable => status == 'available';
  bool get isOnDuty => status == 'on_duty';
  bool get isEnRoute => status == 'en_route';
  bool get isAtScene => status == 'at_scene';
  bool get isTransporting => status == 'transporting';
  bool get isOutOfService => status == 'out_of_service';
  
  bool get hasLocation => latitude != null && longitude != null;
  
  String get locationString {
    if (hasLocation) {
      return '${latitude!.toStringAsFixed(6)}, ${longitude!.toStringAsFixed(6)}';
    }
    return 'Location unknown';
  }
  
  String get statusText {
    switch (status) {
      case 'available':
        return 'Available';
      case 'on_duty':
        return 'On Duty';
      case 'en_route':
        return 'En Route';
      case 'at_scene':
        return 'At Scene';
      case 'transporting':
        return 'Transporting';
      case 'out_of_service':
        return 'Out of Service';
      default:
        return status;
    }
  }
  
  Color get statusColor {
    switch (status) {
      case 'available':
        return Colors.green;
      case 'on_duty':
        return Colors.blue;
      case 'en_route':
        return Colors.orange;
      case 'at_scene':
        return Colors.red;
      case 'transporting':
        return Colors.purple;
      case 'out_of_service':
        return Colors.grey;
      default:
        return Colors.grey;
    }
  }
  
  String get typeText {
    switch (type) {
      case 'basic':
        return 'Basic Life Support';
      case 'advanced':
        return 'Advanced Life Support';
      case 'mobile_icu':
        return 'Mobile ICU';
      case 'air_ambulance':
        return 'Air Ambulance';
      default:
        return type;
    }
  }
  
  DateTime? get lastUpdatedDateTime => lastUpdated?.toDate();
  DateTime? get createdAtDateTime => createdAt?.toDate();
  
  bool needsLocationUpdate() {
    if (lastUpdated == null) return true;
    final now = Timestamp.now();
    final diff = now.seconds - lastUpdated!.seconds;
    return diff > 60; // Update if older than 60 seconds
  }
}