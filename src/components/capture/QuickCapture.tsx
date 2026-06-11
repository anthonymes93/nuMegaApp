import { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { FormField, FormRow, Input, Textarea, Select, FormActions, Btn } from '../ui/FormField';
import { useCollection } from '../../hooks/useCollection';
import { COLLECTIONS } from '../../lib/firestore';
import type { InboxItem, InboxType, ContextType, Urgency } from '../../types';
import styles from './QuickCapture.module.css';

const defaultForm = {
  title: '',
  body: '',
  type: 'unclassified' as InboxType,
  contextType: 'general' as ContextType,
  urgency: 'low' as Urgency,
  nextMove: '',
  source: '',
};

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const { add } = useCollection<InboxItem>(COLLECTIONS.INBOX);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const set = (k: keyof typeof defaultForm, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    await add({
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type,
      contextType: form.contextType,
      status: 'captured',
      urgency: form.urgency,
      nextMove: form.nextMove.trim() || undefined,
      source: form.source.trim() || undefined,
    } as Omit<InboxItem, 'id' | 'createdAt' | 'updatedAt'>);
    setForm(defaultForm);
    setSaving(false);
    setOpen(false);
  }

  return (
    <>
      <button className={styles.trigger} onClick={() => setOpen(true)}>
        <span className={styles.triggerPlus}>+</span>
        <span className={styles.triggerText}>Capture…</span>
        <span className={styles.triggerKbd}>⌘K</span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Capture">
        <div className={styles.form}>
          <FormField label="Title" required>
            <Input
              autoFocus
              placeholder="What needs to be captured?"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleSave(); }}
            />
          </FormField>
          <FormField label="Notes">
            <Textarea
              placeholder="Context, URL, or details…"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
            />
          </FormField>
          <FormRow>
            <FormField label="Type">
              <Select value={form.type} onChange={(e) => set('type', e.target.value)}>
                <option value="unclassified">Unclassified</option>
                <option value="idea">Idea</option>
                <option value="task">Task</option>
                <option value="resource">Resource</option>
                <option value="decision">Decision</option>
                <option value="experiment">Experiment</option>
                <option value="goal">Goal</option>
                <option value="venture_note">Venture Note</option>
              </Select>
            </FormField>
            <FormField label="Urgency">
              <Select value={form.urgency} onChange={(e) => set('urgency', e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </FormField>
          </FormRow>
          <FormRow>
            <FormField label="Context">
              <Select value={form.contextType} onChange={(e) => set('contextType', e.target.value)}>
                <option value="general">General</option>
                <option value="personal">Personal</option>
                <option value="business">Business</option>
                <option value="anthonyos">AnthonyOS</option>
                <option value="contractor_os">Contractor OS</option>
                <option value="megaapp">MegaApp</option>
                <option value="client">Client</option>
                <option value="learning">Learning</option>
                <option value="health">Health</option>
                <option value="money">Money</option>
              </Select>
            </FormField>
            <FormField label="Source">
              <Input
                placeholder="Origin"
                value={form.source}
                onChange={(e) => set('source', e.target.value)}
              />
            </FormField>
          </FormRow>
          <FormField label="Next Move">
            <Input
              placeholder="Immediate next step"
              value={form.nextMove}
              onChange={(e) => set('nextMove', e.target.value)}
            />
          </FormField>
          <FormActions>
            <Btn variant="secondary" onClick={() => setOpen(false)}>Cancel</Btn>
            <Btn onClick={handleSave} disabled={!form.title.trim() || saving}>
              {saving ? 'Saving…' : 'Capture'}
            </Btn>
          </FormActions>
        </div>
      </Modal>
    </>
  );
}
