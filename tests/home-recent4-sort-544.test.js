'use strict';
/* #544 (user 2026-09-17): Home's "Recent workouts" list must order by the
   workout date (isoDate-first, #274's rule), not by when the entry was
   created/logged (completedAt-first). A workout performed Sep 2 but saved
   Sep 13 must sit with Sep 2 — not float to the top of the recent-4.
   Pin 1 pins the renderDashboard call site (selection + slice(0,4)); pin 2
   pins the ordering behavior itself. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole}=require('./harness');

const {sortByWorkoutDateDesc}=loadRole('utilities',{globals:{exercises:[]}});

const src=fs.readFileSync(path.join(__dirname,'..','assets','js','pages','dashboard-stats.js'),'utf8');

/* Mirror of the recent-4 selection in renderDashboard. */
const recent4=(completed)=>completed.slice().sort(sortByWorkoutDateDesc).slice(0,4);

describe('#544: Home recent-4 orders by workout date',()=>{
  it('renderDashboard selects the recent-4 with sortByWorkoutDateDesc',()=>{
    const start=src.indexOf('function renderDashboard()');
    assert.ok(start!==-1,'renderDashboard exists');
    const body=src.slice(start,src.indexOf('function renderDashboardStats',start));
    assert.match(body,/slice\(\)\.sort\(sortByWorkoutDateDesc\)\.slice\(0,4\)/,
      'recent-4 must use the workout-date sort, not completedAt-first');
    assert.doesNotMatch(body,/sort\(sortByRecencyDesc\)\.slice\(0,4\)/,
      'no completedAt-first recent-4 selection remains');
  });
  it('a late-logged Sep 2 workout does not float above Sep 8/12 workouts',()=>{
    const completed=[
      {id:'legs',name:'Legs',date:'2026-09-02',completedAt:'2026-09-13T08:00:00.000Z'},
      {id:'jibran',name:'With Jibran',date:'2026-09-12',completedAt:'2026-09-12T18:00:00.000Z'},
      {id:'back',name:'Back',date:'2026-09-08',completedAt:'2026-09-08T18:00:00.000Z'},
      {id:'push',name:'Push',date:'2026-09-05',completedAt:'2026-09-05T18:00:00.000Z'},
      {id:'run',name:'Run',date:'2026-08-30',completedAt:'2026-08-30T07:00:00.000Z'},
    ];
    const order=recent4(completed).map(w=>w.id);
    assert.deepEqual(order,['jibran','back','push','legs'],
      'most-recently-performed first; Sep 2 log sits by its workout date');
  });
  it('same-day ties still break on completion time',()=>{
    const completed=[
      {id:'am',name:'AM',date:'2026-09-12',completedAt:'2026-09-12T08:00:00.000Z'},
      {id:'pm',name:'PM',date:'2026-09-12',completedAt:'2026-09-12T20:00:00.000Z'},
    ];
    const order=recent4(completed).map(w=>w.id);
    assert.deepEqual(order,['pm','am']);
  });
});
