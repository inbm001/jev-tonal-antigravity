---
name: jev-rag-grounding
description: >-
  Pattern and workflow for injecting domain-specific RAG (Retrieval-Augmented Generation)
  corpus statistics, N-gram transition frequencies, and real-world reference examples
  directly into TypeSafe AI's Jev (`@typesafe-ai/sdk`) `systemOne` `state` and `choice`
  `criteria`. Use this skill whenever building or enhancing decision engines with Jev AI
  so that Jev's probability distribution (`probabilities`) is grounded in empirical data
  and domain rules rather than generic pre-trained priors.
---

# Jev RAG Grounding Skill (`@typesafe-ai/sdk`)

TypeSafe AI's **Jev (`jev-latest`)** is a "System One" single-forward-pass evaluator (`choice`, `score`, `noul`). Unlike generative LLMs, Jev computes logits by cross-attending between `state` (the current context) and `criteria` (the dictionary of candidate options).

If you pass bare labels in `criteria` (e.g. `{ Dm9: null, G13: null }`), Jev relies solely on generic pre-trained priors and converges on repetitive clichés. By **injecting retrieved corpus statistics (RAG) and domain rules directly into each candidate's `criteria` object**, Jev's probability output becomes empirically grounded and explainable.

---

## Architecture: 3-Step Jev RAG Pipeline

1. **Corpus Indexing (Offline / Pre-computation)**
   - Normalize raw domain data (e.g., `chords.jsonl` progression dataset, logs, or historical decisions) into relative states (such as key-normalized 2-gram and 3-gram transitions).
   - Store empirical counts (`count`) and real reference exemplars (`songs` / `sources`).

2. **Candidate Generation + RAG Retrieval (Runtime Stage 1~3)**
   - Generate legal domain candidates (e.g., via `Tonal.js`).
   - Query the N-gram / vector index for the current state history.
   - Inject top corpus-backed candidates that might not be in the naive rule set, and attach `corpusCount` + `referenceSources` to each candidate.

3. **Criteria-Grounded `client.systemOne` Call (Runtime Stage 4)**
   - Populate each key of `choice(instructions, criteria)` with a structured JSON object combining:
     - **Analytical Rules** (e.g. voice-leading smoothness, functional harmony rule)
     - **RAG Evidence** (`corpusMatchCount`, `corpusRank`, `realWorldExamples`)
     - **Diversity / Anti-Repetition Signal** (`recentUsageCount`)

---

## Reference Implementation Pattern (TypeScript)

```typescript
import { TypeSafeClient, choice, noul, score, type ChoiceCriteria } from "@typesafe-ai/sdk";

export async function decideWithJevRAG(params: {
  apiKey: string;
  currentStateSummary: Record<string, unknown>;
  candidates: Array<{
    id: string;
    domainRule: string;
    analyticalScore: number;
    // RAG fields retrieved from local corpus index:
    corpusCount: number;
    referenceExamples: string[];
  }>;
}) {
  const client = new TypeSafeClient({
    apiKey: params.apiKey,
    compression: false,
  });

  // Ground each candidate option with both analytical metrics and retrieved RAG evidence
  const groundedCriteria: ChoiceCriteria = {};
  for (const c of params.candidates) {
    groundedCriteria[c.id] = {
      domainRule: c.domainRule,
      analyticalScore0to100: c.analyticalScore,
      ragCorpusEvidence:
        c.corpusCount > 0
          ? `Observed ${c.corpusCount} times in the verified corpus`
          : "Rule-based candidate (no exact corpus match)",
      referenceExamples:
        c.referenceExamples.length > 0
          ? c.referenceExamples.join(" | ")
          : "none",
    };
  }

  const response = await client.systemOne({
    model: "jev-latest",
    state: params.currentStateSummary,
    questions: {
      bestOption: choice(
        "Select the optimal next option by weighing domain rules, analytical score, and retrieved RAG corpus evidence.",
        groundedCriteria
      ),
    },
  });

  return {
    selected: response.answers.bestOption.choice,
    confidence: response.answers.bestOption.confidence,
    probabilities: response.answers.bestOption.probabilities,
    usage: response.usage,
  };
}
```
