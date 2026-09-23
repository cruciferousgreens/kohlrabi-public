'use strict';
/* F1 — Hevy "titled" CSV import dropped the rpe column: the hevy-title branch
   of obMapHevyRows mapped date/name/exercise/set/reps/weight/tags/duration/
   notes but never read row['rpe'], so every imported set came in with rpe:null
   and its e1RM silently fell back to plain Epley. The branch now keeps the
   RPE like the untitled hevy branch does. Role: csv-import (parse layer). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {obParseCsvText}=loadRole('csv-import',{globals:{exercises:[
  {id:'bench',name:'Bench Press'},
]}});

describe('F1 — hevy-title import keeps the RPE column',()=>{
  it('a titled Hevy row with an rpe value keeps it',()=>{
    const csv=[
      'workout start,workout name,exercise name,set order,set type,weight (kg),reps,rpe',
      '2024-01-05,Morning Push,Bench Press,1,normal,60,10,8',
    ].join('\n');
    const {rows,errors,format}=obParseCsvText(csv);
    assert.equal(format,'hevy-title');
    assert.deepEqual(errors,[]);
    assert.equal(rows.length,1);
    assert.equal(rows[0].rpe,'8');
    assert.equal(rows[0].weight_lb,'132.28'); /* kg→lb mapping still works */
    assert.equal(rows[0].exercise,'Bench Press');
    assert.equal(rows[0].reps,'10');
  });
  it('an absent rpe column stays the empty string (not null)',()=>{
    const csv=[
      'workout start,workout name,exercise name,set order,set type,weight (kg),reps',
      '2024-01-05,Morning Push,Bench Press,1,normal,60,10',
    ].join('\n');
    const {rows}=obParseCsvText(csv);
    assert.equal(rows.length,1);
    assert.equal(rows[0].rpe,'');
  });
});
