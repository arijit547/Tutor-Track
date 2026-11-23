import 'dart:async';
import 'dart:math' as math;
import 'package:geolocator/geolocator.dart';
import '../models/models.dart';

/// Foreground-only GPS tracking, matching the web client's 150m / 20min rule.
/// It never creates a session without tutor confirmation.
class LocationTracker {
  StreamSubscription<Position>? _subscription;
  final Map<String,DateTime> _entered=<String,DateTime>{};
  final Set<String> _fired=<String>{};
  bool get active=>_subscription!=null;

  static Future<Position> currentPosition()async{
    if(!await Geolocator.isLocationServiceEnabled()){
      throw StateError('Turn on device location services and retry.');
    }
    var permission=await Geolocator.checkPermission();
    if(permission==LocationPermission.denied)permission=await Geolocator.requestPermission();
    if(permission==LocationPermission.denied||permission==LocationPermission.deniedForever){
      throw StateError('Location access was denied. Allow it in system settings.');
    }
    return Geolocator.getCurrentPosition(locationSettings:const LocationSettings(accuracy:LocationAccuracy.high));
  }

  static double distanceMeters(double aLat,double aLon,double bLat,double bLon){
    const r=6371000.0;
    final dp=(bLat-aLat)*math.pi/180, dl=(bLon-aLon)*math.pi/180;
    final a=math.pow(math.sin(dp/2),2)+math.cos(aLat*math.pi/180)*math.cos(bLat*math.pi/180)*math.pow(math.sin(dl/2),2);
    return 2*r*math.asin(math.sqrt(a.clamp(0.0,1.0)));
  }

  Future<void> start({required List<Student> Function() students,
    required void Function(Student student,int duration) onCandidate,
    void Function(Object error)? onError})async{
    if(active)return;
    await currentPosition(); // Deliberate, user-initiated permission prompt.
    _subscription=Geolocator.getPositionStream(locationSettings:const LocationSettings(
      accuracy:LocationAccuracy.medium,distanceFilter:25)).listen((position){
      final now=DateTime.now();
      final applicable=students().where((s)=>s.active&&s.location?['latitude'] is num&&s.location?['longitude'] is num).toList();
      final currentIds=applicable.map((s)=>s.id).toSet();
      _entered.removeWhere((key,value)=>!currentIds.contains(key));
      for(final student in applicable){
        final loc=student.location!;
        final distance=distanceMeters(position.latitude,position.longitude,
          (loc['latitude'] as num).toDouble(),(loc['longitude'] as num).toDouble());
        final key='${student.id}-${localDate(now)}';
        if(distance<=150){
          _entered.putIfAbsent(student.id,()=>now);
          final minutes=now.difference(_entered[student.id]!).inMinutes;
          if(minutes>=20 && _fired.add(key))onCandidate(student,minutes);
        }else{_entered.remove(student.id);}
      }
    },onError:(Object e){
      _entered.clear();onError?.call(e);
    });
  }
  Future<void> stop()async{
    await _subscription?.cancel();_subscription=null;_entered.clear();
  }
}
