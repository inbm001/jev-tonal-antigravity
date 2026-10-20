import fs from "node:fs";
import path from "node:path";

const INPUT_PATH = "D:/claude/chord-progression-collecting/data/chords.jsonl";
const OUTPUT_PATH = path.resolve("src/theory/neoSoulCorpus.json");

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

const lines = fs.readFileSync(INPUT_PATH, "utf8").split(/\r?\n/).filter(Boolean);

const openingCounts = { major: new Map(), minor: new Map() };
const transitions2GramByFamily = { major: new Map(), minor: new Map() };
const transitions2GramByPc = { major: new Map(), minor: new Map() };
const transitions3Gram = { major: new Map(), minor: new Map() };

let validSongsCount = 0;
let totalTransitions = 0;

function recordMapItem(map, key, token, songMeta) {
  if (!map.has(key)) map.set(key, new Map());
  const bucket = map.get(key);
  if (!bucket.has(token)) {
    bucket.set(token, { token, count: 0, songs: [] });
  }
  const entry = bucket.get(token);
  entry.count += 1;
  if (
    entry.songs.length < 4 &&
    !entry.songs.some((s) => s.id === songMeta.id)
  ) {
    entry.songs.push(songMeta);
  }
}

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

  if (cleanedSteps.length < 3) continue;
  validSongsCount++;

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
      token: `${relPc}:${s.qual}`,
    };
  });

  // Record opening chord (grouped by relPc:family so maj7/maj9/maj13 combine their opening evidence!)
  const first = relSteps[0];
  const openFamilyKey = `${first.relPc}:${first.family}`;
  if (!openingCounts[mode].has(openFamilyKey)) {
    openingCounts[mode].set(openFamilyKey, {
      token: first.token,
      relPc: first.relPc,
      qual: first.qual,
      family: first.family,
      count: 0,
      songs: [],
    });
  }
  const openEntry = openingCounts[mode].get(openFamilyKey);
  openEntry.count++;
  if (
    openEntry.songs.length < 4 &&
    !openEntry.songs.some((s) => s.id === songMeta.id)
  ) {
    openEntry.songs.push(songMeta);
  }

  for (let i = 1; i < relSteps.length; i++) {
    const prev = relSteps[i - 1];
    const curr = relSteps[i];
    if (prev.relPc === curr.relPc && prev.family === curr.family) continue;

    recordMapItem(
      transitions2GramByFamily[mode],
      `${prev.relPc}:${prev.family}`,
      curr.token,
      songMeta
    );
    recordMapItem(
      transitions2GramByPc[mode],
      String(prev.relPc),
      curr.token,
      songMeta
    );
    totalTransitions++;

    if (i >= 2) {
      const twoBack = relSteps[i - 2];
      const key3 = `${twoBack.relPc}->${prev.relPc}`;
      recordMapItem(transitions3Gram[mode], key3, curr.token, songMeta);
    }
  }
}

function serializeTransitionMap(map, topN = 8, minCount = 2) {
  const out = {};
  for (const [k, bucket] of map.entries()) {
    const sorted = Array.from(bucket.values())
      .filter((x) => x.count >= minCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, topN)
      .map((x) => {
        const [relPcStr, qual] = x.token.split(":");
        return {
          relPc: Number(relPcStr),
          qual,
          family: getQualityFamily(qual),
          count: x.count,
          songs: x.songs,
        };
      });
    if (sorted.length > 0) {
      out[k] = sorted;
    }
  }
  return out;
}

function serializeOpenings(map, topN = 12) {
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

const outputData = {
  meta: {
    sourceRepo: "https://github.com/inbm001/progressions",
    totalSongsAnalyzed: validSongsCount,
    totalTransitionsExtracted: totalTransitions,
  },
  openings: {
    major: serializeOpenings(openingCounts.major, 12),
    minor: serializeOpenings(openingCounts.minor, 12),
  },
  transitions2GramByFamily: {
    major: serializeTransitionMap(transitions2GramByFamily.major, 8, 2),
    minor: serializeTransitionMap(transitions2GramByFamily.minor, 8, 2),
  },
  transitions2Gram: {
    major: serializeTransitionMap(transitions2GramByPc.major, 8, 2),
    minor: serializeTransitionMap(transitions2GramByPc.minor, 8, 2),
  },
  transitions3Gram: {
    major: serializeTransitionMap(transitions3Gram.major, 5, 2),
    minor: serializeTransitionMap(transitions3Gram.minor, 5, 2),
  },
};

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2), "utf8");
console.log(
  `Re-indexed Neo-Soul Corpus with strict Quality Families: ${validSongsCount} songs, ${totalTransitions} transitions`
);
