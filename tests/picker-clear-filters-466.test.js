'use strict';
/* #466 (user 2026-09-14): the exercise picker's Clear button only cleared
   the muscle pills — the equipment type stayed applied. The handler now
   routes through resetPickerFilters() (clears muscles, equipment,
   favorites, custom), and the button shows whenever ANY filter is active,
   not just muscles. These tests pin the state contract the handler and
   the visibility predicate rely on. */
const {describe,it,beforeEach}=require('node:test');
const assert=require('node:assert/strict');
const {loadRole}=require('./harness');

const role=loadRole('picker-scroll');
const {pickerFilters,resetPickerFilters,pickerFilterActive}=role;

beforeEach(()=>{
  resetPickerFilters();
});

describe('#466: picker Clear resets every filter',()=>{
  it('resetPickerFilters clears the equipment type too',()=>{
    pickerFilters.muscles.add('chest');
    pickerFilters.equipment='dumbbell';
    pickerFilters.onlyFavorites=true;
    pickerFilters.onlyCustom=true;
    resetPickerFilters();
    assert.equal(pickerFilters.muscles.size,0);
    assert.equal(pickerFilters.equipment,'');
    assert.equal(pickerFilters.onlyFavorites,false);
    assert.equal(pickerFilters.onlyCustom,false);
  });
  it('the filter-active predicate fires on equipment alone',()=>{
    /* The Clear button's visibility now keys off this: with only an
       equipment filter applied, the button must still show. */
    assert.equal(pickerFilterActive(),false);
    pickerFilters.equipment='dumbbell';
    assert.equal(pickerFilterActive(),true);
    resetPickerFilters();
    assert.equal(pickerFilterActive(),false);
  });
  it('the predicate fires on favorites/custom alone',()=>{
    pickerFilters.onlyFavorites=true;
    assert.equal(pickerFilterActive(),true);
    resetPickerFilters();
    pickerFilters.onlyCustom=true;
    assert.equal(pickerFilterActive(),true);
  });
});
