#!/usr/bin/env python3
"""Configure the Android-only Flutter build from Firebase's google-services.json.

No service-account credentials or Firebase Admin SDK required. The generated
FirebaseOptions file is a Firebase *client* configuration, not a secret key.
"""
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

EXPECTED_PACKAGE = 'com.arijit547.tutortrack_mobile'
ANDROID_NAMESPACE = 'http://schemas.android.com/apk/res/android'


def generate_options(google_json: Path, dart_file: Path):
    config = json.loads(google_json.read_text(encoding='utf-8'))
    project_info = config['project_info']
    clients = [c for c in config['client'] if c.get('client_info', {}).get('android_client_info', {}).get('package_name') == EXPECTED_PACKAGE]
    if len(clients) != 1:
        raise SystemExit(f'Firebase config must contain exactly one Android app for {EXPECTED_PACKAGE}. Found {len(clients)}. Add that Android app in the SAME Firebase project as your website and download its google-services.json.')
    client = clients[0]
    keys = client.get('api_key', [])
    if not keys:
        raise SystemExit('Firebase google-services.json lacks api_key[0].current_key')
    values = {
        'apiKey': keys[0]['current_key'],
        'appId': client['client_info']['mobilesdk_app_id'],
        'messagingSenderId': project_info['project_number'],
        'projectId': project_info['project_id'],
    }
    if project_info.get('storage_bucket'):
        values['storageBucket'] = project_info['storage_bucket']
    fields = ''.join(f'    {name}: {json.dumps(value)},\n' for name, value in values.items())
    output = ('// GENERATED DURING CI from Firebase Android client configuration.\n'
              '// Do not hand-edit. Do not put Firebase service-account keys here.\n'
              "import 'package:firebase_core/firebase_core.dart';\n\n"
              'class DefaultFirebaseOptions {\n'
              '  static const FirebaseOptions currentPlatform = FirebaseOptions(\n'
              + fields + '  );\n}\n')
    # string generation uses escaped newlines; turn them into real newlines
    output = output.replace('\\n', '\n')
    dart_file.write_text(output, encoding='utf-8')


def configure_manifest(manifest_file: Path):
    ET.register_namespace('android', ANDROID_NAMESPACE)
    tree = ET.parse(manifest_file)
    root = tree.getroot()
    attr = f'{{{ANDROID_NAMESPACE}}}name'
    existing = {node.attrib.get(attr) for node in root.findall('uses-permission')}
    for perm in ('android.permission.INTERNET',
                 'android.permission.ACCESS_COARSE_LOCATION',
                 'android.permission.ACCESS_FINE_LOCATION'):
        if perm not in existing:
            permission = ET.Element('uses-permission', {attr: perm})
            root.insert(0, permission)
    tree.write(manifest_file, encoding='utf-8', xml_declaration=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit('usage: python3 tool/configure_android.py android/app/google-services.json')
    google_json = Path(sys.argv[1]);
    if not google_json.is_file():
        raise SystemExit(f'Missing file: {google_json}')
    generate_options(google_json, Path('lib/firebase_options.dart'))
    configure_manifest(Path('android/app/src/main/AndroidManifest.xml'))
    print('Firebase client options and Android manifest configured.')

if __name__ == '__main__':
    main()
