import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export async function exportJson(value: unknown, filename: string, title: string) {
  const json = JSON.stringify(value, null, 2);
  if (Capacitor.isNativePlatform()) {
    const res = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title, url: res.uri });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
    } finally { URL.revokeObjectURL(url); }
  }
}
