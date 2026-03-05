import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arijit.tutortrack.app',
  appName: 'Tutor Track',
  webDir: 'dist',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    App: {
      androidStatusBarStyle: 'dark',
    },
  },
};

export default config;
