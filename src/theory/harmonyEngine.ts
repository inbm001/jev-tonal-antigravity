import { Chord, Interval, Key, Note, Progression } from "tonal";
import neoSoulCorpusRaw from "./neoSoulCorpus.json";

export type KeyMode = "major" | "minor";
export type HarmonicCategory =
  | "diatonic"
  | "secondary_dominant"
  | "modal_interchange"
  | "tritone_sub";

export type HarmonicFunction =
  | "Tonic"
  | "Subdominant"
  | "Dominant"
  | "Secondary Dominant"
  | "Modal Interchange"
  | "Tritone Sub";

export type ComplexityLevel = "auto_genre" | "triad" | "seventh" | "extended";

export type EmotionQuadrant =
  | "bright_expand" // 12시: 설렘 · 밝은 확장 (Subdominant / Lydian / Groove)
  | "tension_drive" // 3시: 긴장 · 추진력 · 에너지 (Dominant / Secondary Dom)
  | "deep_soul" // 6시: 애절함 · 몽환 · 다크/재즈 반전 (Modal Interchange / Tritone Sub)
  | "peace_rest"; // 9시: 평온 · 안정 · 해결 (Tonic / Relative Rest)

export interface CorpusSongRef {
  id: string;
  title: string;
}

export interface VoiceLeadingAnalysis {
  commonTones: string[];
  halfStepResolutions: string[];
  totalSemitoneMove: number;
  smoothnessScore: number; // 0 ~ 100
  voicingNotes: string[];
}

export interface ChordCandidate {
  id: string;
  symbol: string;
  roman: string;
  root: string;
  quality: string;
  notes: string[];
  category: HarmonicCategory;
  categoryLabel: string;
  harmonicFunction: HarmonicFunction;
  functionKorean: string;
  tensionLevel: number; // 0 ~ 4
  theoryRuleTitle: string;
  theoryReason: string;
  idiomTag?: string;
  voiceLeading: VoiceLeadingAnalysis;
  baseTheoryWeight: number; // 0 ~ 100
  jevProbability?: number; // 0 ~ 1
  // Neo-Soul Corpus RAG fields (Methods 1, 2, 3)
  corpusCount: number;
  corpusSongs: CorpusSongRef[];
  isFromCorpus?: boolean;
  // Emotion Radar Polar Coordinates
  emotionQuadrant: EmotionQuadrant;
  emotionLabel: string;
  emotionAngleDeg: number; // 0° = 12시(Top), 90° = 3시(Right), 180° = 6시(Bottom), 270° = 9시(Left)
}

export interface ProgressionStep {
  id: string;
  barIndex: number;
  symbol: string;
  roman: string;
  category: HarmonicCategory;
  harmonicFunction: HarmonicFunction;
  notes: string[];
  voicingNotes: string[];
  selectedReason?: string;
  probabilityWhenChosen?: number;
  corpusSongs?: CorpusSongRef[];
}

interface CorpusEntry {
  relPc: number;
  qual: string;
  count: number;
  songs: CorpusSongRef[];
}

const neoSoulCorpus = neoSoulCorpusRaw as {
  meta: {
    sourceRepo: string;
    totalSongsAnalyzed: number;
    totalTransitionsExtracted: number;
  };
  openings: Record<KeyMode, CorpusEntry[]>;
  transitions2Gram: Record<KeyMode, Record<string, CorpusEntry[]>>;
  transitions3Gram: Record<KeyMode, Record<string, CorpusEntry[]>>;
};

export const CORPUS_META = neoSoulCorpus.meta;

export const KEY_TONICS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "Gb",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
] as const;

export interface MoodPreset {
  id: string;
  name: string;
  description: string;
  preferredCategories: Record<HarmonicCategory, number>;
  preferredFunctions: Record<HarmonicFunction, number>;
  targetTension: number;
  promptHint: string;
  extensionStyle: {
    tonicMaj: string[];
    subdomMaj: string[];
    minor: string[];
    dominant: string[];
    secDominant: string[];
    halfDim: string[];
    subMinor: string[];
    tritoneSub: string[];
  };
}

export const MOOD_PRESETS: MoodPreset[] = [
  {
    id: "neo_soul_jazz",
    name: "네오소울 / 재즈 R&B (RAG 특화)",
    description:
      "inbm001/progressions 코퍼스(857곡)의 실제 m11·9sus4·13·7#9#5·69 텐션과 실전 아티스트 전이 패턴을 최우선 반영합니다.",
    preferredCategories: {
      diatonic: 0.95,
      secondary_dominant: 1.35,
      modal_interchange: 1.35,
      tritone_sub: 1.4,
    },
    preferredFunctions: {
      Tonic: 1.0,
      Subdominant: 1.15,
      Dominant: 1.1,
      "Secondary Dominant": 1.35,
      "Modal Interchange": 1.35,
      "Tritone Sub": 1.4,
    },
    targetTension: 3.2,
    promptHint:
      "Authentic Neo-Soul & Jazz R&B grounded in the 857-song progressions corpus: lush m11/maj9/13sus4/7#9#5 extensions, chromatic mediants, and tritone substitutions.",
    extensionStyle: {
      tonicMaj: ["maj9", "69"],
      subdomMaj: ["maj9", "maj13"],
      minor: ["m9", "m11"],
      dominant: ["9sus4", "13", "9"],
      secDominant: ["7#9#5", "7b9", "7#9"],
      halfDim: ["m7b5"],
      subMinor: ["m9", "m6"],
      tritoneSub: ["9", "7#11"],
    },
  },
  {
    id: "city_pop",
    name: "시티팝 / J-Pop 어반",
    description:
      "왕도 진행(IVmaj7-V7-iiim7-vim7), Just The Two Of Us(IVmaj7-III7-vim9), 백도어 종지 등 세련된 어반 화성을 만듭니다.",
    preferredCategories: {
      diatonic: 1.05,
      secondary_dominant: 1.4,
      modal_interchange: 1.35,
      tritone_sub: 1.15,
    },
    preferredFunctions: {
      Tonic: 0.95,
      Subdominant: 1.35,
      Dominant: 1.15,
      "Secondary Dominant": 1.4,
      "Modal Interchange": 1.35,
      "Tritone Sub": 1.15,
    },
    targetTension: 2.7,
    promptHint:
      "City Pop / Urban groove featuring Royal Road (IVmaj7-V7-iiim7-vim9), III7b9->vim9 turns, and backdoor bVII9 cadences.",
    extensionStyle: {
      tonicMaj: ["maj9", "maj7"],
      subdomMaj: ["maj7", "maj9"],
      minor: ["m9", "m7"],
      dominant: ["9", "13", "9sus4"],
      secDominant: ["7b9", "7"],
      halfDim: ["m7b5"],
      subMinor: ["m7", "m6"],
      tritoneSub: ["9", "7"],
    },
  },
  {
    id: "pop_ballad",
    name: "감성 팝 / 발라드",
    description:
      "add9·maj7·7sus4·m6 등 따뜻한 텐션과 세컨더리 도미넌트, 서브도미넌트 마이너(ivm6) 라인 클리셰를 조합합니다.",
    preferredCategories: {
      diatonic: 1.25,
      secondary_dominant: 1.2,
      modal_interchange: 1.2,
      tritone_sub: 0.7,
    },
    preferredFunctions: {
      Tonic: 1.15,
      Subdominant: 1.25,
      Dominant: 1.15,
      "Secondary Dominant": 1.15,
      "Modal Interchange": 1.2,
      "Tritone Sub": 0.7,
    },
    targetTension: 1.9,
    promptHint:
      "Emotional Pop Ballad using warm add9, maj7, 7sus4, sentimental ivm6 line clichés, and passing secondary dominants.",
    extensionStyle: {
      tonicMaj: ["add9", "maj7"],
      subdomMaj: ["maj7", "add9"],
      minor: ["m7", "m9"],
      dominant: ["9sus4", "7", "9"],
      secDominant: ["7", "7b9"],
      halfDim: ["m7b5"],
      subMinor: ["m6", "m7"],
      tritoneSub: ["7", "9"],
    },
  },
  {
    id: "cinematic_epic",
    name: "시네마틱 / 영화음악",
    description:
      "넓은 add9·maj7과 3도권 반음계 화성(Chromatic Mediant), 패러렐 마이너 차용화음(bVImaj7, bVII, iv)으로 웅장한 서사를 만듭니다.",
    preferredCategories: {
      diatonic: 1.0,
      secondary_dominant: 1.05,
      modal_interchange: 1.55,
      tritone_sub: 0.85,
    },
    preferredFunctions: {
      Tonic: 1.1,
      Subdominant: 1.2,
      Dominant: 1.05,
      "Secondary Dominant": 1.05,
      "Modal Interchange": 1.55,
      "Tritone Sub": 0.85,
    },
    targetTension: 2.4,
    promptHint:
      "Cinematic film score harmony using wide triads/add9, dramatic modal interchange (bVImaj7, bVII, iv), and chromatic mediants.",
    extensionStyle: {
      tonicMaj: ["add9", "maj7"],
      subdomMaj: ["maj7", "add9"],
      minor: ["m", "m7", "m9"],
      dominant: ["9sus4", "7"],
      secDominant: ["7"],
      halfDim: ["m7b5"],
      subMinor: ["m", "m6"],
      tritoneSub: ["7"],
    },
  },
  {
    id: "classic_standard",
    name: "정통 화성학 / 스탠다드",
    description:
      "T - SD - D - T 기능 화성, 5도권 순환, 정격종지/위종지/변격종지 규칙을 명확히 따릅니다.",
    preferredCategories: {
      diatonic: 1.45,
      secondary_dominant: 1.15,
      modal_interchange: 0.75,
      tritone_sub: 0.75,
    },
    preferredFunctions: {
      Tonic: 1.25,
      Subdominant: 1.25,
      Dominant: 1.35,
      "Secondary Dominant": 1.15,
      "Modal Interchange": 0.75,
      "Tritone Sub": 0.75,
    },
    targetTension: 1.4,
    promptHint:
      "Classic functional harmony following clear Tonic-Subdominant-Dominant cycles, circle of fifths, and clean 3rd/7th resolutions.",
    extensionStyle: {
      tonicMaj: ["maj7", ""],
      subdomMaj: ["maj7", ""],
      minor: ["m7", "m"],
      dominant: ["7"],
      secDominant: ["7"],
      halfDim: ["m7b5"],
      subMinor: ["m6", "m"],
      tritoneSub: ["7"],
    },
  },
];

function normalizeNote(note: string): string {
  return Note.simplify(note) || note;
}

function getChroma(note: string): number {
  const c = Note.chroma(note);
  return typeof c === "number" ? c : 0;
}

/**
 * Convert a relative pitch class (0..11) from `keyTonic` into a clean note name
 */
const INTERVAL_FROM_REL_PC: Record<number, string> = {
  0: "1P",
  1: "2m",
  2: "2M",
  3: "3m",
  4: "3M",
  5: "4P",
  6: "5d",
  7: "5P",
  8: "6m",
  9: "6M",
  10: "7m",
  11: "7M",
};

const ROMAN_PREFIX_MAJOR: Record<number, string> = {
  0: "I",
  1: "bII",
  2: "ii",
  3: "bIII",
  4: "iii",
  5: "IV",
  6: "#iv",
  7: "V",
  8: "bVI",
  9: "vi",
  10: "bVII",
  11: "vii",
};

const ROMAN_PREFIX_MINOR: Record<number, string> = {
  0: "i",
  1: "bII",
  2: "ii",
  3: "bIII",
  4: "III",
  5: "iv",
  6: "#iv",
  7: "v",
  8: "bVI",
  9: "vi",
  10: "bVII",
  11: "vii",
};

export function buildSmoothVoicing(
  chordSymbol: string,
  prevVoicing?: string[]
): VoiceLeadingAnalysis {
  const chordData = Chord.get(chordSymbol);
  let rawNotes = chordData.notes.length
    ? chordData.notes.map(normalizeNote)
    : [];

  // Fallback for special Neo-Soul symbols like 7#9#5 or maj9#11 if Tonal returns empty
  if (rawNotes.length === 0) {
    const m = chordSymbol.match(/^([A-G][b#]?)(.*)$/);
    const root = m ? m[1] : "C";
    const suf = m ? m[2] : "";
    if (suf.includes("7#9#5")) {
      rawNotes = ["1P", "3M", "6m", "7m", "2A"].map((iv) =>
        normalizeNote(Note.transpose(root, iv))
      );
    } else if (suf.includes("maj9#11")) {
      rawNotes = ["1P", "3M", "5P", "7M", "9M", "11A"].map((iv) =>
        normalizeNote(Note.transpose(root, iv))
      );
    } else if (suf.includes("9sus4")) {
      rawNotes = ["1P", "4P", "5P", "7m", "9M"].map((iv) =>
        normalizeNote(Note.transpose(root, iv))
      );
    } else {
      rawNotes = [
        root,
        normalizeNote(Note.transpose(root, "3M")),
        normalizeNote(Note.transpose(root, "5P")),
        normalizeNote(Note.transpose(root, "7m")),
      ];
    }
  }

  const root = rawNotes[0];
  const rootChroma = getChroma(root);
  const bassOctave = rootChroma >= 7 ? 2 : 3;
  const bassNote = `${root}${bassOctave}`;

  let upperPitchClasses: string[];
  if (rawNotes.length >= 5) {
    upperPitchClasses = [
      rawNotes[1],
      rawNotes[2],
      rawNotes[3],
      rawNotes[rawNotes.length - 1],
    ];
  } else if (rawNotes.length === 4) {
    upperPitchClasses = rawNotes.slice(0, 4);
  } else {
    upperPitchClasses = [...rawNotes];
  }

  if (!prevVoicing || prevVoicing.length < 2) {
    let lastMidi = Note.midi(bassNote) ?? 48;
    const voicingNotes = [bassNote];
    for (const pc of upperPitchClasses) {
      let candidateOctave = 3;
      while (
        (Note.midi(`${pc}${candidateOctave}`) ?? 60) <= Math.max(lastMidi, 54)
      ) {
        candidateOctave++;
      }
      const voiced = `${pc}${candidateOctave}`;
      lastMidi = Note.midi(voiced) ?? lastMidi + 3;
      voicingNotes.push(voiced);
    }
    return {
      commonTones: [],
      halfStepResolutions: [],
      totalSemitoneMove: 0,
      smoothnessScore: 90,
      voicingNotes,
    };
  }

  const prevUpper = prevVoicing.slice(1);
  const prevUpperMidis = prevUpper.map((n) => Note.midi(n) ?? 60);
  const avgPrevMidi =
    prevUpperMidis.reduce((a, b) => a + b, 0) / (prevUpperMidis.length || 1);

  const chosenUpperMidis: { note: string; midi: number; pc: string }[] = [];
  for (const pc of upperPitchClasses) {
    const candidates = [3, 4, 5]
      .map((oct) => {
        const note = `${pc}${oct}`;
        const midi = Note.midi(note) ?? 60;
        return { note, midi, pc };
      })
      .filter((c) => c.midi >= 53 && c.midi <= 77);

    candidates.sort(
      (a, b) => Math.abs(a.midi - avgPrevMidi) - Math.abs(b.midi - avgPrevMidi)
    );
    chosenUpperMidis.push(candidates[0] || { note: `${pc}4`, midi: 60, pc });
  }

  chosenUpperMidis.sort((a, b) => a.midi - b.midi);
  const voicingNotes = [bassNote, ...chosenUpperMidis.map((c) => c.note)];

  const prevPCs = prevVoicing.map((n) => Note.pitchClass(n));
  const commonTones: string[] = [];
  const halfStepResolutions: string[] = [];

  for (const pc of rawNotes) {
    const ch = getChroma(pc);
    const hasSame = prevPCs.some((p) => getChroma(p) === ch);
    if (hasSame && !commonTones.includes(pc)) {
      commonTones.push(pc);
    }
  }

  for (const prevN of prevUpper) {
    const prevM = Note.midi(prevN) ?? 60;
    const prevPC = Note.pitchClass(prevN);
    for (const curr of chosenUpperMidis) {
      const diff = Math.abs(curr.midi - prevM);
      if (diff === 1) {
        const label = `${prevPC}→${curr.pc}`;
        if (!halfStepResolutions.includes(label)) {
          halfStepResolutions.push(label);
        }
      }
    }
  }

  let totalSemitoneMove = 0;
  const len = Math.min(prevUpperMidis.length, chosenUpperMidis.length);
  for (let i = 0; i < len; i++) {
    totalSemitoneMove += Math.abs(chosenUpperMidis[i].midi - prevUpperMidis[i]);
  }

  const smoothnessScore = Math.max(
    35,
    Math.min(
      99,
      Math.round(
        100 -
          totalSemitoneMove * 4.2 +
          commonTones.length * 6 +
          halfStepResolutions.length * 7
      )
    )
  );

  return {
    commonTones,
    halfStepResolutions,
    totalSemitoneMove,
    smoothnessScore,
    voicingNotes,
  };
}

function buildGenreAwareChordSymbols(
  root: string,
  role:
    | "tonicMaj"
    | "subdomMaj"
    | "minor"
    | "dominant"
    | "secDominant"
    | "halfDim"
    | "subMinor"
    | "tritoneSub",
  complexity: ComplexityLevel,
  mood: MoodPreset
): string[] {
  if (complexity === "triad") {
    const map: Record<typeof role, string[]> = {
      tonicMaj: [root, `${root}add9`],
      subdomMaj: [root, `${root}add9`],
      minor: [`${root}m`],
      dominant: [root, `${root}sus4`],
      secDominant: [`${root}7`],
      halfDim: [`${root}dim`],
      subMinor: [`${root}m`],
      tritoneSub: [`${root}7`],
    };
    return map[role];
  }
  if (complexity === "seventh") {
    const map: Record<typeof role, string[]> = {
      tonicMaj: [`${root}maj7`],
      subdomMaj: [`${root}maj7`],
      minor: [`${root}m7`],
      dominant: [`${root}7`],
      secDominant: [`${root}7`],
      halfDim: [`${root}m7b5`],
      subMinor: [`${root}m7`, `${root}m6`],
      tritoneSub: [`${root}7`],
    };
    return map[role];
  }
  if (complexity === "extended") {
    const map: Record<typeof role, string[]> = {
      tonicMaj: [`${root}maj9`],
      subdomMaj: [`${root}maj9`],
      minor: [`${root}m9`, `${root}m11`],
      dominant: [`${root}13`, `${root}9sus4`],
      secDominant: [`${root}7#9#5`, `${root}7b9`],
      halfDim: [`${root}m7b5`],
      subMinor: [`${root}m9`, `${root}m6`],
      tritoneSub: [`${root}9`, `${root}7#11`],
    };
    return map[role];
  }
  const suffixes = mood.extensionStyle[role] || ["maj7"];
  return suffixes.slice(0, 2).map((suf) => `${root}${suf}`);
}

/**
 * Assign Emotion Quadrant & Angle (0°=12시 Bright/Expand, 90°=3시 Tension/Drive, 180°=6시 Deep/Soul/Modal, 270°=9시 Peace/Rest)
 */
function computeEmotionCoordinates(
  harmonicFunction: HarmonicFunction,
  category: HarmonicCategory,
  relPc: number,
  symbol: string,
  indexInGroup: number
): {
  emotionQuadrant: EmotionQuadrant;
  emotionLabel: string;
  emotionAngleDeg: number;
} {
  // Deterministic jitter based on symbol characters and relPc so nodes spread neatly inside their quadrant
  const hash = symbol
    .split("")
    .reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 3), relPc * 13);
  const spreadOffset = ((hash % 56) - 28) + ((indexInGroup % 3) - 1) * 8; // -36° to +36°

  if (harmonicFunction === "Subdominant" && category === "diatonic") {
    // 12시 (Top: 325° ~ 35°): 밝음 · 설렘 · 공간 확장
    const angle = (360 + spreadOffset) % 360;
    return {
      emotionQuadrant: "bright_expand",
      emotionLabel: symbol.includes("sus")
        ? "설렘 · 부유하는 그루브"
        : "밝음 · 공간감 확장",
      emotionAngleDeg: angle,
    };
  }

  if (
    harmonicFunction === "Dominant" ||
    harmonicFunction === "Secondary Dominant"
  ) {
    // 3시 (Right: 55° ~ 125°): 긴장 · 추진력 · 에너지
    const angle = (90 + spreadOffset + 360) % 360;
    return {
      emotionQuadrant: "tension_drive",
      emotionLabel:
        category === "secondary_dominant"
          ? "강렬한 색채 · 추진력"
          : "에너지 고조 · 긴장감",
      emotionAngleDeg: angle,
    };
  }

  if (
    category === "modal_interchange" ||
    category === "tritone_sub" ||
    harmonicFunction === "Modal Interchange" ||
    harmonicFunction === "Tritone Sub"
  ) {
    // 6시 (Bottom: 145° ~ 215°): 애절함 · 몽환 · 다크/재즈 반전
    const angle = (180 + spreadOffset + 360) % 360;
    return {
      emotionQuadrant: "deep_soul",
      emotionLabel:
        category === "tritone_sub"
          ? "몽환적 반음 하행 · 재즈 텐션"
          : "애절한 차용화음 · 깊은 소울",
      emotionAngleDeg: angle,
    };
  }

  // 9시 (Left: 235° ~ 305°): 평온 · 안정 · 서정적 안식 (Tonic / vi / iii)
  const angle = (270 + spreadOffset + 360) % 360;
  return {
    emotionQuadrant: "peace_rest",
    emotionLabel:
      relPc === 0 ? "평온 · 중심 안식 (Tonic)" : "서정적 여운 · 대리 토닉",
    emotionAngleDeg: angle,
  };
}

function evaluateTransitionTheory(
  progression: ProgressionStep[],
  candidate: {
    symbol: string;
    roman: string;
    root: string;
    category: HarmonicCategory;
    harmonicFunction: HarmonicFunction;
    functionKorean: string;
    corpusCount: number;
    corpusSongs: CorpusSongRef[];
  },
  keyTonic: string,
  keyMode: KeyMode,
  voiceLeading: VoiceLeadingAnalysis,
  barIndex: number
): { title: string; reason: string; weight: number; idiomTag?: string } {
  const prevChord =
    progression.length > 0 ? progression[progression.length - 1] : null;
  const twoBackChord =
    progression.length > 1 ? progression[progression.length - 2] : null;

  const corpusBonus = Math.min(14, Math.round(Math.log2(candidate.corpusCount + 1) * 3.2));
  const corpusNote =
    candidate.corpusCount > 0
      ? ` [네오소울 코퍼스 ${candidate.corpusCount}회 등장: ${candidate.corpusSongs
          .slice(0, 2)
          .map((s) => s.title)
          .join(", ")}]`
      : "";

  // Bar 1 (Starting Chord Selection Mode!)
  if (!prevChord) {
    if (candidate.roman.startsWith("I") || candidate.roman.startsWith("i")) {
      return {
        title: "토닉(Tonic) 센터 오프닝",
        reason: `${keyTonic} ${keyMode === "major" ? "메이저" : "마이너"}의 중심 화음(${candidate.symbol})으로 시작합니다.${corpusNote}`,
        weight: Math.min(98, 90 + corpusBonus),
        idiomTag: "Tonic Opening",
      };
    }
    if (candidate.roman.startsWith("IV") || candidate.roman.startsWith("iv")) {
      return {
        title: "서브도미넌트 오프닝 (IV 시작 기법)",
        reason: `시티팝·네오소울에서 가장 사랑받는 ${candidate.symbol}(${candidate.roman}) 오프닝으로 첫 마디부터 세련된 공간감을 만듭니다.${corpusNote}`,
        weight: Math.min(97, 88 + corpusBonus),
        idiomTag: "Subdominant Opening",
      };
    }
    if (candidate.roman.startsWith("vi") || candidate.roman.startsWith("bVI")) {
      return {
        title: "에올리안(vi/bVI) 감성 오프닝",
        reason: `서정적이고 아련한 색채의 ${candidate.symbol} 화음으로 시작합니다.${corpusNote}`,
        weight: Math.min(95, 83 + corpusBonus),
        idiomTag: "Emotional Opening",
      };
    }
    if (candidate.roman.startsWith("ii")) {
      return {
        title: "투-파이브(ii-V) 그루브 오프닝",
        reason: `2도 화음(${candidate.symbol})으로 시작하여 곧바로 리드미컬한 도미넌트 흐름을 타는 네오소울·재즈 오프닝입니다.${corpusNote}`,
        weight: Math.min(95, 84 + corpusBonus),
        idiomTag: "ii-V Groove Opening",
      };
    }
    return {
      title: `${candidate.functionKorean} 오프닝`,
      reason: `${candidate.symbol} (${candidate.roman}) 코드로 개성 있는 첫 마디를 시작합니다.${corpusNote}`,
      weight: Math.min(92, 68 + corpusBonus),
      idiomTag: candidate.corpusCount > 0 ? "Neo-Soul Opening" : undefined,
    };
  }

  const prevRoot = Chord.get(prevChord.symbol).tonic || "C";
  const currRoot = candidate.root;
  const rootIntervalSemitones =
    ((getChroma(currRoot) - getChroma(prevRoot)) % 12 + 12) % 12;

  const recentUses = progression
    .slice(-4)
    .filter((s) => Chord.get(s.symbol).tonic === currRoot).length;
  const isImmediateRepeat = prevChord.symbol === candidate.symbol;
  const isPingPongRepeat =
    twoBackChord &&
    Chord.get(twoBackChord.symbol).tonic === currRoot &&
    prevChord.harmonicFunction !== "Dominant";

  if (isImmediateRepeat) {
    return {
      title: "동일 화음 지속 (Harmonic Pedal)",
      reason: "직전 마디와 동일한 화음을 유지합니다.",
      weight: 22,
    };
  }

  let weight = 62;
  let title = `${prevChord.roman} → ${candidate.roman} 화성 진행`;
  let reason = `${prevChord.harmonicFunction}에서 ${candidate.harmonicFunction} 기능으로 이어지는 진행입니다.`;
  let idiomTag: string | undefined;

  if (
    twoBackChord &&
    twoBackChord.roman.startsWith("ii") &&
    prevChord.harmonicFunction === "Dominant" &&
    (candidate.roman.startsWith("I") || candidate.roman.startsWith("i"))
  ) {
    weight = 96;
    title = `투-파이브-원 (ii → V → I) 완결 종지`;
    reason = `${twoBackChord.symbol} → ${prevChord.symbol} 투-파이브 에너지를 ${candidate.symbol} 토닉으로 완벽하게 착지시킵니다.`;
    idiomTag = "ii-V-I Cadence";
  } else if (
    twoBackChord &&
    twoBackChord.roman.startsWith("IV") &&
    prevChord.roman.startsWith("V") &&
    candidate.roman.startsWith("iii")
  ) {
    weight = 95;
    title = `왕도 진행 (Royal Road: IV → V → iii)`;
    reason = `IV → V 뒤에 토닉 대리인 ${candidate.symbol}(iii)로 진행해 아련한 도시적 감성을 만듭니다.`;
    idiomTag = "왕도 진행";
  } else if (
    twoBackChord &&
    twoBackChord.roman.startsWith("V") &&
    prevChord.roman.startsWith("iii") &&
    candidate.roman.startsWith("vi")
  ) {
    weight = 96;
    title = `왕도 진행 완성 (V → iii → vi)`;
    reason = `3도 대리화음(${prevChord.symbol})에서 완전4도 상행하여 ${candidate.symbol}(vi)로 이어지는 왕도 진행입니다.`;
    idiomTag = "왕도 진행";
  } else if (
    prevChord.roman.startsWith("IV") &&
    !prevChord.roman.startsWith("iv") &&
    candidate.roman === "V7/vi"
  ) {
    weight = 94;
    title = `Just The Two Of Us 진행 (IV → III7)`;
    reason = `IV에서 반음 하행 베이스로 세컨더리 도미넌트 ${candidate.symbol}(III7)을 연결하는 네오소울 대표 관용구입니다.`;
    idiomTag = "Just The Two Of Us";
  } else if (
    (prevChord.roman.startsWith("iv") || prevChord.roman.startsWith("ii")) &&
    candidate.roman.startsWith("bVII")
  ) {
    weight = 93;
    title = `백도어 도미넌트 진입 (${prevChord.roman} → bVII)`;
    reason = `패러렐 마이너에서 빌려온 ${candidate.symbol}로 진행해 네오소울 백도어 케이던스를 준비합니다.`;
    idiomTag = "Backdoor Dominant";
  } else if (
    prevChord.roman.startsWith("bVII") &&
    candidate.roman.startsWith("I")
  ) {
    weight = 95;
    title = `백도어 케이던스 해결 (bVII → I)`;
    reason = `백도어 도미넌트(${prevChord.symbol})에서 장2도 상행하여 ${candidate.symbol}로 힙하게 해결됩니다.`;
    idiomTag = "Backdoor Cadence";
  } else if (
    prevChord.roman.startsWith("IV") &&
    !prevChord.roman.startsWith("iv") &&
    candidate.roman.startsWith("iv")
  ) {
    weight = 94;
    title = `서브도미넌트 마이너 라인 클리셰 (IV → ivm)`;
    reason = `장3음이 단3음으로 반음 내려가며(${candidate.symbol}) 깊은 애수를 자아냅니다.`;
    idiomTag = "Modal Line Cliché";
  } else if (
    prevChord.category === "secondary_dominant" &&
    rootIntervalSemitones === 5
  ) {
    weight = 96;
    title = `세컨더리 도미넌트 완전5도 해결 (${prevChord.roman} → ${candidate.roman})`;
    reason = `직전 부속화음(${prevChord.symbol})의 가이드톤 트라이톤이 타깃 화음 ${candidate.symbol}로 해결됩니다.`;
    idiomTag = "Secondary Resolution";
  } else if (
    prevChord.harmonicFunction === "Subdominant" &&
    candidate.category === "tritone_sub" &&
    rootIntervalSemitones === 11
  ) {
    weight = 94;
    title = `반음 하행 트라이톤 대리 투-파이브 (ii → subV7)`;
    reason = `서브도미넌트(${prevChord.symbol})에서 반음 아래의 ${candidate.symbol}로 진행해 크로매틱 베이스 라인을 만듭니다.`;
    idiomTag = "Chromatic ii-subV-I";
  } else if (
    prevChord.category === "tritone_sub" &&
    rootIntervalSemitones === 11
  ) {
    weight = 96;
    title = `트라이톤 대리 반음 하행 해결 (${prevChord.roman} → ${candidate.roman})`;
    reason = `트라이톤 대리(${prevChord.symbol})에서 베이스가 반음 하행하여 ${candidate.symbol}로 매끄럽게 착지합니다.`;
    idiomTag = "Tritone Resolution";
  } else if (
    prevChord.harmonicFunction === "Dominant" &&
    candidate.harmonicFunction === "Tonic" &&
    rootIntervalSemitones === 5
  ) {
    weight = 94;
    title = `정격종지 (Authentic Cadence: ${prevChord.roman} → ${candidate.roman})`;
    reason = `도미넌트(${prevChord.symbol})의 긴장감이 으뜸화음(${candidate.symbol})으로 완전 해결됩니다.`;
    idiomTag = "Authentic Cadence";
  } else if (
    (rootIntervalSemitones === 3 ||
      rootIntervalSemitones === 4 ||
      rootIntervalSemitones === 8 ||
      rootIntervalSemitones === 9) &&
    (candidate.category === "modal_interchange" ||
      candidate.category === "secondary_dominant")
  ) {
    weight = 90;
    title = `3도권 크로매틱 메디언트 (${prevChord.roman} → ${candidate.roman})`;
    reason = `근음이 3도 관계로 이동하며 공통음을 유지한 채 색채음(${candidate.symbol})으로 분위기를 전환합니다.`;
    idiomTag = "Chromatic Mediant";
  } else if (rootIntervalSemitones === 5) {
    weight = 90;
    title = `5도권 순환 진행 (${prevChord.roman} → ${candidate.roman})`;
    reason = `근음이 완전4도 상행(5도 하행)하는 자연스러운 5도권 화성 연결입니다.`;
    idiomTag = "Circle of 5ths";
  } else if (rootIntervalSemitones === 2 || rootIntervalSemitones === 10) {
    weight = 86;
    title = `온음 순차 그루브 진행 (${prevChord.roman} → ${candidate.roman})`;
    reason = `네오소울·R&B에서 자주 쓰이는 온음(장2도) 패러렐/순차 이동 진행입니다.`;
    idiomTag = "Neo-Soul Stepwise";
  }

  reason += corpusNote;
  weight += corpusBonus;

  if (recentUses >= 2) {
    weight -= 16;
  } else if (recentUses === 1 && isPingPongRepeat) {
    weight -= 12;
  }

  if ((barIndex + 1) % 4 === 0) {
    if (
      candidate.harmonicFunction === "Dominant" ||
      candidate.harmonicFunction === "Tonic" ||
      candidate.category === "tritone_sub"
    ) {
      weight += 4;
    }
  }

  weight = Math.max(
    20,
    Math.min(
      99,
      Math.round(weight * 0.78 + voiceLeading.smoothnessScore * 0.22)
    )
  );

  return { title, reason, weight, idiomTag: idiomTag || (candidate.corpusCount >= 3 ? "Neo-Soul Corpus" : undefined) };
}

/**
 * Retrieve empirical Neo-Soul corpus transitions for the current state (Methods 1 & 2)
 */
function lookupCorpusEntries(
  keyTonic: string,
  keyMode: KeyMode,
  progression: ProgressionStep[]
): Map<string, CorpusEntry> {
  const keyPc = getChroma(keyTonic);
  const resultMap = new Map<string, CorpusEntry>();

  if (progression.length === 0) {
    const list = neoSoulCorpus.openings[keyMode] || [];
    for (const item of list) {
      resultMap.set(`${item.relPc}:${item.qual}`, item);
    }
    return resultMap;
  }

  const prevStep = progression[progression.length - 1];
  const prevRoot = Chord.get(prevStep.symbol).tonic || keyTonic;
  const prevRelPc = ((getChroma(prevRoot) - keyPc) % 12 + 12) % 12;

  // 1) Check 3-gram first if >= 2 bars
  if (progression.length >= 2) {
    const twoBack = progression[progression.length - 2];
    const twoBackRoot = Chord.get(twoBack.symbol).tonic || keyTonic;
    const twoBackRelPc = ((getChroma(twoBackRoot) - keyPc) % 12 + 12) % 12;
    const key3 = `${twoBackRelPc}->${prevRelPc}`;
    const list3 = neoSoulCorpus.transitions3Gram[keyMode]?.[key3] || [];
    for (const item of list3) {
      resultMap.set(`${item.relPc}:${item.qual}`, {
        ...item,
        count: item.count * 2, // Boost 3-gram exact context matches
      });
    }
  }

  // 2) Merge 2-gram matches
  const list2 = neoSoulCorpus.transitions2Gram[keyMode]?.[String(prevRelPc)] || [];
  for (const item of list2) {
    const k = `${item.relPc}:${item.qual}`;
    const existing = resultMap.get(k);
    if (existing) {
      const mergedSongs = [...existing.songs];
      for (const s of item.songs) {
        if (mergedSongs.length < 4 && !mergedSongs.some((x) => x.id === s.id)) {
          mergedSongs.push(s);
        }
      }
      resultMap.set(k, {
        relPc: item.relPc,
        qual: item.qual,
        count: existing.count + item.count,
        songs: mergedSongs,
      });
    } else {
      resultMap.set(k, item);
    }
  }

  return resultMap;
}

/**
 * Classify a corpus-injected chord's category & function
 */
function classifyCorpusChord(
  relPc: number,
  qual: string,
  keyMode: KeyMode
): {
  category: HarmonicCategory;
  categoryLabel: string;
  harmonicFunction: HarmonicFunction;
  functionKorean: string;
  roman: string;
  tensionLevel: number;
} {
  const prefix =
    keyMode === "major"
      ? ROMAN_PREFIX_MAJOR[relPc] || "I"
      : ROMAN_PREFIX_MINOR[relPc] || "i";
  const roman = `${prefix}${qual.replace(/^m/, "")}`;

  const isDom =
    qual.startsWith("7") ||
    qual === "9" ||
    qual === "13" ||
    qual.includes("sus4");

  if (relPc === 1 && isDom) {
    return {
      category: "tritone_sub",
      categoryLabel: "트라이톤 대리 (코퍼스)",
      harmonicFunction: "Tritone Sub",
      functionKorean: "네오소울 트라이톤 대리 (bII)",
      roman: `subV7/I (${roman})`,
      tensionLevel: 3.4,
    };
  }

  const diatonicRelPcs =
    keyMode === "major" ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  if (!diatonicRelPcs.includes(relPc)) {
    if (isDom) {
      return {
        category: "tritone_sub",
        categoryLabel: "대리/크로매틱 도미넌트",
        harmonicFunction: "Tritone Sub",
        functionKorean: "네오소울 크로매틱 도미넌트",
        roman,
        tensionLevel: 3.3,
      };
    }
    return {
      category: "modal_interchange",
      categoryLabel: "모달 인터체인지 (코퍼스)",
      harmonicFunction: "Modal Interchange",
      functionKorean: "네오소울 차용화음",
      roman,
      tensionLevel: 2.8,
    };
  }

  // Diatonic root but altered/secondary dominant quality
  if (
    keyMode === "major" &&
    isDom &&
    relPc !== 7 &&
    !qual.includes("sus4")
  ) {
    return {
      category: "secondary_dominant",
      categoryLabel: "세컨더리 도미넌트 (코퍼스)",
      harmonicFunction: "Secondary Dominant",
      functionKorean: "네오소울 부속화음",
      roman,
      tensionLevel: 2.9,
    };
  }

  if (
    keyMode === "major" &&
    relPc === 5 &&
    qual.startsWith("m") &&
    !qual.startsWith("maj")
  ) {
    return {
      category: "modal_interchange",
      categoryLabel: "모달 인터체인지 (코퍼스)",
      harmonicFunction: "Modal Interchange",
      functionKorean: "서브도미넌트 마이너 (iv)",
      roman: `iv${qual.slice(1)}`,
      tensionLevel: 2.6,
    };
  }

  const func: HarmonicFunction =
    relPc === 0 || relPc === 4 || relPc === 9 || (keyMode === "minor" && relPc === 3)
      ? "Tonic"
      : relPc === 7 || relPc === 11
        ? "Dominant"
        : "Subdominant";

  return {
    category: "diatonic",
    categoryLabel: "네오소울 다이아토닉",
    harmonicFunction: func,
    functionKorean: `네오소울 실전 보이싱 (${func})`,
    roman,
    tensionLevel: qual.includes("11") || qual.includes("13") ? 2.4 : 1.7,
  };
}

/**
 * Generate all legal/musical next chord candidates in the given key using Tonal.js + Neo-Soul Corpus RAG
 */
export function generateChordCandidates(params: {
  keyTonic: string;
  keyMode: KeyMode;
  progression: ProgressionStep[];
  complexity: ComplexityLevel;
  enabledCategories: Record<HarmonicCategory, boolean>;
  mood?: MoodPreset;
}): ChordCandidate[] {
  const {
    keyTonic,
    keyMode,
    progression,
    complexity,
    enabledCategories,
    mood = MOOD_PRESETS[0],
  } = params;
  const prevStep =
    progression.length > 0 ? progression[progression.length - 1] : null;
  const prevVoicing = prevStep?.voicingNotes;
  const nextBarIndex = progression.length;
  const keyPc = getChroma(keyTonic);

  // Retrieve empirical corpus matches for the current state (Method 1)
  const corpusMap = lookupCorpusEntries(keyTonic, keyMode, progression);

  const rawList: Array<{
    symbol: string;
    roman: string;
    category: HarmonicCategory;
    categoryLabel: string;
    harmonicFunction: HarmonicFunction;
    functionKorean: string;
    tensionLevel: number;
    isFromCorpus?: boolean;
  }> = [];

  if (keyMode === "major") {
    const majKey = Key.majorKey(keyTonic);
    const scale = majKey.scale;

    if (enabledCategories.diatonic && scale.length >= 7) {
      const degreeSpecs: Array<{
        degIdx: number;
        role: "tonicMaj" | "subdomMaj" | "minor" | "dominant" | "halfDim";
        baseRoman: string;
        func: HarmonicFunction;
        funcKor: string;
        baseTension: number;
      }> = [
        {
          degIdx: 0,
          role: "tonicMaj",
          baseRoman: "I",
          func: "Tonic",
          funcKor: "토닉 (으뜸화음)",
          baseTension: 0.6,
        },
        {
          degIdx: 1,
          role: "minor",
          baseRoman: "ii",
          func: "Subdominant",
          funcKor: "서브도미넌트 (2도)",
          baseTension: 1.3,
        },
        {
          degIdx: 2,
          role: "minor",
          baseRoman: "iii",
          func: "Tonic",
          funcKor: "토닉 대리 (3도)",
          baseTension: 1.5,
        },
        {
          degIdx: 3,
          role: "subdomMaj",
          baseRoman: "IV",
          func: "Subdominant",
          funcKor: "서브도미넌트 (4도)",
          baseTension: 1.1,
        },
        {
          degIdx: 4,
          role: "dominant",
          baseRoman: "V",
          func: "Dominant",
          funcKor: "도미넌트 (5도)",
          baseTension: 1.9,
        },
        {
          degIdx: 5,
          role: "minor",
          baseRoman: "vi",
          func: "Tonic",
          funcKor: "토닉 대리 (6도)",
          baseTension: 1.0,
        },
        {
          degIdx: 6,
          role: "halfDim",
          baseRoman: "viiø",
          func: "Dominant",
          funcKor: "도미넌트 대리 (7도)",
          baseTension: 2.5,
        },
      ];

      for (const spec of degreeSpecs) {
        const root = normalizeNote(scale[spec.degIdx]);
        const symbols = buildGenreAwareChordSymbols(
          root,
          spec.role,
          complexity,
          mood
        );
        const primarySym = symbols[0];
        const suffix = primarySym.slice(root.length);
        rawList.push({
          symbol: primarySym,
          roman: `${spec.baseRoman}${suffix.replace(/^m/, "")}`,
          category: "diatonic",
          categoryLabel: "다이아토닉",
          harmonicFunction: spec.func,
          functionKorean: spec.funcKor,
          tensionLevel: spec.baseTension,
        });
      }
    }

    if (enabledCategories.secondary_dominant) {
      const secDomSpecs = [
        { degRoman: "VI7", label: "V7/ii", target: "ii", tension: 2.7 },
        { degRoman: "VII7", label: "V7/iii", target: "iii", tension: 2.9 },
        { degRoman: "I7", label: "V7/IV", target: "IV", tension: 2.3 },
        { degRoman: "II7", label: "V7/V", target: "V", tension: 2.5 },
        { degRoman: "III7", label: "V7/vi", target: "vi", tension: 2.5 },
      ];
      const converted = Progression.fromRomanNumerals(
        keyTonic,
        secDomSpecs.map((s) => s.degRoman)
      );
      secDomSpecs.forEach((spec, idx) => {
        const baseDom = converted[idx];
        if (!baseDom) return;
        const root = normalizeNote(
          Chord.get(baseDom).tonic || baseDom.replace(/7$/, "")
        );
        const syms = buildGenreAwareChordSymbols(
          root,
          "secDominant",
          complexity,
          mood
        );
        rawList.push({
          symbol: syms[0] || `${root}7`,
          roman: spec.label,
          category: "secondary_dominant",
          categoryLabel: "세컨더리 도미넌트",
          harmonicFunction: "Secondary Dominant",
          functionKorean: `부속화음 (→ ${spec.target})`,
          tensionLevel: spec.tension,
        });
      });
    }

    if (enabledCategories.modal_interchange) {
      const ivRoot = normalizeNote(Note.transpose(keyTonic, "4P"));
      const bVIIRoot = normalizeNote(Note.transpose(keyTonic, "7m"));
      const bVIRoot = normalizeNote(Note.transpose(keyTonic, "6m"));
      const bIIIRoot = normalizeNote(Note.transpose(keyTonic, "3m"));

      const ivSym =
        buildGenreAwareChordSymbols(ivRoot, "subMinor", complexity, mood)[0] ||
        `${ivRoot}m6`;
      const bVIISym =
        buildGenreAwareChordSymbols(
          bVIIRoot,
          "dominant",
          complexity,
          mood
        )[0] || `${bVIIRoot}9`;
      const bVISym =
        buildGenreAwareChordSymbols(
          bVIRoot,
          "subdomMaj",
          complexity,
          mood
        )[0] || `${bVIRoot}maj7`;
      const bIIISym =
        buildGenreAwareChordSymbols(
          bIIIRoot,
          "subdomMaj",
          complexity,
          mood
        )[0] || `${bIIIRoot}maj7`;

      rawList.push(
        {
          symbol: ivSym,
          roman: `iv${ivSym.slice(ivRoot.length).replace(/^m/, "")}`,
          category: "modal_interchange",
          categoryLabel: "모달 인터체인지",
          harmonicFunction: "Modal Interchange",
          functionKorean: "서브도미넌트 마이너",
          tensionLevel: 2.5,
        },
        {
          symbol: bVIISym,
          roman: `bVII${bVIISym.slice(bVIIRoot.length)}`,
          category: "modal_interchange",
          categoryLabel: "모달 인터체인지",
          harmonicFunction: "Modal Interchange",
          functionKorean: "백도어 도미넌트",
          tensionLevel: 2.7,
        },
        {
          symbol: bVISym,
          roman: `bVI${bVISym.slice(bVIRoot.length)}`,
          category: "modal_interchange",
          categoryLabel: "모달 인터체인지",
          harmonicFunction: "Modal Interchange",
          functionKorean: "에올리안 6도 차용화음",
          tensionLevel: 2.5,
        },
        {
          symbol: bIIISym,
          roman: `bIII${bIIISym.slice(bIIIRoot.length)}`,
          category: "modal_interchange",
          categoryLabel: "모달 인터체인지",
          harmonicFunction: "Modal Interchange",
          functionKorean: "크로매틱 메디언트 (bIII)",
          tensionLevel: 2.8,
        }
      );
    }

    if (enabledCategories.tritone_sub) {
      const bIIRoot = normalizeNote(Note.transpose(keyTonic, "2m"));
      const bIIIRoot = normalizeNote(Note.transpose(keyTonic, "3m"));
      const subISym =
        buildGenreAwareChordSymbols(
          bIIRoot,
          "tritoneSub",
          complexity,
          mood
        )[0] || `${bIIRoot}9`;
      const subiiSym =
        buildGenreAwareChordSymbols(
          bIIIRoot,
          "tritoneSub",
          complexity,
          mood
        )[0] || `${bIIIRoot}7`;

      rawList.push(
        {
          symbol: subISym,
          roman: "subV7/I (bII)",
          category: "tritone_sub",
          categoryLabel: "트라이톤 대리",
          harmonicFunction: "Tritone Sub",
          functionKorean: "트라이톤 대리 (→ I 반음 하행)",
          tensionLevel: 3.4,
        },
        {
          symbol: subiiSym,
          roman: "subV7/ii (bIII7)",
          category: "tritone_sub",
          categoryLabel: "트라이톤 대리",
          harmonicFunction: "Tritone Sub",
          functionKorean: "세컨더리 트라이톤 대리 (→ ii)",
          tensionLevel: 3.5,
        }
      );
    }
  } else {
    // Minor Key
    const minKey = Key.minorKey(keyTonic);
    const scale = minKey.natural.scale;

    if (enabledCategories.diatonic && scale.length >= 7) {
      const minSpecs: Array<{
        idx: number;
        role: "minor" | "halfDim" | "tonicMaj" | "subdomMaj" | "dominant";
        roman: string;
        func: HarmonicFunction;
        funcKor: string;
        tension: number;
      }> = [
        {
          idx: 0,
          role: "minor",
          roman: "i",
          func: "Tonic",
          funcKor: "마이너 토닉",
          tension: 0.8,
        },
        {
          idx: 1,
          role: "halfDim",
          roman: "iiø",
          func: "Subdominant",
          funcKor: "마이너 2도",
          tension: 2.1,
        },
        {
          idx: 2,
          role: "tonicMaj",
          roman: "bIII",
          func: "Tonic",
          funcKor: "나란한장조 대리",
          tension: 1.2,
        },
        {
          idx: 3,
          role: "minor",
          roman: "iv",
          func: "Subdominant",
          funcKor: "마이너 서브도미넌트",
          tension: 1.4,
        },
        {
          idx: 5,
          role: "subdomMaj",
          roman: "bVI",
          func: "Subdominant",
          funcKor: "에올리안 6도",
          tension: 1.5,
        },
        {
          idx: 6,
          role: "dominant",
          roman: "bVII",
          func: "Subdominant",
          funcKor: "서브토닉 (bVII)",
          tension: 1.7,
        },
      ];

      for (const spec of minSpecs) {
        const root = normalizeNote(scale[spec.idx]);
        const sym = buildGenreAwareChordSymbols(
          root,
          spec.role,
          complexity,
          mood
        )[0];
        rawList.push({
          symbol: sym,
          roman: spec.roman,
          category: "diatonic",
          categoryLabel: "다이아토닉 (마이너)",
          harmonicFunction: spec.func,
          functionKorean: spec.funcKor,
          tensionLevel: spec.tension,
        });
      }

      const domRoot = normalizeNote(scale[4]);
      const domSym = buildGenreAwareChordSymbols(
        domRoot,
        "secDominant",
        complexity,
        mood
      )[0];
      rawList.push({
        symbol: domSym,
        roman: "V7(alt)",
        category: "diatonic",
        categoryLabel: "하모닉 도미넌트",
        harmonicFunction: "Dominant",
        functionKorean: "마이너 도미넌트 해결",
        tensionLevel: 2.5,
      });
    }

    if (enabledCategories.secondary_dominant) {
      const secSpecs = [
        { romanProg: "I7", label: "V7/iv", tension: 2.5, desc: "iv 타깃 부속7화음" },
        { romanProg: "II7", label: "V7/V", tension: 2.7, desc: "V7 타깃 부속7화음" },
      ];
      const conv = Progression.fromRomanNumerals(
        keyTonic,
        secSpecs.map((s) => s.romanProg)
      );
      secSpecs.forEach((spec, idx) => {
        if (!conv[idx]) return;
        rawList.push({
          symbol: conv[idx],
          roman: spec.label,
          category: "secondary_dominant",
          categoryLabel: "세컨더리 도미넌트",
          harmonicFunction: "Secondary Dominant",
          functionKorean: spec.desc,
          tensionLevel: spec.tension,
        });
      });
    }

    if (enabledCategories.modal_interchange) {
      const dorianIV = Progression.fromRomanNumerals(keyTonic, [
        "IV9",
        "Imaj9",
      ]);
      if (dorianIV[0]) {
        rawList.push({
          symbol: dorianIV[0],
          roman: "IV9 (Dorian)",
          category: "modal_interchange",
          categoryLabel: "모달 인터체인지",
          harmonicFunction: "Modal Interchange",
          functionKorean: "도리안 IV9 그루브",
          tensionLevel: 2.5,
        });
      }
      if (dorianIV[1]) {
        rawList.push({
          symbol: dorianIV[1],
          roman: "Imaj9 (Picardy)",
          category: "modal_interchange",
          categoryLabel: "모달 인터체인지",
          harmonicFunction: "Modal Interchange",
          functionKorean: "피카르디 장조 전환",
          tensionLevel: 2.3,
        });
      }
    }

    if (enabledCategories.tritone_sub) {
      const subV = normalizeNote(Note.transpose(keyTonic, "2m"));
      rawList.push({
        symbol: `${subV}9`,
        roman: "subV7/i (bII9)",
        category: "tritone_sub",
        categoryLabel: "트라이톤 대리",
        harmonicFunction: "Tritone Sub",
        functionKorean: "트라이톤 대리 (→ i 반음 하행)",
        tensionLevel: 3.4,
      });
    }
  }

  // Method 2: Inject top verified Neo-Soul Corpus chords directly into the candidate pool!
  const sortedCorpusEntries = Array.from(corpusMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  for (const cEntry of sortedCorpusEntries) {
    const iv = INTERVAL_FROM_REL_PC[cEntry.relPc] || "1P";
    const root = normalizeNote(Note.transpose(keyTonic, iv));
    const sym = `${root}${cEntry.qual}`;
    const classified = classifyCorpusChord(cEntry.relPc, cEntry.qual, keyMode);
    if (!enabledCategories[classified.category]) continue;

    rawList.push({
      symbol: sym,
      roman: classified.roman,
      category: classified.category,
      categoryLabel: classified.categoryLabel,
      harmonicFunction: classified.harmonicFunction,
      functionKorean: classified.functionKorean,
      tensionLevel: classified.tensionLevel,
      isFromCorpus: true,
    });
  }

  const seenSymbols = new Set<string>();
  const candidates: ChordCandidate[] = [];

  rawList.forEach((item, idx) => {
    if (!item.symbol || seenSymbols.has(item.symbol)) return;
    seenSymbols.add(item.symbol);

    const voiceLeading = buildSmoothVoicing(item.symbol, prevVoicing);
    const chordObj = Chord.get(item.symbol);
    const m = item.symbol.match(/^([A-G][b#]?)/);
    const root = normalizeNote(chordObj.tonic || (m ? m[1] : "C"));
    const notes =
      chordObj.notes.length >= 3
        ? chordObj.notes.map(normalizeNote)
        : voiceLeading.voicingNotes.slice(1).map((n) => Note.pitchClass(n));

    const relPc = ((getChroma(root) - keyPc) % 12 + 12) % 12;
    const suffix = item.symbol.slice(root.length);

    // Match corpus entry (exact relPc:qual or same relPc & quality family)
    let matchedCorpus = corpusMap.get(`${relPc}:${suffix}`);
    if (!matchedCorpus) {
      for (const entry of corpusMap.values()) {
        if (entry.relPc === relPc) {
          const bothMinor =
            suffix.startsWith("m") &&
            !suffix.startsWith("maj") &&
            entry.qual.startsWith("m") &&
            !entry.qual.startsWith("maj");
          const bothMaj =
            (suffix.startsWith("maj") || suffix === "add9" || suffix === "69") &&
            (entry.qual.startsWith("maj") || entry.qual === "add9" || entry.qual === "69");
          const bothDom =
            (suffix.includes("7") || suffix.includes("9") || suffix.includes("13")) &&
            (entry.qual.includes("7") || entry.qual.includes("9") || entry.qual.includes("13"));
          if (bothMinor || bothMaj || bothDom) {
            matchedCorpus = entry;
            break;
          }
        }
      }
    }

    const corpusCount = matchedCorpus?.count ?? 0;
    const corpusSongs = matchedCorpus?.songs ?? [];

    const theoryEval = evaluateTransitionTheory(
      progression,
      {
        symbol: item.symbol,
        roman: item.roman,
        root,
        category: item.category,
        harmonicFunction: item.harmonicFunction,
        functionKorean: item.functionKorean,
        corpusCount,
        corpusSongs,
      },
      keyTonic,
      keyMode,
      voiceLeading,
      nextBarIndex
    );

    const emotionCoords = computeEmotionCoordinates(
      item.harmonicFunction,
      item.category,
      relPc,
      item.symbol,
      idx
    );

    candidates.push({
      id: `${item.symbol}-${item.roman}`,
      symbol: item.symbol,
      roman: item.roman,
      root,
      quality: chordObj.quality || suffix || "major",
      notes,
      category: item.category,
      categoryLabel: item.categoryLabel,
      harmonicFunction: item.harmonicFunction,
      functionKorean: item.functionKorean,
      tensionLevel: item.tensionLevel,
      voiceLeading,
      theoryRuleTitle: theoryEval.title,
      theoryReason: theoryEval.reason,
      idiomTag: theoryEval.idiomTag,
      baseTheoryWeight: theoryEval.weight,
      corpusCount,
      corpusSongs,
      isFromCorpus: item.isFromCorpus || corpusCount > 0,
      ...emotionCoords,
    });
  });

  return candidates.sort((a, b) => b.baseTheoryWeight - a.baseTheoryWeight).slice(0, 16);
}

export function createStepFromCandidate(
  candidate: ChordCandidate,
  barIndex: number
): ProgressionStep {
  return {
    id: `${barIndex}-${candidate.symbol}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    barIndex,
    symbol: candidate.symbol,
    roman: candidate.roman,
    category: candidate.category,
    harmonicFunction: candidate.harmonicFunction,
    notes: candidate.notes,
    voicingNotes: candidate.voiceLeading.voicingNotes,
    selectedReason: candidate.theoryRuleTitle,
    probabilityWhenChosen: candidate.jevProbability,
    corpusSongs: candidate.corpusSongs,
  };
}

export function getRootMotionLabel(
  prevSymbol: string,
  nextSymbol: string
): string {
  const r1 = Chord.get(prevSymbol).tonic;
  const r2 = Chord.get(nextSymbol).tonic;
  if (!r1 || !r2) return "";
  const semitones = ((getChroma(r2) - getChroma(r1)) % 12 + 12) % 12;
  const labels: Record<number, string> = {
    0: "근음 유지",
    1: "반음 상행 (+1)",
    2: "온음 상행 (+2)",
    3: "단3도 상행 (+3)",
    4: "장3도 상행 (+4)",
    5: "완전4도 / 5도권",
    6: "트라이톤",
    7: "완전5도 상행",
    8: "단6도 상행",
    9: "장6도 상행",
    10: "온음 하행 (-2)",
    11: "반음 하행 (-1)",
  };
  return labels[semitones] || Interval.distance(r1, r2);
}
