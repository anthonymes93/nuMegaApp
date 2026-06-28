import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  type QueryConstraint,
  type DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';

export const COLLECTIONS = {
  INBOX: 'megaInboxItems',
  IDEAS: 'megaIdeas',
  VENTURES: 'megaVentures',
  GOALS: 'megaGoals',
  TASKS: 'megaTasks',
  RESOURCES: 'megaResources',
  DECISIONS: 'megaDecisions',
  EXPERIMENTS: 'megaExperiments',
  RELATIONSHIPS: 'megaRelationships',
} as const;

function removeUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as T;
}

export async function addDocument(collectionName: string, data: DocumentData) {
  const ref = collection(db, collectionName);
  return addDoc(ref, {
    ...removeUndefined(data),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocument(collectionName: string, id: string, data: Partial<DocumentData>) {
  const ref = doc(db, collectionName, id);
  return updateDoc(ref, {
    ...removeUndefined(data),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteDocument(collectionName: string, id: string) {
  const ref = doc(db, collectionName, id);
  return deleteDoc(ref);
}

export function subscribeToCollection<T>(
  collectionName: string,
  callback: (items: T[]) => void,
  constraints: QueryConstraint[] = []
) {
  const ref = collection(db, collectionName);
  const q = query(ref, ...constraints, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
    callback(items);
  });
}
