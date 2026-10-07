import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plaivang.questbound',
  appName: 'QuestBound',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: {
      // Match the existing no-encryption database; avoid unused keystore setup.
      androidIsEncryption: false,
    },
  },
  android: {
    // Required by @capacitor-community/background-geolocation so location
    // updates keep flowing after ~5 minutes with the screen off.
    useLegacyBridge: true,
  },
};

export default config;
