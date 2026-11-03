import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const original = execFileSync('git',['show','83bb8e0:index.html'],{cwd:new URL('.',import.meta.url),encoding:'utf8'});
function calculator(source, fn) {
  const elements = new Map();
  const get = id => {
    if (!elements.has(id)) elements.set(id, {value:'',style:{display:'none'},textContent:'',innerHTML:'',classList:{toggle(){},add(){},remove(){}},addEventListener(){}});
    return elements.get(id);
  };
  const ctx = vm.createContext({document:{getElementById:get},localStorage:{getItem(){return null}},window:{},console});
  vm.runInContext(source.match(/<script>\s*\/\/[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,''),ctx);
  return (market,standard,uplift,condition,custom=false) => {
    get('in-market').value=String(market);get('in-standard').value=standard == null ? '' : String(standard);
    get('in-custom-uplift').value=String(uplift);get('in-custom-uplift').style.display=custom?'block':'none';
    vm.runInContext(`upliftPct=${uplift};condition=${JSON.stringify(condition)};switchTab=()=>{};${fn}();`,ctx);
    return JSON.parse(vm.runInContext('JSON.stringify(lastResult)',ctx));
  };
}
const oldCalc=calculator(original,'calculate'), newCalc=calculator(html,'computeEstimate');
let cases=0;
for (const rent of [1,875.25,1800,2249.99,100000]) for (const uplift of [40,45,50,12.5,200]) for (const condition of ['same','worse','better']) {
  const args=[rent, rent===1800?1600:null, uplift,condition,true];
  assert.deepEqual(newCalc(...args),oldCalc(...args));cases++;
}
assert.equal(newCalc(1800,null,0,'same',true).airAnnual,21240);
assert.equal(newCalc(1800,null,40,'same').airAnnual,29736);
assert.equal(newCalc(1800,null,40,'same').avgMonthly,2478);

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
const payload={requestId:'12345678-1234-4234-8234-123456789012',firstName:'Test',email:'calculator-test@example.com',mobile:'+447700900123',postcode:'SW1A 1AA',consent:true,consentVersion:'property-enquiry-v1',origin:'https://ceptrade.github.io',website:'',result:newCalc(1800,null,40,'same')};
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
console.log(`PASS: ${cases} original/new estimate comparisons, custom zero fix, storage receipt, duplicate retries, conflicting IDs, malformed submissions, consent and formula injection checks.`);
