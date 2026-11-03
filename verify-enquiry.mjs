import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('./Code.gs',import.meta.url),'utf8');
const rows=[Array(20).fill('old header')];let writes=0,fail=false,flushes=0;
const sheet={getLastRow:()=>rows.length,appendRow(row){if(fail)throw Error('write failed');rows.push(row);writes++;},getRange(r,c,h=1,w=1){return{setValues(values){values.forEach((row,ri)=>row.forEach((v,ci)=>rows[r-1+ri][c-1+ci]=v));},setNumberFormat(){},getValues(){return rows.slice(r-1,r-1+h).map(row=>Array.from({length:w},(_,i)=>row[c-1+i]??''));},createTextFinder(value){return{matchEntireCell(){return this;},findNext(){const i=rows.findIndex((row,i)=>i>0&&row[14]===value);return i<0?null:{getRow:()=>i+1};}};}};}};
const context=vm.createContext({console,Date,SpreadsheetApp:{openById:()=>({getSheetByName:()=>sheet}),flush(){flushes++;}},PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'private-sheet'})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},ContentService:{createTextOutput:value=>({value,setMimeType(){return this;}}),MimeType:{JSON:'json'}},HtmlService:{}});
vm.runInContext(source,context);
const body={flow:'corporateluxe-v2',requestId:'12345678-1234-1234-1234-123456789abc',firstName:'Test',fullName:'Test Landlord',email:'calculator-test@example.com',mobile:'07700 900123',postcode:'N18 2NB',bedrooms:2,lettingDuration:'6+ months',propertyScope:'Whole property',startTime:'As soon as possible',consent:true,consentVersion:'property-enquiry-v2',origin:'https://calculator.corporateluxe.co.uk',transport:'fetch'};
function send(p){context.payload=JSON.stringify(p);return JSON.parse(vm.runInContext('doPost({parameter:{payload}})',context).value);}
assert.equal(send(body).ok,true);assert.equal(writes,1);assert.equal(flushes,1);assert.equal(rows[1][5],2);assert.equal(rows[1][6],'');assert.equal(rows[1][7],'');assert.equal(rows[1][20],'Test Landlord');assert.equal(rows[1][21],'6+ months');assert.equal(rows[1][24],'Personal review requested');assert.equal(rows[1][11],'New Lead');assert.equal(rows[0][26],'Flow Version');
assert.equal(send(body).ok,true);assert.equal(writes,1);
rows[1][11]='Test - do not contact';assert.equal(send(body).ok,true);
for(const change of [{bedrooms:3},{propertyScope:'Private room'},{startTime:'2–6 months'},{email:'other@example.com'}])assert.equal(send({...body,...change}).ok,false);
for(const change of [{consent:false},{bedrooms:11},{bedrooms:'2'},{lettingDuration:'anything'},{origin:'https://evil.example'},{mobile:'123'},{email:'invalid'},{postcode:'bad'},{fullName:'Other name'}])assert.equal(send({...body,...change,requestId:'22345678-1234-1234-1234-123456789abc'}).ok,false);
fail=true;assert.equal(send({...body,requestId:'32345678-1234-1234-1234-123456789abc'}).ok,false);assert.equal(writes,1);
new vm.Script(readFileSync(new URL('./enquiry.js',import.meta.url),'utf8'));
console.log('PASS: enquiry storage, added columns, bedrooms/plans, no fabricated estimate, receipt, deduplication, changed-payload conflicts, validation, consent, allowed origins and storage failure.');
