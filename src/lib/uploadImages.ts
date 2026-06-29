import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Timestamp } from 'firebase/firestore';
import { storage } from './firebase';
import type { ImageAttachment } from '../types';

export async function uploadImages(inboxItemId: string, files: File[]): Promise<ImageAttachment[]> {
  return Promise.all(
    files.map(async (file) => {
      const id = crypto.randomUUID();
      const storageRef = ref(storage, `megaApp/inboxItems/${inboxItemId}/${id}-${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      return {
        id,
        url,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: Timestamp.now(),
      };
    })
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
