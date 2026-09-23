'use strict';
/* Persona P11#10 (2026-09-22): the rep-range MIN/MAX inputs could be left in
   a lying state — an inverted MIN raised silently left the MAX field showing
   a value below the stored min, and clamps never wrote back to the inputs.
   Both the Settings pair and the program pair now clamp in both directions
   and write the stored values back into the fields. Structural pin: the
   handlers must contain the cross-clamp and the write-back. */
const {describe,it}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const src=fs.readFileSync(path.join(__dirname,'..','assets','js','core','app-bootstrap.js'),'utf8');

const sMinIdx=src.indexOf("$('#settingsRepMin').addEventListener");
const sMaxIdx=src.indexOf("$('#settingsRepMax').addEventListener");
const pMinIdx=src.indexOf("$('#programRepMin').addEventListener");
const pMaxIdx=src.indexOf("$('#programRepMax').addEventListener");
const settingsMin=src.slice(sMinIdx,sMaxIdx);
const settingsMax=src.slice(sMaxIdx,pMinIdx);
const programMin=src.slice(pMinIdx,pMaxIdx);
const programMax=src.slice(pMaxIdx,pMaxIdx+900);

describe('rep-range no-lying inputs (persona P11#10)',()=>{
  it('Settings MIN cross-clamps MAX and writes both fields back',()=>{
    assert.ok(settingsMin.includes('r.max<r.min'),'min handler raises max when inverted');
    assert.ok(settingsMin.includes('e.target.value=r.min'),'min handler writes the stored min back');
    assert.ok(settingsMin.includes("$('#settingsRepMax')"),'min handler syncs the max field');
  });
  it('Settings MAX clamps to min and writes the field back',()=>{
    assert.ok(settingsMax.includes('Math.max(r.min'),'max handler clamps to the min');
    assert.ok(settingsMax.includes('e.target.value=r.max'),'max handler writes the stored max back');
  });
  it('program MIN cross-clamps MAX and writes both fields back',()=>{
    assert.ok(programMin.includes('r.max<r.min'),'program min handler raises max when inverted');
    assert.ok(programMin.includes('e.target.value=r.min'),'program min handler writes the stored min back');
    assert.ok(programMin.includes("$('#programRepMax')"),'program min handler syncs the max field');
  });
  it('program MAX clamps to min and writes the field back',()=>{
    assert.ok(programMax.includes('Math.max(r.min'),'program max handler clamps to the min');
    assert.ok(programMax.includes('e.target.value=r.max'),'program max handler writes the stored max back');
  });
});
