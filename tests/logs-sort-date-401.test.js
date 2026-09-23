'use strict';
/* #401 (user 2026-09-13): the Logs list displays w.date, so it must sort by
   the workout date — not by the completion timestamp. A log for a Sep 2
   workout that was saved on Sep 13 (late logging) must sit with Sep 2, not
   float to the top by its completedAt. completedAt survives only as the
   same-day tiebreaker (per #277's same-day-chronology rule). Role: utilities. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {sortByWorkoutDateDesc,sortByRecencyDesc}=loadRole('utilities',{globals:{exercises:[]}});

/* The reported case: Legs (Sep 2) saved Sep 13, With Jibran (Sep 12), Back (Sep 8). */
const mkLogs=()=>[
  {id:'legs',name:'Legs',date:'2026-09-02',completedAt:'2026-09-13T08:00:00.000Z'},
  {id:'jibran',name:'With Jibran',date:'2026-09-12',completedAt:'2026-09-12T18:00:00.000Z'},
  {id:'back',name:'Back',date:'2026-09-08',completedAt:'2026-09-08T18:00:00.000Z'},
];

describe('sortByWorkoutDateDesc (#401)',()=>{
  it('sorts by workout date, not completion timestamp (the reported case)',()=>{
    const order=mkLogs().slice().sort(sortByWorkoutDateDesc).map(w=>w.id);
    assert.deepEqual(order,['jibran','back','legs'],'Sep 2 log saved Sep 13 sits with Sep 2');
  });
  it('the old sortByRecencyDesc would float the late-logged entry to the top',()=>{
    const order=mkLogs().slice().sort(sortByRecencyDesc).map(w=>w.id);
    assert.deepEqual(order,['legs','jibran','back'],'completedAt-first puts Sep 2 first — the bug');
  });
  it('completedAt breaks same-day ties (newest completion first)',()=>{
    const logs=[
      {id:'am',date:'2026-09-05',completedAt:'2026-09-05T08:00:00.000Z'},
      {id:'pm',date:'2026-09-05',completedAt:'2026-09-05T18:00:00.000Z'},
    ];
    const order=logs.slice().sort(sortByWorkoutDateDesc).map(w=>w.id);
    assert.deepEqual(order,['pm','am'],'#277 same-day chronology survives');
  });
  it('logs without a date sort after dated ones',()=>{
    const logs=[
      {id:'nodate',completedAt:'2026-09-13T08:00:00.000Z'},
      {id:'dated',date:'2026-09-01',completedAt:'2026-09-01T08:00:00.000Z'},
    ];
    const order=logs.slice().sort(sortByWorkoutDateDesc).map(w=>w.id);
    assert.deepEqual(order,['dated','nodate']);
  });
});
