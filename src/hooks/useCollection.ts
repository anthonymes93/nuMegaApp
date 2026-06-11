import { useState, useEffect } from 'react';
import { QueryConstraint } from 'firebase/firestore';
import { subscribeToCollection, addDocument, updateDocument, deleteDocument } from '../lib/firestore';

export function useCollection<T>(collectionName: string, constraints: QueryConstraint[] = []) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToCollection<T>(collectionName, (data) => {
      setItems(data);
      setLoading(false);
    }, constraints);
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName]);

  const add = (data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>) =>
    addDocument(collectionName, data);

  const update = (id: string, data: Partial<T>) =>
    updateDocument(collectionName, id, data);

  const remove = (id: string) =>
    deleteDocument(collectionName, id);

  return { items, loading, add, update, remove };
}
