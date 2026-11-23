import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:uuid/uuid.dart';
import '../data/tutor_repository.dart';
import '../models/models.dart';
import '../widgets/ui.dart';

const _uuid=Uuid();

class _DisplayTransaction {
  const _DisplayTransaction({required this.id,required this.type,required this.date,
    required this.category,required this.amount,required this.note,this.personal});
  final String id,type,date,category,note;
  final double amount;
  final FinanceEntry? personal;
}

class FinanceScreen extends StatefulWidget {
  const FinanceScreen({super.key,required this.students});
  final List<Student> students;
  @override State<FinanceScreen> createState()=>_FinanceScreenState();
}
class _FinanceScreenState extends State<FinanceScreen>{
  final repo=TutorRepository();
  late final Stream<List<FinanceEntry>> entriesStream=repo.watchFinances();
  late final Stream<double> budgetStream=repo.watchBudget();
  String month=monthOf(localDate()),type='all',search='';
  bool allTime=false;

  void moveMonth(int change){
    final parts=month.split('-').map(int.parse).toList();
    setState(()=>month=monthOf(localDate(DateTime(parts[0],parts[1]+change))));
  }
  @override Widget build(BuildContext context)=>StreamBuilder<List<FinanceEntry>>(
    stream:entriesStream,builder:(context,snapshot){
      if(snapshot.hasError)return Center(child:Text('Finance unavailable: ${snapshot.error}'));
      if(!snapshot.hasData)return const Center(child:CircularProgressIndicator());
      final entries=<_DisplayTransaction>[
        ...snapshot.data!.where((e)=>!e.deleted).map((e)=>_DisplayTransaction(id:e.id,type:e.type,
          date:e.date,category:e.category,amount:e.amount,note:e.note,personal:e)),
        ...widget.students.expand((s)=>s.payments.map((p)=>_DisplayTransaction(
          id:'tuition:${s.id}:${p.id}',type:'income',date:p.date.length>=10?p.date.substring(0,10):p.date,
          category:'Tuition payment',amount:p.amount,note:'${s.name}${p.notes==null?'':' · ${p.notes}'}'))),
      ]..sort((a,b)=>b.date.compareTo(a.date));
      final selected=entries.where((e)=>allTime||monthOf(e.date)==month).toList();
      final shown=selected.where((e)=>(type=='all'||e.type==type)&&
        '${e.category} ${e.note} ${e.amount}'.toLowerCase().contains(search.toLowerCase())).toList();
      final income=selected.where((e)=>e.type=='income').fold<double>(0,(s,e)=>s+e.amount);
      final expenses=selected.where((e)=>e.type=='expense').fold<double>(0,(s,e)=>s+e.amount);
      final tuition=selected.where((e)=>e.id.startsWith('tuition:')).fold<double>(0,(s,e)=>s+e.amount);
      return ListView(padding:const EdgeInsets.fromLTRB(16,12,16,45),children:[
        InfoCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          const Text('PERSONAL FINANCE',style:TextStyle(color:muted,fontSize:11,fontWeight:FontWeight.w700,letterSpacing:1.1)),
          const SizedBox(height:9),const Text('Your money, clearly.',style:TextStyle(fontSize:25,color:ink,fontWeight:FontWeight.w800)),
          const SizedBox(height:14),Row(children:[
            IconButton(onPressed:allTime?null:()=>moveMonth(-1),icon:const Icon(Icons.chevron_left)),
            Expanded(child:Text(allTime?'All time':DateFormat('MMMM yyyy').format(DateTime.parse('$month-01')),
              textAlign:TextAlign.center,style:const TextStyle(color:ink,fontWeight:FontWeight.w700))),
            IconButton(onPressed:allTime?null:()=>moveMonth(1),icon:const Icon(Icons.chevron_right)),
          ]),
          SwitchListTile(title:const Text('Show all-time records'),value:allTime,contentPadding:EdgeInsets.zero,
            onChanged:(v)=>setState(()=>allTime=v)),
        ])),
        const SizedBox(height:12),GridView.count(crossAxisCount:2,shrinkWrap:true,
          physics:const NeverScrollableScrollPhysics(),crossAxisSpacing:10,mainAxisSpacing:10,childAspectRatio:1.5,
          children:[
            AmountStat(label:'Income',value:money(income),icon:Icons.arrow_downward_rounded),
            AmountStat(label:'Expenses',value:money(expenses),icon:Icons.arrow_upward_rounded),
            AmountStat(label:'Net balance',value:money(income-expenses),icon:Icons.account_balance_wallet_outlined),
            AmountStat(label:'Tuition collected',value:money(tuition),icon:Icons.school_outlined),
          ]),
        const SizedBox(height:14),StreamBuilder<double>(stream:budgetStream,builder:(context,budgetSnap){
          final budget=budgetSnap.data??0;
          final monthlyExpenses=entries.where((e)=>e.type=='expense'&&monthOf(e.date)==month).fold<double>(0,(sum,e)=>sum+e.amount);
          final ratio=budget<=0?0.0:(monthlyExpenses/budget).clamp(0.0,1.0).toDouble();
          return InfoCard(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
            Row(children:[const Expanded(child:Text('Monthly spending budget',style:TextStyle(fontWeight:FontWeight.w700,color:ink))),
              IconButton(onPressed:()=>_editBudget(context,budget),icon:const Icon(Icons.edit_outlined,size:19))]),
            Text(budget<=0?'No limit set':'${money(monthlyExpenses)} of ${money(budget)}',style:const TextStyle(color:muted)),
            const SizedBox(height:10),LinearProgressIndicator(value:ratio,minHeight:8,
              backgroundColor:const Color(0xFFEAF0E9),borderRadius:BorderRadius.circular(10),
              color:budget>0&&monthlyExpenses>budget?const Color(0xFFC17F57):forest),
          ]));
        }),
        SectionTitle('Transactions',subtitle:'Tuition payments are imported automatically',trailing:
          IconButton(tooltip:'Add transaction',onPressed:()=>_openEditor(context),icon:const Icon(Icons.add_circle_outline))),
        Row(children:[Expanded(child:OutlinedButton.icon(onPressed:()=>_openEditor(context,initialType:'income'),
          icon:const Icon(Icons.add,size:17),label:const Text('Income'))),const SizedBox(width:10),
          Expanded(child:ElevatedButton.icon(onPressed:()=>_openEditor(context,initialType:'expense'),
            icon:const Icon(Icons.remove,size:17),label:const Text('Expense')))]),
        const SizedBox(height:12),TextField(onChanged:(v)=>setState(()=>search=v),
          decoration:const InputDecoration(prefixIcon:Icon(Icons.search),hintText:'Search transactions')),
        const SizedBox(height:10),SegmentedButton<String>(segments:const [
          ButtonSegment(value:'all',label:Text('All')),ButtonSegment(value:'income',label:Text('Income')),
          ButtonSegment(value:'expense',label:Text('Expense'))],selected:{type},
          onSelectionChanged:(s)=>setState(()=>type=s.first)),
        const SizedBox(height:12),
        if(shown.isEmpty)const InfoCard(child:Text('No transactions for this period.')),
        ...shown.map((e)=>Padding(padding:const EdgeInsets.only(bottom:8),child:InfoCard(
          padding:const EdgeInsets.symmetric(horizontal:8,vertical:5),child:ListTile(
            leading:CircleAvatar(backgroundColor:e.type=='income'?const Color(0xFFEAF1EA):const Color(0xFFF5EBDF),
              child:Icon(e.type=='income'?Icons.south_west:Icons.north_east,color:e.type=='income'?forest:gold)),
            title:Text(e.category,style:const TextStyle(fontSize:14,color:ink,fontWeight:FontWeight.w700)),
            subtitle:Text('${e.date}${e.note.isEmpty?'':' · ${e.note}'}',maxLines:2,overflow:TextOverflow.ellipsis),
            trailing:Column(mainAxisAlignment:MainAxisAlignment.center,crossAxisAlignment:CrossAxisAlignment.end,children:[
              Text('${e.type=='income'?'+':'−'}${money(e.amount)}',style:TextStyle(fontWeight:FontWeight.w800,color:e.type=='income'?forest:ink)),
              if(e.personal!=null)const Icon(Icons.edit_outlined,size:14,color:muted),
            ]),
            onTap:e.personal==null?null:()=>_openEditor(context,entry:e.personal),
          )))),
      ]);
    },
  );
  Future<void> _editBudget(BuildContext context,double previous)async{
    final text=TextEditingController(text:previous.toStringAsFixed(0));
    final value=await showDialog<double>(context:context,builder:(dialog)=>AlertDialog(
      title:const Text('Monthly spending limit'),content:TextField(controller:text,autofocus:true,
        keyboardType:const TextInputType.numberWithOptions(decimal:true),
        decoration:const InputDecoration(labelText:'Budget (BDT)'),),actions:[
          TextButton(onPressed:()=>Navigator.pop(dialog),child:const Text('Cancel')),
          FilledButton(onPressed:()=>Navigator.pop(dialog,double.tryParse(text.text)),child:const Text('Save')),
        ]));
    text.dispose();
    if(value==null||value<0)return;
    try{await repo.saveBudget(value);}catch(e){if(context.mounted)showError(context,e);}
  }
  Future<void> _openEditor(BuildContext context,{FinanceEntry? entry,String initialType='expense'})async{
    await showModalBottomSheet<void>(context:context,isScrollControlled:true,showDragHandle:true,
      builder:(_)=>FinanceEditor(repo:repo,entry:entry,initialType:initialType));
  }
}

class FinanceEditor extends StatefulWidget{
  const FinanceEditor({super.key,required this.repo,this.entry,required this.initialType});
  final TutorRepository repo;
  final FinanceEntry? entry;
  final String initialType;
  @override State<FinanceEditor> createState()=>_FinanceEditorState();
}
class _FinanceEditorState extends State<FinanceEditor>{
  final form=GlobalKey<FormState>();
  late final TextEditingController amount,category,note;
  late String type;
  late DateTime date;
  bool busy=false;
  @override void initState(){super.initState();
    final e=widget.entry;
    amount=TextEditingController(text:e==null?'':e.amount.toString());
    category=TextEditingController(text:e?.category??'');note=TextEditingController(text:e?.note??'');
    type=e?.type??widget.initialType;date=DateTime.tryParse(e?.date??'')??DateTime.now();
  }
  @override void dispose(){amount.dispose();category.dispose();note.dispose();super.dispose();}
  Future<void> save()async{
    if(!form.currentState!.validate())return;
    setState(()=>busy=true);
    final e=FinanceEntry(id:widget.entry?.id??_uuid.v4(),type:type,amount:double.parse(amount.text),
      category:category.text.trim(),date:localDate(date),note:note.text.trim(),
      updatedAt:DateTime.now().millisecondsSinceEpoch);
    try{await widget.repo.saveFinance(e);if(mounted)Navigator.pop(context);}
    catch(err){if(mounted)showError(context,err);}finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context)=>Padding(
    padding:EdgeInsets.fromLTRB(20,10,20,MediaQuery.viewInsetsOf(context).bottom+28),
    child:SingleChildScrollView(child:Form(key:form,child:Column(mainAxisSize:MainAxisSize.min,
      crossAxisAlignment:CrossAxisAlignment.stretch,children:[
      Row(children:[Expanded(child:Text(widget.entry==null?'Add transaction':'Edit transaction',
        style:const TextStyle(fontSize:22,fontWeight:FontWeight.w800,color:ink))),
        if(widget.entry!=null)IconButton(onPressed:busy?null:()async{
          if(await confirmDelete(context,'Delete this personal finance transaction?')){
            try{await widget.repo.deleteFinance(widget.entry!);if(context.mounted)Navigator.pop(context);}
            catch(e){if(context.mounted)showError(context,e);}
          }
        },icon:const Icon(Icons.delete_outline))]),const SizedBox(height:14),
      SegmentedButton<String>(segments:const [ButtonSegment(value:'expense',label:Text('Expense')),
        ButtonSegment(value:'income',label:Text('Income'))],selected:{type},
        onSelectionChanged:(s)=>setState(()=>type=s.first)),
      const SizedBox(height:12),TextFormField(controller:amount,
        keyboardType:const TextInputType.numberWithOptions(decimal:true),decoration:const InputDecoration(labelText:'Amount (BDT)'),
        validator:(s)=>(double.tryParse(s??'')??0)<=0?'Enter a positive amount':null),
      const SizedBox(height:12),TextFormField(controller:category,decoration:const InputDecoration(labelText:'Category'),
        validator:(s)=>s==null||s.trim().isEmpty?'Enter a category':null),
      const SizedBox(height:12),ListTile(contentPadding:EdgeInsets.zero,title:const Text('Date'),
        subtitle:Text(localDate(date)),trailing:const Icon(Icons.calendar_month_outlined),
        onTap:()async{final d=await chooseDate(context,date);if(d!=null)setState(()=>date=d);}),
      TextFormField(controller:note,maxLines:2,decoration:const InputDecoration(labelText:'Note (optional)')),
      const SizedBox(height:18),ElevatedButton(onPressed:busy?null:save,child:Text(busy?'Saving…':'Save transaction')),
    ]))));
}
