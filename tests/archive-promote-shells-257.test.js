'use strict';
/* #257 (user 2026-09-13): archiving a program must not hide its workouts from
   the saved-workouts list. Program-only shells (no live source template) are
   promoted to real saved templates by promoteProgramShellsToTemplates, which
   the Archive-program handler calls. Shells already covered by a live template
   are left alone. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const ROOT=path.resolve(__dirname,'..');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');

function loadPromote(){
  const m=programs.match(/function promoteProgramShellsToTemplates\(program,templates\)\{[\s\S]*?\n    \}/);
  assert.ok(m,'promoteProgramShellsToTemplates found');
  const sandbox={
    newTemplateId:()=>'t-new-'+(sandbox.n=(sandbox.n||0)+1),
    cloneTemplateExercises:(rows)=>(rows||[]).map(r=>({clonedFrom:r.exerciseId||'x'})),
  };
  vm.createContext(sandbox);
  vm.runInContext(m[0]+'\nthis.__promote=promoteProgramShellsToTemplates;',sandbox);
  return sandbox.__promote;
}

describe('#257 archiving promotes program-only shells to saved templates',()=>{
  it('the Archive-program handler calls promoteProgramShellsToTemplates',()=>{
    const h=programs.match(/\$\('#endProgram'\)\.addEventListener\('click', \(\) => \{([\s\S]*?)\}\);/);
    assert.ok(h,'#endProgram handler found');
    assert.ok(h[1].includes('promoteProgramShellsToTemplates(program,workoutState.templates)'),
      'archive promotes shells before moving the program');
  });
  it('promotes shells with no live source template',()=>{
    const promote=loadPromote();
    const templates=[];
    const program={workouts:[
      {uid:'w1',name:'Push Day',template:{exercises:[{exerciseId:'bench'}]}},
      {uid:'w2',name:'Pull Day',template:{exercises:[]}},
    ]};
    promote(program,templates);
    assert.equal(templates.length,2,'both shells became templates');
    assert.equal(templates[0].name,'Pull Day','unshift order: last shell first');
    assert.equal(templates[1].name,'Push Day');
    assert.equal(templates[1].exercises.length,1,'exercises cloned through');
    assert.ok(program.workouts[0].sourceTemplateId,'shell links to its new template');
    assert.equal(program.workouts[0].sourceTemplateId,templates[1].id);
  });
  it('skips shells already covered by a live template',()=>{
    const promote=loadPromote();
    const templates=[{id:'t-live',name:'Legs'}];
    const program={workouts:[
      {uid:'w1',name:'Legs',sourceTemplateId:'t-live',template:{exercises:[]}},
      {uid:'w2',name:'Core',template:{exercises:[]}},
    ]};
    promote(program,templates);
    assert.equal(templates.length,2,'only the uncovered shell was promoted');
    assert.equal(templates[0].name,'Core');
    assert.equal(program.workouts[0].sourceTemplateId,'t-live','covered shell untouched');
  });
  it('promotes shells whose source template is gone',()=>{
    const promote=loadPromote();
    const templates=[];
    const program={workouts:[
      {uid:'w1',name:'Orphan',sourceTemplateId:'t-deleted',template:{exercises:[]}},
    ]};
    promote(program,templates);
    assert.equal(templates.length,1,'orphaned shell promoted to a new template');
    assert.notEqual(program.workouts[0].sourceTemplateId,'t-deleted','shell re-linked');
  });
});
