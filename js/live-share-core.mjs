export const LIVE_SHARE_SCHEMA_VERSION = 1;
export const MAX_ROLLS = 1000;

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function isValidShareId(value) {
  if (!SHARE_ID_PATTERN.test(value ?? "")) return false;

  try {
    const padded = `${value.replaceAll("-", "+").replaceAll("_", "/")}==`;
    if (typeof globalThis.atob === "function") {
      return globalThis.atob(padded).length === 16;
    }
    return Buffer.from(padded, "base64url").length === 16;
  } catch {
    return false;
  }
}

export function normalizeRolls(value) {
  if (value == null) return [];

  const rolls = Array.isArray(value)
    ? value.filter((roll) => roll != null)
    : isPlainObject(value)
      ? Object.keys(value)
          .sort(compareRtdbKeys)
          .map((key) => value[key])
      : null;

  if (rolls == null || rolls.length > MAX_ROLLS) {
    throw new Error("Invalid rolls collection");
  }

  const seenIds = new Set();
  return rolls.map((roll) => {
    if (!isPlainObject(roll)) throw new Error("Invalid roll");

    const normalized = {
      id: roll.id,
      timestamp: roll.timestamp,
      dice1: roll.dice1,
      dice2: roll.dice2,
      dice3: roll.dice3,
    };

    if (
      typeof normalized.id !== "string" ||
      normalized.id.length === 0 ||
      !Number.isFinite(normalized.timestamp) ||
      !isDie(normalized.dice1) ||
      !isDie(normalized.dice2) ||
      !isDie(normalized.dice3) ||
      seenIds.has(normalized.id)
    ) {
      throw new Error("Invalid roll");
    }

    seenIds.add(normalized.id);
    return normalized;
  });
}

export function parseSnapshot(value) {
  if (!isPlainObject(value)) throw new Error("Invalid snapshot");
  if (value.schemaVersion !== LIVE_SHARE_SCHEMA_VERSION) {
    throw new Error("Unsupported schema");
  }
  if (
    !Number.isFinite(value.startedAt) ||
    !Number.isFinite(value.updatedAt)
  ) {
    throw new Error("Invalid timestamps");
  }

  return {
    startedAt: value.startedAt,
    updatedAt: value.updatedAt,
    rolls: normalizeRolls(value.rolls),
  };
}

export function analyzeRolls(rolls) {
  const totalRolls = rolls.length;
  const enrichedRolls = rolls.map(classifyRoll);
  const nonTriples = enrichedRolls.filter((roll) => !roll.isTriple);
  const triples = enrichedRolls.filter((roll) => roll.isTriple);

  const tripleCounts = countsForRange(1, 6);
  const sumCounts = countsForRange(3, 18);
  const faceCounts = countsForRange(1, 6);

  for (const roll of enrichedRolls) {
    sumCounts[roll.sum] += 1;
    faceCounts[roll.dice1] += 1;
    faceCounts[roll.dice2] += 1;
    faceCounts[roll.dice3] += 1;
    if (roll.isTriple) tripleCounts[roll.dice1] += 1;
  }

  return {
    totalRolls,
    rolls: enrichedRolls,
    basic: {
      bigPercent: percentOf(
        nonTriples.filter((roll) => roll.bigSmall === "大").length,
        nonTriples.length,
      ),
      smallPercent: percentOf(
        nonTriples.filter((roll) => roll.bigSmall === "小").length,
        nonTriples.length,
      ),
      oddPercent: percentOf(
        nonTriples.filter((roll) => roll.oddEven === "單").length,
        nonTriples.length,
      ),
      evenPercent: percentOf(
        nonTriples.filter((roll) => roll.oddEven === "雙").length,
        nonTriples.length,
      ),
      triplePercent: percentOf(triples.length, totalRolls),
    },
    tripleRates: entriesForRange(tripleCounts, 1, 6).map(([face, count]) => ({
      face,
      percentage: percentOf(count, totalRolls),
    })),
    diceHeat: {
      frequencies: entriesForRange(faceCounts, 1, 6).map(([number, count]) => ({
        number,
        count,
        percentage: percentOf(count, totalRolls * 3),
      })),
      hotNumber: uniqueExtremeKey(faceCounts, Math.max),
      coldNumber: uniqueExtremeKey(faceCounts, Math.min),
    },
    sumDistribution: entriesForRange(sumCounts, 3, 18).map(([sum, count]) => ({
      sum,
      percentage: percentOf(count, totalRolls),
    })),
    hotSum: uniqueExtremeKey(sumCounts, Math.max),
    coldSum: uniqueExtremeKey(sumCounts, Math.min),
  };
}

export function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

function classifyRoll(roll) {
  const sum = roll.dice1 + roll.dice2 + roll.dice3;
  return {
    ...roll,
    sum,
    bigSmall: sum >= 11 ? "大" : "小",
    oddEven: sum % 2 === 0 ? "雙" : "單",
    isTriple: roll.dice1 === roll.dice2 && roll.dice2 === roll.dice3,
  };
}

function percentOf(count, denominator) {
  return denominator > 0 ? (count * 100) / denominator : 0;
}

function uniqueExtremeKey(counts, extreme) {
  const values = Object.values(counts);
  if (values.length === 0) return null;
  const target = extreme(...values);
  const matches = Object.entries(counts).filter(([, count]) => count === target);
  return matches.length === 1 ? Number(matches[0][0]) : null;
}

function countsForRange(start, end) {
  return Object.fromEntries(
    Array.from({ length: end - start + 1 }, (_, index) => [start + index, 0]),
  );
}

function entriesForRange(counts, start, end) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => {
      const key = start + index;
      return [key, counts[key]];
    },
  );
}

function isDie(value) {
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function compareRtdbKeys(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isInteger(leftNumber) && Number.isInteger(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return left.localeCompare(right);
}
