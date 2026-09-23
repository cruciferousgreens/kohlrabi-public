'use strict';
/* Role: exercise-detail-logic — pins #201 (user 2026-09-12): with a single
   data point the exercise Progress chart hides entirely (a dot is not a
   chart); the header keeps the latest value and the "log one more session"
   copy. Zero points keeps the existing empty-state message. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {lineChart}=loadRole('exercise-detail-logic');

const onePoint=[{label:'Sep 12, 2026',shortLabel:'Sep 12',value:200}];
const twoPoints=[{label:'Sep 10, 2026',shortLabel:'Sep 10',value:190},...onePoint];

describe('lineChart — #201 single data point hides the chart',()=>{
  it('zero points keeps the empty-state message',()=>{
    const html=lineChart([]);
    assert.match(html,/chart-empty/);
    assert.match(html,/Log workouts to start this chart/);
  });
  it('one point renders no SVG',()=>{
    const html=lineChart(onePoint);
    assert.equal(html,'');
    assert.ok(!html.includes('<svg'),'no chart markup for a single dot');
  });
  it('two points still render the chart',()=>{
    const html=lineChart(twoPoints);
    assert.ok(html.includes('<svg'),'chart renders with two points');
    assert.ok(html.includes('chart-line'),'line path present');
  });
});
