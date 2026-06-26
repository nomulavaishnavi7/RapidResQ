class UserModel {
  final String uid;
  final String email;
  final String name;
  final String phone;
  final String? bloodType;
  final List<String>? medicalConditions;
  final List<String>? allergies;
  final DateTime createdAt;

  UserModel({
    required this.uid,
    required this.email,
    required this.name,
    required this.phone,
    this.bloodType,
    this.medicalConditions,
    this.allergies,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'uid': uid,
      'email': email,
      'name': name,
      'phone': phone,
      'bloodType': bloodType,
      'medicalConditions': medicalConditions ?? [],
      'allergies': allergies ?? [],
      'createdAt': createdAt.toIso8601String(),
    };
  }

  factory UserModel.fromMap(Map<String, dynamic> map) {
    return UserModel(
      uid: map['uid'] ?? '',
      email: map['email'] ?? '',
      name: map['name'] ?? '',
      phone: map['phone'] ?? '',
      bloodType: map['bloodType'],
      medicalConditions: List<String>.from(map['medicalConditions'] ?? []),
      allergies: List<String>.from(map['allergies'] ?? []),
      createdAt: DateTime.parse(map['createdAt']),
    );
  }
}