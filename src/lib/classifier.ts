import type { InboxType } from '../types';

export interface Classification {
  possibleType: InboxType;
  confidence: 'low' | 'medium' | 'high';
  tags: string[];
}

type ClassifiableType = Exclude<InboxType, 'unclassified'>;

const SIGNALS: Record<ClassifiableType, RegExp[]> = {
  task: [
    /\b(call|email|text|message|dm|slack|ping)\s+\w/i,
    /\b(schedule|book|arrange|set\s+up)\s+(a\s+)?(meeting|call|sync|chat)/i,
    /\b(buy|purchase|order|pick\s+up|grab)\s/i,
    /\b(fix|repair|debug|install|update|upgrade)\s/i,
    /\b(send|submit|upload|post|publish|file|deliver)\s/i,
    /\b(finish|complete|wrap\s+up|close\s+out)\s/i,
    /\b(remind\s+(me|us)|don't\s+forget|follow\s+up\s+with)\b/i,
    /\btomorrow\b/i,
    /\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod|eow)\b/i,
  ],
  relationship: [
    /\b[A-Z][a-z]+\s+knows\b/,
    /\b[A-Z][a-z]+\s+is\s+(a|an|the)\s/,
    /\b[A-Z][a-z]+\s+(can|does|works\s+at|works\s+for)\b/,
    /\b(met|talked\s+to|spoke\s+with|connected\s+with|introduced\s+to)\s+[A-Z]/,
    /\bknows\s+(a\s+|some\s+|the\s+)?(contractor|developer|designer|lawyer|accountant|agent|realtor|investor|builder|plumber|electrician)\b/i,
  ],
  goal: [
    /\b(want\s+to|need\s+to|plan\s+to|going\s+to|aim\s+to)\s+(buy|own|build|become|start|launch|create|achieve|reach|earn|make)\b/i,
    /\b(goal:|target:|milestone:|aim:)\s/i,
    /\bbuy\s+(a|my|our)\s+(house|car|property|home|place)\b/i,
    /\bby\s+(january|february|march|april|may|june|july|august|september|october|november|december|q[1-4]|next\s+year|end\s+of\s+year)\b/i,
    /\b(eventually|someday|long[- ]term|life\s+goal)\b/i,
  ],
  idea: [
    /\bshould\s+(sell|build|create|launch|offer|add|include|support|make)\b/i,
    /\bcould\s+(sell|build|create|offer|add|make)\b/i,
    /\b(what\s+if|imagine\s+if)\b/i,
    /\b(idea:|concept:|feature:|product\s+idea|business\s+idea)\b/i,
    /\bwould\s+be\s+(good|great|cool|interesting|useful|valuable|powerful)\b/i,
    /\b(we\s+should|they\s+should)\b/i,
  ],
  resource: [
    /\b(read|watch|listen\s+to|study)\s/i,
    /\b(article|book|course|video|podcast|tutorial|guide|docs?)\b/i,
    /https?:\/\//,
    /\.(com|org|net|io|co|dev|app)\b/,
    /\b(research|look\s+into|check\s+out|investigate)\s/i,
  ],
  decision: [
    /\b(decided|going\s+with|choosing|locked\s+in|committed\s+to)\b/i,
    /\bvs\.?\s/i,
    /\binstead\s+of\b/i,
    /^(use|using|going\s+with|picking|chose)\s/i,
  ],
  experiment: [
    /\b(test|testing|trying|piloting)\s/i,
    /\b(hypothesis:|see\s+if|check\s+if|validate\s+(whether|if))\b/i,
    /\b(a\/b|split\s+test|prototype|proof\s+of\s+concept|poc)\b/i,
  ],
  venture_note: [
    /\b(startup|new\s+venture|business\s+(plan|idea|model))\b/i,
    /\b(mrr|arr|funding|raise|investor|equity)\b/i,
    /\b(go[\s-]to[\s-]market|product[\s-]market[\s-]fit|gtm|mvp)\b/i,
  ],
};

const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'have', 'will', 'what', 'when', 'where',
  'there', 'their', 'about', 'would', 'could', 'should', 'them', 'they',
  'some', 'into', 'been', 'just', 'more', 'also', 'over', 'very',
]);

const FALLBACK: Classification = { possibleType: 'unclassified', confidence: 'low', tags: [] };

function extractTags(text: string): string[] {
  try {
    return text
      .slice(0, 500)
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.toLowerCase())
      .filter((w) => w.length > 3 && !STOP_WORDS.has(w))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export function classify(rawInput: string): Classification {
  try {
    const text = rawInput.trim();
    if (!text) return FALLBACK;

    // Cap to 2000 chars for regex safety on pathological inputs
    const safeText = text.slice(0, 2000);
    const scores: Partial<Record<ClassifiableType, number>> = {};

    for (const [type, patterns] of Object.entries(SIGNALS) as [ClassifiableType, RegExp[]][]) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(safeText)) score++;
      }
      if (score > 0) scores[type] = score;
    }

    const entries = Object.entries(scores) as [ClassifiableType, number][];
    if (entries.length === 0) {
      return { possibleType: 'unclassified', confidence: 'low', tags: extractTags(safeText) };
    }

    entries.sort((a, b) => b[1] - a[1]);
    const [winner, winnerScore] = entries[0];

    const confidence: Classification['confidence'] =
      winnerScore >= 3 ? 'high' : winnerScore >= 2 ? 'medium' : 'low';

    return { possibleType: winner, confidence, tags: extractTags(safeText) };
  } catch {
    return FALLBACK;
  }
}
