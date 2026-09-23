'use strict';
/* #89 program muscle card (user 2026-09-14): the Program cover's "Muscles in
   this program" card renders exactly ONE view — Chart (the existing muscle
   bars, default) or the Sasha-style anatomical Heat map with legend — chosen
   ONLY by Settings → Units → "Program muscle card". The card carries no
   toggle; the Settings row is the single control. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('program-muscle-view');
const {
  programMuscleSectionHtml,
  programMuscleChartHtml,
  programMuscleHeatmapHtml,
  programMuscleViewDefault,
  progressionSetup,
  DEFAULT_PROGRESSION_SETUP,
  normalizeProgression,
}=role;

const rows=[['chest',12],['front delts',10],['triceps',9],['lats',8]];
const MAX=12;

function resetView(){
  progressionSetup.programMuscleView='chart';
}

describe('#89 program muscle card (Settings-only view)',()=>{
  it('Settings default is chart',()=>{
    assert.equal(DEFAULT_PROGRESSION_SETUP.programMuscleView,'chart');
    resetView();
    assert.equal(programMuscleViewDefault(),'chart');
  });

  it('chart setting renders the chart ONLY — no heat map markup, no toggle',()=>{
    resetView();
    const html=programMuscleSectionHtml(rows,MAX);
    assert.ok(html.includes('program-muscle-bars'),'chart bars missing');
    /* #460 (user 2026-09-15): the chart caption is gone — the chart reads
       on its own. The heat-map caption stays (asserted in the next test). */
    assert.ok(!html.includes('Sets per muscle across all program workouts'),'chart caption should be gone');
    assert.ok(!html.includes('anatomy-map'),'heat map markup rendered in chart view');
    assert.ok(!html.includes('data-pm-view'),'toggle remnant in the card');
    assert.ok(!html.includes('data-pm-pane'),'pane remnant in the card');
    assert.ok(!html.includes('mini-segmented'),'segmented control remnant in the card');
  });

  it('heat map setting renders the anatomical map + legend ONLY — no chart',()=>{
    resetView();
    progressionSetup.programMuscleView='heatmap';
    const html=programMuscleSectionHtml(rows,MAX);
    assert.equal(programMuscleViewDefault(),'heatmap');
    assert.ok(html.includes('class="anatomy-map"'),'anatomical map missing');
    assert.ok(html.includes('Heat-graded by weekly sets across all program workouts'),'heat map caption missing');
    assert.ok(html.includes('12 sets'),'legend missing');
    assert.ok(!html.includes('program-muscle-bars'),'chart bars rendered in heat map view');
    assert.ok(!html.includes('data-pm-view'),'toggle remnant in the card');
    assert.ok(!html.includes('data-pm-pane'),'pane remnant in the card');
    resetView();
  });

  it('the section embeds the chart builder output unaltered (chart setting)',()=>{
    resetView();
    const chartHtml=programMuscleChartHtml(rows,MAX);
    assert.ok(chartHtml.includes('<div class="program-muscle-bars">'),'bars container');
    assert.ok(chartHtml.includes('<div class="program-muscle-bar"><span>Chest</span><i style="--fill:100%"></i></div>'),'first bar exact');
    assert.ok(chartHtml.includes('--fill:83'),'fill scales with max');
    assert.ok(programMuscleSectionHtml(rows,MAX).includes(chartHtml),'section does not embed the chart builder');
  });

  it('the section embeds the heat map builder output (heat map setting)',()=>{
    resetView();
    const heatHtml=programMuscleHeatmapHtml(rows);
    assert.ok(heatHtml.includes('class="anatomy-map"'),'anatomy-map host');
    assert.ok(heatHtml.includes('data-volumes='),'volumes payload');
    assert.ok(heatHtml.includes('data-metric="sets"'),'sets metric');
    assert.ok(heatHtml.includes('12 sets'),'legend reads N sets');
    assert.ok(heatHtml.includes('heat-5'),'top muscle gets full heat swatch');
    progressionSetup.programMuscleView='heatmap';
    assert.ok(programMuscleSectionHtml(rows,MAX).includes(heatHtml),'section does not embed the heat map builder');
    resetView();
  });

  it('empty program: no view markup at all, keeps the guidance note',()=>{
    resetView();
    const html=programMuscleSectionHtml([],1);
    assert.ok(!html.includes('program-muscle-bars'),'chart rendered for an empty program');
    assert.ok(!html.includes('anatomy-map'),'heat map rendered for an empty program');
    assert.ok(!html.includes('data-pm-view'),'toggle rendered for an empty program');
    assert.ok(html.includes('Add exercises to a program workout'),'guidance note missing');
    /* The guidance is identical regardless of the Settings choice. */
    progressionSetup.programMuscleView='heatmap';
    assert.equal(programMuscleSectionHtml([],1),html,'empty guidance differs by view');
    resetView();
  });

  it('an invalid persisted view normalizes to chart',()=>{
    progressionSetup.programMuscleView='bogus';
    assert.equal(programMuscleViewDefault(),'chart');
    normalizeProgression(progressionSetup);
    assert.equal(progressionSetup.programMuscleView,'chart');
    progressionSetup.programMuscleView='heatmap';
    assert.equal(programMuscleViewDefault(),'heatmap');
    normalizeProgression(progressionSetup);
    assert.equal(progressionSetup.programMuscleView,'heatmap');
    resetView();
  });

  it('no card-level view control remains: setProgramMuscleView is gone',()=>{
    /* The role proxy's `has` trap can't express absence (typeof never
       throws), so resolve the bare name — a missing binding throws. */
    let gone=false;
    try{role.setProgramMuscleView;}catch(_){gone=true;}
    assert.ok(gone,'setProgramMuscleView still resolvable');
  });
});
