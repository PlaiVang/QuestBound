import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plaivang.questbound',
  appName: 'QuestBound',
  webDir: 'dist',
  android: {
    // Required by @capacitor-community/background-geolocation so location
    // updates keep flowing after ~5 minutes with the screen off.
    useLegacyBridge: true,
  },
};

export default config;
