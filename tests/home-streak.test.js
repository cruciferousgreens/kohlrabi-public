'use strict';
/* Home streak (user 2026-09-19): consecutive calendar days with ≥1 completed
   workout, anchored at today — or at yesterday when today has no workout yet
   (the streak stays alive). Future-dated logs never count. Pure function
   currentStreakDayCount(completed, todayIso); the Home chip shows it only
   when the streak is ≥ 2 days. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {currentStreakDayCount}=loadRole('stats-math',{globals:{exercises:[]}});

const W=date=>({id:'w-'+date,date,exercises:[]});

describe('currentStreakDayCount',()=>{
  it('counts consecutive days anchored at today',()=>{
    const completed=[W('2026-09-19'),W('2026-09-18'),W('2026-09-17')];
    assert.equal(currentStreakDayCount(completed,'2026-09-19'),3);
  });
  it('a gap resets the count to the run ending at the anchor',()=>{
    const completed=[W('2026-09-19'),W('2026-09-17'),W('2026-09-16')];
    assert.equal(currentStreakDayCount(completed,'2026-09-19'),1);
  });
  it('no workout today anchors at yesterday so the streak stays alive',()=>{
    const completed=[W('2026-09-18'),W('2026-09-17'),W('2026-09-16')];
    assert.equal(currentStreakDayCount(completed,'2026-09-19'),3);
  });
  it('a full rest day breaks the streak',()=>{
    const completed=[W('2026-09-17'),W('2026-09-16')];
    assert.equal(currentStreakDayCount(completed,'2026-09-19'),0);
  });
  it('multiple workouts on one day count once',()=>{
    const completed=[W('2026-09-19'),{id:'w2',date:'2026-09-19',exercises:[]},W('2026-09-18')];
    assert.equal(currentStreakDayCount(completed,'2026-09-19'),2);
  });
  it('future-dated logs are ignored',()=>{
    const completed=[W('2026-09-20'),W('2026-09-19'),W('2026-09-18')];
    assert.equal(currentStreakDayCount(completed,'2026-09-19'),2);
  });
  it('malformed dates and empty history yield 0',()=>{
    assert.equal(currentStreakDayCount([W('not-a-date'),W('2026-09-19')],'2026-09-19'),1);
    assert.equal(currentStreakDayCount([W('not-a-date')],'2026-09-19'),0);
    assert.equal(currentStreakDayCount([],'2026-09-19'),0);
    assert.equal(currentStreakDayCount(null,'2026-09-19'),0);
  });
});
