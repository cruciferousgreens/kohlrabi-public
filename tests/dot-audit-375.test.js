'use strict';
/* #375 (user 2026-09-13): the app used `·` as a separator ~99 times — audit
   and reduce so the dot reads as intentional where it remains. #244 (user
   2026-09-12/13): sweep AI-sounding absolute language ("never x / always x")
   — rewrite in plain human language or drop it. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const programsSrc=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const dashSrc=fs.readFileSync(path.join(ROOT,'assets/js/pages/dashboard-stats.js'),'utf8');
const editorSrc=fs.readFileSync(path.join(ROOT,'assets/js/workout/workout-editor.js'),'utf8');
const progressionSrc=fs.readFileSync(path.join(ROOT,'assets/js/workout/progression.js'),'utf8');
const indexHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'assets/styles.css'),'utf8');

describe('program cover range is one merged chip (user 2026-09-22)',()=>{
  /* Supersedes the #375 two-chip direction: the user found the separate
     preset + range chips repetitive (the preset name implies the range),
     so they merged back into one dot-joined chip. */
  it('renders the preset and the range as a single dot-joined .tag span',()=>{
    assert.ok(programsSrc.includes('<span class="tag">${escapeHtml(titleCase(program.progression?.defaultRange?.preset||\'hypertrophy\'))} · ${programRangeLabel(program.progression?.defaultRange)}</span>'),
      'one merged preset · range chip');
  });
  it('no separate preset-only and range-only chips remain',()=>{
    assert.ok(!programsSrc.includes('preset||\'hypertrophy\'))}</span><span class="tag">${programRangeLabel'),
      'separate chips are gone');
  });
});

describe('dot audit: saved-program row meta mirrors the archived card (#375)',()=>{
  /* Superseded 2026-09-14 by the #455 direction: the Saved list mirrors the
     Archived card rows, whose "N weeks · N logs" dot-joined meta is the
     established intentional pattern — the saved row uses the same shape. */
  it('renders the "N weeks · N workouts" meta line like the archived rows',()=>{
    assert.ok(programsSrc.includes('<span class="archive-meta">${program.length} weeks · ${workoutCount} workout${workoutCount===1?\'\':\'s\'}</span>'),
      'dot-joined meta mirrors the archived "N weeks · N logs" line');
  });
  it('no .prog-meta-chips chip row remains on the saved list',()=>{
    assert.ok(!programsSrc.includes('prog-meta-chips'),
      'old chip meta is gone');
    assert.ok(!css.includes('.prog-meta-chips'),
      'orphaned chip rule removed');
  });
});

describe('dot audit: archive row date on its own line (#375)',()=>{
  it('splits the archived date onto its own muted line',()=>{
    assert.ok(programsSrc.includes('<br><span class="archive-meta archive-date">Archived ${escapeHtml(formatLogDate(program.archivedAt))}</span>'),
      'archived date is own-line subdued text');
  });
  it('no three-fact "weeks · logs · archived" chain remains',()=>{
    assert.ok(!programsSrc.includes('log${logs.length===1?\'\':\'s\'} · <span'),
      'old three-fact chain is gone');
  });
});

describe('dot audit: empty shell hint on its own line (#375)',()=>{
  it('renders the tap hint below the state, not dot-joined',()=>{
    assert.ok(programsSrc.includes('\'Empty shell<br><span class="empty-shell-hint">tap to add exercises</span>\''),
      'two facts on two lines');
  });
  it('CSS subdues the hint',()=>{
    assert.ok(css.includes('.empty-shell-hint { opacity: .72; }'),
      '.empty-shell-hint rule present');
  });
});

describe('dot audit: dashboard program card (#375)',()=>{
  it('puts "workouts in rotation" on its own subdued line',()=>{
    assert.ok(dashSrc.includes('<br><span class="section-note">${p.workouts.length} workouts in rotation</span>'),
      'secondary fact on its own line');
  });
  it('no "Week N of M · N workouts" dot chain remains',()=>{
    assert.ok(!dashSrc.includes('of ${p.length} · ${p.workouts.length}'),
      'old dot chain is gone');
  });
});

describe('dot audit: log summaries and next-workout lines use commas (#375)',()=>{
  it('completed-log summary joins date, sets, volume with commas',()=>{
    assert.ok(editorSrc.includes('return `${formatLogDate(workout.date)}, ${s.sets} set${s.sets===1?\'\':\'s\'}, ${vol}`;'),
      'comma-joined summary');
  });
  it('program-next small joins week, exercises, range with commas',()=>{
    assert.ok(editorSrc.includes('<small>Week ${week}, ${next.template.exercises.length} exercise${next.template.exercises.length===1?\'\':\'s\'}, ${escapeHtml(programWorkoutRangeLabel(program,next,week))}</small>'),
      'comma-joined next-workout line');
  });
  it('suggestion context pill joins the renamed workout with a comma',()=>{
    assert.ok(progressionSrc.includes('contextText+=`, ${scheduledName}`;'),
      'third context fact is comma-joined');
  });
});

describe('de-AI sweep: no never/always absolutes in UI copy (#244)',()=>{
  it('warm-up Settings note is plain language',()=>{
    assert.ok(!indexHtml.includes('Never added automatically'),
      'no "Never added automatically"');
    /* PP2 F3 (2026-09-22): subtitle shortened; still plain language, no
       never/always absolute. */
    assert.ok(indexHtml.includes('The Warm-up button inserts this ladder before your working sets.'),
      'rewritten in plain language');
  });
  it('set-tags note is plain language',()=>{
    assert.ok(!indexHtml.includes('they never filter them out'),
      'no "they never filter them out"');
    assert.ok(indexHtml.includes("they don't hide sets from history or stats"),
      'rewritten in plain language');
  });
  it('no other never/always absolutes remain in UI copy',()=>{
    const stripped=indexHtml.replace(/<script[\s\S]*?<\/script>/gi,'').replace(/<style[\s\S]*?<\/style>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
    const uiStrings=[...stripped.matchAll(/>([^<>]{12,}?)</g)].map(m=>m[1]);
    const offenders=uiStrings.filter(s=>/\b(never|always)\b/i.test(s));
    assert.deepEqual(offenders,[],'UI copy free of never/always absolutes: '+JSON.stringify(offenders.slice(0,3)));
  });
});
