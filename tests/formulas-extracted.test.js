#!/usr/bin/env node
'use strict';
/* v1.878 restructure: pins the exact outputs of the pure formula functions
   extracted into assets/js/formulas/. These are the app's tunable math —
   any change here is user-visible by definition. */
const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const {loadRole} = require('./harness');

const {
  LB_TO_KG, isMetric, weightUnit, displayWeight, storageWeight,
  setVolume, displayVolume, SECONDARY_MUSCLE_WEIGHT,
  rpeToRir, rirToRpe, blankRpeToNull, rpeRepJump, fmtRpe,
  epley1RM, epleyLoadForReps, estimate1RM, backIntoRange,
  roundedIncrement, scaledLoadIncrement, snapToIncrement, snapUpToIncrement,
  warmupLadderRows,
  PR_E1RM_TOLERANCE, detectExercisePRs, detectTimedPRs, detectBodyweightPRs,
  programPctForWeek, isDeloadWeek, clampPct1RM, clampDeloadPct,
  topSetForSession,
  progressionSetup,
} = loadRole('progression-logic');

describe('formulas/units', () => {
  test('canonical store is pounds; 1 lb = 0.45359237 kg', () => {
    assert.equal(LB_TO_KG, 0.45359237);
    assert.equal(isMetric(), false);
    assert.equal(weightUnit(), 'lb');
    assert.equal(displayWeight(100), '100');
    assert.equal(storageWeight('100'), '100');
  });
  test('metric is a display/input lens only', () => {
    progressionSetup.units = 'metric';
    try {
      assert.equal(weightUnit(), 'kg');
      assert.equal(displayWeight(100), '45.4');
      assert.equal(storageWeight('45.4'), '100.1'); // 1-decimal round-trip dust (pre-existing)
      assert.equal(displayWeight(''), '');
      assert.equal(storageWeight(null), '');
    } finally {
      progressionSetup.units = 'imperial';
    }
  });
});

describe('formulas/volume', () => {
  test('setVolume is weight × reps; distance sets contribute 0', () => {
    assert.equal(setVolume({w: 135, r: 8}), 1080);
    assert.equal(setVolume({w: 135, r: 8, distance: 40}), 0);
    assert.equal(setVolume({w: 'abc', r: 8}), 0);
  });
  test('secondary muscle attribution weight', () => {
    assert.equal(SECONDARY_MUSCLE_WEIGHT, 0.45);
  });
  test('displayVolume degrades non-finite to 0 (#chaos)', () => {
    assert.equal(displayVolume('1e309'), 0);
    assert.equal(displayVolume(1080), 1080);
  });
});

describe('formulas/rpe', () => {
  test('RPE↔RIR rounds to 0.5', () => {
    assert.equal(rpeToRir(7.5), '2.5');
    assert.equal(rirToRpe(2.5), '7.5');
    assert.equal(rpeToRir(''), '10'); // Number('')===0 → degenerate but unchanged
  });
  test('blank RPE is null, never 0 (#370)', () => {
    assert.equal(blankRpeToNull(''), null);
    assert.equal(blankRpeToNull('   '), null);
    assert.equal(blankRpeToNull('abc'), null);
    assert.equal(blankRpeToNull(7.5), 7.5);
  });
  test('rep jump is RIR rounded half-up, floor 2 (#483, #387)', () => {
    assert.equal(rpeRepJump(7.5), 3);
    assert.equal(rpeRepJump(9), 2);
    assert.equal(rpeRepJump(10), 2);
    assert.equal(fmtRpe(8.199999), '8.2');
  });
});

describe('formulas/e1rm', () => {
  test('Epley: 1RM = w(1+r/30)', () => {
    assert.equal(epley1RM(100, 10), 100 * (1 + 10 / 30));
    assert.equal(epley1RM(0, 5), 0);
  });
  test('epleyLoadForReps inverts Epley', () => {
    const e1 = epley1RM(245, 5, 3); // 245 × 38/30
    assert.ok(Math.abs(epleyLoadForReps(e1, 9, 3) - 245 * 38 / 42) < 0.01);
  });
  test('Epley cross-checks against the NSCA %1RM table (~1%)', () => {
    // Implied %1RM = 1/(1+r/30); NSCA Essentials: 5→87%, 9→~77%, 12→70%.
    const pct = r => 100 / (1 + r / 30);
    assert.ok(Math.abs(pct(5) - 87) / 87 < 0.02);
    assert.ok(Math.abs(pct(9) - 77) / 77 < 0.02);
    assert.ok(Math.abs(pct(12) - 70) / 70 < 0.03);
  });
  test('estimate1RM folds RPE in via RIR; blank RPE = plain Epley', () => {
    assert.equal(estimate1RM({w: 245, r: 2, rpe: 7}), 245 * (1 + 5 / 30));
    assert.equal(estimate1RM({w: 245, r: 2, rpe: ''}), 245 * (1 + 2 / 30));
    assert.equal(estimate1RM({w: 0, r: 5}), 0);
  });
  test('backIntoRange: hypertrophy anchor 245×2 @7, 6–12 → 205×9', () => {
    const res = backIntoRange(245, 2, 7, 6, 12, 'fixed', 5);
    assert.equal(res.kind, 'backrange');
    assert.equal(res.nextWeight, 205);
    assert.equal(res.nextReps, 9);
  });
  test('backIntoRange: strength anchor 245×2 @7, 3–5 → hold 245×5', () => {
    const res = backIntoRange(245, 2, 7, 3, 5, 'fixed', 5);
    assert.equal(res.kind, 'reps');
    assert.equal(res.nextWeight, 245);
    assert.equal(res.nextReps, 5);
  });
  test('backIntoRange: in-range set → null', () => {
    assert.equal(backIntoRange(200, 8, 7, 6, 12, 'fixed', 5), null);
  });
});

describe('formulas/increments', () => {
  test('fixed increments snap to the step grid (#246)', () => {
    assert.equal(roundedIncrement(100, 'fixed', 5), 105);
    assert.equal(snapToIncrement(108.6, 'fixed', 5), 110);
  });
  test('percent increments snap to the 5 lb grid, never decimals (#473)', () => {
    assert.equal(snapToIncrement(136.25, 'percent', 9), 135);
  });
  test('snapUpToIncrement rounds up', () => {
    assert.equal(snapUpToIncrement(136.25, 'percent', 9), 140);
  });
  test('scaled increments grow the step but keep the grid', () => {
    assert.equal(scaledLoadIncrement(100, 'fixed', 5, 1), 105);
    assert.equal(scaledLoadIncrement(100, 'fixed', 5, 2), 110);
  });
  test('warm-up ladder is pure rung math (#185)', () => {
    const rows = warmupLadderRows(140, 'reps');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].w, '55'); // 56 → 55 on the 5 lb grid
    assert.equal(rows[1].w, '85'); // 84 → 85
  });
});

describe('formulas/prs', () => {
  test('e1rm PR needs to beat prior best by the tolerance', () => {
    assert.equal(PR_E1RM_TOLERANCE, 0.5);
    const prior = [{w: 200, r: 5}];
    assert.equal(detectExercisePRs([{w: 205, r: 5}], prior), 'e1rm');
    assert.equal(detectExercisePRs([{w: 200, r: 5}], prior), '');
  });
  test('heaviest PR for a new top weight', () => {
    const prior = [{w: 200, r: 8}];
    assert.equal(detectExercisePRs([{w: 205, r: 3}], prior), 'heaviest');
  });
  test('bodyweight PRs compare unweighted sets only (#372)', () => {
    assert.equal(detectBodyweightPRs([{w: 0, r: 12}], [{w: 0, r: 10}]), true);
    assert.equal(detectBodyweightPRs([{w: 45, r: 12}], [{w: 0, r: 10}]), false);
  });
  test('timed PRs compare holds at the same load (#282)', () => {
    assert.equal(detectTimedPRs([{w: 0, seconds: 70}], [{w: 0, seconds: 60}]), true);
    assert.equal(detectTimedPRs([{w: 0, seconds: 50}], [{w: 0, seconds: 60}]), false);
  });
});

describe('formulas/program-math', () => {
  test('weekly wave cycles; disabled wave → null', () => {
    assert.equal(programPctForWeek({pctWave: true, weeklyPcts: [70, 80, 90]}, 5), 80);
    assert.equal(programPctForWeek({pctWave: false, weeklyPcts: [70]}, 1), null);
  });
  test('deload week detection (wave flags only — Auto Deload removed)', () => {
    assert.equal(isDeloadWeek({pctWave: true, weeklyDeloads: [false, false, false, true]}, 4), true);
    assert.equal(isDeloadWeek({pctWave: true, weeklyDeloads: [false, false, false, true]}, 3), false);
    assert.equal(isDeloadWeek({pctWave: false, weeklyDeloads: [false, false, false, true]}, 4), false);
  });
  test('%1RM clamps', () => {
    assert.equal(clampPct1RM(80), 80);
    assert.equal(clampPct1RM(150), 100);
    assert.equal(clampDeloadPct(90), 80);
    assert.equal(clampDeloadPct(0), 60);
  });
});

describe('formulas/progression-analysis', () => {
  test('top set is the heaviest work set; warm-ups never compete (#185)', () => {
    const top = topSetForSession({sets: [
      {w: 135, r: 8, tags: ['Warmup']},
      {w: 185, r: 5},
      {w: 135, r: 8},
    ]});
    assert.equal(top.weight, 185);
    assert.equal(topSetForSession({sets: []}), null);
  });
});
