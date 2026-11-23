import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

const ink=Color(0xFF293C30);
const forest=Color(0xFF285944);
const muted=Color(0xFF708277);
const paper=Color(0xFFF7F8F4);
const line=Color(0xFFE2E8E0);
const gold=Color(0xFFAA7E37);

String money(num amount)=>'৳${NumberFormat('#,##0.##','en').format(amount)}';

ThemeData tutorTheme(){
  final scheme=ColorScheme.fromSeed(seedColor:forest,primary:forest,
    surface:Colors.white,brightness:Brightness.light);
  return ThemeData(useMaterial3:true,colorScheme:scheme,scaffoldBackgroundColor:paper,
    appBarTheme:const AppBarTheme(backgroundColor:paper,foregroundColor:ink,centerTitle:false,
      elevation:0,scrolledUnderElevation:0),
    cardTheme:CardThemeData(color:Colors.white,elevation:0,margin:EdgeInsets.zero,
      shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(18),side:const BorderSide(color:line))),
    inputDecorationTheme:InputDecorationTheme(filled:true,fillColor:Colors.white,
      contentPadding:const EdgeInsets.symmetric(horizontal:14,vertical:15),
      border:OutlineInputBorder(borderRadius:BorderRadius.circular(12),borderSide:const BorderSide(color:line)),
      enabledBorder:OutlineInputBorder(borderRadius:BorderRadius.circular(12),borderSide:const BorderSide(color:line))),
    elevatedButtonTheme:ElevatedButtonThemeData(style:ElevatedButton.styleFrom(
      backgroundColor:forest,foregroundColor:Colors.white,padding:const EdgeInsets.symmetric(horizontal:22,vertical:16),
      shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(12)))),
    outlinedButtonTheme:OutlinedButtonThemeData(style:OutlinedButton.styleFrom(
      foregroundColor:forest,side:const BorderSide(color:line),
      shape:RoundedRectangleBorder(borderRadius:BorderRadius.circular(12)))),
    dividerColor:line,
  );
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title,{super.key,this.trailing,this.subtitle});
  final String title;
  final Widget? trailing;
  final String? subtitle;
  @override Widget build(BuildContext context)=>Padding(
    padding:const EdgeInsets.symmetric(vertical:12),
    child:Row(children:[Expanded(child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      Text(title,style:const TextStyle(fontSize:21,fontWeight:FontWeight.w700,color:ink)),
      if(subtitle!=null)Text(subtitle!,style:const TextStyle(color:muted,fontSize:12)),
    ])),if(trailing!=null)trailing!]),
  );
}

class InfoCard extends StatelessWidget{
  const InfoCard({super.key,required this.child,this.padding=const EdgeInsets.all(16)});
  final Widget child;
  final EdgeInsetsGeometry padding;
  @override Widget build(BuildContext context)=>Card(child:Padding(padding:padding,child:child));
}

class AmountStat extends StatelessWidget {
  const AmountStat({super.key,required this.label,required this.value,this.icon});
  final String label,value;
  final IconData? icon;
  @override Widget build(BuildContext context)=>InfoCard(child:Column(
    crossAxisAlignment:CrossAxisAlignment.start,mainAxisAlignment:MainAxisAlignment.center,children:[
    Row(children:[if(icon!=null)Icon(icon,size:17,color:muted),if(icon!=null)const SizedBox(width:5),
      Expanded(child:Text(label,style:const TextStyle(color:muted,fontSize:12),maxLines:2))]),
    const SizedBox(height:12),FittedBox(fit:BoxFit.scaleDown,alignment:Alignment.centerLeft,
      child:Text(value,style:const TextStyle(color:ink,fontWeight:FontWeight.w800,fontSize:25))),
  ]));
}

Future<bool> confirmDelete(BuildContext context,String description)async => await showDialog<bool>(context:context,
  builder:(context)=>AlertDialog(title:const Text('Delete record?'),content:Text(description),actions:[
    TextButton(onPressed:()=>Navigator.pop(context,false),child:const Text('Cancel')),
    TextButton(onPressed:()=>Navigator.pop(context,true),child:const Text('Delete')),
  ]))??false;

void showError(BuildContext context,Object error){
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content:Text(error.toString())));
}

Future<DateTime?> chooseDate(BuildContext context,DateTime current)=>showDatePicker(context:context,
  initialDate:current,firstDate:DateTime(2010),lastDate:DateTime(2100));
