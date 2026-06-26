// lib/models/emergency_model.dart
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

class EmergencyModel {
  final String id;
  final String patientId;
  final String patientName;
  final String emergencyType;
  final String condition;
  final String description;
  final double latitude;
  final double longitude;
  final String address;
  final String? assignedHospitalId;
  final String? assignedHospitalName;
  final String? assignedAmbulanceId;
  final String status;
  final Timestamp createdAt;
  final Timestamp? updatedAt;
  final Map<String, Timestamp>? timeline;
  
  final List<String>? candidateHospitals;
  final Map<String, dynamic>? hospitalRankings;
  final bool? isLocked;
  
  final double? distanceToHospital;
  final int? estimatedTravelTime;

  EmergencyModel({
    required this.id,
    required this.patientId,
    required this.patientName,
    required this.emergencyType,
    required this.condition,
    required this.description,
    required this.latitude,
    required this.longitude,
    required this.address,
    this.assignedHospitalId,
    this.assignedHospitalName,
    this.assignedAmbulanceId,
    required this.status,
    required this.createdAt,
    this.updatedAt,
    this.timeline,
    this.candidateHospitals,
    this.hospitalRankings,
    this.isLocked,
    this.distanceToHospital,
    this.estimatedTravelTime,
  });

  Map<String, dynamic> toMap() {
    return {
      'patientId': patientId,
      'patientName': patientName,
      'emergencyType': emergencyType,
      'condition': condition,
      'description': description,
      'latitude': latitude,
      'longitude': longitude,
      'address': address,
      if (assignedHospitalId != null) 'assignedHospitalId': assignedHospitalId,
      if (assignedHospitalName != null) 'assignedHospitalName': assignedHospitalName,
      if (assignedAmbulanceId != null) 'assignedAmbulanceId': assignedAmbulanceId,
      'status': status,
      'createdAt': FieldValue.serverTimestamp(),
      if (candidateHospitals != null) 'candidateHospitals': candidateHospitals,
      if (hospitalRankings != null) 'hospitalRankings': hospitalRankings,
      if (isLocked != null) 'isLocked': isLocked,
      if (distanceToHospital != null) 'distanceToHospital': distanceToHospital,
      if (estimatedTravelTime != null) 'estimatedTravelTime': estimatedTravelTime,
    };
  }

  factory EmergencyModel.fromMap(Map<String, dynamic> map, String docId) {
    // Debug prints to see what's coming from Firestore
    print('📋 === Parsing Emergency ===');
    print('📋 distanceToHospital raw: ${map['distanceToHospital']}');
    print('📋 estimatedTravelTime raw: ${map['estimatedTravelTime']}');
    print('📋 assignedHospitalName: ${map['assignedHospitalName']}');
    
    Timestamp createdAt;
    if (map['createdAt'] is Timestamp) {
      createdAt = map['createdAt'];
    } else if (map['createdAt'] is String) {
      createdAt = Timestamp.fromDate(DateTime.parse(map['createdAt']));
    } else {
      createdAt = Timestamp.now();
    }

    double? distanceToHospital;
    if (map['distanceToHospital'] != null) {
      distanceToHospital = (map['distanceToHospital'] as num).toDouble();
      print('📋 distanceToHospital parsed: $distanceToHospital');
    } else {
      print('📋 distanceToHospital is NULL');
    }
    
    int? estimatedTravelTime;
    if (map['estimatedTravelTime'] != null) {
      estimatedTravelTime = (map['estimatedTravelTime'] as num).toInt();
      print('📋 estimatedTravelTime parsed: $estimatedTravelTime');
    } else {
      print('📋 estimatedTravelTime is NULL');
    }

    return EmergencyModel(
      id: docId,
      patientId: map['patientId'] ?? '',
      patientName: map['patientName'] ?? '',
      emergencyType: map['emergencyType'] ?? 'OTHER',
      condition: map['condition'] ?? 'Medical Emergency',
      description: map['description'] ?? '',
      latitude: (map['latitude'] ?? 0.0).toDouble(),
      longitude: (map['longitude'] ?? 0.0).toDouble(),
      address: map['address'] ?? '',
      assignedHospitalId: map['assignedHospitalId'],
      assignedHospitalName: map['assignedHospitalName'],
      assignedAmbulanceId: map['assignedAmbulanceId'],
      status: map['status'] ?? 'pending',
      createdAt: createdAt,
      updatedAt: map['updatedAt'] is Timestamp ? map['updatedAt'] : null,
      timeline: map['timeline'] != null 
          ? Map<String, Timestamp>.from(map['timeline']) 
          : null,
      candidateHospitals: map['candidateHospitals'] != null 
          ? List<String>.from(map['candidateHospitals']) 
          : null,
      hospitalRankings: map['hospitalRankings'],
      isLocked: map['isLocked'] ?? false,
      distanceToHospital: distanceToHospital,
      estimatedTravelTime: estimatedTravelTime,
    );
  }

  EmergencyModel copyWith({
    String? id,
    String? patientId,
    String? patientName,
    String? emergencyType,
    String? condition,
    String? description,
    double? latitude,
    double? longitude,
    String? address,
    String? assignedHospitalId,
    String? assignedHospitalName,
    String? assignedAmbulanceId,
    String? status,
    Timestamp? createdAt,
    Timestamp? updatedAt,
    Map<String, Timestamp>? timeline,
    List<String>? candidateHospitals,
    Map<String, dynamic>? hospitalRankings,
    bool? isLocked,
    double? distanceToHospital,
    int? estimatedTravelTime,
  }) {
    return EmergencyModel(
      id: id ?? this.id,
      patientId: patientId ?? this.patientId,
      patientName: patientName ?? this.patientName,
      emergencyType: emergencyType ?? this.emergencyType,
      condition: condition ?? this.condition,
      description: description ?? this.description,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      address: address ?? this.address,
      assignedHospitalId: assignedHospitalId ?? this.assignedHospitalId,
      assignedHospitalName: assignedHospitalName ?? this.assignedHospitalName,
      assignedAmbulanceId: assignedAmbulanceId ?? this.assignedAmbulanceId,
      status: status ?? this.status,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      timeline: timeline ?? this.timeline,
      candidateHospitals: candidateHospitals ?? this.candidateHospitals,
      hospitalRankings: hospitalRankings ?? this.hospitalRankings,
      isLocked: isLocked ?? this.isLocked,
      distanceToHospital: distanceToHospital ?? this.distanceToHospital,
      estimatedTravelTime: estimatedTravelTime ?? this.estimatedTravelTime,
    );
  }

  DateTime get createdAtDateTime => createdAt.toDate();
  DateTime? get updatedAtDateTime => updatedAt?.toDate();

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';
  bool get isLockedStatus => isLocked ?? false;
  bool get isActive => status == 'pending' || status == 'accepted';
  
  String get formattedDistance {
    print('📏 formattedDistance called, value: $distanceToHospital');
    if (distanceToHospital == null) return 'Calculating...';
    if (distanceToHospital! < 1) {
      return '${(distanceToHospital! * 1000).round()} meters';
    }
    return '${distanceToHospital!.toStringAsFixed(1)} km';
  }

  String get formattedTravelTime {
    print('⏱️ formattedTravelTime called, value: $estimatedTravelTime');
    if (estimatedTravelTime == null) return 'Calculating...';
    if (estimatedTravelTime! < 60) {
      return '$estimatedTravelTime minutes';
    }
    final hours = estimatedTravelTime! ~/ 60;
    final minutes = estimatedTravelTime! % 60;
    if (minutes == 0) {
      return '$hours hour${hours > 1 ? 's' : ''}';
    }
    return '$hours hour${hours > 1 ? 's' : ''} $minutes min';
  }
  
  String get statusText {
    switch (status) {
      case 'pending':
        return 'Finding nearest hospital...';
      case 'accepted':
        return 'Hospital accepted your request';
      case 'rejected':
        return 'Request declined by hospital';
      case 'ambulance_assigned':
        return 'Ambulance assigned';
      case 'ambulance_enroute':
        return 'Ambulance on the way';
      case 'ambulance_arrived':
        return 'Ambulance arrived';
      case 'patient_picked':
        return 'Patient picked up';
      case 'delivered':
        return 'Delivered to hospital';
      case 'completed':
        return 'Emergency completed';
      case 'cancelled':
        return 'Emergency cancelled';
      default:
        return status;
    }
  }

  Color get statusColor {
    switch (status) {
      case 'pending':
        return Colors.orange;
      case 'accepted':
        return Colors.blue;
      case 'ambulance_assigned':
        return Colors.blue;
      case 'ambulance_enroute':
        return Colors.green;
      case 'ambulance_arrived':
        return Colors.teal;
      case 'patient_picked':
        return Colors.purple;
      case 'delivered':
        return Colors.indigo;
      case 'completed':
        return Colors.grey;
      case 'cancelled':
        return Colors.red;
      case 'rejected':
        return Colors.red;
      default:
        return Colors.grey;
    }
  }
}