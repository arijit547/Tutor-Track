import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../data/tutor_repository.dart';
import '../data/location_tracker.dart';
import '../logic/billing.dart';
import '../models/models.dart';
import '../widgets/ui.dart';
import 'student_screen.dart';
import 'finance_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget{
  const HomeScreen({super.key});
  @override State<HomeScreen> createState()=>_HomeScreenState();
}
class _HomeScreenState extends State<HomeScreen>{
  final repo=TutorRepository();
  final tracker=LocationTracker();
  bool tracking=false;
  StreamSubscription<List<Student>>? sub;
  List<Student> students=[];
  int tab=0;
  bool loading=true;
  Object? streamError;
  @override void initState(){super.initState();sub=repo.watchStudents().listen((data){
    if(mounted)setState((){students=data;loading=false;streamError=null;});
  },onError:(Object error){if(mounted)setState((){loading=false;streamError=error;});});}
  @override void dispose(){sub?.cancel();tracker.stop();super.dispose();}
  void openStudent(Student s)=>Navigator.push(context,MaterialPageRoute(builder:(_)=>StudentDetailScreen(studentId:s.id)));
  void addStudent()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>const StudentEditScreen()));
  void logSession(Student s)=>showSessionEditor(context,s.id);
  Future<void> toggleTracking()async{
    if(tracking){await tracker.stop();if(mounted)setState(()=>tracking=false);return;}
    try{
      await tracker.start(students:()=>students,onCandidate:(s,minutes)async{
        if(!mounted)return;
        final confirmed=await showDialog<bool>(context:context,builder:(dialog)=>AlertDialog(
          title:const Text('Possible teaching session'),
          content:Text('You have been near ${s.name} for $minutes minutes. Log a session?'),
          actions:[TextButton(onPressed:()=>Navigator.pop(dialog,false),child:const Text('Not now')),
            FilledButton(onPressed:()=>Navigator.pop(dialog,true),child:const Text('Review session'))]));
        if(confirmed==true&&mounted)await showSessionEditor(context,s.id,defaultMinutes:minutes);
      },onError:(e){if(mounted)showError(context,e);});
      if(mounted)setState(()=>tracking=true);
    }catch(e){if(mounted)showError(context,e);}
  }
  @override Widget build(BuildContext context){
    final titles=['Overview','Students','Finance','Profile'];
    return Scaffold(
      appBar:AppBar(title:Row(children:[Container(width:30,height:30,
        decoration:BoxDecoration(color:forest,borderRadius:BorderRadius.circular(8)),
        child:ClipRRect(borderRadius:BorderRadius.circular(8),child:Image.asset('assets/icon.png',width:30,height:30,fit:BoxFit.cover))),
        const SizedBox(width:10),Text(titles[tab],style:const TextStyle(color:ink,fontWeight:FontWeight.w700))]),
        actions:[if(tab==0||tab==1)IconButton(tooltip:'Add student',onPressed:addStudent,icon:const Icon(Icons.add_circle_outline))]),
      body:loading?const Center(child:CircularProgressIndicator()):streamError!=null?
        Center(child:Padding(padding:const EdgeInsets.all(24),child:Text('Could not load your student records.\n$streamError',textAlign:TextAlign.center))):
        IndexedStack(index:tab,children:[
          DashboardScreen(students:students,onAdd:addStudent,onOpen:openStudent,onSession:logSession),
          StudentListScreen(students:students,onAdd:addStudent,onOpen:openStudent,onSession:logSession),
          FinanceScreen(students:students),ProfileScreen(tracking:tracking,onToggleTracking:toggleTracking),
        ]),
      bottomNavigationBar:NavigationBar(selectedIndex:tab,onDestinationSelected:(v)=>setState(()=>tab=v),
        labelBehavior:NavigationDestinationLabelBehavior.alwaysShow,
        destinations:const [
          NavigationDestination(icon:Icon(Icons.dashboard_outlined),selectedIcon:Icon(Icons.dashboard),label:'Home'),
          NavigationDestination(icon:Icon(Icons.people_outline),selectedIcon:Icon(Icons.people),label:'Students'),
          NavigationDestination(icon:Icon(Icons.account_balance_wallet_outlined),selectedIcon:Icon(Icons.account_balance_wallet),label:'Finance'),
          NavigationDestination(icon:Icon(Icons.person_outline),selectedIcon:Icon(Icons.person),label:'Profile'),
        ]),
    );
  }
}

class DashboardScreen extends StatelessWidget{
  const DashboardScreen({super.key,required this.students,required this.onAdd,required this.onOpen,required this.onSession});
  final List<Student> students;
  final VoidCallback onAdd;
  final ValueChanged<Student> onOpen,onSession;
  @override Widget build(BuildContext context){
    final today=DateTime.now();
    final dayName=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][today.weekday%7];
    final active=students.where((s)=>s.active).toList();
    final scheduled=active.where((s)=>s.scheduleDays.contains(dayName)).toList()
      ..sort((a,b)=>a.scheduleTime.compareTo(b.scheduleTime));
    final earned=students.fold<double>(0,(v,s)=>v+getStudentBilling(s).earned);
    final collected=students.fold<double>(0,(v,s)=>v+getStudentBilling(s).paid);
    final completed=students.fold<int>(0,(v,s)=>v+getStudentBilling(s).completedSessions);
    final next=scheduled.where((s){
      final parts=s.scheduleTime.split(':');
      if(parts.length!=2)return false;
      final t=DateTime(today.year,today.month,today.day,int.tryParse(parts[0])??0,int.tryParse(parts[1])??0);
      return t.isAfter(today);
    }).firstOrNull;
    return ListView(padding:const EdgeInsets.fromLTRB(16,12,16,32),children:[
      InfoCard(padding:const EdgeInsets.all(22),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        Text(DateFormat('EEEE, MMMM d').format(today).toUpperCase(),style:const TextStyle(color:muted,fontSize:11,letterSpacing:1.4,fontWeight:FontWeight.w600)),
        const SizedBox(height:12),const Text('Your teaching,\nat a glance.',style:TextStyle(color:ink,fontSize:31,fontWeight:FontWeight.w800,height:1.08)),
        const SizedBox(height:12),const Text('Lessons, student records, and tuition in one calm workspace.',style:TextStyle(color:muted)),
        const SizedBox(height:20),ElevatedButton.icon(onPressed:onAdd,icon:const Icon(Icons.add,size:18),label:const Text('Add student')),
        const Divider(height:36),
        const Text('WEEKLY SCHEDULE',style:TextStyle(color:muted,fontWeight:FontWeight.w700,fontSize:11,letterSpacing:1.2)),
        const SizedBox(height:18),_WeeklyBars(students:active,today:dayName),
      ])),
      const SizedBox(height:16),GridView.count(crossAxisCount:2,shrinkWrap:true,physics:const NeverScrollableScrollPhysics(),
        crossAxisSpacing:10,mainAxisSpacing:10,childAspectRatio:1.55,children:[
        AmountStat(label:'Total earned',value:money(earned),icon:Icons.trending_up),
        AmountStat(label:'Outstanding',value:money((earned-collected).clamp(0,double.infinity)),icon:Icons.payments_outlined),
        AmountStat(label:'Lessons done',value:'$completed',icon:Icons.check_circle_outline),
        AmountStat(label:'Active students',value:'${active.length}',icon:Icons.school_outlined),
      ]),
      SectionTitle('Today’s classes',subtitle:'${scheduled.length} scheduled',trailing:Chip(label:Text(dayName))),
      if(scheduled.isEmpty)const InfoCard(child:ListTile(contentPadding:EdgeInsets.zero,
        leading:Icon(Icons.event_available_outlined,color:forest),title:Text('No classes today'),
        subtitle:Text('Your schedule is clear. Enjoy the extra space.')))
      else InfoCard(padding:EdgeInsets.zero,child:Column(children:scheduled.map((s)=>Column(children:[
        ListTile(contentPadding:const EdgeInsets.symmetric(horizontal:16,vertical:5),
          leading:Text(s.scheduleTime,style:const TextStyle(color:forest,fontWeight:FontWeight.w700)),
          title:Text(s.name,style:const TextStyle(fontWeight:FontWeight.w700,color:ink)),
          subtitle:Text(s.subject,maxLines:1,overflow:TextOverflow.ellipsis),
          trailing:IconButton(tooltip:'Log session',onPressed:()=>onSession(s),icon:const Icon(Icons.add_task_outlined,color:forest)),
          onTap:()=>onOpen(s)),
        if(s!=scheduled.last)const Divider(height:1,indent:16,endIndent:16),
      ])).toList())),
      SectionTitle('Up next',subtitle:next==null?'No more classes today':'Next scheduled lesson'),
      InfoCard(child:next==null?const Text('You’re all caught up for today.',style:TextStyle(color:muted)):
        ListTile(contentPadding:EdgeInsets.zero,title:Text(next.name,style:const TextStyle(fontWeight:FontWeight.w700)),
          subtitle:Text('${next.subject} · ${next.scheduleTime}'),trailing:const Icon(Icons.arrow_forward_ios,size:16),onTap:()=>onOpen(next))),
      SectionTitle('Your students',subtitle:'${students.length} total'),
      if(students.isEmpty)InfoCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('Start your student record',style:TextStyle(color:ink,fontWeight:FontWeight.w700,fontSize:18)),
        const SizedBox(height:8),const Text('Add a student to start tracking lessons and tuition.'),
        const SizedBox(height:14),ElevatedButton(onPressed:onAdd,child:const Text('Add your first student')),
      ]))
      else ...students.take(4).map((s)=>Padding(padding:const EdgeInsets.only(bottom:9),child:StudentRow(student:s,onOpen:()=>onOpen(s)))),
    ]);
  }
}

class _WeeklyBars extends StatelessWidget{
  const _WeeklyBars({required this.students,required this.today});
  final List<Student> students;
  final String today;
  @override Widget build(BuildContext context){
    const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    final counts=days.map((day)=>students.where((s)=>s.scheduleDays.contains(day)).length).toList();
    final max=counts.fold<int>(1,(a,b)=>b>a?b:a);
    return Row(children:List.generate(7,(i)=>Expanded(child:Column(children:[
      Text('${counts[i]}',style:const TextStyle(color:muted,fontSize:11)),const SizedBox(height:6),
      Container(height:65,margin:const EdgeInsets.symmetric(horizontal:3),alignment:Alignment.bottomCenter,
        decoration:BoxDecoration(color:const Color(0xFFE8EEE8),borderRadius:BorderRadius.circular(7)),
        child:FractionallySizedBox(heightFactor:counts[i]==0?0.05:counts[i]/max,
          child:Container(decoration:BoxDecoration(color:days[i]==today?forest:const Color(0xFFB3C5B8),
          borderRadius:BorderRadius.circular(6))))),
      const SizedBox(height:8),Text(days[i],style:TextStyle(color:days[i]==today?forest:muted,
        fontWeight:days[i]==today?FontWeight.w800:FontWeight.w400,fontSize:11)),
    ]))));
  }
}

class StudentListScreen extends StatefulWidget{
  const StudentListScreen({super.key,required this.students,required this.onAdd,required this.onOpen,required this.onSession});
  final List<Student> students;
  final VoidCallback onAdd;
  final ValueChanged<Student> onOpen,onSession;
  @override State<StudentListScreen> createState()=>_StudentListScreenState();
}
class _StudentListScreenState extends State<StudentListScreen>{
  String search='';
  bool onlyActive=false;
  @override Widget build(BuildContext context){
    final shown=widget.students.where((s)=>(!onlyActive||s.active)&&
      ('${s.name} ${s.subject}'.toLowerCase().contains(search.toLowerCase()))).toList();
    return ListView(padding:const EdgeInsets.fromLTRB(16,12,16,40),children:[
      TextField(onChanged:(v)=>setState(()=>search=v),decoration:const InputDecoration(
        prefixIcon:Icon(Icons.search),hintText:'Search students or subjects')),
      const SizedBox(height:10),SwitchListTile(contentPadding:EdgeInsets.zero,title:const Text('Active students only'),
        value:onlyActive,onChanged:(v)=>setState(()=>onlyActive=v)),
      SectionTitle('Student records',subtitle:'${shown.length} students',
        trailing:IconButton(onPressed:widget.onAdd,icon:const Icon(Icons.person_add_alt_1_outlined))),
      if(shown.isEmpty)const InfoCard(child:Text('No matching student records.')),
      ...shown.map((s)=>Padding(padding:const EdgeInsets.only(bottom:10),child:StudentRow(
        student:s,onOpen:()=>widget.onOpen(s),onSession:()=>widget.onSession(s)))),
    ]);
  }
}

class StudentRow extends StatelessWidget{
  const StudentRow({super.key,required this.student,required this.onOpen,this.onSession});
  final Student student;
  final VoidCallback onOpen;
  final VoidCallback? onSession;
  @override Widget build(BuildContext context){
    final billing=getStudentBilling(student);
    return InfoCard(padding:const EdgeInsets.all(14),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      InkWell(onTap:onOpen,child:Row(children:[
        CircleAvatar(backgroundColor:const Color(0xFFEAF1EA),child:Text(student.name.isEmpty?'?':student.name[0].toUpperCase(),
          style:const TextStyle(color:forest,fontWeight:FontWeight.w700))),const SizedBox(width:12),
        Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          Text(student.name,style:const TextStyle(fontSize:16,fontWeight:FontWeight.w700,color:ink)),
          Text('${student.subject} · ${student.scheduleDays.join(', ')}',maxLines:2,overflow:TextOverflow.ellipsis,
            style:const TextStyle(color:muted,fontSize:12)),
        ])),
        Icon(student.active?Icons.check_circle_outline:Icons.pause_circle_outline,color:student.active?forest:muted,size:20),
      ])),const Divider(height:24),
      Row(children:[Expanded(child:Text(monthlyRateLabel(student),style:const TextStyle(color:muted,fontSize:12))),
        Text('Due ${money(billing.outstanding)}',style:const TextStyle(color:forest,fontWeight:FontWeight.w800,fontSize:13))]),
      if(onSession!=null)...[const SizedBox(height:8),Align(alignment:Alignment.centerRight,
        child:TextButton.icon(onPressed:onSession,icon:const Icon(Icons.add_task_outlined,size:17),label:const Text('Log session')))],
    ]));
  }
}
