import React from "react";
import { Note } from "tonal";

interface PianoVisualizerProps {
  activeNotes: string[]; // e.g., ["C3", "E4", "G4", "B4"]
  commonTones?: string[]; // pitch classes e.g., ["E", "G"]
  chordSymbol?: string;
}

const OCTAVES = [2, 3, 4, 5];
const WHITE_PCS = ["C", "D", "E", "F", "G", "A", "B"];
const BLACK_AFTER: Record<string, string> = {
  C: "Db",
  D: "Eb",
  F: "Gb",
  G: "Ab",
  A: "Bb",
};

export const PianoVisualizer: React.FC<PianoVisualizerProps> = ({
  activeNotes,
  commonTones = [],
  chordSymbol,
}) => {
  const activeMidis = new Set(
    activeNotes.map((n) => Note.midi(n)).filter((m): m is number => typeof m === "number")
  );
  const commonChromas = new Set(
    commonTones.map((pc) => Note.chroma(pc)).filter((c): c is number => typeof c === "number")
  );

  const whiteKeys: { note: string; midi: number; pc: string; octave: number }[] = [];
  for (const oct of OCTAVES) {
    for (const pc of WHITE_PCS) {
      if (oct === 2 && ["C", "D", "E", "F"].includes(pc)) continue; // Start from G2
      if (oct === 5 && ["D", "E", "F", "G", "A", "B"].includes(pc)) continue; // End at C5
      const note = `${pc}${oct}`;
      const midi = Note.midi(note) ?? 60;
      whiteKeys.push({ note, midi, pc, octave: oct });
    }
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300">
            보이싱 건반 {chordSymbol ? `(${chordSymbol})` : ""}
          </span>
          <span className="text-slate-400 font-mono">
            {activeNotes.join(" · ")}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
            구성음
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
            이전 코드와 공통음
          </span>
        </div>
      </div>

      <div className="relative flex h-20 select-none overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
        {whiteKeys.map((wk) => {
          const isActive = activeMidis.has(wk.midi);
          const chroma = Note.chroma(wk.pc) ?? -1;
          const isCommon = isActive && commonChromas.has(chroma);
          const blackPc = BLACK_AFTER[wk.pc];
          const blackNote = blackPc ? `${blackPc}${wk.octave}` : null;
          const blackMidi = blackNote ? Note.midi(blackNote) ?? -1 : -1;
          const isBlackActive = blackMidi > 0 && activeMidis.has(blackMidi);
          const isBlackCommon =
            isBlackActive &&
            blackPc &&
            commonChromas.has(Note.chroma(blackPc) ?? -2);

          return (
            <div
              key={wk.note}
              className="relative flex-1 flex flex-col justify-end items-center pb-1 border-r border-slate-300/20 last:border-r-0 transition-colors"
              style={{
                backgroundColor: isCommon
                  ? "#10b981"
                  : isActive
                    ? "#6366f1"
                    : "#f1f5f9",
              }}
            >
              <span
                className={`text-[9px] font-mono font-bold ${
                  isActive ? "text-white" : "text-slate-500"
                }`}
              >
                {wk.pc === "C" || isActive ? wk.note : ""}
              </span>

              {blackNote && wk.note !== "C5" && (
                <div
                  className="absolute top-0 -right-[32%] w-[64%] h-12 z-10 rounded-b-md border border-slate-900 flex items-end justify-center pb-1 shadow-md transition-colors"
                  style={{
                    backgroundColor: isBlackCommon
                      ? "#059669"
                      : isBlackActive
                        ? "#4f46e5"
                        : "#0f172a",
                  }}
                >
                  {isBlackActive && (
                    <span className="text-[8px] font-mono text-white font-bold">
                      {blackPc}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
