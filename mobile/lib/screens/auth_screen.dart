import 'package:flutter/material.dart';
import '../data/tutor_repository.dart';
import '../widgets/ui.dart';

class AuthScreen extends StatefulWidget{
  const AuthScreen({super.key});
  @override State<AuthScreen> createState()=>_AuthScreenState();
}
class _AuthScreenState extends State<AuthScreen>{
  final repo=TutorRepository();
  final _form=GlobalKey<FormState>();
  final email=TextEditingController();
  final password=TextEditingController();
  final name=TextEditingController();
  String mode='login';
  bool busy=false,obscure=true;
  @override void dispose(){email.dispose();password.dispose();name.dispose();super.dispose();}

  Future<void> submit()async{
    if(!_form.currentState!.validate())return;
    setState(()=>busy=true);
    try{
      if(mode=='register')await repo.register(email:email.text.trim(),password:password.text,name:name.text.trim());
      else if(mode=='reset'){
        await repo.resetPassword(email.text.trim());
        if(mounted){ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Password reset email sent.')));setState(()=>mode='login');}
      }else await repo.login(email.text.trim(),password.text);
    }catch(e){if(mounted)showError(context,e);}finally{if(mounted)setState(()=>busy=false);}
  }
  @override Widget build(BuildContext context){
    final register=mode=='register',reset=mode=='reset';
    return Scaffold(body:SafeArea(child:Center(child:SingleChildScrollView(
      padding:const EdgeInsets.symmetric(horizontal:24,vertical:32),
      child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:440),child:Column(
        crossAxisAlignment:CrossAxisAlignment.start,children:[
        Container(width:56,height:56,decoration:BoxDecoration(color:forest,borderRadius:BorderRadius.circular(16)),
          child:ClipRRect(borderRadius:BorderRadius.circular(16),child:Image.asset('assets/icon.png',width:56,height:56,fit:BoxFit.cover))),
        const SizedBox(height:24),
        const Text('TutorTrack',style:TextStyle(fontSize:17,fontWeight:FontWeight.w800,color:forest)),
        const SizedBox(height:20),
        Text(reset?'Reset your password':register?'Create your account':'Your teaching, in order.',
          style:const TextStyle(fontSize:31,height:1.15,fontWeight:FontWeight.w800,color:ink)),
        const SizedBox(height:12),
        Text(reset?'We will send a password reset link to your email.':register?
          'Keep class schedules, tuition and payments in one place.':'Sign in to your personal teaching workspace.',
          style:const TextStyle(color:muted,fontSize:15)),
        const SizedBox(height:30),InfoCard(padding:const EdgeInsets.all(22),child:Form(key:_form,child:Column(
          crossAxisAlignment:CrossAxisAlignment.stretch,children:[
          if(register)...[
            TextFormField(controller:name,textCapitalization:TextCapitalization.words,
              decoration:const InputDecoration(labelText:'Your name',prefixIcon:Icon(Icons.person_outline)),
              validator:(s)=>s==null||s.trim().isEmpty?'Enter your name':null),
            const SizedBox(height:14),
          ],
          TextFormField(controller:email,keyboardType:TextInputType.emailAddress,
            decoration:const InputDecoration(labelText:'Email address',prefixIcon:Icon(Icons.mail_outline)),
            validator:(s)=>s==null||!s.contains('@')?'Enter a valid email':null),
          if(!reset)...[
            const SizedBox(height:14),
            TextFormField(controller:password,obscureText:obscure,
              decoration:InputDecoration(labelText:'Password',prefixIcon:const Icon(Icons.lock_outline),
                suffixIcon:IconButton(onPressed:()=>setState(()=>obscure=!obscure),
                  icon:Icon(obscure?Icons.visibility_outlined:Icons.visibility_off_outlined))),
              validator:(s)=>s==null||s.length<6?'At least six characters':null),
          ],
          const SizedBox(height:22),ElevatedButton(onPressed:busy?null:submit,
            child:Padding(padding:const EdgeInsets.symmetric(vertical:3),child:Text(busy?'Working…':reset?'Send reset email':register?'Create account':'Sign in'))),
          if(!register&&!reset)Align(alignment:Alignment.centerRight,
            child:TextButton(onPressed:()=>setState(()=>mode='reset'),child:const Text('Forgot password?'))),
        ]))),
        const SizedBox(height:16),Align(alignment:Alignment.center,child:TextButton(
          onPressed:busy?null:()=>setState(()=>mode=register||reset?'login':'register'),
          child:Text(register||reset?'Already have an account? Sign in':'New to TutorTrack? Create an account'),
        )),
      ]))),
    )));
  }
}
