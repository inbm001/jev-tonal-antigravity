import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Sparkles,
  Play,
  Square,
  RotateCcw,
  Undo2,
  Volume2,
  KeyRound,
  Music,
  Wand2,
  Code2,
  CheckCircle2,
  Send,
  Coins,
  Bot,
  User,
  Keyboard,
  Plus,
  Compass,
} from "lucide-react";
import {
  KEY_TONICS,
  MOOD_PRESETS,
  CORPUS_META,
  generateChordCandidates,
  createStepFromCandidate,
  getRootMotionLabel,
  type ChordCandidate,
  type ComplexityLevel,
  type HarmonicCategory,
  type HarmonicFunction,
  type KeyMode,
  type MoodPreset,
  type ProgressionStep,
} from "./theory/harmonyEngine";
import {
  evaluateNextChordsWithJev,
  processHarmonyChatWithJev,
  type JevDecisionResult,
  type TokenUsageStats,
} from "./ai/jevDecisionEngine";
import { synth } from "./audio/synth";
import { HarmonyRadar } from "./components/HarmonyRadar";

const FUNCTION_COLORS: Record<HarmonicFunction, string> = {
  Tonic: "text-emerald-400",
  Subdominant: "text-sky-400",
  Dominant: "text-amber-400",
  "Secondary Dominant": "text-orange-400",
  "Modal Interchange": "text-purple-400",
  "Tritone Sub": "text-rose-400",
};

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  suggestedChord?: ChordCandidate;
  usage?: TokenUsageStats;
}

interface TokenLogEntry {
  id: string;
  time: string;
  action: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

const QUICK_CHAT_PROMPTS = [
  "1위 코드가 왜 추천됐는지 설명해줘",
  "애절한 모달 인터체인지 추천해줘",
  "트라이톤 대리 반음 하행 추천해줘",
  "네오소울 스타일로 4마디 채워줘",
  "안정적인 토닉 종지로 마무리해줘",
];

const TOTAL_SLOTS = 8;

export function App() {
  // Musical Key & Theory Settings
  const [keyTonic, setKeyTonic] = useState<string>("C");
  const [keyMode, setKeyMode] = useState<KeyMode>("major");
  const [complexity, setComplexity] = useState<ComplexityLevel>("auto_genre");
  const [enabledCategories, setEnabledCategories] = useState<
    Record<HarmonicCategory, boolean>
  >({
    diatonic: true,
    secondary_dominant: true,
    modal_interchange: true,
    tritone_sub: true,
  });

  // Mood & Jev AI Settings
  const [selectedMood, setSelectedMood] = useState<MoodPreset>(MOOD_PRESETS[0]);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("TYPESAFE_API_KEY") || ""
  );
  const [showApiModal, setShowApiModal] = useState<boolean>(false);
  const [showPayloadModal, setShowPayloadModal] = useState<boolean>(false);
  const [showTokenModal, setShowTokenModal] = useState<boolean>(false);

  // Token Usage Tracking State
  const [sessionTokens, setSessionTokens] = useState<{
    calls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>({ calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  const [tokenLogs, setTokenLogs] = useState<TokenLogEntry[]>([]);

  // Progression Slots State (Starts empty [] so user can pick Starting Chord on Slot 1!)
  const [progression, setProgression] = useState<ProgressionStep[]>([]);
  const [bpm, setBpm] = useState<number>(92);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [keyTriggeredSlot, setKeyTriggeredSlot] = useState<number | null>(null);

  // Candidate & Jev Evaluation State
  const [jevDecision, setJevDecision] = useState<JevDecisionResult | null>(
    null
  );
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState<boolean>(false);
  const [hoveredCandidate, setHoveredCandidate] =
    useState<ChordCandidate | null>(null);

  // Site Chat Assistant State
  const [chatInput, setChatInput] = useState<string>("");
  const [isChatLoading, setIsChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `안녕하세요! Jev AI × Tonal.js × Neo-Soul RAG (${CORPUS_META.totalSongsAnalyzed}곡 코퍼스) 스튜디오입니다.\n• 중앙 레이더의 노드에 마우스를 올리면 즉시 소리와 화성/RAG 정보를 확인하고, 클릭하면 하단 슬롯에 추가됩니다.\n• 시작 코드(SLOT 1)부터 자유롭게 고르실 수 있고, 키보드 숫자키 [1]~[8]을 누르면 각 슬롯의 코드가 즉시 연주됩니다!`,
      timestamp: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    },
  ]);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Record token usage helper
  const recordTokenUsage = useCallback(
    (
      action: string,
      model: string,
      usage: TokenUsageStats,
      latencyMs: number
    ) => {
      if (usage.totalTokens <= 0) return;
      setSessionTokens((prev) => ({
        calls: prev.calls + 1,
        inputTokens: prev.inputTokens + usage.inputTokens,
        outputTokens: prev.outputTokens + usage.outputTokens,
        totalTokens: prev.totalTokens + usage.totalTokens,
      }));
      setTokenLogs((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: new Date().toLocaleTimeString("ko-KR"),
          action,
          model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          latencyMs,
        },
        ...prev.slice(0, 49),
      ]);
    },
    []
  );

  const handleSaveApiKey = (val: string) => {
    setApiKey(val);
    if (val.trim()) {
      localStorage.setItem("TYPESAFE_API_KEY", val.trim());
    } else {
      localStorage.removeItem("TYPESAFE_API_KEY");
    }
  };

  // Generate Tonal.js + Neo-Soul Corpus candidates for the current state
  const rawCandidates = useMemo(() => {
    return generateChordCandidates({
      keyTonic,
      keyMode,
      progression,
      complexity,
      enabledCategories,
      mood: selectedMood,
    });
  }, [
    keyTonic,
    keyMode,
    progression,
    complexity,
    enabledCategories,
    selectedMood,
  ]);

  // Run Jev AI / Softmax evaluation whenever progression or settings change
  useEffect(() => {
    let cancelled = false;
    async function runEvaluation() {
      if (rawCandidates.length === 0) return;
      setIsEvaluating(true);
      const decision = await evaluateNextChordsWithJev({
        apiKey,
        keyTonic,
        keyMode,
        mood: selectedMood,
        customPrompt,
        progression,
        candidates: rawCandidates,
        targetTotalBars: TOTAL_SLOTS,
      });
      if (!cancelled) {
        setJevDecision(decision);
        setHoveredCandidate(decision.rankedCandidates[0] || null);
        setIsEvaluating(false);
        if (decision.engineMode === "jev-live") {
          recordTokenUsage(
            progression.length === 0
              ? "시작 코드(SLOT 1) 평가"
              : `SLOT ${progression.length + 1} 후보 평가`,
            decision.modelName,
            decision.usage,
            decision.latencyMs
          );
        }
      }
    }
    runEvaluation();
    return () => {
      cancelled = true;
    };
  }, [
    apiKey,
    keyTonic,
    keyMode,
    selectedMood,
    customPrompt,
    progression,
    rawCandidates,
    recordTokenUsage,
  ]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isChatLoading]);

  // Keyboard Number Keys [1] ~ [8] to play slots immediately!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key >= "1" && e.key <= "8") {
        const slotIdx = Number(e.key) - 1;
        const step = progression[slotIdx];
        if (step) {
          e.preventDefault();
          synth.playChord(step.voicingNotes, 1.35, 22);
          setKeyTriggeredSlot(slotIdx);
          window.setTimeout(() => {
            setKeyTriggeredSlot((prev) => (prev === slotIdx ? null : prev));
          }, 350);
        }
      } else if (e.key === " ") {
        // Spacebar to toggle play progression
        if (progression.length > 0) {
          e.preventDefault();
          handlePlayProgression();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [progression, playingIndex, bpm]);

  // Hovering a node on the Radar previews sound & updates inspector
  const handleHoverCandidate = useCallback((candidate: ChordCandidate) => {
    setHoveredCandidate((prev) => {
      if (prev?.symbol !== candidate.symbol) {
        synth.playChord(candidate.voiceLeading.voicingNotes, 1.1, 22);
      }
      return candidate;
    });
  }, []);

  // Clicking a node on the Radar adds it to the next slot (up to 8 slots, or wraps/replaces last)
  const handleSelectCandidate = useCallback(
    (candidate: ChordCandidate, playSound = true) => {
      if (playSound) {
        synth.playChord(candidate.voiceLeading.voicingNotes, 1.35, 22);
      }
      setHoveredCandidate(candidate);
      setProgression((prev) => {
        if (prev.length >= TOTAL_SLOTS) {
          // Replace the 8th slot if already full
          const next = [...prev.slice(0, TOTAL_SLOTS - 1)];
          next.push(createStepFromCandidate(candidate, TOTAL_SLOTS - 1));
          return next;
        }
        return [...prev, createStepFromCandidate(candidate, prev.length)];
      });
    },
    []
  );

  // Auto-generate N next chords using Jev AI decision probabilities
  const handleAutoGenerateBars = async (
    barsToGenerate: number,
    promptOverride?: string
  ) => {
    if (isAutoGenerating) return;
    setIsAutoGenerating(true);

    let currentProg = [...progression];
    const remainingSlots = Math.max(1, TOTAL_SLOTS - currentProg.length);
    const count = Math.min(barsToGenerate, remainingSlots);

    for (let i = 0; i < count; i++) {
      const cands = generateChordCandidates({
        keyTonic,
        keyMode,
        progression: currentProg,
        complexity,
        enabledCategories,
        mood: selectedMood,
      });
      if (cands.length === 0) break;

      const decision = await evaluateNextChordsWithJev({
        apiKey,
        keyTonic,
        keyMode,
        mood: selectedMood,
        customPrompt: promptOverride ?? customPrompt,
        progression: currentProg,
        candidates: cands,
        targetTotalBars: TOTAL_SLOTS,
      });

      if (decision.engineMode === "jev-live") {
        recordTokenUsage(
          `자동 생성 (SLOT ${currentProg.length + 1})`,
          decision.modelName,
          decision.usage,
          decision.latencyMs
        );
      }

      const topPool = decision.rankedCandidates.slice(0, 3);
      const poolSum =
        topPool.reduce((acc, c) => acc + (c.jevProbability ?? 0.1), 0) || 1;
      let rand = Math.random() * poolSum;
      let chosen = topPool[0];
      for (const item of topPool) {
        rand -= item.jevProbability ?? 0.1;
        if (rand <= 0) {
          chosen = item;
          break;
        }
      }

      const newStep = createStepFromCandidate(chosen, currentProg.length);
      currentProg = [...currentProg, newStep];
      setProgression([...currentProg]);
      setJevDecision(decision);
      setHoveredCandidate(chosen);
      synth.playChord(chosen.voiceLeading.voicingNotes, 0.75, 20);

      await new Promise((r) => setTimeout(r, 400));
    }

    setIsAutoGenerating(false);
  };

  // Handle sending a chat message in the Site Harmony Chat
  const handleSendChat = async (textOverride?: string) => {
    const msg = (textOverride ?? chatInput).trim();
    if (!msg || isChatLoading) return;

    if (!textOverride) setChatInput("");

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: msg,
      timestamp: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    const chatResult = await processHarmonyChatWithJev({
      userMessage: msg,
      apiKey,
      keyTonic,
      keyMode,
      mood: selectedMood,
      progression,
      candidates: rawCandidates,
      targetTotalBars: TOTAL_SLOTS,
    });

    if (chatResult.usage.totalTokens > 0) {
      recordTokenUsage(
        `채팅: "${msg.slice(0, 14)}..."`,
        chatResult.decision?.modelName || "jev-latest",
        chatResult.usage,
        chatResult.decision?.latencyMs || 120
      );
    }

    if (chatResult.decision) {
      setJevDecision(chatResult.decision);
    }
    if (
      chatResult.detectedIntent === "change_mood_style" &&
      chatResult.suggestedMoodId
    ) {
      const foundMood = MOOD_PRESETS.find(
        (m) => m.id === chatResult.suggestedMoodId
      );
      if (foundMood) setSelectedMood(foundMood);
    }
    if (chatResult.suggestedChord) {
      setHoveredCandidate(chatResult.suggestedChord);
      synth.playChord(
        chatResult.suggestedChord.voiceLeading.voicingNotes,
        1.2,
        24
      );
    }

    const assistantMsg: ChatMessage = {
      id: `bot-${Date.now()}`,
      role: "assistant",
      text: chatResult.replyText,
      timestamp: new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      suggestedChord: chatResult.suggestedChord,
      usage: chatResult.usage,
    };

    setChatMessages((prev) => [...prev, assistantMsg]);
    setIsChatLoading(false);

    if (chatResult.barsToGenerate && chatResult.barsToGenerate > 1) {
      await handleAutoGenerateBars(chatResult.barsToGenerate, msg);
    } else if (
      chatResult.barsToGenerate === 1 &&
      chatResult.suggestedChord &&
      (msg.includes("추가") || msg.includes("넣어") || msg.includes("해결해줘"))
    ) {
      handleSelectCandidate(chatResult.suggestedChord, false);
    } else {
      setCustomPrompt(msg);
    }
  };

  // Play entire progression
  function handlePlayProgression() {
    if (progression.length === 0) return;
    if (playingIndex !== null) {
      synth.stopAll();
      setPlayingIndex(null);
      return;
    }
    synth.playProgression(
      progression.map((s) => ({
        notesWithOctave: s.voicingNotes,
        durationBeats: 2,
      })),
      bpm,
      (idx) => setPlayingIndex(idx)
    );
  }

  const toggleCategory = (cat: HarmonicCategory) => {
    setEnabledCategories((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

  const candidatesForRadar = jevDecision?.rankedCandidates ?? rawCandidates;
  const prevStep =
    progression.length > 0 ? progression[progression.length - 1] : null;

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col select-none">
      {/* Compact Top Control Header (No scroll, single row) */}
      <header className="h-14 shrink-0 border-b border-slate-800/90 bg-slate-900/90 px-4 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow">
            <Music className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-extrabold text-white tracking-tight">
                Jev × Tonal
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Neo-Soul RAG ({CORPUS_META.totalSongsAnalyzed}곡)
              </span>
            </div>
          </div>
        </div>

        {/* Key Tonic, Mode & Mood Selector */}
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          {/* Key Selector */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 gap-0.5">
            {KEY_TONICS.map((t) => (
              <button
                key={t}
                onClick={() => {
                  setKeyTonic(t);
                  setProgression([]);
                }}
                className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                  keyTonic === t
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Major / Minor Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => {
                setKeyMode("major");
                setProgression([]);
              }}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                keyMode === "major"
                  ? "bg-amber-500/25 text-amber-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Maj
            </button>
            <button
              onClick={() => {
                setKeyMode("minor");
                setProgression([]);
              }}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                keyMode === "minor"
                  ? "bg-purple-500/25 text-purple-300"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Min
            </button>
          </div>

          {/* Genre / Mood Selector */}
          <select
            value={selectedMood.id}
            onChange={(e) => {
              const found = MOOD_PRESETS.find((m) => m.id === e.target.value);
              if (found) setSelectedMood(found);
            }}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-purple-200 focus:outline-none focus:border-purple-500"
          >
            {MOOD_PRESETS.map((m) => (
              <option key={m.id} value={m.id} className="bg-slate-900">
                스타일: {m.name}
              </option>
            ))}
          </select>

          {/* Complexity Selector */}
          <select
            value={complexity}
            onChange={(e) => setComplexity(e.target.value as ComplexityLevel)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="auto_genre">텐션: ★ 장르 자동(3·7·9·11·13)</option>
            <option value="triad">텐션: 3화음/add9</option>
            <option value="seventh">텐션: 7화음</option>
            <option value="extended">텐션: 9th/11th/13th 확장</option>
          </select>

          {/* Category Quick Toggles */}
          <div className="hidden 2xl:flex items-center gap-1">
            {(
              [
                { id: "diatonic", label: "다이아" },
                { id: "secondary_dominant", label: "부속7" },
                { id: "modal_interchange", label: "차용" },
                { id: "tritone_sub", label: "대리" },
              ] as const
            ).map((c) => (
              <button
                key={c.id}
                onClick={() => toggleCategory(c.id)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition ${
                  enabledCategories[c.id]
                    ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-200"
                    : "bg-slate-900 border-slate-800 text-slate-500"
                }`}
              >
                {enabledCategories[c.id] ? "✓" : "○"} {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right Status: Token Monitor, Payload Inspector, API Key */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowTokenModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-200 hover:bg-amber-500/20 transition"
          >
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-mono">
              {jevDecision?.usage?.totalTokens ?? 0}t
            </span>
            <span className="text-slate-500">|</span>
            <span className="font-mono text-amber-300 font-bold">
              누적 {sessionTokens.totalTokens.toLocaleString()}t
            </span>
          </button>

          <button
            onClick={() => setShowPayloadModal(true)}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition"
            title="Jev SystemOne RAG 요청/응답 JSON 보기"
          >
            <Code2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowApiModal(true)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
              jevDecision?.engineMode === "jev-live"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : "bg-slate-800 border-slate-700 text-slate-300"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            {jevDecision?.engineMode === "jev-live" ? "Jev Live" : "API 설정"}
          </button>
        </div>
      </header>

      {/* Main Single-Viewport Workspace (Zero Scroll) */}
      <div className="flex-1 min-h-0 grid grid-cols-12 gap-3 p-3 overflow-hidden">
        {/* Left/Center Column (8 cols): Radar on Top + 8 Slots on Bottom */}
        <div className="col-span-8 h-full min-h-0 flex flex-col gap-3 overflow-hidden">
          {/* 1. Emotion × Jev Probability Radar + Live Hover Inspector */}
          <HarmonyRadar
            candidates={candidatesForRadar}
            hoveredCandidate={hoveredCandidate}
            onHoverCandidate={handleHoverCandidate}
            onSelectCandidate={(cand) => handleSelectCandidate(cand, true)}
            targetSlotIndex={Math.min(progression.length, TOTAL_SLOTS - 1)}
            prevStep={prevStep}
            cadenceProb={jevDecision?.cadenceNeedProbability ?? 0.3}
            expectedTension={jevDecision?.expectedTensionScore ?? 2.0}
            isEvaluating={isEvaluating}
          />

          {/* 2. Bottom 8 Progression Slots (Playable via Number Keys 1 ~ 8) */}
          <section className="shrink-0 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 space-y-2.5">
            {/* Slot Toolbar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white">
                  <Keyboard className="w-4 h-4 text-indigo-400" />
                  코드 진행 슬롯 (숫자키{" "}
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-indigo-300">
                    1
                  </kbd>{" "}
                  ~{" "}
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-indigo-300">
                    8
                  </kbd>{" "}
                  눌러 각 슬롯 즉시 연주 ·{" "}
                  <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-800 border border-slate-700 rounded text-indigo-300">
                    Space
                  </kbd>{" "}
                  전체 재생)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {/* BPM */}
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px]">
                  <span className="text-slate-400">BPM</span>
                  <input
                    type="range"
                    min={65}
                    max={135}
                    value={bpm}
                    onChange={(e) => setBpm(Number(e.target.value))}
                    className="w-14 accent-indigo-500"
                  />
                  <span className="font-mono text-white w-6">{bpm}</span>
                </div>

                <button
                  onClick={handlePlayProgression}
                  disabled={progression.length === 0}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition disabled:opacity-40 ${
                    playingIndex !== null
                      ? "bg-rose-600 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {playingIndex !== null ? (
                    <>
                      <Square className="w-3 h-3 fill-current" />
                      정지
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      전체 재생
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleAutoGenerateBars(1)}
                  disabled={isAutoGenerating || progression.length >= TOTAL_SLOTS}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition"
                >
                  <Wand2 className="w-3 h-3" />
                  +1슬롯 AI
                </button>

                <button
                  onClick={() => handleAutoGenerateBars(4)}
                  disabled={isAutoGenerating || progression.length >= TOTAL_SLOTS}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition"
                >
                  <Sparkles className="w-3 h-3" />
                  +4슬롯 연속
                </button>

                <button
                  onClick={() =>
                    setProgression((prev) => prev.slice(0, -1))
                  }
                  disabled={progression.length === 0}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition"
                  title="마지막 슬롯 취소"
                >
                  <Undo2 className="w-3 h-3" />
                  한칸 취소
                </button>

                <button
                  onClick={() => {
                    synth.stopAll();
                    setPlayingIndex(null);
                    setProgression([]);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 transition"
                  title="시작 코드(SLOT 1)부터 다시 선택"
                >
                  <RotateCcw className="w-3 h-3" />
                  시작코드부터 재선택
                </button>
              </div>
            </div>

            {/* 8 Slots Grid */}
            <div className="grid grid-cols-8 gap-2">
              {Array.from({ length: TOTAL_SLOTS }).map((_, slotIdx) => {
                const step = progression[slotIdx];
                const isNextTarget = slotIdx === progression.length;
                const isPlaying =
                  playingIndex === slotIdx || keyTriggeredSlot === slotIdx;
                const prevSymbol =
                  slotIdx > 0 && progression[slotIdx - 1]
                    ? progression[slotIdx - 1].symbol
                    : null;
                const rootMotion =
                  step && prevSymbol
                    ? getRootMotionLabel(prevSymbol, step.symbol)
                    : slotIdx === 0
                      ? "시작 코드"
                      : "";

                if (step) {
                  return (
                    <div
                      key={step.id}
                      onClick={() => {
                        synth.playChord(step.voicingNotes, 1.35, 22);
                        setKeyTriggeredSlot(slotIdx);
                        window.setTimeout(
                          () => setKeyTriggeredSlot(null),
                          320
                        );
                      }}
                      className={`relative cursor-pointer rounded-xl p-2.5 border transition flex flex-col justify-between h-[96px] ${
                        isPlaying
                          ? "bg-indigo-600/30 border-indigo-400 ring-2 ring-indigo-400 scale-[1.02]"
                          : "bg-slate-950/95 border-slate-800 hover:border-indigo-500/60"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 font-mono font-bold">
                            [{slotIdx + 1}]
                          </span>
                          <span
                            className={`font-bold truncate ml-1 ${
                              FUNCTION_COLORS[step.harmonicFunction]
                            }`}
                          >
                            {step.roman}
                          </span>
                        </div>
                        <div className="text-base font-extrabold text-white tracking-tight mt-1 truncate">
                          {step.symbol}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono truncate">
                          {step.notes.join("·")}
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-800/80 pt-1">
                        <span className="truncate">{rootMotion}</span>
                        {step.probabilityWhenChosen !== undefined && (
                          <span className="font-mono text-indigo-300">
                            {(step.probabilityWhenChosen * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                if (isNextTarget) {
                  return (
                    <div
                      key={`target-${slotIdx}`}
                      onClick={() => {
                        if (hoveredCandidate) {
                          handleSelectCandidate(hoveredCandidate, true);
                        }
                      }}
                      className="cursor-pointer rounded-xl p-2 border-2 border-dashed border-indigo-500/60 bg-indigo-500/10 hover:bg-indigo-500/20 flex flex-col items-center justify-center text-center h-[96px] transition"
                    >
                      <span className="text-[10px] font-mono font-bold text-indigo-300">
                        [{slotIdx + 1}]{" "}
                        {slotIdx === 0 ? "시작 코드" : "다음 슬롯"}
                      </span>
                      {hoveredCandidate ? (
                        <>
                          <span className="text-xs font-extrabold text-white mt-1 truncate max-w-full">
                            {hoveredCandidate.symbol}
                          </span>
                          <span className="text-[9px] text-indigo-300 mt-0.5 flex items-center gap-0.5">
                            <Plus className="w-2.5 h-2.5" />
                            클릭 확정
                          </span>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-400 mt-1">
                          레이더에서 선택
                        </span>
                      )}
                    </div>
                  );
                }

                return (
                  <div
                    key={`empty-${slotIdx}`}
                    className="rounded-xl p-2 border border-slate-800/60 bg-slate-950/40 flex flex-col items-center justify-center text-center h-[96px] opacity-50"
                  >
                    <span className="text-[10px] font-mono text-slate-600">
                      [{slotIdx + 1}]
                    </span>
                    <span className="text-[10px] text-slate-600 mt-1">
                      비어있음
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right Column (4 cols): Site Harmony Chat Assistant */}
        <aside className="col-span-4 h-full min-h-0 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-3.5 py-2.5 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                <Bot className="w-4 h-4 text-purple-300" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-white">
                  AI 화성학 사이트 채팅 (Jev RAG)
                </h3>
                <p className="text-[10px] text-slate-400">
                  화성 질문 · 분위기 변경 · 연속 생성 지시
                </p>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-amber-300">
              {sessionTokens.totalTokens} tok
            </span>
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-slate-950/50 shrink-0">
            <div className="flex flex-wrap gap-1">
              {QUICK_CHAT_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSendChat(q)}
                  disabled={isChatLoading}
                  className="text-[10px] px-2 py-1 rounded-md bg-slate-800/90 hover:bg-indigo-600/30 hover:text-indigo-200 border border-slate-700/70 text-slate-300 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Area (Internally scrollable) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3 select-text">
            {chatMessages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div className="flex items-center gap-1 mb-1 text-[10px] text-slate-400">
                  {m.role === "assistant" ? (
                    <>
                      <Bot className="w-3 h-3 text-purple-400" />
                      <span className="font-semibold text-purple-300">
                        Jev × Tonal
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-semibold text-indigo-300">나</span>
                      <User className="w-3 h-3 text-indigo-400" />
                    </>
                  )}
                  <span>· {m.timestamp}</span>
                </div>

                <div
                  className={`rounded-2xl px-3 py-2 text-xs leading-relaxed max-w-[94%] whitespace-pre-line ${
                    m.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-none"
                      : "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-none"
                  }`}
                >
                  {m.text}

                  {m.suggestedChord && (
                    <div className="mt-2 pt-2 border-t border-slate-700/80 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-sm font-extrabold text-white">
                          {m.suggestedChord.symbol}
                        </span>
                        <span className="ml-1 text-[10px] text-indigo-300 font-semibold">
                          ({m.suggestedChord.roman})
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleHoverCandidate(m.suggestedChord!)
                          }
                          className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[10px] font-medium text-slate-200 flex items-center gap-1"
                        >
                          <Volume2 className="w-3 h-3 text-indigo-300" />
                          듣기
                        </button>
                        <button
                          onClick={() =>
                            handleSelectCandidate(m.suggestedChord!, true)
                          }
                          className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          슬롯 추가
                        </button>
                      </div>
                    </div>
                  )}

                  {m.usage && m.usage.totalTokens > 0 && (
                    <div className="mt-1.5 pt-1 border-t border-slate-700/50 flex items-center justify-between text-[9px] font-mono text-amber-300/90">
                      <span>⚡ Jev 토큰</span>
                      <span>
                        In {m.usage.inputTokens} + Out {m.usage.outputTokens} ={" "}
                        {m.usage.totalTokens}t
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isChatLoading && (
              <div className="flex items-center gap-2 text-xs text-purple-300 animate-pulse">
                <Bot className="w-4 h-4" />
                <span>Jev RAG가 화성과 코퍼스를 분석 중...</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendChat();
            }}
            className="p-2.5 border-t border-slate-800 bg-slate-950/90 flex items-center gap-1.5 shrink-0"
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="예: 다음엔 어두운 네오소울 차용화음 추천해줘..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading}
              className="p-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      </div>

      {/* Token Usage Modal */}
      {showTokenModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-400" />
                Jev AI 실시간 토큰 사용량 모니터
              </h3>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                닫기 ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5 bg-slate-950 border border-slate-800 rounded-xl p-3 text-center">
              <div>
                <div className="text-[11px] text-slate-400">총 호출 횟수</div>
                <div className="text-base font-bold font-mono text-white mt-0.5">
                  {sessionTokens.calls}회
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">누적 Input</div>
                <div className="text-base font-bold font-mono text-sky-300 mt-0.5">
                  {sessionTokens.inputTokens.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">누적 Output</div>
                <div className="text-base font-bold font-mono text-purple-300 mt-0.5">
                  {sessionTokens.outputTokens.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">총 누적 토큰</div>
                <div className="text-base font-bold font-mono text-amber-300 mt-0.5">
                  {sessionTokens.totalTokens.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {tokenLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-xs bg-slate-950/70 border border-slate-800/80 rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="font-semibold text-slate-200">
                      {log.action}
                    </span>
                    <span className="ml-2 text-[10px] font-mono text-slate-500">
                      {log.time} · {log.model} · {log.latencyMs}ms
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-amber-300">
                    In {log.inputTokens} + Out {log.outputTokens} ={" "}
                    <strong>{log.totalTokens}</strong> tok
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Jev RAG Payload Inspector Modal */}
      {showPayloadModal && jevDecision && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-2xl max-w-2xl w-full p-5 space-y-3 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-indigo-300 flex items-center gap-1.5">
                <Code2 className="w-4 h-4" />
                `@typesafe-ai/sdk` SystemOne + Neo-Soul RAG 요청 상태(`state`)
              </span>
              <button
                onClick={() => setShowPayloadModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                닫기 ✕
              </button>
            </div>
            <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-xl border border-slate-800 overflow-x-auto text-slate-300 max-h-96 select-text">
              {JSON.stringify(jevDecision.rawRequestPreview, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-400" />
                TypeSafe AI (Jev) API 키 설정
              </h3>
              <button
                onClick={() => setShowApiModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                닫기 ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              현재 프로젝트의 <code>.env</code> 파일에 설정된 키가 자동으로 사용됩니다.
            </p>

            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleSaveApiKey(e.target.value)}
              placeholder=".env 키 사용 중 (직접 입력 시 덮어씀)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>로컬 스토리지에만 안전하게 보관됩니다</span>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default App;
