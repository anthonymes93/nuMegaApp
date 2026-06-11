import { Timestamp } from 'firebase/firestore';

export type ContextType =
  | 'general'
  | 'personal'
  | 'business'
  | 'anthonyos'
  | 'contractor_os'
  | 'megaapp'
  | 'client'
  | 'learning'
  | 'health'
  | 'money';

export type InboxType =
  | 'unclassified'
  | 'idea'
  | 'task'
  | 'resource'
  | 'decision'
  | 'experiment'
  | 'goal'
  | 'venture_note'
  | 'relationship';

export type Urgency = 'low' | 'medium' | 'high';

export interface InboxItem {
  id: string;
  title: string;
  body: string;
  rawInput?: string;
  type: InboxType;
  possibleType?: InboxType;
  confidence?: 'low' | 'medium' | 'high';
  tags?: string[];
  contextType: ContextType;
  contextId?: string;
  status: 'captured' | 'reviewed' | 'converted' | 'archived';
  urgency: Urgency;
  nextMove?: string;
  source?: string;
  processedAt?: Timestamp;
  convertedTo?: { type: string; id: string };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type IdeaStatus = 'raw' | 'thinking' | 'testing' | 'launching' | 'parked' | 'archived';

export interface Idea {
  id: string;
  title: string;
  description: string;
  contextType: ContextType;
  status: IdeaStatus;
  potential: 'low' | 'medium' | 'high';
  nextMove?: string;
  relatedVentureId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type VentureStatus = 'seed' | 'active' | 'paused' | 'validating' | 'launched' | 'archived';

export interface Venture {
  id: string;
  name: string;
  description: string;
  status: VentureStatus;
  category: 'software' | 'service' | 'content' | 'contractor' | 'personal' | 'other';
  currentFocus?: string;
  nextMove?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type GoalHorizon = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'life';

export interface Goal {
  id: string;
  title: string;
  description: string;
  horizon: GoalHorizon;
  status: 'active' | 'paused' | 'completed' | 'archived';
  relatedVentureId?: string;
  nextMove?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type TaskStatus = 'todo' | 'doing' | 'done' | 'archived';
export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: TaskStatus;
  priority: Priority;
  dueAt?: Timestamp;
  relatedType?: 'idea' | 'venture' | 'goal' | 'resource' | 'decision' | 'experiment';
  relatedId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ResourceType = 'article' | 'video' | 'course' | 'tool' | 'book' | 'prompt' | 'doc' | 'other';

export interface Resource {
  id: string;
  title: string;
  url?: string;
  notes?: string;
  resourceType: ResourceType;
  status: 'saved' | 'studying' | 'applied' | 'archived';
  contextType: ContextType;
  nextMove?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Decision {
  id: string;
  title: string;
  decision: string;
  reasoning?: string;
  contextType: ContextType;
  relatedType?: string;
  relatedId?: string;
  status: 'active' | 'reversed' | 'archived';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ExperimentStatus = 'idea' | 'running' | 'completed' | 'abandoned';

export interface Experiment {
  id: string;
  title: string;
  hypothesis: string;
  status: ExperimentStatus;
  result?: string;
  relatedVentureId?: string;
  nextMove?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Relationship {
  id: string;
  name: string;
  role?: string;
  notes?: string;
  nextAction?: string;
  relatedVentureId?: string;
  tags?: string[];
  sourceInboxId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
