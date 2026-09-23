'use strict';
/* #435: with exactly one day of history the progress chart is a single
   dot, and same-day sessions aggregate to ONE point per day (#165) — the
   "log one more session" copy falsely implied a second same-day session
   would draw the chart. The copy now states the real threshold. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const detail=fs.readFileSync(path.join(ROOT,'assets/js/pages/exercise-detail.js'),'utf8');

describe('#435 one-day progress copy states the real threshold',()=>{
  it('the misleading copy is gone',()=>{
    assert.ok(!detail.includes('Log one more session to see your progress chart.'),
      'the old copy no longer promises one more (same-day) session draws the chart');
  });
  it('the replacement copy names the real threshold',()=>{
    const line=detail.split('\n').find(l=>l.includes('trendData.e1rm.length===1&&progressNote'));
    assert.ok(line,'the one-day branch still exists');
    assert.ok(line.includes('another day'),
      'the copy says the chart needs a session on another day');
  });
  it('the aggregation premise is still documented in the trend code',()=>{
    assert.ok(detail.includes('ONE point per day'),
      'the one-point-per-day aggregation rule is still the code\'s premise');
  });
});
