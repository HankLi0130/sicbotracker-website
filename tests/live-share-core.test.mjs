import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  analyzeRolls,
  analyticsConfig,
  formatPercent,
  isValidShareId,
  normalizeRolls,
  parseSnapshot,
} from "../js/live-share-core.mjs";

const fixture = JSON.parse(
  await readFile(new URL("./fixtures/live-share-v1.json", import.meta.url), "utf8"),
);

test("share ID accepts exactly 128-bit URL-safe Base64 without padding", () => {
  assert.equal(isValidShareId("AAAAAAAAAAAAAAAAAAAAAA"), true);
  assert.equal(isValidShareId("Zp4CIX9Tn7gLwljOAo-V5w"), true);
  assert.equal(isValidShareId("_wAAAAAAAAAAAAAAAAAAAA"), true);
  assert.equal(isValidShareId("AAAAAAAAAAAAAAAAAAAAA"), false);
  assert.equal(isValidShareId("AAAAAAAAAAAAAAAAAAAAA="), false);
  assert.equal(isValidShareId("AAAAAAAAAAAAAAAAAAAAA+"), false);
});

test("analytics config disables page views and excludes bearer URL data", () => {
  const shareId = "Zp4CIX9Tn7gLwljOAo-V5w";
  const location = {
    href: `https://example.com/share.html?s=${shareId}#records`,
  };

  const config = analyticsConfig(location);

  assert.deepEqual(config, {
    send_page_view: false,
    page_location: "https://example.com/share.html",
    page_referrer: "",
  });
  assert.equal(JSON.stringify(config).includes(shareId), false);
});

test("schema parser normalizes RTDB objects without exposing owner UID", () => {
  const parsed = parseSnapshot(fixture);

  assert.equal(parsed.rolls.length, 5);
  assert.equal(parsed.rolls[0].id, "triple-one");
  assert.equal("ownerUid" in parsed, false);
});

test("schema parser supports arrays and absent rolls as an empty snapshot", () => {
  const arraySnapshot = {
    ...fixture,
    rolls: [fixture.rolls["0"], fixture.rolls["1"]],
  };

  assert.deepEqual(
    parseSnapshot(arraySnapshot).rolls.map((roll) => roll.id),
    ["triple-one", "triple-five"],
  );
  assert.deepEqual(parseSnapshot({ ...fixture, rolls: undefined }).rolls, []);
});

test("schema parser rejects unsupported or malformed snapshots", () => {
  assert.throws(() => parseSnapshot({ ...fixture, schemaVersion: 2 }));
  assert.throws(() => parseSnapshot({ ...fixture, updatedAt: "now" }));
  assert.throws(() => parseSnapshot({
    ...fixture,
    rolls: [{ ...fixture.rolls["0"], dice1: 7 }],
  }));
  assert.throws(() => parseSnapshot({
    ...fixture,
    rolls: [fixture.rolls["0"], fixture.rolls["0"]],
  }));
  assert.throws(() => normalizeRolls(
    Array.from({ length: 1001 }, (_, index) => ({
      id: `roll-${index}`,
      timestamp: index,
      dice1: 1,
      dice2: 2,
      dice3: 3,
    })),
  ));
});

test("basic analysis excludes triples from Big Small and Odd Even", () => {
  const analysis = analyzeRolls(parseSnapshot(fixture).rolls);

  assert.equal(analysis.totalRolls, 5);
  assertClose(analysis.basic.bigPercent, 100 / 3);
  assertClose(analysis.basic.smallPercent, 200 / 3);
  assertClose(analysis.basic.oddPercent, 200 / 3);
  assertClose(analysis.basic.evenPercent, 100 / 3);
  assert.equal(analysis.basic.triplePercent, 40);
});

test("per-triple rates use total rolls and sum to overall triple rate", () => {
  const analysis = analyzeRolls(parseSnapshot(fixture).rolls);

  assert.equal(analysis.tripleRates.find((rate) => rate.face === 1).percentage, 20);
  assert.equal(analysis.tripleRates.find((rate) => rate.face === 5).percentage, 20);
  assert.equal(
    analysis.tripleRates.reduce((total, rate) => total + rate.percentage, 0),
    analysis.basic.triplePercent,
  );
});

test("dice heat and sum distribution use deterministic unique hot cold rules", () => {
  const rolls = [
    roll("a", 1, 1, 2),
    roll("b", 1, 1, 2),
    roll("c", 3, 3, 4),
    roll("d", 4, 5, 5),
    roll("e", 6, 3, 4),
  ];
  const analysis = analyzeRolls(rolls);

  assert.equal(analysis.diceHeat.hotNumber, 1);
  assert.equal(analysis.diceHeat.coldNumber, 6);
  assert.deepEqual(analysis.sumDistribution.map((rate) => rate.sum), range(3, 18));

  const tied = analyzeRolls([
    roll("one", 1, 2, 3),
    roll("two", 4, 5, 6),
  ]);
  assert.equal(tied.diceHeat.hotNumber, null);
  assert.equal(tied.diceHeat.coldNumber, null);
});

test("sum distribution marks only a unique maximum", () => {
  const analysis = analyzeRolls([
    roll("a", 1, 3, 6),
    roll("b", 2, 3, 5),
    roll("c", 4, 5, 1),
    roll("d", 1, 2, 3),
    roll("e", 1, 2, 3),
  ]);

  assert.equal(analysis.hotSum, 10);
  assert.equal(analysis.coldSum, null);
  const hotRate = analysis.sumDistribution.find((rate) => rate.sum === 10).percentage;
  assert.equal(hotRate, 60);
  assert.equal(formatPercent(hotRate), "60.0%");
});

function roll(id, dice1, dice2, dice3) {
  return {
    id,
    timestamp: 1800000000000,
    dice1,
    dice2,
    dice3,
  };
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.0001, `${actual} != ${expected}`);
}
