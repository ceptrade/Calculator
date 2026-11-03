// Deploy as a Web app: execute as owner, access Anyone. The Sheet stays private.
const ALLOWED_ORIGINS = ['https://ceptrade.github.io', 'http://127.0.0.1:8787'];
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
