import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
// Execute the real request handler with a durable-store double; validate write/receipt ordering and idempotence.
const rows=[[]]; let flushed=false;
const sheet={
  getLastRow:()=>rows.length,
  appendRow:row=>rows.push(row),
  getRange:(row,col,count,width)=>({
    createTextFinder:id=>({matchEntireCell(){return this},findNext(){const idx=rows.findIndex(r=>r[14]===id);return idx>0?{getRow:()=>idx+1}:null}}),
    setNumberFormat:()=>{},
    getValues:()=>rows.slice(row-1,row-1+count).map(r=>r.slice(col-1,col-1+width))
  })
};
const ctx=vm.createContext({console,PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'test-sheet'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){flushed=true}},HtmlService:{XFrameOptionsMode:{ALLOWALL:'ALLOWALL'},createHtmlOutput:html=>({html,setXFrameOptionsMode(){return this}})}});
ctx.ContentService={MimeType:{JSON:'application/json'},createTextOutput:text=>({html:text,setMimeType(){return this}})};
vm.runInContext(readFileSync(new URL('./Code.gs', import.meta.url),'utf8'),ctx);
const payload={requestId:'12345678-1234-4234-8234-123456789012',firstName:'Test',email:'calculator-test@example.com',mobile:'+447700900123',postcode:'SW1A 1AA',consent:true,consentVersion:'property-enquiry-v1',origin:'https://ceptrade.github.io',website:'',result:{market:1800,standard:1800,upliftPct:40,condition:'same',airAnnual:29736,avgMonthly:2478,stdAnnual:21600}};
const post=p=>{ctx.input={parameter:{payload:JSON.stringify(p)}};return vm.runInContext('doPost(input)',ctx).html;};
assert.match(post(payload),/"ok":true/);assert.equal(rows.length,2);assert.equal(flushed,true);
assert.equal(rows[1][6],2478);assert.equal(rows[1][7],29736);assert.equal(rows[1][10],'Property Earnings Calculator');assert.equal(rows[1][11],'New Lead');
assert.match(post(payload),/"ok":true/);assert.equal(rows.length,2);
assert.equal(JSON.parse(post({...payload,transport:'fetch'})).ok,true);
assert.match(post({...payload,email:'other@example.com'}),/"ok":false/);
for (const mutation of [{consent:false},{email:'invalid'},{mobile:'123'},{postcode:'invalid'},{website:'bot'},{origin:'https://attacker.example'},{result:{...payload.result,airAnnual:1}}]) assert.match(post({...payload,...mutation}),/"ok":false/);
for (const bad of [null,{},[],{requestId:'</script>'}]) assert.match(post(bad),/"ok":false/);
assert.equal(rows.length,2);
assert.equal(vm.runInContext(`safeCell('=IMPORTXML("bad")')`,ctx).startsWith("'"),true);
console.log('PASS: retained legacy estimate/storage receipt, duplicate retries, conflicting IDs, malformed submissions, consent and formula injection checks.');
await import('./verify-enquiry.mjs');
