import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mydigitalholidays.app',
  appName: 'My Holidays',
  webDir: 'dist/public',

  // -------------------------------------------------------------------------
  // iOS-specific configuration
  // -------------------------------------------------------------------------
  ios: {
    // Allow the WKWebView to scroll; the app manages its own scroll areas
    scrollEnabled: true,
    // Prevents white flash on launch
    backgroundColor: '#F9F4EE',
    // Allow inline media playback (used for wardrobe image previews)
    allowsInlineMediaPlayback: true,

    // iOS privacy-usage strings — all three are required for the camera +
    // photo-library flow.  Missing any one causes a TCC SIGABRT crash or a
    // silent refusal to open the picker.
    infoPlist: {
      NSCameraUsageDescription:
        'My Holidays uses your camera to photograph clothing and accessories for your wardrobe.',
      NSPhotoLibraryUsageDescription:
        'My Holidays reads your photo library so you can add existing photos to your wardrobe.',
      NSPhotoLibraryAddUsageDescription:
        'My Holidays saves photos you take with the camera back to your photo library.',
    },
  },

  plugins: {
    // Keep the splash screen visible until the React app signals it is ready
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: '#F9F4EE',
      iosSpinnerStyle: 'small',
      showSpinner: false,
    },

    // Overlay the status bar so the cream background shows through the notch
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F9F4EE',
      overlaysWebView: true,
    },
  },
};

export default config;
