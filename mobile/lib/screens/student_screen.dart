import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../data/location_tracker.dart';
import '../data/tutor_repository.dart';
import '../logic/billing.dart';
import '../models/models.dart';
import '../widgets/ui.dart';

const _uuid=Uuid();
String _isoDate(DateTime d)=>DateTime.utc(d.year,d.month,d.day).toIso8601String();

class StudentDetailScreen extends StatefulWidget{
  const StudentDetailScreen({super.key,required this.studentId});
  final String studentId;
  @override State<StudentDetailScreen> createState()=>_StudentDetailScreenState();
}
class _StudentDetailScreenState extends State<StudentDetailScreen>{
  late final Stream<List<Student>> records=TutorRepository().watchStudents();
  final repo=TutorRepository();

  @override Widget build(BuildContext context)=>StreamBuilder<List<Student>>(
    stream:records,builder:(context,snapshot){
      final matches=snapshot.data?.where((s)=>s.id==widget.studentId).toList()??[];
      if(snapshot.hasError)return Scaffold(appBar:AppBar(),body:Center(child:Text('${snapshot.error}')));
      if(!snapshot.hasData)return Scaffold(appBar:AppBar(),body:const Center(child:CircularProgressIndicator()));
      if(matches.isEmpty)return Scaffold(appBar:AppBar(title:const Text('Student record')),body:const Center(child:Text('Student not found.')));
      final s=matches.first;
      final billing=getStudentBilling(s);
      final lessons=[...s.sessions]..sort((a,b)=>b.date.compareTo(a.date));
      final payments=[...s.payments]..sort((a,b)=>b.date.compareTo(a.date));
      return Scaffold(
        appBar:AppBar(title:Text(s.name),actions:[
          IconButton(tooltip:'Edit student',onPressed:()=>Navigator.push(context,
            MaterialPageRoute(builder:(_)=>StudentEditScreen(student:s))),icon:const Icon(Icons.edit_outlined)),
          PopupMenuButton<String>(onSelected:(v)async{
            if(v=='delete'&&await confirmDelete(context,'Delete ${s.name} and their session/payment history?')){
              try{await repo.deleteStudent(s.id);if(context.mounted)Navigator.pop(context);}
              catch(e){if(context.mounted)showError(context,e);}
            }
          },itemBuilder:(_)=>[const PopupMenuItem(value:'delete',child:Text('Delete student'))]),
        ]),
        body:ListView(padding:const EdgeInsets.fromLTRB(16,8,16,30),children:[
          InfoCard(padding:const EdgeInsets.all(20),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Text(s.subject.toUpperCase(),style:const TextStyle(color:muted,fontWeight:FontWeight.w700,fontSize:11,letterSpacing:1.2)),
            const SizedBox(height:8),Text(s.name,style:const TextStyle(color:ink,fontSize:27,fontWeight:FontWeight.w800)),
            const SizedBox(height:8),Text('${s.scheduleDays.join(' · ')} at ${s.scheduleTime}',style:const TextStyle(color:muted)),
            const SizedBox(height:7),Text(monthlyRateLabel(s),style:const TextStyle(fontWeight:FontWeight.w700,color:forest)),
            if(s.email!=null&&s.email!.isNotEmpty)Padding(padding:const EdgeInsets.only(top:7),child:Text(s.email!,style:const TextStyle(color:muted))),
            if(!s.active)const Padding(padding:EdgeInsets.only(top:7),child:Text('Inactive · billing paused according to agreement',style:TextStyle(color:gold))),
          ])),
          const SizedBox(height:12),GridView.count(crossAxisCount:2,shrinkWrap:true,
            physics:const NeverScrollableScrollPhysics(),crossAxisSpacing:10,mainAxisSpacing:10,childAspectRatio:1.55,children:[
            AmountStat(label:'Earned',value:money(billing.earned)),
            AmountStat(label:'Outstanding',value:money(billing.outstanding)),
            AmountStat(label:'Paid',value:money(billing.paid)),
            AmountStat(label:'Completed',value:'${billing.completedSessions} sessions'),
          ]),
          const SizedBox(height:15),Row(children:[
            Expanded(child:ElevatedButton.icon(onPressed:()=>showSessionEditor(context,s.id),
              icon:const Icon(Icons.add_task_outlined,size:18),label:const Text('Log session'))),
            const SizedBox(width:10),Expanded(child:OutlinedButton.icon(
              onPressed:()=>showPaymentEditor(context,s.id,suggested:billing.outstanding),
              icon:const Icon(Icons.payments_outlined,size:18),label:const Text('Payment'))),
          ]),
          SectionTitle('Lesson history',subtitle:'${lessons.length} recorded'),
          if(lessons.isEmpty)const InfoCard(child:Text('No sessions recorded yet.')),
          ...lessons.map((session)=>Padding(padding:const EdgeInsets.only(bottom:8),child:InfoCard(
            padding:const EdgeInsets.all(10),child:ListTile(
              title:Text('${DateFormat('MMM d, yyyy').format(parseDate(session.date))} · ${session.durationMinutes} min',
                style:const TextStyle(fontSize:14,fontWeight:FontWeight.w700)),
              subtitle:Text('${session.status}${session.notes?.isNotEmpty==true?' · ${session.notes}':''}'),
              leading:Icon(session.status=='completed'?Icons.check_circle_outline:
                session.status=='cancelled'?Icons.cancel_outlined:Icons.error_outline,
                color:session.status=='completed'?forest:gold),
              trailing:IconButton(tooltip:'Delete session',icon:const Icon(Icons.delete_outline,size:19),
                onPressed:()async{if(await confirmDelete(context,'Remove this session from the billing history?')){
                  try{await repo.deleteSession(s.id,session.id);}catch(e){if(context.mounted)showError(context,e);}
                }}),
            )))),
          SectionTitle('Payment history',subtitle:'${payments.length} payments'),
          if(payments.isEmpty)const InfoCard(child:Text('No payments recorded yet.')),
          ...payments.map((payment)=>Padding(padding:const EdgeInsets.only(bottom:8),child:InfoCard(
            padding:const EdgeInsets.all(10),child:ListTile(
              leading:const CircleAvatar(backgroundColor:Color(0xFFEAF1EA),child:Icon(Icons.payments_outlined,color:forest)),
              title:Text(money(payment.amount),style:const TextStyle(color:ink,fontWeight:FontWeight.w800)),
              subtitle:Text('${DateFormat('MMM d, yyyy').format(parseDate(payment.date))}${payment.notes?.isNotEmpty==true?' · ${payment.notes}':''}'),
              trailing:IconButton(tooltip:'Delete payment',icon:const Icon(Icons.delete_outline),
                onPressed:()async{if(await confirmDelete(context,'Delete this tuition payment?')){
                  try{await repo.deletePayment(s.id,payment.id);}catch(e){if(context.mounted)showError(context,e);}
                }}),
            )))),
        ]),
      );
    },
  );
}

class StudentEditScreen extends StatefulWidget{
  const StudentEditScreen({super.key,this.student});
  final Student? student;
  @override State<StudentEditScreen> createState()=>_StudentEditScreenState();
}
class _StudentEditScreenState extends State<StudentEditScreen>{
  final form=GlobalKey<FormState>();
  late final TextEditingController name,subject,email,salary,target;
  late DateTime startDate;
  late TimeOfDay schedule;
  late List<String> days;
  late bool active;
  Map<String,dynamic>? location;
  bool findingLocation=false;
  late String mode;
  bool busy=false;
  @override void initState(){super.initState();
    final s=widget.student;
    final plans=s==null?<BillingPlan>[]:plansFor(s);
    final current=plans.isEmpty?null:plans.last;
    name=TextEditingController(text:s?.name??'');
    subject=TextEditingController(text:s?.subject??'');
    email=TextEditingController(text:s?.email??'');
    salary=TextEditingController(text:current==null?'':current.monthlySalary.toString());
    target=TextEditingController(text:'${current?.sessionsPerMonth??12}');
    startDate=DateTime.tryParse(s?.billingStartDate??'')??DateTime.now();
    final parts=(s?.scheduleTime??'10:00').split(':');
    schedule=TimeOfDay(hour:int.tryParse(parts[0])??10,minute:parts.length>1?int.tryParse(parts[1])??0:0);
    days=[...(s?.scheduleDays ?? ['Mon'])];active=s?.active??true;location=s?.location;
    mode=current?.billingMode??'session-target';
  }
  @override void dispose(){name.dispose();subject.dispose();email.dispose();salary.dispose();target.dispose();super.dispose();}
  Future<void> save()async{
    if(!form.currentState!.validate())return;
    if(days.isEmpty){showError(context,'Choose at least one day.');return;}
    final monthly=double.parse(salary.text);
    final count=int.tryParse(target.text);
    final s=widget.student;
    final oldPaused=[...(s?.billingPausedMonths ?? <String>[])];
    var pausedFrom=s?.billingPausedFromMonth??(!active?monthOf(localDate(startDate)):'');
    final nowMonth=monthOf(localDate());
    if(s!=null&&s.active&&!active){pausedFrom=nextMonth(nowMonth);}
    else if(s!=null&&!s.active&&active&&pausedFrom.isNotEmpty){
      var month=pausedFrom;
      for(var i=0;i<1200&&month.compareTo(nowMonth)<0;i++,month=nextMonth(month)){
        if(!oldPaused.contains(month))oldPaused.add(month);
      }
      pausedFrom='';
    }
    final plans=updatedPlans(s,salary:monthly,mode:mode,sessionsPerMonth:count,startDate:localDate(startDate));
    final fields=<String,dynamic>{
      'name':name.text.trim(),'subject':subject.text.trim(),'email':email.text.trim(),
      'monthlySalary':monthly,'billingMode':mode,'sessionsPerMonth':count,
      'ratePerSession':count!=null&&count>0?(monthly/count*100).round()/100:0,
      'billingStartDate':s?.billingStartDate??localDate(startDate),
      'billingPlans':plans.map((p)=>p.toMap()).toList(),
      'billingPausedMonths':oldPaused,'billingPausedFromMonth':pausedFrom,
      'scheduleDays':days,'scheduleTime':'${schedule.hour.toString().padLeft(2,'0')}:${schedule.minute.toString().padLeft(2,'0')}',
      'active':active,
      if(s!=null)'legacyRatePerSession':s.legacyRatePerSession??s.ratePerSession,
      if(location!=null)'location':location,
      if(s?.location!=null&&location==null)'location':FieldValue.delete(),
    };
    setState(()=>busy=true);
    try{await TutorRepository().saveStudent(fields,id:s?.id);if(mounted)Navigator.pop(context);}
    catch(e){if(mounted)showError(context,e);}finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(
    appBar:AppBar(title:Text(widget.student==null?'Add student':'Edit student')),
    body:Form(key:form,child:ListView(padding:const EdgeInsets.fromLTRB(16,12,16,40),children:[
      InfoCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Student details',style:TextStyle(color:ink,fontSize:18,fontWeight:FontWeight.w800)),
        const SizedBox(height:18),TextFormField(controller:name,textCapitalization:TextCapitalization.words,
          decoration:const InputDecoration(labelText:'Student name'),validator:(v)=>v==null||v.trim().isEmpty?'Enter a name':null),
        const SizedBox(height:12),TextFormField(controller:subject,decoration:const InputDecoration(labelText:'Subject'),
          validator:(v)=>v==null||v.trim().isEmpty?'Enter a subject':null),
        const SizedBox(height:12),TextFormField(controller:email,keyboardType:TextInputType.emailAddress,
          decoration:const InputDecoration(labelText:'Email (optional)')),
      ])),
      const SizedBox(height:16),InfoCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Monthly tuition agreement',style:TextStyle(fontSize:18,color:ink,fontWeight:FontWeight.w800)),
        const SizedBox(height:8),const Text('Existing tuition terms remain in history. Changes after sessions/payments take effect next month.',
          style:TextStyle(color:muted,fontSize:12)),
        const SizedBox(height:16),TextFormField(controller:salary,keyboardType:const TextInputType.numberWithOptions(decimal:true),
          decoration:const InputDecoration(labelText:'Salary per month (BDT)'),
          validator:(v)=>(double.tryParse(v??'')??0)<=0?'Enter a positive salary':null),
        const SizedBox(height:12),DropdownButtonFormField<String>(value:mode,decoration:const InputDecoration(labelText:'Billing mode'),
          items:const [DropdownMenuItem(value:'session-target',child:Text('Fixed sessions per month')),
            DropdownMenuItem(value:'calendar-month',child:Text('Calendar month'))],
          onChanged:(v)=>setState(()=>mode=v??mode)),
        const SizedBox(height:12),TextFormField(controller:target,keyboardType:TextInputType.number,
          decoration:InputDecoration(labelText:mode=='session-target'?'Required sessions per month':'Planned sessions (optional)'),
          validator:(v){final i=int.tryParse(v??'');if(mode=='session-target'&&(i==null||i<1))return 'Enter a positive whole number';
            if(v!=null&&v.trim().isNotEmpty&&(i==null||i<1))return 'Use a positive whole number';return null;}),
        const SizedBox(height:10),ListTile(contentPadding:EdgeInsets.zero,
          title:const Text('Billing begins'),subtitle:Text(localDate(startDate)),
          trailing:widget.student!=null?const Icon(Icons.lock_outline,size:18):const Icon(Icons.calendar_month_outlined),
          onTap:widget.student!=null?null:()async{
            final value=await chooseDate(context,startDate);if(value!=null)setState(()=>startDate=value);
          }),
      ])),
      const SizedBox(height:16),InfoCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Class schedule',style:TextStyle(fontSize:18,color:ink,fontWeight:FontWeight.w800)),
        const SizedBox(height:16),Wrap(spacing:7,runSpacing:5,children:weekDays.map((day)=>FilterChip(
          label:Text(day),selected:days.contains(day),onSelected:(v)=>setState(()=>v?days.add(day):days.remove(day)))).toList()),
        const SizedBox(height:14),ListTile(contentPadding:EdgeInsets.zero,
          leading:const Icon(Icons.schedule_outlined,color:forest),title:const Text('Class time'),
          subtitle:Text(schedule.format(context)),trailing:const Icon(Icons.edit_outlined,size:19),
          onTap:()async{final t=await showTimePicker(context:context,initialTime:schedule);if(t!=null)setState(()=>schedule=t);}),
        const Divider(height:24),
        const Text('Teaching location',style:TextStyle(fontWeight:FontWeight.w700,color:ink)),
        const SizedBox(height:6),
        Text(location==null?'No location saved':
          'Lat ${location!['latitude']?.toStringAsFixed(5) ?? '-'} · Lng ${location!['longitude']?.toStringAsFixed(5) ?? '-'}',
          style:const TextStyle(color:muted,fontSize:12)),
        Row(children:[
          Expanded(child:OutlinedButton.icon(onPressed:findingLocation?null:()async{
            setState(()=>findingLocation=true);
            try{final pos=await LocationTracker.currentPosition();
              if(mounted)setState(()=>location={'latitude':pos.latitude,'longitude':pos.longitude});
            }catch(e){if(mounted)showError(context,e);}finally{if(mounted)setState(()=>findingLocation=false);}
          },icon:const Icon(Icons.my_location_outlined,size:17),
            label:Text(findingLocation?'Locating…':'Use current location'))),
          if(location!=null)IconButton(tooltip:'Clear location',onPressed:()=>setState(()=>location=null),
            icon:const Icon(Icons.close_outlined)),
        ]),
        const SizedBox(height:8),SwitchListTile(contentPadding:EdgeInsets.zero,value:active,title:const Text('Active student'),
          subtitle:const Text('Inactive students are hidden from active schedules.'),onChanged:(v)=>setState(()=>active=v)),
      ])),
      const SizedBox(height:22),ElevatedButton.icon(onPressed:busy?null:save,icon:const Icon(Icons.save_outlined),
        label:Text(busy?'Saving…':widget.student==null?'Add student':'Save changes')),
    ])),
  );
}

Future<void> showSessionEditor(BuildContext context,String studentId,{int defaultMinutes=60})async{
  final repo=TutorRepository();
  var date=DateTime.now(),duration=defaultMinutes,status='completed',notes='';
  var busy=false;
  final form=GlobalKey<FormState>();
  await showModalBottomSheet<void>(context:context,isScrollControlled:true,showDragHandle:true,
    builder:(sheetContext)=>StatefulBuilder(builder:(sheetContext,update)=>Padding(
      padding:EdgeInsets.fromLTRB(20,12,20,MediaQuery.viewInsetsOf(sheetContext).bottom+24),
      child:SingleChildScrollView(child:Form(key:form,child:Column(mainAxisSize:MainAxisSize.min,
        crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        const Text('Log session',style:TextStyle(fontSize:22,color:ink,fontWeight:FontWeight.w800)),const SizedBox(height:16),
        ListTile(contentPadding:EdgeInsets.zero,title:const Text('Lesson date'),
          subtitle:Text(localDate(date)),trailing:const Icon(Icons.calendar_month_outlined),
          onTap:()async{final d=await chooseDate(sheetContext,date);if(d!=null)update(()=>date=d);}),
        TextFormField(initialValue:'$defaultMinutes',keyboardType:TextInputType.number,decoration:const InputDecoration(labelText:'Duration (minutes)'),
          onChanged:(v)=>duration=int.tryParse(v)??0,
          validator:(v)=>(int.tryParse(v??'')??0)<15?'Use 15 minutes or more':null),
        const SizedBox(height:12),DropdownButtonFormField<String>(value:status,
          decoration:const InputDecoration(labelText:'Session status'),items:const [
            DropdownMenuItem(value:'completed',child:Text('Completed')),
            DropdownMenuItem(value:'missed',child:Text('Missed')),
            DropdownMenuItem(value:'cancelled',child:Text('Cancelled')),
          ],onChanged:(v)=>update(()=>status=v??status)),
        const SizedBox(height:12),TextFormField(maxLines:2,decoration:const InputDecoration(labelText:'Notes (optional)'),onChanged:(v)=>notes=v),
        const SizedBox(height:18),ElevatedButton(onPressed:busy?null:()async{
          if(!form.currentState!.validate())return;
          update(()=>busy=true);
          try{
            await repo.addSession(studentId,LessonSession(id:_uuid.v4(),date:_isoDate(date),durationMinutes:duration,status:status,notes:notes.trim()));
            if(sheetContext.mounted)Navigator.pop(sheetContext);
          }catch(e){if(sheetContext.mounted)showError(sheetContext,e);}finally{if(sheetContext.mounted)update(()=>busy=false);}
        },child:Text(busy?'Saving…':'Save session')),
      ]))))));
}

Future<void> showPaymentEditor(BuildContext context,String studentId,{double suggested=0})async{
  final repo=TutorRepository();
  var date=DateTime.now(),amount=suggested,notes='';
  var busy=false;
  final form=GlobalKey<FormState>();
  await showModalBottomSheet<void>(context:context,isScrollControlled:true,showDragHandle:true,
    builder:(sheetContext)=>StatefulBuilder(builder:(sheetContext,update)=>Padding(
      padding:EdgeInsets.fromLTRB(20,12,20,MediaQuery.viewInsetsOf(sheetContext).bottom+24),
      child:SingleChildScrollView(child:Form(key:form,child:Column(mainAxisSize:MainAxisSize.min,
        crossAxisAlignment:CrossAxisAlignment.stretch,children:[
        const Text('Record tuition payment',style:TextStyle(fontSize:22,color:ink,fontWeight:FontWeight.w800)),
        if(suggested>0)Padding(padding:const EdgeInsets.symmetric(vertical:9),
          child:Text('Current outstanding: ${money(suggested)}',style:const TextStyle(color:forest))),
        ListTile(contentPadding:EdgeInsets.zero,title:const Text('Payment date'),
          subtitle:Text(localDate(date)),trailing:const Icon(Icons.calendar_month_outlined),
          onTap:()async{final d=await chooseDate(sheetContext,date);if(d!=null)update(()=>date=d);}),
        TextFormField(initialValue:suggested>0?suggested.toStringAsFixed(0):'',
          keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Amount (BDT)'),
          onChanged:(v)=>amount=double.tryParse(v)??0,
          validator:(v)=>(double.tryParse(v??'')??0)<=0?'Enter a positive amount':null),
        const SizedBox(height:12),TextFormField(maxLines:2,decoration:const InputDecoration(labelText:'Notes (optional)'),onChanged:(v)=>notes=v),
        const SizedBox(height:18),ElevatedButton(onPressed:busy?null:()async{
          if(!form.currentState!.validate())return;
          update(()=>busy=true);
          try{
            await repo.addPayment(studentId,TuitionPayment(id:_uuid.v4(),date:_isoDate(date),amount:amount,notes:notes.trim()));
            if(sheetContext.mounted)Navigator.pop(sheetContext);
          }catch(e){if(sheetContext.mounted)showError(sheetContext,e);}finally{if(sheetContext.mounted)update(()=>busy=false);}
        },child:Text(busy?'Saving…':'Record payment')),
      ]))))));
}
