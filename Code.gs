// Deploy as a Web app: execute as owner, access Anyone. The Sheet stays private.
const ALLOWED_ORIGINS = ['https://ceptrade.github.io', 'http://127.0.0.1:8787', 'https://calculator.corporateluxe.co.uk', 'https://corporateluxe.co.uk', 'https://www.corporateluxe.co.uk'];
const HEADERS = ['Timestamp', 'First Name', 'Email', 'Mobile Phone', 'Property Postcode', 'Bedrooms', 'Average Monthly Estimate GBP', 'Annual Estimate GBP', 'Standard Annual GBP', 'Extra Annual GBP', 'Source', 'Status', 'Enquiry Consent', 'Consent Version', 'Request ID', 'Market Monthly GBP', 'Standard Monthly GBP', 'Uplift Percent', 'Condition', 'Monthly Breakdown JSON'];

function setup() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('LEADS_SHEET_ID');
  if (!id) {
    const book = SpreadsheetApp.create('AirLandlords — Property Earnings Calculator Leads');
    id = book.getId();
    props.setProperty('LEADS_SHEET_ID', id);
    const sheet = book.getSheets()[0];
    sheet.setName('Calculator Leads');
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#1a1a1a').setFontColor('#F0C040');
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    sheet.getRange('D:F').setNumberFormat('@');
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  console.log('Private leads sheet: ' + SpreadsheetApp.openById(id).getUrl());
}

function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error('Invalid field');
  return value.trim();
}
function safeCell(value) { return /^[=+\-@\t\r]/.test(value) ? "'" + value : value; }
function validateLead(p) {
  if (p && ['corporateluxe-v2','corporateluxe-v3'].includes(p.flow)) return validatePropertyEnquiry(p);
  if (!p || !ALLOWED_ORIGINS.includes(p.origin) || p.website || p.consent !== true || p.consentVersion !== 'property-enquiry-v1') throw new Error('Invalid enquiry');
  const requestId = text(p.requestId, 36);
  if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid request');
  const firstName = text(p.firstName, 80), email = text(p.email, 254), mobile = text(p.mobile, 25);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[\d\s().-]+$/.test(mobile) || mobile.replace(/\D/g, '').length < 10 || mobile.replace(/\D/g, '').length > 15) throw new Error('Invalid contact');
  const postcode = text(p.postcode, 10).toUpperCase();
  if (!/^(GIR 0AA|[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2})$/.test(postcode)) throw new Error('Invalid postcode');
  const r = p.result;
  if (!r || !Number.isFinite(r.market) || r.market <= 0 || r.market > 100000 || !Number.isFinite(r.standard) || r.standard <= 0 || r.standard > 100000 || !Number.isFinite(r.upliftPct) || r.upliftPct < 0 || r.upliftPct > 200 || !['same','better','worse'].includes(r.condition)) throw new Error('Invalid assumptions');
  // Same month-level rounding and seasonality as the original calculator.
  const base = r.market * (1 + r.upliftPct / 100) * (1 + (r.condition === 'better' ? .20 : r.condition === 'worse' ? -.10 : 0));
  const seasons = [-.2,-.2,0,0,0,.2,.2,.2,0,0,-.2,-.2];
  const monthly = seasons.map(mod => Math.round(base * (1 + mod)));
  const annual = monthly.reduce((a,b) => a+b, 0), average = Math.round(annual / 12);
  if (annual !== r.airAnnual || average !== r.avgMonthly || r.stdAnnual !== r.standard * 12) throw new Error('Estimate mismatch');
  return {requestId, firstName, email, mobile, postcode, annual, average, monthly, r};
}

function doPost(e) {
  let p = {}, receipt = {type:'airlandlords-lead', ok:false};
  try {
    if (!e || !e.parameter.payload || e.parameter.payload.length > 16000) throw new Error('Invalid request');
    p = JSON.parse(e.parameter.payload) || {};
    const lead = validateLead(p);
    receipt.requestId = lead.requestId;
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const id = PropertiesService.getScriptProperties().getProperty('LEADS_SHEET_ID');
      if (!id) throw new Error('Run setup first');
      const sheet = SpreadsheetApp.openById(id).getSheetByName('Calculator Leads');
      if (['corporateluxe-v2','corporateluxe-v3'].includes(lead.flow)) {
        receipt = savePropertyEnquiry(sheet, lead, p);
      } else {
      const rows = sheet.getLastRow();
      const existing = rows > 1 ? sheet.getRange(2,15,rows-1,1).createTextFinder(lead.requestId).matchEntireCell(true).findNext() : null;
      if (!existing) {
        sheet.appendRow([new Date(), safeCell(lead.firstName), safeCell(lead.email), "'" + lead.mobile, lead.postcode, '', lead.average, lead.annual, lead.r.standard*12, lead.annual-lead.r.standard*12, 'Property Earnings Calculator', 'New Lead', 'Yes — property enquiry only; no unrelated marketing', 'property-enquiry-v1', lead.requestId, lead.r.market, lead.r.standard, lead.r.upliftPct, lead.r.condition, JSON.stringify(lead.monthly)]);
        sheet.getRange(sheet.getLastRow(), 1).setNumberFormat('yyyy-mm-dd hh:mm:ss');
        SpreadsheetApp.flush();
      } else {
        // A retry ID must refer to the same submission, never unlock another payload.
        const old = sheet.getRange(existing.getRow(),1,1,HEADERS.length).getValues()[0];
        if (String(old[1]).replace(/^'/,'') !== lead.firstName || String(old[2]).replace(/^'/,'') !== lead.email || String(old[3]).replace(/^'/,'') !== lead.mobile || old[4] !== lead.postcode || old[6] !== lead.average || old[7] !== lead.annual) throw new Error('Request conflict');
      }
      receipt = {type:'airlandlords-lead', requestId:lead.requestId, ok:true, avgMonthly:lead.average, airAnnual:lead.annual};
      }
    } finally { lock.releaseLock(); }
  } catch (error) {
    // Do not log personal details or expose internal errors to public callers.
    if (typeof p.requestId === 'string' && /^[a-f0-9-]{36}$/.test(p.requestId)) receipt.requestId = p.requestId;
  }
  if (p.transport === 'fetch') return ContentService.createTextOutput(JSON.stringify(receipt)).setMimeType(ContentService.MimeType.JSON);
  const origin = ALLOWED_ORIGINS.includes(p.origin) ? p.origin : ALLOWED_ORIGINS[0];
  const data = JSON.stringify(receipt).replace(/</g,'\\u003c');
  return HtmlService.createHtmlOutput('<!doctype html><meta charset="utf-8"><p>Enquiry processed. You can return to the calculator.</p><script>window.top.postMessage(' + data + ',' + JSON.stringify(origin) + ');</script>').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doGet() { return ContentService.createTextOutput('AirLandlords enquiry endpoint is available. Submit through the calculator.'); }


// V2 remains compatible. V3 uses the owner-specified 40% benchmark and original seasonality.
const ENQUIRY_EXTRA_HEADERS = ['Full Name', 'Letting Duration', 'Property Scope', 'Start Time', 'Estimate Status', 'Brand', 'Flow Version'];
function validatePropertyEnquiry(p) {
  if (!ALLOWED_ORIGINS.includes(p.origin) || p.website || p.consent !== true || p.consentVersion !== 'property-enquiry-v2') throw new Error('Invalid enquiry');
  const requestId = text(p.requestId,36);
  if (!/^[a-f0-9-]{36}$/.test(requestId)) throw new Error('Invalid request');
  const firstName=text(p.firstName,80),fullName=text(p.fullName,120),email=text(p.email,254),mobile=text(p.mobile,25),postcode=text(p.postcode,10).toUpperCase();
  if (firstName!==fullName.split(/\s+/)[0]) throw new Error('Invalid name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\+?[\d\s().-]+$/.test(mobile) || mobile.replace(/\D/g,'').length<10 || mobile.replace(/\D/g,'').length>15) throw new Error('Invalid contact');
  if (!/^(GIR 0AA|[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2})$/.test(postcode)) throw new Error('Invalid postcode');
  if (!Number.isInteger(p.bedrooms) || p.bedrooms<0 || p.bedrooms>10 || !['6+ months','1–6 months','Less than 1 month'].includes(p.lettingDuration) || !['Whole property','Private room'].includes(p.propertyScope) || !['As soon as possible','2–6 months','6+ months'].includes(p.startTime)) throw new Error('Invalid property plans');
  const projection=p.flow==='corporateluxe-v3'?projectMonthlyRent(p.monthlyRent):null;
  return {flow:p.flow,requestId,firstName,fullName,email,mobile,postcode,bedrooms:p.bedrooms,lettingDuration:p.lettingDuration,propertyScope:p.propertyScope,startTime:p.startTime,projection};
}
function savePropertyEnquiry(sheet, lead, p) {
  const allHeaders=HEADERS.concat(ENQUIRY_EXTRA_HEADERS);
  // Append columns after the existing schema; preserve all existing leads and column indexes.
  sheet.getRange(1,HEADERS.length+1,1,ENQUIRY_EXTRA_HEADERS.length).setValues([ENQUIRY_EXTRA_HEADERS]);
  const q=lead.projection, estimateStatus=q?'Short-let income projection':'Personal review requested';
  const row=[new Date(),safeCell(lead.firstName),safeCell(lead.email),"'"+lead.mobile,lead.postcode,lead.bedrooms,q?q.averageMonthly:'',q?q.annual:'',q?q.standardAnnual:'',q?q.extraAnnual:'','Property Earnings Calculator','New Lead','Yes — property enquiry only; no unrelated marketing','property-enquiry-v2',lead.requestId,q?q.monthlyRent:'',q?q.monthlyRent:'',q?40:'',q?'same':'',q?JSON.stringify(q.months.map(m=>m.amount)):'',safeCell(lead.fullName),lead.lettingDuration,lead.propertyScope,lead.startTime,estimateStatus,'CorporateLuxe / AirLandlords',lead.flow];
  const rows=sheet.getLastRow();
  const existing=rows>1?sheet.getRange(2,15,rows-1,1).createTextFinder(lead.requestId).matchEntireCell(true).findNext():null;
  if(existing){
    const old=sheet.getRange(existing.getRow(),1,1,allHeaders.length).getValues()[0];
    // Bind every saved field to its retry ID, including qualification answers.
    for(const i of [1,2,3,4,5,6,7,8,9,13,14,15,16,17,18,19,20,21,22,23,24,25,26])if(String(old[i]).replace(/^'/,'')!==String(row[i]).replace(/^'/,''))throw new Error('Request conflict');
  } else {
    sheet.appendRow(row);sheet.getRange(sheet.getLastRow(),1).setNumberFormat('yyyy-mm-dd hh:mm:ss');SpreadsheetApp.flush();
  }
  return {type:'airlandlords-lead',requestId:lead.requestId,ok:true,flow:lead.flow,estimateStatus,projection:q};
}

// Preserve original month-level rounding and seasonal factors; no condition adjustment in the public flow.
function projectMonthlyRent(monthlyRent) {
  if (typeof monthlyRent!=='number' || !Number.isFinite(monthlyRent) || monthlyRent<=0 || monthlyRent>100000 || Math.abs(monthlyRent*100-Math.round(monthlyRent*100))>0.00001) throw new Error('Invalid monthly rent');
  const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const seasons=[-.2,-.2,0,0,0,.2,.2,.2,0,0,-.2,-.2];
  const baseMonthly=monthlyRent*(1+40/100);
  const months=names.map((name,i)=>({name,amount:Math.round(baseMonthly*(1+seasons[i])),type:seasons[i]<0?'winter':seasons[i]>0?'summer':'base'}));
  const annual=months.reduce((sum,m)=>sum+m.amount,0),standardAnnual=monthlyRent*12;
  return {monthlyRent,baseMonthly,months,annual,averageMonthly:Math.round(annual/12),standardAnnual,extraAnnual:annual-standardAnnual,benchmark:40};
}
