import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/models.dart';

class TutorRepository {
  TutorRepository({FirebaseFirestore? firestore,FirebaseAuth? firebaseAuth})
    : _db=firestore??FirebaseFirestore.instance, _auth=firebaseAuth??FirebaseAuth.instance;
  final FirebaseFirestore _db;
  final FirebaseAuth _auth;

  String get uid {
    final user=_auth.currentUser;
    if(user==null)throw StateError('Sign in to continue.');
    return user.uid;
  }
  DocumentReference<Map<String,dynamic>> get profileRef=>_db.doc('tutors/$uid/profile/data');
  CollectionReference<Map<String,dynamic>> get studentsRef=>_db.collection('tutors/$uid/students');
  CollectionReference<Map<String,dynamic>> get financeRef=>_db.collection('tutors/$uid/financeEntries');
  DocumentReference<Map<String,dynamic>> get budgetRef=>_db.doc('tutors/$uid/financeSettings/general');
  CollectionReference<Map<String,dynamic>> sessionsRef(String studentId)=>studentsRef.doc(studentId).collection('sessions');
  CollectionReference<Map<String,dynamic>> paymentsRef(String studentId)=>studentsRef.doc(studentId).collection('payments');

  /// React to parent documents and to independent session/payment subcollections.
  /// Firestore mobile persistence queues edits while offline and replays them on reconnect.
  Stream<List<Student>> watchStudents(){
    late StreamController<List<Student>> controller;
    StreamSubscription<QuerySnapshot<Map<String,dynamic>>>? parent;
    final childSubscriptions=<String,List<StreamSubscription<dynamic>>>{};
    final records=<String,Student>{};
    final sessions=<String,List<LessonSession>>{};
    final payments=<String,List<TuitionPayment>>{};
    var disposed=false;
    void emit(){
      if(disposed||controller.isClosed)return;
      final list=records.values.map((s)=>s.withHistory(sessions[s.id]??[], payments[s.id]??[])).toList()
        ..sort((a,b)=>a.name.toLowerCase().compareTo(b.name.toLowerCase()));
      controller.add(list);
    }
    void stopStudent(String id){
      for(final sub in childSubscriptions.remove(id)??<StreamSubscription<dynamic>>[]) { unawaited(sub.cancel()); }
      records.remove(id);sessions.remove(id);payments.remove(id);
    }
    controller=StreamController<List<Student>>(
      onListen:(){
        parent=studentsRef.snapshots().listen((snapshot){
          final ids=snapshot.docs.map((e)=>e.id).toSet();
          for(final old in records.keys.toList()) {if(!ids.contains(old))stopStudent(old);}
          for(final doc in snapshot.docs){
            records[doc.id]=Student.fromData(doc.id,doc.data());
            if(childSubscriptions.containsKey(doc.id))continue;
            final sSub=sessionsRef(doc.id).snapshots().listen((value){
              sessions[doc.id]=value.docs.map(LessonSession.fromDoc).toList();emit();
            },onError:controller.addError);
            final pSub=paymentsRef(doc.id).snapshots().listen((value){
              payments[doc.id]=value.docs.map(TuitionPayment.fromDoc).toList();emit();
            },onError:controller.addError);
            childSubscriptions[doc.id]=[sSub,pSub];
          }
          emit();
        },onError:controller.addError);
      },
      onCancel:()async{
        disposed=true;
        await parent?.cancel();
        for(final group in childSubscriptions.values){for(final sub in group){await sub.cancel();}}
      },
    );
    return controller.stream;
  }

  /// Server-controlled timestamps match the original React app schema.
  Future<void> saveStudent(Map<String,dynamic> data,{String? id})async{
    final ref=id==null?studentsRef.doc():studentsRef.doc(id);
    if(id==null){ await ref.set({...clean(data),'joinedDate':DateTime.now().toUtc().toIso8601String(),
      'createdAt':FieldValue.serverTimestamp(),'updatedAt':FieldValue.serverTimestamp()}); }
    else{ await ref.update({...clean(data),'updatedAt':FieldValue.serverTimestamp()}); }
  }
  Future<void> deleteStudent(String id)async {
    // Firestore does not cascade delete documents. Remove descendants first.
    for(final collection in [sessionsRef(id),paymentsRef(id)]) {
      while(true){
        final page=await collection.limit(300).get();
        if(page.docs.isEmpty) break;
        final batch=_db.batch();
        for(final doc in page.docs){batch.delete(doc.reference);}
        await batch.commit();
        if(page.docs.length<300)break;
      }
    }
    await studentsRef.doc(id).delete();
  }
  Future<void> addSession(String id,LessonSession session)async{
    await sessionsRef(id).doc(session.id).set({...session.toMap(),'createdAt':FieldValue.serverTimestamp()});
  }
  Future<void> deleteSession(String id,String sessionId)=>sessionsRef(id).doc(sessionId).delete();
  Future<void> addPayment(String id,TuitionPayment payment)async{
    await paymentsRef(id).doc(payment.id).set({...payment.toMap(),'createdAt':FieldValue.serverTimestamp()});
  }
  Future<void> deletePayment(String id,String paymentId)=>paymentsRef(id).doc(paymentId).delete();

  Stream<Map<String,dynamic>> watchProfile()=>profileRef.snapshots().map((e)=>e.data()??{});
  Future<void> saveProfile(Map<String,dynamic> details)=>profileRef.set({
    ...clean(details),'updatedAt':FieldValue.serverTimestamp(),
  },SetOptions(merge:true));
  Future<void> register({required String email,required String password,required String name})async{
    final credentials=await _auth.createUserWithEmailAndPassword(email:email,password:password);
    try {
      await profileRef.set({'uid':credentials.user!.uid,'email':email,'displayName':name,
        'createdAt':FieldValue.serverTimestamp(),'updatedAt':FieldValue.serverTimestamp()});
    }catch(_){
      // Don't silently leave an apparently successful registration without a profile.
      rethrow;
    }
  }
  Future<void> login(String email,String password)async {await _auth.signInWithEmailAndPassword(email:email,password:password);}
  Future<void> resetPassword(String email)=>_auth.sendPasswordResetEmail(email:email);
  Future<void> logout()=>_auth.signOut();

  Stream<List<FinanceEntry>> watchFinances()=>financeRef.snapshots().map((snapshot)=>
    snapshot.docs.map((e)=>FinanceEntry.fromData(e.id,e.data())).toList());
  Stream<double> watchBudget()=>budgetRef.snapshots().map((d)=>asDouble(d.data()?['monthlyLimit']));
  Future<void> saveFinance(FinanceEntry e)=>financeRef.doc(e.id).set(e.toMap());
  Future<void> deleteFinance(FinanceEntry e)=>saveFinance(FinanceEntry(
    id:e.id,type:e.type,amount:e.amount,category:e.category,date:e.date,note:e.note,
    updatedAt:DateTime.now().millisecondsSinceEpoch,deleted:true));
  Future<void> saveBudget(double value)=>budgetRef.set({
    'monthlyLimit':value,'updatedAt':DateTime.now().millisecondsSinceEpoch});
}
