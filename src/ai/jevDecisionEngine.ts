import { TypeSafeClient, choice, noul, score, type ChoiceCriteria } from "@typesafe-ai/sdk";
import {
  MOOD_PRESETS,
  type ChordCandidate,
  type KeyMode,
  type MoodPreset,
  type ProgressionStep,
} from "../theory/harmonyEngine";

export interface TokenUsageStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface JevDecisionResult {
  engineMode: "jev-live" | "theory-fallback";
  modelName: string;
  topChoiceSymbol: string;
  topChoiceConfidence: number;
  colorfulChoiceSymbol: string;
  cadenceNeedProbability: number; // from Jev `noul` (0..1)
  expectedTensionScore: number; // from Jev `score` (0..4)
  tensionProbabilities: number[]; // length 5 for rubric 0..4
  rankedCandidates: ChordCandidate[]; // sorted by probability descending
  usage: TokenUsageStats;
  rawRequestPreview: {
    state: Record<string, unknown>;
    questionsSummary: string[];
  };
  latencyMs: number;
  apiError?: string;
}

export interface ChatTurnResult {
  replyText: string;
  detectedIntent:
    | "recommend_next"
    | "auto_generate_bars"
    | "explain_theory"
    | "change_mood_style"
    | "resolve_cadence";
  suggestedChord?: ChordCandidate;
  suggestedMoodId?: string;
  barsToGenerate?: number;
  usage: TokenUsageStats;
  decision?: JevDecisionResult;
}

/**
 * Build the structured state payload and criteria map sent to Jev System One (`client.systemOne`)
 */
export function buildJevPayload(params: {
  keyTonic: string;
  keyMode: KeyMode;
  mood: MoodPreset;
  customPrompt: string;
  progression: ProgressionStep[];
  candidates: ChordCandidate[];
  targetTotalBars: number;
}) {
  const {
    keyTonic,
    keyMode,
    mood,
    customPrompt,
    progression,
    candidates,
    targetTotalBars,
  } = params;

  const nextBarNumber = progression.length + 1;
  const isPhraseEnd = nextBarNumber % 4 === 0 || nextBarNumber === targetTotalBars;

  const state = {
    musicalKey: `${keyTonic} ${keyMode}`,
    nextBarPosition: `${nextBarNumber} of ${targetTotalBars}${isPhraseEnd ? " (Phrase Cadence Position)" : ""}`,
    stylePreset: {
      name: mood.name,
      guidance: mood.promptHint,
      targetTensionFrom0To4: mood.targetTension,
    },
    userDirection:
      customPrompt.trim() ||
      "Follow the style preset naturally with musical voice leading.",
    progressionSoFar:
      progression.length === 0
        ? "Empty (Choosing the opening chord of Bar 1)"
        : progression.map((step, i) => ({
            bar: i + 1,
            chord: step.symbol,
            roman: step.roman,
            function: step.harmonicFunction,
          })),
    previousChord:
      progression.length > 0
        ? {
            symbol: progression[progression.length - 1].symbol,
            roman: progression[progression.length - 1].roman,
            function: progression[progression.length - 1].harmonicFunction,
            voicing: progression[progression.length - 1].voicingNotes.join(" "),
          }
        : null,
  };

  const chordCriteria: ChoiceCriteria = {};
  for (const c of candidates) {
    chordCriteria[c.symbol] = {
      romanNumeral: c.roman,
      category: c.category,
      harmonicFunction: c.harmonicFunction,
      emotionDirection: c.emotionLabel,
      tensionLevel0to4: c.tensionLevel,
      musicTheoryRule: c.theoryRuleTitle,
      explanation: c.theoryReason,
      voiceLeadingSmoothness0to100: c.voiceLeading.smoothnessScore,
      commonTonesWithPrev: c.voiceLeading.commonTones.join(", ") || "none",
      halfStepGuideToneMoves:
        c.voiceLeading.halfStepResolutions.join(", ") || "none",
      ragNeoSoulCorpusCount:
        c.corpusCount > 0
          ? `Observed ${c.corpusCount} times in the 857-song Neo-Soul corpus`
          : "Rule-based candidate",
      ragReferenceSongs:
        c.corpusSongs.length > 0
          ? c.corpusSongs.map((s) => s.title).join(" | ")
          : "none",
    };
  }

  return { state, chordCriteria, isPhraseEnd };
}

/**
 * Compute music-theory & mood-aware softmax probabilities when running in local mode
 */
function computeTheorySoftmaxDecision(params: {
  keyTonic: string;
  keyMode: KeyMode;
  mood: MoodPreset;
  customPrompt: string;
  progression: ProgressionStep[];
  candidates: ChordCandidate[];
  targetTotalBars: number;
  startTime: number;
  apiError?: string;
}): JevDecisionResult {
  const {
    mood,
    customPrompt,
    progression,
    candidates,
    startTime,
    apiError,
  } = params;

  const { state, isPhraseEnd } = buildJevPayload(params);
  const promptLower = customPrompt.toLowerCase();

  const logits = candidates.map((c) => {
    let scoreVal = c.baseTheoryWeight / 18;

    const catMult = mood.preferredCategories[c.category] ?? 1.0;
    const funcMult = mood.preferredFunctions[c.harmonicFunction] ?? 1.0;
    scoreVal *= catMult * 0.55 + funcMult * 0.45;

    const tensionDiff = Math.abs(c.tensionLevel - mood.targetTension);
    scoreVal -= tensionDiff * 0.35;

    if (isPhraseEnd) {
      if (c.harmonicFunction === "Dominant" || c.harmonicFunction === "Tonic") {
        scoreVal += 0.65;
      }
    }

    if (
      (promptLower.includes("재즈") ||
        promptLower.includes("jazz") ||
        promptLower.includes("대리") ||
        promptLower.includes("반음")) &&
      (c.category === "tritone_sub" || c.category === "secondary_dominant")
    ) {
      scoreVal += 0.9;
    }
    if (
      (promptLower.includes("슬픈") ||
        promptLower.includes("애절") ||
        promptLower.includes("감성") ||
        promptLower.includes("차용") ||
        promptLower.includes("마이너") ||
        promptLower.includes("어둡")) &&
      (c.category === "modal_interchange" ||
        c.roman.includes("vi") ||
        c.roman.includes("iv"))
    ) {
      scoreVal += 0.85;
    }
    if (
      (promptLower.includes("안정") ||
        promptLower.includes("종지") ||
        promptLower.includes("해결") ||
        promptLower.includes("끝")) &&
      c.harmonicFunction === "Tonic"
    ) {
      scoreVal += 1.0;
    }

    return scoreVal;
  });

  const maxLogit = Math.max(...logits, 0);
  const exps = logits.map((l) => Math.exp(l - maxLogit));
  const sumExp = exps.reduce((a, b) => a + b, 0) || 1;
  const probs = exps.map((e) => e / sumExp);

  const rankedCandidates = candidates
    .map((c, idx) => ({
      ...c,
      jevProbability: probs[idx],
    }))
    .sort((a, b) => (b.jevProbability ?? 0) - (a.jevProbability ?? 0));

  const topChoice = rankedCandidates[0];
  const colorfulCandidates = rankedCandidates.filter(
    (c) => c.category !== "diatonic" && c.symbol !== topChoice?.symbol
  );
  const colorfulChoice =
    colorfulCandidates[0] || rankedCandidates[1] || topChoice;

  const prevStep = progression[progression.length - 1];
  const prevIsDominant =
    prevStep?.harmonicFunction === "Dominant" ||
    prevStep?.harmonicFunction === "Secondary Dominant" ||
    prevStep?.harmonicFunction === "Tritone Sub";
  const cadenceNeedProbability = prevIsDominant
    ? 0.84
    : isPhraseEnd
      ? 0.72
      : 0.28;

  const tensionProbabilities = [0, 1, 2, 3, 4].map((lvl) => {
    const d = Math.abs(lvl - mood.targetTension);
    return Math.exp(-d * 1.1);
  });
  const tSum = tensionProbabilities.reduce((a, b) => a + b, 0) || 1;
  const normTensionProbs = tensionProbabilities.map((p) => p / tSum);
  const expectedTensionScore = normTensionProbs.reduce(
    (acc, p, idx) => acc + p * idx,
    0
  );

  return {
    engineMode: "theory-fallback",
    modelName: "Tonal.js + Jev-Style Probabilistic Simulator",
    topChoiceSymbol: topChoice?.symbol ?? "Cmaj7",
    topChoiceConfidence: topChoice?.jevProbability ?? 0.5,
    colorfulChoiceSymbol:
      colorfulChoice?.symbol ?? topChoice?.symbol ?? "Cmaj7",
    cadenceNeedProbability,
    expectedTensionScore,
    tensionProbabilities: normTensionProbs,
    rankedCandidates,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    rawRequestPreview: {
      state,
      questionsSummary: [
        `nextChord: choice("${candidates.length} legal Tonal.js candidates")`,
        `colorfulTwist: choice("Non-diatonic / colorful alternative")`,
        `cadenceNeed: noul("Should this bar resolve toward a cadence?")`,
        `tensionTarget: score("Rubric 0..4 harmonic tension level")`,
      ],
    },
    latencyMs: Math.max(1, Math.round(performance.now() - startTime)),
    apiError,
  };
}

function getEffectiveApiKey(apiKey?: string): string {
  return (
    apiKey?.trim() ||
    (import.meta.env.VITE_TYPESAFE_API_KEY as string | undefined)?.trim() ||
    ""
  );
}

function createBrowserClient(cleanKey: string): TypeSafeClient {
  const baseURL =
    typeof window !== "undefined"
      ? `${window.location.origin}/typesafe-api`
      : "https://api.typesafe.ai";

  return new TypeSafeClient({
    apiKey: cleanKey,
    baseURL,
    dangerouslyAllowBrowser: true,
    compression: false,
  });
}

/**
 * Evaluate the next chord progression step using TypeSafe AI's Jev (`@typesafe-ai/sdk`)
 */
export async function evaluateNextChordsWithJev(params: {
  apiKey?: string;
  keyTonic: string;
  keyMode: KeyMode;
  mood: MoodPreset;
  customPrompt: string;
  progression: ProgressionStep[];
  candidates: ChordCandidate[];
  targetTotalBars: number;
}): Promise<JevDecisionResult> {
  const startTime = performance.now();
  const cleanKey = getEffectiveApiKey(params.apiKey);

  if (!cleanKey || params.candidates.length === 0) {
    return computeTheorySoftmaxDecision({
      ...params,
      startTime,
    });
  }

  const { state, chordCriteria } = buildJevPayload(params);

  const nonDiatonicCriteria: ChoiceCriteria = {};
  for (const c of params.candidates) {
    if (c.category !== "diatonic") {
      nonDiatonicCriteria[c.symbol] = chordCriteria[c.symbol];
    }
  }
  const twistCriteria =
    Object.keys(nonDiatonicCriteria).length >= 2
      ? nonDiatonicCriteria
      : chordCriteria;

  const tensionRubric = [
    "0: Pure stable diatonic tonic rest (minimal tension)",
    "1: Gentle diatonic functional movement (mild tension)",
    "2: Colorful 7th/9th diatonic harmony (moderate tension)",
    "3: Chromatic secondary dominant or modal interchange (strong pull)",
    "4: High-tension tritone substitution or altered dominant",
  ] as const;

  try {
    const client = createBrowserClient(cleanKey);

    const result = await client.systemOne({
      model: "jev-latest",
      state,
      questions: {
        nextChord: choice(
          "Select the most musical, harmonically coherent next chord given the key, style preset, user direction, progression history, and voice-leading smoothness.",
          chordCriteria
        ),
        colorfulTwist: choice(
          "Which candidate offers the most tastefully expressive or colorful harmonic twist while maintaining smooth voice leading?",
          twistCriteria
        ),
        cadenceNeed: noul(
          "Given the current bar position and previous harmonic function, should this next chord resolve toward a stable Tonic cadence?",
          {
            true: "Yes, resolve tension toward Tonic stability or cadence now.",
            false: "No, continue building harmonic momentum, color, or forward motion.",
          }
        ),
        tensionTarget: score(
          "What level of harmonic tension and chromaticism (0 to 4) is ideal for this bar?",
          tensionRubric
        ),
      },
    });

    const probsMap = result.answers.nextChord.probabilities as Record<
      string,
      number
    >;

    const rankedCandidates = params.candidates
      .map((c) => ({
        ...c,
        jevProbability:
          typeof probsMap[c.symbol] === "number" ? probsMap[c.symbol] : 0,
      }))
      .sort((a, b) => (b.jevProbability ?? 0) - (a.jevProbability ?? 0));

    const tProbsObj = result.answers.tensionTarget.probabilities as Record<
      string,
      number
    >;
    const tensionProbabilities = [0, 1, 2, 3, 4].map((idx) =>
      typeof tProbsObj[String(idx)] === "number" ? tProbsObj[String(idx)] : 0.2
    );

    const inputTokens = result.usage?.input_tokens ?? 0;
    const outputTokens = result.usage?.output_tokens ?? 0;

    return {
      engineMode: "jev-live",
      modelName: result.model || "jev-latest",
      topChoiceSymbol: result.answers.nextChord.choice,
      topChoiceConfidence: result.answers.nextChord.confidence,
      colorfulChoiceSymbol: result.answers.colorfulTwist.choice,
      cadenceNeedProbability: result.answers.cadenceNeed.noul,
      expectedTensionScore: result.answers.tensionTarget.score,
      tensionProbabilities,
      rankedCandidates,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      rawRequestPreview: {
        state,
        questionsSummary: [
          `nextChord: choice(${params.candidates.length} candidates) -> ${result.answers.nextChord.choice}`,
          `colorfulTwist: choice(${Object.keys(twistCriteria).length} candidates) -> ${result.answers.colorfulTwist.choice}`,
          `cadenceNeed: noul() -> ${(result.answers.cadenceNeed.noul * 100).toFixed(1)}%`,
          `tensionTarget: score(0..4) -> ${result.answers.tensionTarget.score.toFixed(2)}`,
        ],
      },
      latencyMs: Math.max(1, Math.round(performance.now() - startTime)),
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Jev API 호출 중 오류가 발생했습니다.";
    return computeTheorySoftmaxDecision({
      ...params,
      startTime,
      apiError: message,
    });
  }
}

/**
 * Interactive Site Chat Assistant powered by Jev System One + Tonal.js
 * Understands the user's natural language message, classifies intent, selects the best chord or mood,
 * and constructs a detailed Korean music-theory response with token usage.
 */
export async function processHarmonyChatWithJev(params: {
  userMessage: string;
  apiKey?: string;
  keyTonic: string;
  keyMode: KeyMode;
  mood: MoodPreset;
  progression: ProgressionStep[];
  candidates: ChordCandidate[];
  targetTotalBars: number;
}): Promise<ChatTurnResult> {
  const {
    userMessage,
    apiKey,
    keyTonic,
    keyMode,
    mood,
    progression,
    candidates,
    targetTotalBars,
  } = params;

  const cleanKey = getEffectiveApiKey(apiKey);
  const { state, chordCriteria } = buildJevPayload({
    keyTonic,
    keyMode,
    mood,
    customPrompt: userMessage,
    progression,
    candidates,
    targetTotalBars,
  });

  const moodCriteria: ChoiceCriteria = {};
  for (const m of MOOD_PRESETS) {
    moodCriteria[m.id] = `${m.name}: ${m.promptHint}`;
  }

  let detectedIntent: ChatTurnResult["detectedIntent"] = "recommend_next";
  let pickedChordSymbol = candidates[0]?.symbol || "Cmaj7";
  let pickedMoodId = mood.id;
  let shouldAutoAdd = false;
  let usage: TokenUsageStats = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let decision: JevDecisionResult | undefined;

  if (cleanKey && candidates.length > 0) {
    try {
      const client = createBrowserClient(cleanKey);
      const chatRes = await client.systemOne({
        model: "jev-latest",
        state: {
          ...state,
          userChatMessage: userMessage,
        },
        questions: {
          userIntent: choice(
            "What is the primary action requested by the user's chat message?",
            {
              recommend_next:
                "User wants a chord recommendation or specific mood/color for the next bar",
              auto_generate_bars:
                "User explicitly asks to generate/fill multiple bars (e.g., 4 bars, complete progression)",
              explain_theory:
                "User is asking why a chord works, how the music theory or voice leading works",
              change_mood_style:
                "User wants to switch the overall genre/style preset (e.g., to Jazz, City Pop, Ballad, Cinematic)",
              resolve_cadence:
                "User wants to wrap up, resolve, or end the progression on a stable cadence",
            }
          ),
          bestMatchingChord: choice(
            "Which candidate chord best satisfies the user's message and musical context?",
            chordCriteria
          ),
          bestMatchingMood: choice(
            "Which style preset best matches the user's message?",
            moodCriteria
          ),
          shouldImmediatelyAppend: noul(
            "Did the user ask to immediately add/apply the chord(s) to the timeline rather than just asking a question?"
          ),
        },
      });

      detectedIntent = chatRes.answers.userIntent.choice;
      pickedChordSymbol = chatRes.answers.bestMatchingChord.choice;
      pickedMoodId = chatRes.answers.bestMatchingMood.choice;
      shouldAutoAdd = chatRes.answers.shouldImmediatelyAppend.noul >= 0.62;

      const inTok = chatRes.usage?.input_tokens ?? 0;
      const outTok = chatRes.usage?.output_tokens ?? 0;
      usage = {
        inputTokens: inTok,
        outputTokens: outTok,
        totalTokens: inTok + outTok,
      };

      // Also update the full candidate probabilities using the user's chat prompt
      const probsMap = chatRes.answers.bestMatchingChord.probabilities as Record<
        string,
        number
      >;
      const rankedCandidates = candidates
        .map((c) => ({
          ...c,
          jevProbability:
            typeof probsMap[c.symbol] === "number" ? probsMap[c.symbol] : 0,
        }))
        .sort((a, b) => (b.jevProbability ?? 0) - (a.jevProbability ?? 0));

      decision = {
        engineMode: "jev-live",
        modelName: chatRes.model || "jev-latest",
        topChoiceSymbol: pickedChordSymbol,
        topChoiceConfidence: chatRes.answers.bestMatchingChord.confidence,
        colorfulChoiceSymbol:
          rankedCandidates.find((c) => c.category !== "diatonic")?.symbol ||
          pickedChordSymbol,
        cadenceNeedProbability: detectedIntent === "resolve_cadence" ? 0.9 : 0.4,
        expectedTensionScore: mood.targetTension,
        tensionProbabilities: [0.1, 0.2, 0.4, 0.2, 0.1],
        rankedCandidates,
        usage,
        rawRequestPreview: {
          state: { ...state, userChatMessage: userMessage },
          questionsSummary: [
            `userIntent -> ${detectedIntent}`,
            `bestMatchingChord -> ${pickedChordSymbol} (${(chatRes.answers.bestMatchingChord.confidence * 100).toFixed(1)}%)`,
            `bestMatchingMood -> ${pickedMoodId}`,
          ],
        },
        latencyMs: 120,
      };
    } catch {
      // Fallback handled below
    }
  }

  // Fallback or post-processing
  if (!decision) {
    decision = await evaluateNextChordsWithJev({
      apiKey,
      keyTonic,
      keyMode,
      mood,
      customPrompt: userMessage,
      progression,
      candidates,
      targetTotalBars,
    });
    pickedChordSymbol = decision.topChoiceSymbol;
    if (userMessage.includes("4마디") || userMessage.includes("연속") || userMessage.includes("만들어")) {
      detectedIntent = "auto_generate_bars";
    } else if (userMessage.includes("왜") || userMessage.includes("설명") || userMessage.includes("이유")) {
      detectedIntent = "explain_theory";
    }
  }

  const suggestedChord =
    decision.rankedCandidates.find((c) => c.symbol === pickedChordSymbol) ||
    decision.rankedCandidates[0];
  const prevStep = progression[progression.length - 1];
  const matchedMood = MOOD_PRESETS.find((m) => m.id === pickedMoodId) || mood;

  let replyText = "";
  let barsToGenerate = 0;

  if (detectedIntent === "auto_generate_bars") {
    barsToGenerate = userMessage.includes("2마디") ? 2 : 4;
    replyText = `요청하신 분위기("${userMessage}")를 반영하여 **${barsToGenerate}마디 코드 진행**을 연속으로 생성합니다. 첫 연결 코드로는 **${suggestedChord?.symbol} (${suggestedChord?.roman})**이 선택되었습니다 — ${suggestedChord?.theoryReason}`;
  } else if (detectedIntent === "explain_theory" && suggestedChord) {
    replyText =
      `현재 ${prevStep ? `직전 코드 **${prevStep.symbol}(${prevStep.roman})** 뒤에는` : "첫 마디로는"} **${suggestedChord.symbol} (${suggestedChord.roman}, ${suggestedChord.categoryLabel})**가 가장 높은 확률(**${((suggestedChord.jevProbability ?? 0) * 100).toFixed(1)}%**)로 평가되었습니다.\n\n` +
      `• **화성학적 이유**: ${suggestedChord.theoryRuleTitle} — ${suggestedChord.theoryReason}\n` +
      `• **성부 진행(Voice Leading)**: 매끄러움 ${suggestedChord.voiceLeading.smoothnessScore}점` +
      (suggestedChord.voiceLeading.commonTones.length
        ? `, 공통음 [${suggestedChord.voiceLeading.commonTones.join(", ")}] 유지`
        : "") +
      (suggestedChord.voiceLeading.halfStepResolutions.length
        ? `, 반음 가이드톤 해결 [${suggestedChord.voiceLeading.halfStepResolutions.join(", ")}]`
        : "");
  } else if (detectedIntent === "change_mood_style" && suggestedChord) {
    replyText = `스타일 프리셋을 **[${matchedMood.name}]** 방향으로 맞추고 후보 확률을 재계산했습니다! 이 스타일에서 가장 추천하는 다음 코드는 **${suggestedChord.symbol} (${suggestedChord.roman})**입니다. (${suggestedChord.theoryReason})`;
  } else if (suggestedChord) {
    const alt = decision.rankedCandidates[1];
    replyText =
      `"${userMessage}" 요청에 맞춰 Jev AI가 재평가한 최적의 다음 코드는 **${suggestedChord.symbol} (${suggestedChord.roman})** [확률 **${((suggestedChord.jevProbability ?? 0) * 100).toFixed(1)}%**] 입니다.\n` +
      `• **이유**: ${suggestedChord.theoryRuleTitle} — ${suggestedChord.theoryReason}\n` +
      (alt
        ? `• **대안 추천**: **${alt.symbol} (${alt.roman})** [${((alt.jevProbability ?? 0) * 100).toFixed(1)}%]`
        : "");
    if (shouldAutoAdd) {
      barsToGenerate = 1;
    }
  }

  return {
    replyText,
    detectedIntent,
    suggestedChord,
    suggestedMoodId: pickedMoodId,
    barsToGenerate,
    usage,
    decision,
  };
}
