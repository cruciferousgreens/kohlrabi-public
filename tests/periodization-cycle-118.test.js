'use strict';
/* #118 (user 2026-09-16): default periodization cycle lengths — 4 / 6 / 8 /
   12 weeks behind a "Vary rep ranges by week" toggle (QA batch 2026-09-22:
   the toggle is back; the Off pill is gone, the toggle is the off switch).
   Program week N maps to cycle week ((N-1) mod cycleLen) + 1, so short
   programs use the cycle's first weeks and long programs loop. Only
   suggested rep ranges vary — the schedule never auto-applies training. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadRole,REPO_ROOT}=require('./harness');

const {
  cycleWeek, normalizeCycleLength, programRangeForWeek,
  normalizeProgression, DEFAULT_PROGRESSION_SETUP,
}=loadRole('focus-preset');

const html=fs.readFileSync(path.join(REPO_ROOT,'index.html'),'utf8');
const bootstrap=fs.readFileSync(path.join(REPO_ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('#118: cycleWeek mapping',()=>{
  it('maps ((N-1) mod cycleLen) + 1 for every supported length',()=>{
    for(const len of [4,6,8,12]){
      for(let w=1;w<=len;w++)assert.equal(cycleWeek(w,len),w,`week ${w} of a ${len}-week cycle`);
      assert.equal(cycleWeek(len+1,len),1,`week ${len+1} wraps to 1`);
      assert.equal(cycleWeek(2*len,len),len,`week ${2*len} is the cycle end`);
      assert.equal(cycleWeek(2*len+1,len),1,`week ${2*len+1} wraps to 1`);
    }
  });
  it('the issue’s exact formula: 8-week cycle, week 9 → 1, week 16 → 8',()=>{
    assert.equal(cycleWeek(9,8),1);
    assert.equal(cycleWeek(16,8),8);
    assert.equal(cycleWeek(10,8),2);
  });
  it('Off (0 or invalid) returns the week unchanged',()=>{
    assert.equal(cycleWeek(9,0),9);
    assert.equal(cycleWeek(9,undefined),9);
    assert.equal(cycleWeek(9,5),9,'unsupported lengths are Off, not a crash');
    assert.equal(cycleWeek(9,'8'),1,'string numbers coerce');
  });
  it('clamps nonsense weeks to 1',()=>{
    assert.equal(cycleWeek(0,8),1);
    assert.equal(cycleWeek(-3,8),1);
  });
});

describe('#118: normalizeCycleLength',()=>{
  it('accepts 4/6/8/12, rejects everything else as Off',()=>{
    for(const len of [4,6,8,12])assert.equal(normalizeCycleLength({cycleLength:len}),len);
    assert.equal(normalizeCycleLength({cycleLength:0}),0);
    assert.equal(normalizeCycleLength({}),0);
    assert.equal(normalizeCycleLength({cycleLength:5}),0);
    assert.equal(normalizeCycleLength({cycleLength:'12'}),12);
  });
  it('legacy undulating blobs keep an 8-week cycle without a cycleLength',()=>{
    assert.equal(normalizeCycleLength({undulating:true}),8);
    assert.equal(normalizeCycleLength({undulating:true,cycleLength:0}),8);
    assert.equal(normalizeCycleLength({undulating:false}),0);
  });
});

describe('#118: normalizeProgression migrates stored blobs',()=>{
  it('new blobs default to Off',()=>{
    const p=JSON.parse(JSON.stringify(DEFAULT_PROGRESSION_SETUP));
    assert.equal(p.cycleLength,0);
    normalizeProgression(p);
    assert.equal(p.cycleLength,0);
    assert.equal(p.undulating,false);
  });
  it('legacy undulating:true keeps its supported length',()=>{
    for(const len of [4,6,8,12]){
      const p={undulating:true,weeklyRanges:new Array(len).fill('hypertrophy')};
      normalizeProgression(p);
      assert.equal(p.cycleLength,len,`keeps ${len}`);
      assert.equal(p.undulating,true);
    }
  });
  it('legacy undulating:true with an odd length falls back to 8',()=>{
    const p={undulating:true,weeklyRanges:new Array(10).fill('hypertrophy')};
    normalizeProgression(p);
    assert.equal(p.cycleLength,8);
  });
  it('legacy undulating falsy → Off',()=>{
    const p={weeklyRanges:[]};
    normalizeProgression(p);
    assert.equal(p.cycleLength,0);
    assert.equal(p.undulating,false);
  });
  it('an explicit valid cycleLength survives normalization',()=>{
    const p={undulating:true,cycleLength:6,weeklyRanges:new Array(6).fill('strength')};
    normalizeProgression(p);
    assert.equal(p.cycleLength,6);
  });
});

describe('#118: programRangeForWeek loops the cycle',()=>{
  const prog=(cycleLength,ranges)=>({
    length:12,
    progression:{
      scheme:'rpe',cycleLength,weeklyRanges:ranges,
      defaultRange:{preset:'hypertrophy',min:6,max:12},
    },
  });
  it('Off → the default range every week',()=>{
    const p=prog(0,['strength','strength','strength','strength']);
    for(const w of [1,5,9])assert.equal(programRangeForWeek(p,w).preset,'hypertrophy');
  });
  it('a 4-week cycle on a 12-week program loops',()=>{
    const p=prog(4,['strength','hypertrophy','endurance','open']);
    assert.equal(programRangeForWeek(p,1).preset,'strength');
    assert.equal(programRangeForWeek(p,4).preset,'open');
    assert.equal(programRangeForWeek(p,5).preset,'strength','week 5 wraps to cycle week 1');
    assert.equal(programRangeForWeek(p,8).preset,'open');
    assert.equal(programRangeForWeek(p,9).preset,'strength');
    assert.equal(programRangeForWeek(p,12).preset,'open');
  });
  it('a program shorter than the cycle uses the cycle’s first weeks',()=>{
    const p=prog(12,['strength','hypertrophy','endurance','open','strength','hypertrophy','endurance','open','strength','hypertrophy','endurance','open']);
    p.length=6;
    assert.equal(programRangeForWeek(p,1).preset,'strength');
    assert.equal(programRangeForWeek(p,6).preset,'hypertrophy');
  });
  it('missing cycle-week entries fall back to the default preset',()=>{
    const p=prog(8,['strength']);
    assert.equal(programRangeForWeek(p,1).preset,'strength');
    assert.equal(programRangeForWeek(p,2).preset,'hypertrophy','unset week → default');
  });
  it('legacy undulating blob (no cycleLength) still varies by week',()=>{
    const p={length:8,progression:{scheme:'rpe',undulating:true,weeklyRanges:['endurance'],defaultRange:{preset:'hypertrophy',min:6,max:12}}};
    assert.equal(programRangeForWeek(p,1).preset,'endurance');
    assert.equal(programRangeForWeek(p,2).preset,'hypertrophy');
  });
});

describe('#118: vary-by-week is a toggle + cycle pills in markup + wiring',()=>{
  it('program setup has the toggle and the 4/6/8/12 pill group (no Off pill)',()=>{
    assert.ok(/id="varyRangesToggle"/.test(html),'program vary-ranges toggle exists');
    assert.ok(/id="programCyclePills"/.test(html),'program cycle pills exist');
    for(const len of [4,6,8,12])assert.ok(new RegExp(`data-cycle-length="${len}"`).test(html),`program pill ${len} exists`);
    assert.ok(!/data-cycle-length="0"/.test(html),'no Off pill — the toggle is the off switch');
    assert.ok(/id="programCycleWrap"[^>]*hidden/.test(html),'pill group starts hidden');
    assert.ok(!/id="undulatingToggle"/.test(html),'undulatingToggle is gone');
    assert.ok(/id="undulatingPanel"/.test(html),'the schedule panel stays');
  });
  it('settings has the default toggle and cycle pill group',()=>{
    assert.ok(/id="settingsVaryRangesToggle"/.test(html),'settings vary-ranges toggle exists');
    assert.ok(/id="settingsCyclePills"/.test(html),'settings cycle pills exist');
    for(const len of [4,6,8,12]){
      const m=html.match(new RegExp(`<div class="cycle-pills" id="settingsCyclePills"[\\s\\S]*?data-cycle-length="${len}"`));
      assert.ok(m,`settings pill ${len} exists`);
    }
    assert.ok(!/id="settingsUndulatingToggle"/.test(html),'settingsUndulatingToggle is gone');
  });
  it('program pills write cycleLength on the draft and re-render the panel',()=>{
    const wiring=/#programCyclePills[\s\S]*?addEventListener/;
    assert.ok(wiring.test(bootstrap),'program pill wiring exists');
    const chunk=bootstrap.slice(bootstrap.indexOf('#programCyclePills'),bootstrap.indexOf('#programCyclePills')+600);
    assert.ok(chunk.includes('programFormProgression()'),'writes the detached draft');
    assert.ok(chunk.includes('d.cycleLength=Number(button.dataset.cycleLength)'),'sets cycleLength');
    assert.ok(chunk.includes('renderWeekRanges(d)'),'re-renders the schedule panel');
    assert.ok(!chunk.includes('schedulePersist'),'draft-only: no persist (#420)');
  });
  it('the program toggle flips the cycle on/off and re-renders',()=>{
    const idx=bootstrap.indexOf('#varyRangesToggle');
    assert.ok(idx>-1,'program toggle wiring exists');
    const chunk=bootstrap.slice(idx,idx+600);
    assert.ok(chunk.includes('d.undulating=on'),'toggle sets the undulating flag');
    assert.ok(chunk.includes('syncProgramCycleUI(d)'),'toggle re-syncs the pill/panel visibility');
  });
  it('settings pills write the default and persist',()=>{
    const idx=bootstrap.indexOf('#settingsCyclePills');
    assert.ok(idx>-1,'settings pill wiring exists');
    const chunk=bootstrap.slice(idx,idx+600);
    assert.ok(chunk.includes('progressionSetup.cycleLength=Number(button.dataset.cycleLength)'),'sets the default');
    assert.ok(chunk.includes('syncSettingsCycleUI()'),'syncs the panel');
    assert.ok(chunk.includes('schedulePersist()'),'persists the new default');
  });
  it('syncProgramForm syncs the pills from the draft',()=>{
    const programs=fs.readFileSync(path.join(REPO_ROOT,'assets/js/pages/programs.js'),'utf8');
    assert.ok(programs.includes("syncProgramCycleUI(p)"),'form syncs program cycle UI');
    assert.ok(!programs.includes("$('#undulatingToggle')"),'no undulatingToggle sync remains');
  });
});
