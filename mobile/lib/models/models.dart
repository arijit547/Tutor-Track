import 'package:cloud_firestore/cloud_firestore.dart';

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

String localDate([DateTime? date]) {
  final d = date ?? DateTime.now();
  return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}

String dateIso(DateTime d) => d.toUtc().toIso8601String();
String monthOf(String date) => date.length >= 7 ? date.substring(0, 7) : localDate().substring(0, 7);
String nextMonth(String month) {
  final parts = month.split('-').map(int.parse).toList();
  final d = DateTime(parts[0], parts[1] + 1);
  return monthOf(localDate(d));
}

DateTime parseDate(String value) => DateTime.tryParse(value)?.toLocal() ?? DateTime.now();
double asDouble(Object? value, [double fallback = 0]) => value is num ? value.toDouble() : fallback;
int asInt(Object? value, [int fallback = 0]) => value is num ? value.toInt() : fallback;
String asString(Object? value, [String fallback = '']) => value is String ? value : fallback;
List<String> asStrings(Object? value) => value is List ? value.whereType<String>().toList() : [];
Map<String, dynamic> clean(Map<String, dynamic> input) {
  final result = <String, dynamic>{};
  input.forEach((key, value) { if (value != null) result[key] = value; });
  return result;
}

class BillingPlan {
  const BillingPlan({required this.effectiveMonth, required this.monthlySalary, required this.billingMode, this.sessionsPerMonth});
  final String effectiveMonth;
  final double monthlySalary;
  final String billingMode;
  final int? sessionsPerMonth;

  factory BillingPlan.fromMap(Map<String, dynamic> m) => BillingPlan(
    effectiveMonth: asString(m['effectiveMonth']), monthlySalary: asDouble(m['monthlySalary']),
    billingMode: asString(m['billingMode'], 'session-target'), sessionsPerMonth: m['sessionsPerMonth'] is num ? asInt(m['sessionsPerMonth']) : null,
  );
  Map<String, dynamic> toMap() => clean({
    'effectiveMonth': effectiveMonth, 'monthlySalary': monthlySalary,
    'billingMode': billingMode, 'sessionsPerMonth': sessionsPerMonth,
  });
}

class LessonSession {
  const LessonSession({required this.id, required this.date, required this.durationMinutes, required this.status, this.notes});
  final String id, date, status;
  final int durationMinutes;
  final String? notes;
  factory LessonSession.fromDoc(QueryDocumentSnapshot<Map<String,dynamic>> doc) {
    final m=doc.data();
    return LessonSession(id: doc.id, date: asString(m['date']), durationMinutes: asInt(m['durationMinutes'], 60), status: asString(m['status'], 'completed'), notes: m['notes'] as String?);
  }
  Map<String, dynamic> toMap() => clean({'date':date, 'durationMinutes':durationMinutes, 'status':status, 'notes':notes});
}

class TuitionPayment {
  const TuitionPayment({required this.id, required this.date, required this.amount, this.notes});
  final String id, date;
  final double amount;
  final String? notes;
  factory TuitionPayment.fromDoc(QueryDocumentSnapshot<Map<String,dynamic>> doc) {
    final m=doc.data();
    return TuitionPayment(id:doc.id, date:asString(m['date']), amount:asDouble(m['amount']), notes:m['notes'] as String?);
  }
  Map<String,dynamic> toMap() => clean({'date':date, 'amount':amount, 'notes':notes});
}

class Student {
  const Student({required this.id, required this.name, required this.subject,
    required this.scheduleDays, required this.scheduleTime, required this.ratePerSession,
    required this.active, required this.joinedDate, this.email, this.monthlySalary,
    this.billingMode, this.sessionsPerMonth, this.billingStartDate,
    this.legacyRatePerSession, this.billingPausedFromMonth, this.billingPausedMonths=const [],
    this.billingPlans=const [], this.sessions=const [], this.payments=const [], this.location});
  final String id, name, subject, scheduleTime, joinedDate;
  final List<String> scheduleDays;
  final double ratePerSession;
  final double? legacyRatePerSession, monthlySalary;
  final String? billingMode, billingStartDate, billingPausedFromMonth, email;
  final int? sessionsPerMonth;
  final List<BillingPlan> billingPlans;
  final List<String> billingPausedMonths;
  final bool active;
  final List<LessonSession> sessions;
  final List<TuitionPayment> payments;
  final Map<String,dynamic>? location;

  factory Student.fromData(String id, Map<String,dynamic> m, {List<LessonSession> sessions=const [], List<TuitionPayment> payments=const []}) => Student(
    id:id, name:asString(m['name']), subject:asString(m['subject']),
    scheduleDays:asStrings(m['scheduleDays']), scheduleTime:asString(m['scheduleTime'], '10:00'),
    ratePerSession:asDouble(m['ratePerSession']), active:m['active'] != false,
    joinedDate:asString(m['joinedDate'],DateTime.now().toIso8601String()), email:m['email'] as String?,
    monthlySalary: m['monthlySalary'] is num ? asDouble(m['monthlySalary']) : null,
    legacyRatePerSession: m['legacyRatePerSession'] is num ? asDouble(m['legacyRatePerSession']) : null,
    billingMode:m['billingMode'] as String?, billingStartDate:m['billingStartDate'] as String?,
    sessionsPerMonth:m['sessionsPerMonth'] is num ? asInt(m['sessionsPerMonth']) : null,
    billingPausedMonths:asStrings(m['billingPausedMonths']),billingPausedFromMonth:m['billingPausedFromMonth'] as String?,
    billingPlans:(m['billingPlans'] is List ? (m['billingPlans'] as List) : const [])
      .whereType<Map>().map((e)=>BillingPlan.fromMap(Map<String,dynamic>.from(e))).toList(),
    location: m['location'] is Map ? Map<String,dynamic>.from(m['location'] as Map) : null,
    sessions:sessions,payments:payments,
  );
  Student withHistory(List<LessonSession> s, List<TuitionPayment> p) => Student(
    id:id,name:name,subject:subject,scheduleDays:scheduleDays,scheduleTime:scheduleTime,
    ratePerSession:ratePerSession,active:active,joinedDate:joinedDate,email:email,
    monthlySalary:monthlySalary,legacyRatePerSession:legacyRatePerSession,
    billingMode:billingMode,sessionsPerMonth:sessionsPerMonth,billingStartDate:billingStartDate,
    billingPausedMonths:billingPausedMonths,billingPausedFromMonth:billingPausedFromMonth,
    billingPlans:billingPlans,sessions:s,payments:p,location:location,
  );
}

class FinanceEntry {
  const FinanceEntry({required this.id,required this.type,required this.amount, required this.category,
    required this.date, required this.note, required this.updatedAt, this.deleted=false});
  final String id, type, category, date, note;
  final double amount;
  final int updatedAt;
  final bool deleted;
  factory FinanceEntry.fromData(String id, Map<String,dynamic> m) => FinanceEntry(
    id:id, type:asString(m['type']), amount:asDouble(m['amount']), category:asString(m['category']),
    date:asString(m['date']),note:asString(m['note']), updatedAt:asInt(m['updatedAt']), deleted:m['deleted']==true,
  );
  Map<String,dynamic> toMap() => {'id':id, 'type':type,'amount':amount,'category':category,
    'date':date,'note':note,'updatedAt':updatedAt,'deleted':deleted};
}
