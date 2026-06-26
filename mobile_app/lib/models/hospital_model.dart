class HospitalModel {
  final String id;
  final String name;
  final String address;
  final double latitude;
  final double longitude;
  final String phone;
  final Map<String, dynamic> resources;
  final List<String> capabilities;

  HospitalModel({
    required this.id,
    required this.name,
    required this.address,
    required this.latitude,
    required this.longitude,
    required this.phone,
    required this.resources,
    required this.capabilities,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'latitude': latitude,
      'longitude': longitude,
      'phone': phone,
      'resources': resources,
      'capabilities': capabilities,
    };
  }

  factory HospitalModel.fromMap(Map<String, dynamic> map, String docId) {
    return HospitalModel(
      id: docId,
      name: map['name'] ?? '',
      address: map['address'] ?? '',
      latitude: map['location']?['latitude']?.toDouble() ?? 0.0,
      longitude: map['location']?['longitude']?.toDouble() ?? 0.0,
      phone: map['phone'] ?? '',
      resources: map['resources'] ?? {},
      capabilities: List<String>.from(map['capabilities'] ?? []),
    );
  }
}