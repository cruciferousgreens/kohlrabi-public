'use strict';
/* #559 (persona sweep v1.862): the future-date Upcoming card starts a
   program workout with the DISPLAYED week (not the current week). Wired
   through dashboard-stats.js and programs.js DOM paths; this test pins the
   wiring at the source level (the #276 pattern) so a refactor can't silently
   drop the week. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const dash=fs.readFileSync(path.join(__dirname,'..','assets','js','pages','dashboard-stats.js'),'utf8');
const prog=fs.readFileSync(path.join(__dirname,'..','assets','js','pages','programs.js'),'utf8');

describe('#559: the Upcoming Start button carries the displayed week',()=>{
  it('the card button embeds the card\'s computed week',()=>{
    assert.ok(dash.includes('data-upcoming-week="${week}"'),
      'Start button must carry data-upcoming-week with the card week');
  });
  it('the click handler forwards it to startProgramWorkout',()=>{
    assert.ok(dash.includes('e.currentTarget?.dataset?.upcomingWeek'),
      'click handler must read the button\'s upcomingWeek dataset');
    assert.ok(dash.includes('startProgramWorkout(program,next,e.currentTarget?.dataset?.upcomingWeek)'),
      'click handler must pass the week into startProgramWorkout');
  });
  it('startProgramWorkout/doStartProgramWorkout accept and use the week',()=>{
    assert.ok(prog.includes('function startProgramWorkout(program, workout, week=null)'),
      'startProgramWorkout must take an optional week');
    assert.ok(prog.includes('function doStartProgramWorkout(program, workout, week=null)'),
      'doStartProgramWorkout must take an optional week');
    assert.ok(prog.includes('const startWeek=Number(week)||programWeek(program)'),
      'a passed week wins; missing week keeps current-week behavior');
    assert.ok(prog.includes('programRangeForWeek(program,startWeek)'),
      'inherited range must come from the displayed week');
    assert.ok(prog.includes('currentWeek:startWeek'),
      'progression context must carry the displayed week');
  });
});
