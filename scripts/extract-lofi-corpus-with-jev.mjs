import fs from "node:fs";
import path from "node:path";
import { TypeSafeClient, score } from "@typesafe-ai/sdk";

const INPUT_PATH = "D:/claude/chord-progression-collecting/data/chords.jsonl";
const OUTPUT_PATH = path.resolve("src/theory/lofiCorpus.json");

const PC_TO_MAJOR_NOTE = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const PC_TO_MINOR_NOTE = ["A", "Bb", "B", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "G#"];

const NOTE_TO_PC = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

function getQualityFamily(qual) {
  if (!qual) return "MAJ";
  if (qual.includes("sus")) return "SUS";
  if (qual.includes("dim") || qual.includes("m7b5") || qual.includes("ø")) return "DIM";
  if (qual.startsWith("maj") || qual === "add9" || qual === "69" || qual === "6") return "MAJ";
  if (qual.startsWith("m")) return "MIN";
  if (qual.startsWith("7") || qual === "9" || qual === "13") return "DOM";
  return "MAJ";
}

function normalizeQuality(rawQual) {
  if (!rawQual) return "";
  const q = String(rawQual).trim();

  if (
    q.includes("N.C.") ||
    q.includes("Perfect") ||
    q.includes("Major 2nd") ||
    q.includes("ppo") ||
    q.length > 16
  ) {
    return null;
  }

  if (/min9\s*\(?11\)?/i.test(q) || /m11/i.test(q)) return "m11";
  if (/min9\s*\(?13\)?/i.test(q) || /m13/i.test(q)) return "m11";
  if (/min9/i.test(q) || /m9/i.test(q)) return "m9";
  if (/min6\/9/i.test(q) || /min6/i.test(q) || /min\s*6/i.test(q)) return "m6";
  if (/min7b5/i.test(q) || /m7b5/i.test(q)) return "m7b5";
  if (/min7/i.test(q) || /minor 7th/i.test(q)) return "m7";
  if (/^min$/i.test(q) || /min\s*\(add/i.test(q)) return "m9";

  if (/Maj9.*#11/i.test(q) || /Maj7.*#11/i.test(q)) return "maj9#11";
  if (/Maj9\s*\(?13\)?/i.test(q) || /Maj13/i.test(q) || /Maj7\s*\(?13\)?/i.test(q)) return "maj13";
  if (/Maj9/i.test(q)) return "maj9";
  if (/Maj7\s*Sus2/i.test(q) || /Maj\(add2\)/i.test(q)) return "add9";
  if (/Maj7/i.test(q) || /Major 7th/i.test(q)) return "maj7";
  if (/Maj6/i.test(q) || /^6\/9$/i.test(q)) return "69";

  if (/13\s*sus/i.test(q) || /7sus4\(13\)/i.test(q) || /9\s*sus4/i.test(q) || /7\s*sus4/i.test(q)) {
    return "9sus4";
  }
  if (/7\(b9#9#5\)|7\(#9#5\)|7\(b9#5\)/i.test(q)) return "7#9#5";
  if (/7#9/i.test(q)) return "7#9";
  if (/7\(?b9\)?/i.test(q)) return "7b9";
  if (/9\(13\)/i.test(q) || /^13$/i.test(q)) return "13";
  if (/7\(9\)|^9$|^S 9$/i.test(q)) return "9";
  if (/7\(?#11\)?|7b5/i.test(q)) return "7#11";
  if (/dim7/i.test(q)) return "dim7";
  if (/^7$/i.test(q)) return "7";

  return null;
}

function cleanSongTitle(rawTitle) {
  return String(rawTitle || "")
    .replace(/Chords.*$/i, "")
    .replace(/🔥|🎹|#\S+/g, "")
    .trim()
    .slice(0, 52);
}

function parseKeyString(keyStr, fallbackPc) {
  if (!keyStr) return { pc: fallbackPc ?? 0, mode: "minor" };
  const m = String(keyStr).match(/^([A-G][#b]?)\s*(major|minor)/i);
  if (!m) return { pc: fallbackPc ?? 0, mode: "minor" };
  const pc = NOTE_TO_PC[m[1]] ?? fallbackPc ?? 0;
  const mode = m[2].toLowerCase() === "major" ? "major" : "minor";
  return { pc, mode };
}

function romanDegreeLabel(relPc, family, mode) {
  const majorDeg = ["I", "bII", "II", "bIII", "III", "IV", "#IV", "V", "bVI", "VI", "bVII", "VII"];
  const minorDeg = ["i", "bII", "ii", "III", "bIV", "iv", "#iv", "v", "VI", "vi", "VII", "vii"];
  const base = mode === "major" ? majorDeg[relPc] : minorDeg[relPc];
  if (family === "MIN") return `${base.toLowerCase()}m9`;
  if (family === "MAJ") return `${base.toUpperCase()}maj9`;
  if (family === "DOM") return `${base.toUpperCase()}13`;
  if (family === "SUS") return `${base.toUpperCase()}9sus4`;
  if (family === "DIM") return `${base.toLowerCase()}ø7`;
  return base;
}

function chordInReferenceKey(relPc, qual, mode) {
  const root = mode === "major" ? PC_TO_MAJOR_NOTE[relPc] : PC_TO_MINOR_NOTE[relPc];
  return `${root}${qual}`;
}

/**
 * STAGE 1: Music Theory Pre-Filter for Lo-Fi 4-Bar Loops
 * Evaluates structural repetition, non-resolving floating nature, and turnaround smoothness.
 */
function computeRuleLofiPreScore(steps4, mode, repeatsInSong) {
  let scoreVal = 0;
  const traits = [];

  // 1. Actual loop repetition inside the song (crucial for Lo-Fi beat loops)
  if (repeatsInSong >= 3) {
    scoreVal += 30;
    traits.push(`Repeated ${repeatsInSong}x as an actual loop in song`);
  } else if (repeatsInSong === 2) {
    scoreVal += 20;
    traits.push("Repeated 2x loop in song");
  }

  // 2. Non-resolving / Floating Opening (Starts on IV, ii, vi, or bVI rather than static Tonic I)
  const first = steps4[0];
  if (mode === "major") {
    if (first.relPc === 5 && first.family === "MAJ") {
      scoreVal += 22;
      traits.push("Starts on nostalgic IVmaj (Classic Lo-Fi Subdominant opening)");
    } else if (first.relPc === 2 && first.family === "MIN") {
      scoreVal += 20;
      traits.push("Starts on warm iim9 (Jazz-Hop Dorian/ii-V opening)");
    } else if (first.relPc === 9 && first.family === "MIN") {
      scoreVal += 15;
      traits.push("Starts on melancholic vim9");
    } else if (first.relPc === 0 && first.family === "MAJ") {
      scoreVal += 8;
      traits.push("Starts on Imaj");
    }
  } else {
    // Minor mode
    if (first.relPc === 8 && first.family === "MAJ") {
      scoreVal += 22;
      traits.push("Starts on dreamy VImaj (Floating Minor Lo-Fi opening)");
    } else if (first.relPc === 5 && first.family === "MIN") {
      scoreVal += 20;
      traits.push("Starts on melancholic ivm9");
    } else if (first.relPc === 3 && first.family === "MAJ") {
      scoreVal += 16;
      traits.push("Starts on warm IIImaj (Relative Major color)");
    } else if (first.relPc === 0 && first.family === "MIN") {
      scoreVal += 12;
      traits.push("Starts on tonic im9");
    }
  }

  // 3. Turnaround smoothness (Bar 4 -> Bar 1 root motion)
  const last = steps4[3];
  const turnaroundInterval = ((first.relPc - last.relPc) % 12 + 12) % 12;
  if (turnaroundInterval === 5) {
    scoreVal += 18;
    traits.push("Fifth-descent turnaround (Bar 4 -> Bar 1 resolves down a 5th)");
  } else if (turnaroundInterval === 1 || turnaroundInterval === 11) {
    scoreVal += 20;
    traits.push("Half-step turnaround (Chromatic/Tritone Sub slide back to Bar 1)");
  } else if (turnaroundInterval === 2 || turnaroundInterval === 10) {
    scoreVal += 14;
    traits.push("Stepwise whole-tone turnaround back to Bar 1");
  }

  // 4. Voicing warmth (9ths, 11ths, maj7/m7, sus4 vs harsh diminished)
  const dimCount = steps4.filter((s) => s.family === "DIM").length;
  if (dimCount >= 2) {
    scoreVal -= 25; // Too Gospel/Theatrical for chill Lo-Fi
  } else if (dimCount === 1) {
    scoreVal += 5;
    traits.push("Single half-diminished/diminished color chord");
  }

  const lushCount = steps4.filter((s) =>
    ["maj9", "maj7", "m9", "m11", "9sus4", "add9", "69", "13"].includes(s.qual)
  ).length;
  scoreVal += lushCount * 5;

  // 5. Stepwise planing or ii-V presence inside the 4 bars
  let stepwiseMoves = 0;
  let fifthMoves = 0;
  for (let i = 0; i < 3; i++) {
    const diff = ((steps4[i + 1].relPc - steps4[i].relPc) % 12 + 12) % 12;
    if (diff === 1 || diff === 2 || diff === 10 || diff === 11) stepwiseMoves++;
    if (diff === 5) fifthMoves++;
  }
  if (stepwiseMoves >= 2) {
    scoreVal += 12;
    traits.push("Smooth stepwise Rhodes/Guitar planing motion");
  }
  if (fifthMoves >= 1) {
    scoreVal += 10;
    traits.push("Contains Jazz ii-V / circle-of-fifths motion");
  }

  return { scoreVal, traits };
}

async function main() {
  const lines = fs.readFileSync(INPUT_PATH, "utf8").split(/\r?\n/).filter(Boolean);
  const loopBuckets = { major: new Map(), minor: new Map() };
  let totalSongs = 0;
  let total4BarWindowsScanned = 0;

  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.status !== "ok" || !Array.isArray(row.progression)) continue;

    const cleanedSteps = [];
    for (const step of row.progression) {
      if ((step.dur ?? 0) < 0.5) continue;
      if (typeof step.pc !== "number") continue;
      const qual = normalizeQuality(step.quality);
      if (qual === null) continue;

      const prev = cleanedSteps[cleanedSteps.length - 1];
      if (prev && prev.pc === step.pc && prev.qual === qual) {
        prev.dur += step.dur;
        continue;
      }
      cleanedSteps.push({
        pc: step.pc,
        qual,
        family: getQualityFamily(qual),
        dur: step.dur,
      });
    }

    if (cleanedSteps.length < 8) continue;
    totalSongs++;

    const { pc: keyPc, mode } = parseKeyString(row.key, cleanedSteps[0].pc);
    const songMeta = {
      id: row.id,
      title: cleanSongTitle(row.title) || row.id,
    };

    const relSteps = cleanedSteps.map((s) => {
      const relPc = ((s.pc - keyPc) % 12 + 12) % 12;
      return {
        relPc,
        qual: s.qual,
        family: s.family,
        familyKey: `${relPc}:${s.family}`,
      };
    });

    // Count how many times each 4-bar window repeats within this song
    const songWindowCounts = new Map();
    for (let i = 0; i <= relSteps.length - 4; i++) {
      total4BarWindowsScanned++;
      const win = relSteps.slice(i, i + 4);
      // Require 4 distinct consecutive chords (no immediate duplicates) and at least 3 unique chords in the 4-bar loop
      const uniqueFamKeys = new Set(win.map((x) => x.familyKey));
      if (uniqueFamKeys.size < 3) continue;
      if (win[0].familyKey === win[3].familyKey) continue; // Bar 4 should transition to Bar 1, not be identical

      const sig = win.map((x) => x.familyKey).join(" -> ");
      if (!songWindowCounts.has(sig)) {
        songWindowCounts.set(sig, { win, count: 0 });
      }
      songWindowCounts.get(sig).count += 1;
    }

    // Keep only windows that actually repeat (>= 2 times) inside the song!
    for (const [sig, { win, count }] of songWindowCounts.entries()) {
      if (count < 2) continue;
      const bucket = loopBuckets[mode];
      if (!bucket.has(sig)) {
        const { scoreVal, traits } = computeRuleLofiPreScore(win, mode, count);
        bucket.set(sig, {
          sig,
          mode,
          steps: win,
          exampleChords: win.map((s) => chordInReferenceKey(s.relPc, s.qual, mode)),
          romanNumerals: win.map((s) => romanDegreeLabel(s.relPc, s.family, mode)),
          totalOccurrences: 0,
          songCount: 0,
          maxRepeatsInSingleSong: 0,
          rulePreScore: scoreVal,
          traits,
          songs: [],
        });
      }
      const entry = bucket.get(sig);
      entry.totalOccurrences += count;
      entry.songCount += 1;
      if (count > entry.maxRepeatsInSingleSong) {
        entry.maxRepeatsInSingleSong = count;
      }
      if (entry.songs.length < 4 && !entry.songs.some((s) => s.id === songMeta.id)) {
        entry.songs.push(songMeta);
      }
    }
  }

  // Sort by hybrid Rule Pre-Score + Song Frequency and take Top 30 Major + Top 30 Minor for Jev AI Curation
  const topMajorCandidates = Array.from(loopBuckets.major.values())
    .sort((a, b) => (b.rulePreScore + b.songCount * 6 + b.totalOccurrences * 1.5) - (a.rulePreScore + a.songCount * 6 + a.totalOccurrences * 1.5))
    .slice(0, 30);

  const topMinorCandidates = Array.from(loopBuckets.minor.values())
    .sort((a, b) => (b.rulePreScore + b.songCount * 6 + b.totalOccurrences * 1.5) - (a.rulePreScore + a.songCount * 6 + a.totalOccurrences * 1.5))
    .slice(0, 30);

  console.log(`[Stage 1: Tonal Rule Filter]`);
  console.log(`- Total songs scanned: ${totalSongs}`);
  console.log(`- Total 4-bar windows scanned: ${total4BarWindowsScanned}`);
  console.log(`- Unique repeating 4-bar loops found: Major=${loopBuckets.major.size}, Minor=${loopBuckets.minor.size}`);
  console.log(`- Selected top 60 candidate loops (30 Major + 30 Minor) for Stage 2 Jev AI evaluation.`);

  // STAGE 2: Jev System One (`score`) AI Curation
  const apiKey = process.env.VITE_TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("VITE_TYPESAFE_API_KEY is missing in .env");
  }

  const client = new TypeSafeClient({
    apiKey,
    baseURL: "https://api.typesafe.ai",
    compression: false,
  });

  const lofiRubric = [
    "0: Unsuitable for Lo-Fi Hip-Hop (too static, harsh theatrical diminished, or generic pop march)",
    "1: Weak Lo-Fi fit (standard R&B/Gospel progression that feels too dramatic or resolved for a chill beat loop)",
    "2: Moderate Lo-Fi fit (pleasant jazz-pop chords, usable with Rhodes piano)",
    "3: Strong Authentic Lo-Fi / Chillhop Loop (warm 9th/11th extensions, smooth turnaround, nostalgic mood)",
    "4: Masterpiece Nujabes / J Dilla / Idealism Style Lo-Fi Loop (hypnotic non-resolving floating feeling, lush jazz-hop voice leading, endless replayability)",
  ];

  async function evaluateBatchWithJev(candidates, modeLabel) {
    const batchSize = 10;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);
      const questions = {};
      const stateSummary = {};

      batch.forEach((cand, idx) => {
        const qKey = `loop_${i + idx}`;
        const chordStr = cand.exampleChords.join(" -> ");
        const romanStr = cand.romanNumerals.join(" -> ");
        stateSummary[qKey] = {
          referenceKey: modeLabel === "major" ? "C major" : "A minor",
          chords: `${chordStr} (loops back to ${cand.exampleChords[0]})`,
          romanAnalysis: romanStr,
          corpusEvidence: `Appears ${cand.totalOccurrences} times across ${cand.songCount} songs (e.g., ${cand.songs.map((s) => s.title).join(", ")})`,
          harmonicTraits: cand.traits,
        };
        questions[qKey] = score(
          `Evaluate "${chordStr}" (${romanStr}) in ${modeLabel === "major" ? "C major" : "A minor"} as a 4-bar infinitely repeating Lo-Fi Hip-Hop / Chillhop (Nujabes, J Dilla, Idealism style) chord loop. Consider floating non-resolution, dusty nostalgia, and turnaround smoothness (${cand.exampleChords[3]} -> ${cand.exampleChords[0]}).`,
          lofiRubric
        );
      });

      const res = await client.systemOne({
        model: "jev-latest",
        state: {
          task: "Curate an authentic Lo-Fi Hip-Hop / Chillhop 4-bar chord loop corpus from a larger Neo-Soul/Jazz dataset",
          genreCriteria: [
            "Prefer floating non-resolving loops (starting on IVmaj9, iim9, VImaj9, ivm9) or warm jazz turnarounds (ii9 - V13 - iii7 - VI7b9)",
            "Prefer seamless Bar 4 -> Bar 1 loop turnarounds (fifth descent, tritone sub bIImaj7, or half-step slide)",
            "Penalize progressions that feel overly theatrical, gospel-climax heavy, or abruptly stopped",
          ],
          candidateLoops: stateSummary,
        },
        questions,
      });

      totalInputTokens += res.usage?.input_tokens ?? 0;
      totalOutputTokens += res.usage?.output_tokens ?? 0;

      batch.forEach((cand, idx) => {
        const qKey = `loop_${i + idx}`;
        const ans = res.answers[qKey];
        const probsObj = ans?.probabilities || {};
        const probs = [0, 1, 2, 3, 4].map((k) =>
          typeof probsObj[String(k)] === "number" ? probsObj[String(k)] : 0.2
        );
        const expectedScore =
          typeof ans?.score === "number"
            ? ans.score
            : probs.reduce((acc, p, rIdx) => acc + p * rIdx, 0);
        const lofiProbability = (probs[3] || 0) + (probs[4] || 0);
        cand.jevScore = Number(expectedScore.toFixed(2));
        cand.jevLofiConfidence = Number((lofiProbability * 100).toFixed(1));
        cand.jevProbabilities = probs.map((p) => Number(p.toFixed(3)));
        // Final combined score: 60% Jev AI Score + 40% Rule/Corpus Score
        const normRule = Math.min(100, cand.rulePreScore + cand.songCount * 5);
        cand.finalLofiScore = Number(((expectedScore / 4) * 60 + (normRule / 100) * 40).toFixed(1));
      });
    }

    return { totalInputTokens, totalOutputTokens };
  }

  console.log(`[Stage 2: Calling Jev System One (jev-latest) to score 60 candidate loops...]`);
  const majUsage = await evaluateBatchWithJev(topMajorCandidates, "major");
  const minUsage = await evaluateBatchWithJev(topMinorCandidates, "minor");
  const totalIn = majUsage.totalInputTokens + minUsage.totalInputTokens;
  const totalOut = majUsage.totalOutputTokens + minUsage.totalOutputTokens;

  console.log(`- Jev API Evaluation Complete! Tokens used: Input=${totalIn}, Output=${totalOut}, Total=${totalIn + totalOut}`);

  // Sort by Jev Score & Final Lo-Fi Score, filter out low-scoring loops
  const curatedMajorLoops = topMajorCandidates
    .filter((c) => c.jevScore >= 2.2)
    .sort((a, b) => b.jevScore - a.jevScore || b.finalLofiScore - a.finalLofiScore);

  const curatedMinorLoops = topMinorCandidates
    .filter((c) => c.jevScore >= 2.2)
    .sort((a, b) => b.jevScore - a.jevScore || b.finalLofiScore - a.finalLofiScore);

  // Build Lo-Fi weighted Opening & 2-Gram Transition tables from curated loops
  function buildLofiTransitions(curatedLoops) {
    const openings = new Map();
    const trans2Gram = new Map();

    for (const loop of curatedLoops) {
      const weight = Math.max(1, Math.round(loop.jevScore * loop.songCount));
      const first = loop.steps[0];
      const openKey = `${first.relPc}:${first.family}`;
      if (!openings.has(openKey)) {
        openings.set(openKey, {
          relPc: first.relPc,
          qual: first.qual,
          family: first.family,
          lofiWeight: 0,
          avgJevScore: loop.jevScore,
          exampleLoop: loop.exampleChords.join(" -> "),
          songs: loop.songs.slice(0, 3),
        });
      }
      openings.get(openKey).lofiWeight += weight;

      // Include all 4 transitions including the turnaround (Bar 4 -> Bar 1)!
      for (let i = 0; i < 4; i++) {
        const prev = loop.steps[i];
        const next = loop.steps[(i + 1) % 4];
        const prevKey = `${prev.relPc}:${prev.family}`;
        const nextKey = `${next.relPc}:${next.family}`;
        if (!trans2Gram.has(prevKey)) trans2Gram.set(prevKey, new Map());
        const bucket = trans2Gram.get(prevKey);
        if (!bucket.has(nextKey)) {
          bucket.set(nextKey, {
            relPc: next.relPc,
            qual: next.qual,
            family: next.family,
            isTurnaround: i === 3,
            lofiWeight: 0,
            jevScore: loop.jevScore,
            exampleLoop: loop.exampleChords.join(" -> "),
            songs: loop.songs.slice(0, 3),
          });
        }
        bucket.get(nextKey).lofiWeight += weight;
      }
    }

    const serializedTrans = {};
    for (const [k, bucket] of trans2Gram.entries()) {
      serializedTrans[k] = Array.from(bucket.values())
        .sort((a, b) => b.lofiWeight - a.lofiWeight)
        .slice(0, 6);
    }

    return {
      openings: Array.from(openings.values()).sort((a, b) => b.lofiWeight - a.lofiWeight),
      transitions2GramByFamily: serializedTrans,
    };
  }

  const majorStats = buildLofiTransitions(curatedMajorLoops);
  const minorStats = buildLofiTransitions(curatedMinorLoops);

  const outputCorpus = {
    meta: {
      sourceRepo: "https://github.com/inbm001/progressions",
      curationMethod: "2-Stage Hybrid: Tonal.js Loop Rule Filter + Jev System One (score rubric 0..4)",
      totalSongsScanned: totalSongs,
      total4BarWindowsScanned,
      candidatesEvaluatedByJev: 60,
      curatedMajorLoopsCount: curatedMajorLoops.length,
      curatedMinorLoopsCount: curatedMinorLoops.length,
      jevTokensUsed: {
        inputTokens: totalIn,
        outputTokens: totalOut,
        totalTokens: totalIn + totalOut,
      },
    },
    curatedLoops: {
      major: curatedMajorLoops.slice(0, 20),
      minor: curatedMinorLoops.slice(0, 20),
    },
    openings: {
      major: majorStats.openings,
      minor: minorStats.openings,
    },
    transitions2GramByFamily: {
      major: majorStats.transitions2GramByFamily,
      minor: minorStats.transitions2GramByFamily,
    },
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputCorpus, null, 2), "utf8");
  console.log(`\nSaved curated Lo-Fi corpus to: ${OUTPUT_PATH}`);
  console.log(`\n=== TOP 5 MAJOR LO-FI LOOPS (Curated by Jev) ===`);
  curatedMajorLoops.slice(0, 5).forEach((l, i) => {
    console.log(
      `${i + 1}. [${l.exampleChords.join(" -> ")}] (${l.romanNumerals.join(" -> ")}) | Jev Score: ${l.jevScore}/4.00 (Lo-Fi Conf: ${l.jevLofiConfidence}%) | Songs: ${l.songs.map((s) => s.title).join(", ")}`
    );
  });

  console.log(`\n=== TOP 5 MINOR LO-FI LOOPS (Curated by Jev) ===`);
  curatedMinorLoops.slice(0, 5).forEach((l, i) => {
    console.log(
      `${i + 1}. [${l.exampleChords.join(" -> ")}] (${l.romanNumerals.join(" -> ")}) | Jev Score: ${l.jevScore}/4.00 (Lo-Fi Conf: ${l.jevLofiConfidence}%) | Songs: ${l.songs.map((s) => s.title).join(", ")}`
    );
  });

  const rejected = [...topMajorCandidates, ...topMinorCandidates]
    .sort((a, b) => a.jevScore - b.jevScore)
    .slice(0, 4);
  console.log(`\n=== LOWEST SCORED / REJECTED BY JEV (Too R&B/Static/Dramatic for Lo-Fi) ===`);
  rejected.forEach((l, i) => {
    console.log(
      `${i + 1}. [${l.exampleChords.join(" -> ")}] (${l.romanNumerals.join(" -> ")}) | Jev Score: ${l.jevScore}/4.00 (Lo-Fi Conf: ${l.jevLofiConfidence}%)`
    );
  });
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
