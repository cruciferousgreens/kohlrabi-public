'use strict';
/* #360: the saved-workout Configure dialog's progression-override controls
   (reps-only toggle, increment type/value, time-step pills, progression
   on/off) write p.repsOnly / p.incrementType / p.incrementValue /
   p.timeStep / p.scheme on Apply. buildBuilderConfigureProgression is the
   pure builder behind the Apply handler; these tests pin its contract. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const {buildBuilderConfigureProgression,progressionSetup,defaultExerciseProgression}=loadRole('saved-workout-template');

describe('buildBuilderConfigureProgression (#360)',()=>{
  it('writes all override fields from the dialog values (time exercise)',()=>{
    const p=buildBuilderConfigureProgression({min:6,max:12},{
      time:true,repsOnly:true,incrementType:'percent',incrementValue:'2.5',
      timeStep:15,progressionOn:true,
    });
    assert.equal(p.repsOnly,true);
    assert.equal(p.incrementType,'percent');
    assert.equal(p.incrementValue,2.5);
    assert.equal(p.timeStep,15);
    assert.equal(p.custom,true);
    assert.equal(p.scheme,undefined);
    assert.equal(p.min,6);
    assert.equal(p.max,12);
  });
  it('does not write timeStep for rep-tracking exercises',()=>{
    const p=buildBuilderConfigureProgression({timeStep:30},{
      time:false,repsOnly:false,incrementType:'lb',incrementValue:'5',
      timeStep:15,progressionOn:true,
    });
    assert.equal(p.timeStep,30);
  });
  it('falls back to lb for unknown increment types',()=>{
    const p=buildBuilderConfigureProgression({},{
      time:false,incrementType:'stones',incrementValue:'5',progressionOn:true,
    });
    assert.equal(p.incrementType,'lb');
  });
  it('blank/zero/negative increment falls back to prev, then the global default',()=>{
    const dflt=progressionSetup.incrementValue;
    assert.equal(buildBuilderConfigureProgression({incrementValue:7.5},{time:false,incrementValue:'',progressionOn:true}).incrementValue,7.5);
    assert.equal(buildBuilderConfigureProgression({incrementValue:7.5},{time:false,incrementValue:'0',progressionOn:true}).incrementValue,7.5);
    assert.equal(buildBuilderConfigureProgression({incrementValue:7.5},{time:false,incrementValue:'-3',progressionOn:true}).incrementValue,7.5);
    assert.equal(buildBuilderConfigureProgression({},{time:false,incrementValue:'',progressionOn:true}).incrementValue,dflt);
  });
  it("progression off writes scheme:'off'; on removes a stored 'off'",()=>{
    const off=buildBuilderConfigureProgression({},{time:false,progressionOn:false});
    assert.equal(off.scheme,'off');
    assert.equal(off.custom,true);
    const on=buildBuilderConfigureProgression({scheme:'off'},{time:false,progressionOn:true});
    assert.equal('scheme' in on,false);
  });
  it('leaves non-off schemes alone and never touches scheme when unstated',()=>{
    const p=buildBuilderConfigureProgression({scheme:'linear'},{time:false,progressionOn:true});
    assert.equal(p.scheme,'linear');
    const q=buildBuilderConfigureProgression({scheme:'off'},{time:false});
    assert.equal(q.scheme,'off');
  });
  it('does not mutate the previous profile',()=>{
    const prev={incrementType:'lb',incrementValue:5};
    buildBuilderConfigureProgression(prev,{time:true,repsOnly:true,incrementType:'percent',incrementValue:'10',timeStep:30,progressionOn:false});
    assert.deepEqual(prev,{incrementType:'lb',incrementValue:5});
  });
});

describe('defaultExerciseProgression scheme passthrough (#360)',()=>{
  it("carries scheme:'off' so share import keeps the per-exercise override",()=>{
    assert.equal(defaultExerciseProgression({scheme:'off'}).scheme,'off');
  });
  it('omits scheme when not overridden',()=>{
    assert.equal('scheme' in defaultExerciseProgression(),false);
    assert.equal('scheme' in defaultExerciseProgression({scheme:''}),false);
  });
});
