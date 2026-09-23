'use strict';
/* #492 (agent): warm-up rung weights used to snap to the 5 lb plate grid
   only, bypassing the #473 formula grid — an odd anchor (109 lb) halved into
   ugly per-dumbbell decimals. Rungs now snap to the #473 5 lb grid (the same
   increment grid fixed-lb increments use; 2.5 kg for metric users), and
   per-dumbbell exercises additionally snap the rung total to an even whole
   total (the #473 even-total rule) so the halved placeholder stays whole. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {
  warmupLadderRows, DEFAULT_PROGRESSION_SETUP, progressionSetup, workoutState,
}=loadRole('progression-logic');

const freshSetup=()=>JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));
beforeEach(()=>{
  workoutState.completed=[];
  workoutState.activeProgram=null;
  Object.keys(progressionSetup).forEach(k=>delete progressionSetup[k]);
  Object.assign(progressionSetup,freshSetup());
  progressionSetup.units='imperial';
});
/* On-grid means a 5 lb multiple (imperial). */
const onGrid=w=>{const n=Number(w);return n>0&&Math.abs(n/5-Math.round(n/5))<1e-9;};
/* Metric on-grid means a 2.5 kg multiple. */
const onMetricGrid=w=>{const kg=Number(w)*0.45359237;return kg>0&&Math.abs(kg/2.5-Math.round(kg/2.5))<1e-9;};

describe('#492: warmup rungs snap to the 5 lb grid',()=>{
  it('odd anchor (109 lb): every rung lands on the 5 lb grid',()=>{
    const rows=warmupLadderRows(109,'reps');
    assert.ok(rows.length>=2,'ladder has rungs');
    for(const row of rows){
      assert.ok(onGrid(row.w),`rung ${row.pct}% → ${row.w} lb is on the 5 lb grid`);
    }
  });
  it('no rung carries decimals (5 lb multiples print whole)',()=>{
    const rows=warmupLadderRows(109,'reps');
    for(const row of rows){
      assert.match(row.w,/^\d+$/,`rung weight prints clean: ${row.w}`);
    }
  });
  it('per-dumbbell: odd anchor → even totals, so halved placeholders stay whole',()=>{
    const rows=warmupLadderRows(109,'reps',true);
    for(const row of rows){
      const total=Number(row.w);
      assert.ok(Number.isInteger(total),`per-db rung total is whole: ${row.w}`);
      assert.ok(Number.isInteger(total/2),`per-dumbbell placeholder has no decimals: ${total/2}`);
    }
  });
  it('the even-total flag is optional: barbell rungs keep the plain grid',()=>{
    const rows=warmupLadderRows(109,'reps');
    /* 109 × 40% = 43.6 → 45 on the grid (no even-total rule for barbells). */
    assert.equal(rows[0].w,'45');
  });
  it('metric snaps to the 2.5 kg grid (the kg-equivalent of the 5 lb grid)',()=>{
    progressionSetup.units='metric';
    const rows=warmupLadderRows(109,'reps');
    for(const row of rows){
      assert.ok(onMetricGrid(row.w),`metric rung ${row.pct}% → ${row.w} on the 2.5 kg grid`);
    }
    // 43.6 lb → 20 kg (canonical lb carries float dust; display rounds to 1 kg decimal)
    assert.ok(Math.abs(Number(rows[0].w)*0.45359237-20)<1e-9,`20 kg, got ${rows[0].w}`);
  });
  it('no anchor → blank editable weight, reps still ladder',()=>{
    const rows=warmupLadderRows(0,'reps',true);
    assert.equal(rows[0].w,'');
    assert.equal(rows[0].reps,'5');
  });
});
