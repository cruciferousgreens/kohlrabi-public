'use strict';
/* #509 (user 2026-09-16): next to the primary "Create active program"
   button, a small secondary "Save to library" button saves the program
   builder form to the saved-programs library instead of making it active.
   Mirrors the #432 share-page pattern (set as active vs save to library).
   Regression pins:
   - the secondary button sits next to #createProgram in the setup actions;
   - clicking it runs saveProgramToLibrary(), which validates like
     createProgram() and unshifts the program onto savedPrograms (never
     touching activeProgram);
   - the button hides while editing the active program (there the only
     commit path is "Save program changes"). */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const programs=fs.readFileSync(path.join(ROOT,'assets/js/pages/programs.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(ROOT,'assets/js/core/app-bootstrap.js'),'utf8');

describe('#509 save program to library',()=>{
  it('the setup actions carry a secondary Save to library button next to Create active program',()=>{
    const row=html.slice(html.indexOf('program-setup-actions'),html.indexOf('program-setup-actions')+1200);
    assert.ok(/id="createProgram"[^>]*>Create active program</.test(row),'primary button keeps its copy');
    assert.ok(/id="saveProgramToLibrary"/.test(row),'secondary button exists');
    assert.ok(/class="secondary-button" id="saveProgramToLibrary"[^>]*>Save to library</.test(row),
      'secondary button is secondary-styled with "Save to library" copy');
    assert.ok(row.indexOf('id="createProgram"')<row.indexOf('id="saveProgramToLibrary"'),
      'secondary button sits next to (after) the primary');
  });
  it('the button is wired to saveProgramToLibrary()',()=>{
    assert.ok(/\$\('#saveProgramToLibrary'\)\.addEventListener\('click', saveProgramToLibrary\);/.test(bootstrap),
      'click wiring exists in app-bootstrap.js');
  });
  it('saveProgramToLibrary() validates like createProgram() and parks the program in savedPrograms',()=>{
    const fn=programs.slice(programs.indexOf('function saveProgramToLibrary()'),programs.indexOf('function saveProgramToLibrary()')+1400);
    assert.ok(/const vals=programFormValues\(\);if\(!vals\)return;/.test(fn),
      'same validation path as createProgram()');
    assert.ok(/savedAt:localIsoDate\(\)/.test(fn),'saved program is stamped like a library entry');
    assert.ok(/workoutState\.savedPrograms\|\|\(workoutState\.savedPrograms=\[\]\)/.test(fn),
      'program goes onto savedPrograms');
    assert.ok(/saved\.unshift\(program\)/.test(fn),'newest-first, mirroring the #432 share pattern');
    assert.ok(!/workoutState\.activeProgram\s*=/.test(fn),'never makes the program active');
    assert.ok(/showToast\(`"\$\{name\}" saved to your library\.`\)/.test(fn),'toast confirms the save');
  });
  it('the button hides while editing the active program',()=>{
    assert.ok(/saveLibBtn\.hidden=editing/.test(programs)||/\$\('#saveProgramToLibrary'\)[^;]*hidden=editing/.test(programs),
      'renderProgram derives the button visibility from the editing flag');
  });
});
