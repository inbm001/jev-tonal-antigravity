import React, { useState } from "react";
import {
  Sparkles,
  Volume2,
  Plus,
  ExternalLink,
  Disc3,
  Target,
  Compass,
} from "lucide-react";
import {
  type ChordCandidate,
  type HarmonicCategory,
  type ProgressionStep,
} from "../theory/harmonyEngine";

interface HarmonyRadarProps {
  candidates: ChordCandidate[];
  hoveredCandidate: ChordCandidate | null;
  onHoverCandidate: (cand: ChordCandidate) => void;
  onSelectCandidate: (cand: ChordCandidate) => void;
  targetSlotIndex: number; // 0 = Bar 1 (Starting Chord), 1 = Bar 2, etc.
  prevStep: ProgressionStep | null;
  cadenceProb: number;
  expectedTension: number;
  isEvaluating: boolean;
}

const CATEGORY_NODE_COLORS: Record<
  HarmonicCategory,
  { fill: string; stroke: string; glow: string; badge: string }
> = {
  diatonic: {
    fill: "#10b981",
    stroke: "#6ee7b7",
    glow: "rgba(16, 185, 129, 0.55)",
    badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  },
  secondary_dominant: {
    fill: "#f59e0b",
    stroke: "#fcd34d",
    glow: "rgba(245, 158, 11, 0.55)",
    badge: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  },
  modal_interchange: {
    fill: "#a855f7",
    stroke: "#d8b4fe",
    glow: "rgba(168, 85, 247, 0.55)",
    badge: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  },
  tritone_sub: {
    fill: "#f43f5e",
    stroke: "#fda4af",
    glow: "rgba(244, 63, 94, 0.55)",
    badge: "bg-rose-500/20 text-rose-300 border-rose-500/40",
  },
};

export const HarmonyRadar: React.FC<HarmonyRadarProps> = ({
  candidates,
  hoveredCandidate,
  onHoverCandidate,
  onSelectCandidate,
  targetSlotIndex,
  prevStep,
  cadenceProb,
  expectedTension,
  isEvaluating,
}) => {
  // Depth mode: "bullseye" (closer to center = higher Jev prob) or "radial" (further out = higher Jev prob)
  const [depthMode, setDepthMode] = useState<"bullseye" | "radial">("bullseye");

  const size = 380;
  const center = size / 2;
  const maxRadius = 142;
  const minRadius = 32;

  const maxProb = Math.max(
    ...candidates.map((c) => c.jevProbability ?? 0.05),
    0.15
  );

  // Compute (x, y) for each candidate
  const plottedNodes = candidates.map((c, rankIdx) => {
    const prob = c.jevProbability ?? 0.05;
    const normProb = Math.min(1, Math.max(0.05, prob / maxProb));

    // Radial distance r based on depthMode
    const r =
      depthMode === "bullseye"
        ? minRadius + (1 - normProb) * (maxRadius - minRadius)
        : minRadius + normProb * (maxRadius - minRadius);

    // Convert angle (0 deg = 12 o'clock top, clockwise) to SVG radians
    const rad = ((c.emotionAngleDeg - 90) * Math.PI) / 180;
    const x = center + r * Math.cos(rad);
    const y = center + r * Math.sin(rad);

    return {
      candidate: c,
      rank: rankIdx + 1,
      x,
      y,
      r,
      normProb,
    };
  });

  const activeNode =
    plottedNodes.find(
      (n) => n.candidate.symbol === hoveredCandidate?.symbol
    ) || plottedNodes[0];

  const activeCand = activeNode?.candidate || candidates[0];

  return (
    <div className="flex-1 min-h-0 bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 grid grid-cols-12 gap-3.5 items-center overflow-hidden">
      {/* Left: Interactive Polar Emotion × Probability Radar SVG */}
      <div className="col-span-7 h-full flex flex-col items-center justify-center relative select-none">
        {/* Top Left Radar Status Pill */}
        <div className="w-full flex items-center justify-between mb-1 px-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <Compass className="w-3.5 h-3.5 text-indigo-400" />
              {targetSlotIndex === 0
                ? "SLOT 1: 시작 코드(Opening) 선택"
                : `SLOT ${targetSlotIndex + 1}: 다음 코드 레이더 (${prevStep?.symbol || ""} 이후)`}
            </span>
            {isEvaluating && (
              <span className="text-[11px] text-amber-300 animate-pulse font-medium">
                Jev RAG 계산 중...
              </span>
            )}
          </div>

          <button
            onClick={() =>
              setDepthMode((m) => (m === "bullseye" ? "radial" : "bullseye"))
            }
            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="레이더 깊이(확률) 기준 전환"
          >
            <Target className="w-3 h-3 text-indigo-400" />
            {depthMode === "bullseye"
              ? "깊이: 중심=고확률(과녁형)"
              : "깊이: 외곽=고확률(방사형)"}
          </button>
        </div>

        {/* SVG Radar */}
        <div className="relative flex items-center justify-center">
          <svg
            viewBox={`0 0 ${size} ${size}`}
            className="w-[340px] h-[340px] xl:w-[365px] xl:h-[365px] overflow-visible"
          >
            <defs>
              <radialGradient id="radarCoreGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(99, 102, 241, 0.28)" />
                <stop offset="55%" stopColor="rgba(168, 85, 247, 0.08)" />
                <stop offset="100%" stopColor="rgba(15, 23, 42, 0)" />
              </radialGradient>
            </defs>

            {/* Background Glow Circle */}
            <circle
              cx={center}
              cy={center}
              r={maxRadius + 16}
              fill="url(#radarCoreGlow)"
            />

            {/* 4 Concentric Probability Depth Rings */}
            {[0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
              const ringR = minRadius + ratio * (maxRadius - minRadius);
              const probLabel =
                depthMode === "bullseye"
                  ? `${Math.round((1 - ratio * 0.85) * maxProb * 100)}%`
                  : `${Math.round(ratio * maxProb * 100)}%`;
              return (
                <g key={idx}>
                  <circle
                    cx={center}
                    cy={center}
                    r={ringR}
                    fill="none"
                    stroke={idx === 0 ? "#4f46e5" : "#1e293b"}
                    strokeWidth={idx === 0 ? 1.5 : 1}
                    strokeDasharray={idx % 2 === 1 ? "3 3" : undefined}
                  />
                  <text
                    x={center + 4}
                    y={center - ringR + 9}
                    className="fill-slate-500 text-[8px] font-mono"
                  >
                    {probLabel}
                  </text>
                </g>
              );
            })}

            {/* Inner Bullseye Core */}
            <circle
              cx={center}
              cy={center}
              r={minRadius * 0.65}
              fill="rgba(99, 102, 241, 0.14)"
              stroke="#6366f1"
              strokeWidth={1}
            />

            {/* Diagonal & Cardinal Axis Lines */}
            <line
              x1={center}
              y1={center - maxRadius - 12}
              x2={center}
              y2={center + maxRadius + 12}
              stroke="#1e293b"
              strokeWidth={1.2}
            />
            <line
              x1={center - maxRadius - 12}
              y1={center}
              x2={center + maxRadius + 12}
              y2={center}
              stroke="#1e293b"
              strokeWidth={1.2}
            />
            <line
              x1={center - maxRadius * 0.75}
              y1={center - maxRadius * 0.75}
              x2={center + maxRadius * 0.75}
              y2={center + maxRadius * 0.75}
              stroke="#1e293b"
              strokeWidth={0.7}
              strokeDasharray="2 4"
            />
            <line
              x1={center + maxRadius * 0.75}
              y1={center - maxRadius * 0.75}
              x2={center - maxRadius * 0.75}
              y2={center + maxRadius * 0.75}
              stroke="#1e293b"
              strokeWidth={0.7}
              strokeDasharray="2 4"
            />

            {/* Cardinal Emotion Labels */}
            <text
              x={center}
              y={14}
              textAnchor="middle"
              className="fill-sky-300 text-[10px] font-bold"
            >
              ▲ 설렘 · 밝은 확장 (Subdominant)
            </text>
            <text
              x={size - 4}
              y={center - 6}
              textAnchor="end"
              className="fill-amber-300 text-[10px] font-bold"
            >
              긴장 · 추진력 ▶
            </text>
            <text
              x={center}
              y={size - 4}
              textAnchor="middle"
              className="fill-purple-300 text-[10px] font-bold"
            >
              ▼ 애절함 · 몽환 · 반전 (Modal / SubV)
            </text>
            <text
              x={4}
              y={center - 6}
              textAnchor="start"
              className="fill-emerald-300 text-[10px] font-bold"
            >
              ◀ 평온 · 안식 (Tonic)
            </text>

            {/* Vector Beam from Center to Hovered Node */}
            {activeNode && (
              <g>
                <line
                  x1={center}
                  y1={center}
                  x2={activeNode.x}
                  y2={activeNode.y}
                  stroke="#818cf8"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                />
                <circle
                  cx={activeNode.x}
                  cy={activeNode.y}
                  r={22}
                  fill="rgba(99, 102, 241, 0.2)"
                  stroke="#818cf8"
                  strokeWidth={1.5}
                />
              </g>
            )}

            {/* Center Label (Previous Chord or START) */}
            <g>
              <circle
                cx={center}
                cy={center}
                r={16}
                fill="#0f172a"
                stroke="#6366f1"
                strokeWidth={1.5}
              />
              <text
                x={center}
                y={center + 3.5}
                textAnchor="middle"
                className="fill-indigo-200 text-[9px] font-extrabold font-mono"
              >
                {prevStep ? prevStep.symbol : "START"}
              </text>
            </g>

            {/* Candidate Nodes */}
            {plottedNodes.map(({ candidate, rank, x, y }) => {
              const isHovered = activeCand?.symbol === candidate.symbol;
              const colors = CATEGORY_NODE_COLORS[candidate.category];
              const nodeRadius =
                rank === 1 ? 15 : rank <= 3 ? 13 : isHovered ? 14 : 11;

              return (
                <g
                  key={candidate.id}
                  transform={`translate(${x}, ${y})`}
                  onMouseEnter={() => onHoverCandidate(candidate)}
                  onClick={() => onSelectCandidate(candidate)}
                  className="cursor-pointer transition-transform"
                >
                  {/* Corpus RAG star halo if verified in Neo-Soul corpus */}
                  {candidate.corpusCount > 0 && (
                    <circle
                      r={nodeRadius + 4}
                      fill="none"
                      stroke={colors.stroke}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                      opacity={0.75}
                    />
                  )}

                  <circle
                    r={nodeRadius}
                    fill={isHovered ? colors.fill : "#0f172a"}
                    stroke={colors.fill}
                    strokeWidth={isHovered || rank === 1 ? 2.5 : 1.8}
                    style={{
                      filter: isHovered
                        ? `drop-shadow(0 0 8px ${colors.glow})`
                        : undefined,
                    }}
                  />

                  {/* Chord Symbol inside/above node */}
                  <text
                    y={3}
                    textAnchor="middle"
                    className={`text-[9px] font-extrabold pointer-events-none ${
                      isHovered ? "fill-slate-950" : "fill-white"
                    }`}
                  >
                    {candidate.symbol}
                  </text>

                  {/* Probability Tag underneath */}
                  <text
                    y={nodeRadius + 10}
                    textAnchor="middle"
                    className="fill-slate-300 text-[8px] font-mono pointer-events-none"
                  >
                    {((candidate.jevProbability ?? 0) * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Bottom Legend */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[10px] text-slate-400 mt-0.5">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            다이아토닉
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            세컨더리 도미넌트
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
            모달 인터체인지
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
            트라이톤 대리
          </span>
          <span className="text-indigo-300 font-medium">
            (마우스 오버: 즉시 청음 · 클릭: 슬롯에 추가)
          </span>
        </div>
      </div>

      {/* Right: Live Hover Inspector & Neo-Soul RAG Evidence Card */}
      <div className="col-span-5 h-full flex flex-col justify-between bg-slate-950/90 border border-slate-800/90 rounded-xl p-3.5 overflow-y-auto">
        {activeCand ? (
          <div className="space-y-2.5">
            {/* Header: Rank, Category, Probability */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  CATEGORY_NODE_COLORS[activeCand.category].badge
                }`}
              >
                {activeCand.categoryLabel}
              </span>
              <span className="text-xs font-mono font-bold text-indigo-300">
                앙상블 확률: {((activeCand.jevProbability ?? 0) * 100).toFixed(1)}%
              </span>
            </div>

            {activeCand.rawJevProb !== undefined && (
              <div className="flex items-center justify-between text-[10px] font-mono bg-slate-900/80 border border-slate-800/80 rounded-md px-2 py-1 text-slate-300">
                <span className="text-indigo-300">
                  Jev(50%): {(activeCand.rawJevProb * 100).toFixed(0)}%
                </span>
                <span className="text-emerald-300">
                  이론(30%): {((activeCand.theoryProb ?? 0) * 100).toFixed(0)}%
                </span>
                <span className="text-purple-300">
                  코퍼스(20%): {((activeCand.corpusProb ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
            )}

            {/* Chord Symbol & Roman & Emotion */}
            <div className="flex items-baseline justify-between border-b border-slate-800 pb-2">
              <div>
                <span className="text-2xl font-extrabold text-white tracking-tight">
                  {activeCand.symbol}
                </span>
                <span className="ml-2 text-sm font-bold text-indigo-400">
                  {activeCand.roman}
                </span>
              </div>
              <span className="text-[11px] text-purple-300 font-medium">
                {activeCand.emotionLabel}
              </span>
            </div>

            {/* Voicing & Voice Leading */}
            <div className="space-y-1 text-[11px]">
              <div className="flex items-center justify-between text-slate-300">
                <span>보이싱 구성음:</span>
                <span className="font-mono text-indigo-200">
                  {activeCand.voiceLeading.voicingNotes.join(" · ")}
                </span>
              </div>
              <div className="flex flex-wrap gap-1 pt-0.5">
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                  성부 매끄러움 {activeCand.voiceLeading.smoothnessScore}점
                </span>
                {activeCand.voiceLeading.commonTones.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[10px]">
                    공통음: {activeCand.voiceLeading.commonTones.join(", ")}
                  </span>
                )}
                {activeCand.voiceLeading.halfStepResolutions.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 text-[10px]">
                    반음 해결:{" "}
                    {activeCand.voiceLeading.halfStepResolutions
                      .slice(0, 2)
                      .join(", ")}
                  </span>
                )}
              </div>
            </div>

            {/* Music Theory Rule Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-100">
                  {activeCand.theoryRuleTitle}
                </span>
                {activeCand.idiomTag && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                    {activeCand.idiomTag}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 leading-snug">
                {activeCand.theoryReason}
              </p>
            </div>

            {/* Neo-Soul Corpus RAG Evidence Box */}
            <div className="bg-purple-950/25 border border-purple-500/30 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-purple-200 flex items-center gap-1">
                  <Disc3 className="w-3.5 h-3.5 text-purple-400" />
                  inbm001/progressions 코퍼스 RAG
                </span>
                <span className="font-mono text-[10px] text-purple-300">
                  {activeCand.corpusCount > 0
                    ? `${activeCand.corpusCount}회 실전 등장`
                    : "화성학 규칙 생성"}
                </span>
              </div>
              {activeCand.corpusSongs.length > 0 ? (
                <div className="space-y-1">
                  {activeCand.corpusSongs.slice(0, 3).map((song) => (
                    <a
                      key={song.id}
                      href={`https://www.youtube.com/watch?v=${song.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between text-[10px] text-slate-300 hover:text-purple-200 bg-slate-900/80 px-2 py-1 rounded border border-slate-800 transition"
                    >
                      <span className="truncate">🎵 {song.title}</span>
                      <ExternalLink className="w-2.5 h-2.5 shrink-0 ml-1 text-purple-400" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400">
                  Tonal.js 화성학 및 성부 진행 최적화로 생성된 후보입니다.
                </p>
              )}
            </div>
          </div>
        ) : null}

        {/* Bottom SystemOne Mini Metrics & Action Buttons */}
        <div className="pt-2 mt-2 border-t border-slate-800 space-y-2">
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">종지 필요도(noul)</span>
              <span className="font-mono font-bold text-emerald-300">
                {(cadenceProb * 100).toFixed(0)}%
              </span>
            </div>
            <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">목표 텐션(score)</span>
              <span className="font-mono font-bold text-amber-300">
                {expectedTension.toFixed(1)} / 4.0
              </span>
            </div>
          </div>

          {activeCand && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onHoverCandidate(activeCand)}
                className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition"
              >
                <Volume2 className="w-3.5 h-3.5 text-indigo-400" />
                다시 듣기
              </button>
              <button
                onClick={() => onSelectCandidate(activeCand)}
                className="py-1.5 px-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                슬롯 {targetSlotIndex + 1}에 확정
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
