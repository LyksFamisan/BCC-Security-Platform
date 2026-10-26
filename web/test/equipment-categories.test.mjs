import {test} from 'node:test'
import assert from 'node:assert/strict'
import {NCR_CITIES,equipmentCategory,matchesEquipment} from '../src/equipmentCategories.ts'
test('NCR contains 17 cities and municipality without duplicates',()=>{assert.equal(NCR_CITIES.length,17);assert.equal(new Set(NCR_CITIES).size,17);assert.ok(NCR_CITIES.includes('Pateros'))})
const asset={id:'asset',site_id:'makati',data:{title:'Radio 01',category:'Radio',location_region:'NCR',location_city:'Makati',status:'In Service'}}
const issue={id:'issue',site_id:'makati',data:{equipment_id:'asset',acknowledged:true,returned_at:null}}
test('accountability inherits asset classification and filters all dimensions',()=>{assert.deepEqual(equipmentCategory(issue,[asset],true),{region:'NCR',city:'Makati',category:'Radio',status:'Acknowledged',title:'Radio 01'});assert.ok(matchesEquipment(issue,[asset],true,{region:'NCR',city:'Makati',site:'makati',category:'Radio',status:'Acknowledged'}));assert.equal(matchesEquipment(issue,[asset],true,{city:'Pasig'}),false);assert.equal(equipmentCategory({...issue,data:{...issue.data,returned_at:'2026-10-26'}},[asset],true).status,'Returned')})
test('legacy and inaccessible assets are uncategorized rather than guessed',()=>{assert.equal(equipmentCategory({...asset,data:{title:'Legacy'}},[],false).region,'Uncategorized');assert.equal(equipmentCategory(issue,[],true).city,'Uncategorized')})
