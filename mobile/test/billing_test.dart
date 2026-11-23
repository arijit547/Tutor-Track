import 'package:flutter_test/flutter_test.dart';
import 'package:tutortrack_mobile/logic/billing.dart';
import 'package:tutortrack_mobile/models/models.dart';

Student student({required List<BillingPlan> plans,List<LessonSession> sessions=const [],List<TuitionPayment> payments=const []})=>Student(
  id:'abc',name:'Sample',subject:'Math',scheduleDays:const ['Mon'],scheduleTime:'10:00',ratePerSession:100,
  active:true,joinedDate:'2026-01-01T00:00:00.000Z',billingStartDate:'2026-01-01',
  billingPlans:plans,sessions:sessions,payments:payments,
);
LessonSession completed(String id,String date)=>LessonSession(id:id,date:'${date}T00:00:00.000Z',durationMinutes:60,status:'completed');

void main(){
  test('session-target monthly billing is capped at one salary',(){
    final s=student(plans:[const BillingPlan(effectiveMonth:'2026-11',monthlySalary:1000,billingMode:'session-target',sessionsPerMonth:2)],
      sessions:[completed('1','2026-11-02'),completed('2','2026-11-05'),completed('3','2026-11-08')]);
    final summary=getStudentBilling(s,asOf:DateTime(2026,11,20));
    expect(summary.earned,1000);expect(summary.currentMonthComplete,true);
  });
  test('calendar month billing does not collect current month early',(){
    final s=student(plans:[const BillingPlan(effectiveMonth:'2026-10',monthlySalary:500,billingMode:'calendar-month')]);
    expect(getStudentBilling(s,asOf:DateTime(2026,11,20)).earned,500);
  });
  test('legacy missed sessions remain billable',(){
    final s=student(plans:[],sessions:[const LessonSession(id:'miss',date:'2026-11-08',durationMinutes:60,status:'missed')]);
    expect(getStudentBilling(s,asOf:DateTime(2026,11,20)).earned,100);
  });
  test('new contract after previous history begins next calendar month',(){
    final s=student(plans:[const BillingPlan(effectiveMonth:'2026-01',monthlySalary:500,billingMode:'session-target',sessionsPerMonth:5)],
      sessions:[completed('1','2026-11-02')]);
    final newPlans=updatedPlans(s,salary:800,mode:'session-target',sessionsPerMonth:4,
      startDate:'2026-01-01',now:DateTime(2026,11,20));
    expect(newPlans.last.effectiveMonth,'2026-12');
  });
}
