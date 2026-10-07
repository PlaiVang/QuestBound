import { Capacitor, registerPlugin } from '@capacitor/core';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';
import type { RawFix } from '../lib/geo';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');

export interface PositionSource {
  start(onFix: (fix: RawFix) => void, onError: (message: string) => void): Promise<void>;
  stop(): Promise<void>;
}

class NativeSource implements PositionSource {
  private watcherId: string | null = null;

  async start(onFix: (fix: RawFix) => void, onError: (message: string) => void) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        onError('Notifications are disabled. Android may hide the tracking notification; enable notifications in app settings.');
      }
    } catch (e) {
      console.warn('Could not request notification permission', e);
      onError('Could not request notification permission. Check app permissions; the tracking notification may be hidden.');
    }
    this.watcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundTitle: 'QuestBound run in progress',
        backgroundMessage: 'Your hero is on the move. Tracking your route.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 0,
      },
      (location, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            onError('Location permission is required. Allow precise location in Android Settings, then restart this run.');
          } else {
            onError(error.message);
          }
          return;
        }
        if (location) {
          onFix({
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            altitude: location.altitude,
            time: location.time ?? Date.now(),
          });
        }
      },
    );
  }

  async stop() {
    if (this.watcherId) await BackgroundGeolocation.removeWatcher({ id: this.watcherId });
    this.watcherId = null;
  }
}

class WebSource implements PositionSource {
  private watchId: number | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  async start(onFix: (fix: RawFix) => void, onError: (message: string) => void) {
    if (!window.isSecureContext) {
      onError('GPS needs a secure (https) connection. On a phone, open the https:// address shown by "npm run phone".');
      return;
    }
    if (!('geolocation' in navigator)) {
      onError('GPS is not available on this device.');
      return;
    }
    try {
      this.wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      // Not critical.
    }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) =>
        onFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          time: pos.timestamp,
        }),
      (err) =>
        onError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied. Allow location for this site in your browser settings, then try again.'
            : err.message || 'Unable to get location.',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 },
    );
  }

  async stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    await this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }
}

export const createPositionSource = (): PositionSource =>
  Capacitor.isNativePlatform() ? new NativeSource() : new WebSource();
