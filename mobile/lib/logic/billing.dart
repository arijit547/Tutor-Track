import '../models/models.dart';

class BillingSummary {
  const BillingSummary({required this.earned,required this.paid,required this.outstanding,
    required this.completedSessions,required this.currentMonthSessions,
    required this.currentMonthEarned,required this.currentMonthComplete,required this.currentMode,this.currentMonthTarget});
  final double earned,paid,outstanding,currentMonthEarned;
  final int completedSessions,currentMonthSessions;
  final bool currentMonthComplete;
  final String currentMode;
  final int? currentMonthTarget;
}

double _round(double x) => (x * 100 + 1e-9).round() / 100;
List<BillingPlan> plansFor(Student s) {
  if(s.billingPlans.isNotEmpty) return [...s.billingPlans]..sort((a,b)=>a.effectiveMonth.compareTo(b.effectiveMonth));
  if((s.monthlySalary ?? 0)>0 && s.billingMode != null){
    return [BillingPlan(effectiveMonth:monthOf(s.billingStartDate ?? s.joinedDate),monthlySalary:s.monthlySalary!,billingMode:s.billingMode!,sessionsPerMonth:s.sessionsPerMonth)];
  }
  return [];
}
BillingPlan? planForMonth(Student s,String month) {
  BillingPlan? found;
  for(final plan in plansFor(s)){if(plan.effectiveMonth.compareTo(month)<=0) found=plan;}
  return found;
}
String monthlyRateLabel(Student student,[String? month]) {
  final plan=planForMonth(student,month ?? monthOf(localDate()));
  if(plan != null) return '৳${plan.monthlySalary.toStringAsFixed(plan.monthlySalary==plan.monthlySalary.roundToDouble()?0:2)}/month';
  return '৳${(student.legacyRatePerSession ?? student.ratePerSession).toStringAsFixed(0)}/session';
}
BillingSummary getStudentBilling(Student s,{DateTime? asOf}){
  final plans=plansFor(s);
  final thisMonth=monthOf(localDate(asOf));
  final completed=s.sessions.where((e)=>e.status=='completed').toList();
  final paid=_round(s.payments.fold<double>(0,(sum,p)=>sum+p.amount));
  final currentCount=completed.where((e)=>monthOf(e.date)==thisMonth).length;
  if(plans.isEmpty){
    final billable=s.sessions.where((e)=>e.status=='completed'||e.status=='missed').toList();
    final earned=_round(billable.length*s.ratePerSession);
    return BillingSummary(earned:earned,paid:paid,outstanding:_round((earned-paid).clamp(0.0,double.infinity).toDouble()),
      completedSessions:completed.length,currentMonthSessions:currentCount,
      currentMonthEarned:_round(billable.where((e)=>monthOf(e.date)==thisMonth).length*s.ratePerSession),
      currentMonthComplete:false,currentMode:'legacy');
  }
  final initialMonth=plans.first.effectiveMonth;
  var earned=_round(s.sessions.where((e)=>monthOf(e.date).compareTo(initialMonth)<0 && (e.status=='completed'||e.status=='missed')).length * (s.legacyRatePerSession ?? s.ratePerSession));
  var currentEarned=0.0, mode='legacy';
  int? target;
  var complete=false;
  var month=initialMonth;
  for(var index=0;index<1200 && month.compareTo(thisMonth)<=0;index++,month=nextMonth(month)){
    final plan=planForMonth(s,month);
    final paused=s.billingPausedMonths.contains(month)||(s.billingPausedFromMonth!=null && s.billingPausedFromMonth!.isNotEmpty && month.compareTo(s.billingPausedFromMonth!)>=0);
    if(plan==null||plan.monthlySalary<=0||paused) continue;
    final done=completed.where((e)=>monthOf(e.date)==month).length;
    double bill=0;
    if(plan.billingMode=='session-target'){
      final required=(plan.sessionsPerMonth??1)>0 ? plan.sessionsPerMonth! : 1;
      bill=_round(plan.monthlySalary* (done<required?done:required)/required);
      if(month==thisMonth){ target=required; complete=done>=required; }
    }else{
      bill=month.compareTo(thisMonth)<0?plan.monthlySalary:0;
      if(month==thisMonth)complete=false;
    }
    earned+=bill;
    if(month==thisMonth){currentEarned=bill;mode=plan.billingMode;}
  }
  earned=_round(earned);
  return BillingSummary(earned:earned,paid:paid,outstanding:_round((earned-paid).clamp(0.0,double.infinity).toDouble()),
    completedSessions:completed.length,currentMonthSessions:currentCount,currentMonthEarned:currentEarned,
    currentMonthComplete:complete,currentMode:mode,currentMonthTarget:target);
}

/// Keep existing salary contracts; terms edited after recorded activity start next month.
List<BillingPlan> updatedPlans(Student? existing, {required double salary,required String mode,
  required int? sessionsPerMonth,required String startDate,DateTime? now}) {
  final old=existing==null?<BillingPlan>[]:plansFor(existing);
  final last=old.isEmpty?null:old.last;
  final changed=last==null||last.monthlySalary!=salary||last.billingMode!=mode||last.sessionsPerMonth!=sessionsPerMonth;
  if(!changed)return old;
  final current=monthOf(localDate(now));
  final history=existing!=null&&(existing.sessions.isNotEmpty||existing.payments.isNotEmpty);
  final future=old.isNotEmpty&&old.first.effectiveMonth.compareTo(current)>0?old.first.effectiveMonth:null;
  final effective=existing==null?monthOf(startDate):future ?? (history ? nextMonth(current) : current);
  return [...old.where((e)=>e.effectiveMonth!=effective), BillingPlan(effectiveMonth:effective,
    monthlySalary:salary,billingMode:mode,sessionsPerMonth:sessionsPerMonth)]
    ..sort((a,b)=>a.effectiveMonth.compareTo(b.effectiveMonth));
}
