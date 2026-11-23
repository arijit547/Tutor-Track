import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../data/tutor_repository.dart';
import '../widgets/ui.dart';

class ProfileScreen extends StatelessWidget{
  const ProfileScreen({super.key,required this.tracking,required this.onToggleTracking});
  final bool tracking;
  final VoidCallback onToggleTracking;
  @override Widget build(BuildContext context){
    final repo=TutorRepository(), user=FirebaseAuth.instance.currentUser;
    return StreamBuilder<Map<String,dynamic>>(stream:repo.watchProfile(),builder:(context,snapshot){
      final profile=snapshot.data??{};
      final display=profile['displayName'] as String? ?? user?.email??'Tutor';
      return ListView(padding:const EdgeInsets.fromLTRB(16,16,16,50),children:[
        InfoCard(padding:const EdgeInsets.all(20),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
          CircleAvatar(radius:27,backgroundColor:forest,child:Text(display.isEmpty?'T':display[0].toUpperCase(),
            style:const TextStyle(fontSize:22,color:Colors.white,fontWeight:FontWeight.w700))),
          const SizedBox(height:14),Text(display,style:const TextStyle(color:ink,fontSize:23,fontWeight:FontWeight.w800)),
          const SizedBox(height:4),Text(user?.email??'',style:const TextStyle(color:muted)),
        ])),
        SectionTitle('Tutor profile'),
        InfoCard(padding:EdgeInsets.zero,child:SwitchListTile(
          secondary:const Icon(Icons.location_on_outlined,color:forest),
          title:const Text('Auto-session detection'),
          subtitle:const Text('Foreground GPS only · 150 m · 20 minutes. Always asks before logging.'),
          value:tracking,onChanged:(_)=>onToggleTracking(),
        )),const SizedBox(height:12),
        InfoCard(padding:EdgeInsets.zero,child:Column(children:[
          ListTile(leading:const Icon(Icons.person_outline,color:forest),title:const Text('Edit profile'),
            subtitle:const Text('Name, phone and bio'),trailing:const Icon(Icons.chevron_right),
            onTap:()=>Navigator.push(context,MaterialPageRoute(builder:(_)=>EditProfileScreen(profile:profile)))),
          const Divider(height:1,indent:16,endIndent:16),
          ListTile(leading:const Icon(Icons.lock_reset,color:forest),title:const Text('Password reset email'),
            subtitle:const Text('Send reset link to your registered email'),onTap:()async{
              if(user?.email==null)return;
              try{await repo.resetPassword(user!.email!);if(context.mounted){
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content:Text('Reset email sent.')));
              }}catch(e){if(context.mounted)showError(context,e);}
            }),
          const Divider(height:1,indent:16,endIndent:16),
          ListTile(leading:const Icon(Icons.cloud_done_outlined,color:forest),title:const Text('Cloud sync'),
            subtitle:const Text('Firebase Firestore offline persistence is active on mobile.')),
        ])),
        const SizedBox(height:24),OutlinedButton.icon(onPressed:()async{
          try{await repo.logout();}catch(e){if(context.mounted)showError(context,e);}
        },icon:const Icon(Icons.logout),label:const Text('Sign out')),
        const SizedBox(height:18),const Center(child:Text('TutorTrack · Mobile edition',style:TextStyle(color:muted,fontSize:12))),
      ]);
    });
  }
}

class EditProfileScreen extends StatefulWidget{
  const EditProfileScreen({super.key,required this.profile});
  final Map<String,dynamic> profile;
  @override State<EditProfileScreen> createState()=>_EditProfileScreenState();
}
class _EditProfileScreenState extends State<EditProfileScreen>{
  late final TextEditingController name,phone,bio;
  bool saving=false;
  @override void initState(){super.initState();
    name=TextEditingController(text:widget.profile['displayName'] as String? ?? '');
    phone=TextEditingController(text:widget.profile['phone'] as String? ?? '');
    bio=TextEditingController(text:widget.profile['bio'] as String? ?? '');
  }
  @override void dispose(){name.dispose();phone.dispose();bio.dispose();super.dispose();}
  Future<void> save()async{
    if(name.text.trim().isEmpty){showError(context,'Enter your name.');return;}
    setState(()=>saving=true);
    try{await TutorRepository().saveProfile({'displayName':name.text.trim(),'phone':phone.text.trim(),'bio':bio.text.trim()});
      if(mounted)Navigator.pop(context);
    }catch(e){if(mounted)showError(context,e);}finally{if(mounted)setState(()=>saving=false);}
  }
  @override Widget build(BuildContext context)=>Scaffold(appBar:AppBar(title:const Text('Edit profile')),
    body:ListView(padding:const EdgeInsets.all(18),children:[InfoCard(child:Column(children:[
      TextField(controller:name,decoration:const InputDecoration(labelText:'Display name')),
      const SizedBox(height:14),TextField(controller:phone,decoration:const InputDecoration(labelText:'Phone (optional)')),
      const SizedBox(height:14),TextField(controller:bio,maxLines:3,decoration:const InputDecoration(labelText:'Bio (optional)')),
    ])),const SizedBox(height:20),ElevatedButton(onPressed:saving?null:save,
      child:Text(saving?'Saving…':'Save profile'))]));
}
