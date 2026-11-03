// Contact details remain in memory only. Reveal results after a storage receipt.
let leadSaved = false;
let submitting = false;
let pendingResult = null;
let retry = null;
const byId = id => document.getElementById(id);
const postcodePattern = /^(GIR 0AA|[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2})$/;

byId('property-form').addEventListener('submit', event => {
  event.preventDefault();
  const postcode = byId('in-postcode');
  const raw = postcode.value.toUpperCase().replace(/\s/g, '');
  postcode.value = raw.slice(0, -3) + ' ' + raw.slice(-3);
  postcode.setCustomValidity(postcodePattern.test(postcode.value) ? '' : 'Enter a full UK postcode, such as SW1A 1AA.');
  if (!event.target.reportValidity()) return;
  const standard = byId('in-standard');
  standard.setCustomValidity(standard.value && (!Number.isFinite(Number(standard.value)) || Number(standard.value) <= 0) ? 'Enter a rent greater than zero, or leave blank.' : '');
  const custom = byId('in-custom-uplift');
  custom.setCustomValidity(custom.style.display !== 'none' && (custom.value === '' || !Number.isFinite(Number(custom.value)) || Number(custom.value) < 0 || Number(custom.value) > 200) ? 'Enter an uplift between 0 and 200.' : '');
  if (!event.target.reportValidity()) return;
  pendingResult = computeEstimate();
  leadSaved = false;
  switchTab('contact');
  window.scrollTo(0, 0);
  byId('contact-heading').focus();
});
['in-postcode','in-standard','in-custom-uplift'].forEach(id => byId(id).addEventListener('input', () => byId(id).setCustomValidity('')));
byId('back-property').addEventListener('click', () => switchTab('calc'));

async function storeLead(payload) {
  const endpoint = window.AIRLANDLORDS_CONFIG?.leadEndpoint || '';
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)) {
    throw new Error('Online enquiries are temporarily unavailable. Please contact info@airlandlords.co.uk or call +44 7537 105075.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    // URLSearchParams is a simple cross-origin request, avoiding a preflight.
    // Omit Google login cookies so public visitors and signed-in users behave alike.
    const response = await fetch(endpoint, {
      method:'POST', credentials:'omit', redirect:'follow', signal:controller.signal,
      body:new URLSearchParams({payload:JSON.stringify({...payload, transport:'fetch'})})
    });
    if (!response.ok) throw new Error('Storage unavailable');
    const message = await response.json();
    if (message.type !== 'airlandlords-lead' || message.requestId !== payload.requestId || !message.ok || message.avgMonthly !== payload.result.avgMonthly || message.airAnnual !== payload.result.airAnnual) throw new Error('Unconfirmed enquiry');
    return message;
  } catch (error) {
    throw new Error(error.name === 'AbortError'
      ? 'The connection timed out. Please try again. Your details are still here; retrying will not duplicate this enquiry.'
      : 'We could not confirm your enquiry. Please try again or contact info@airlandlords.co.uk.');
  } finally { clearTimeout(timeout); }
}

byId('contact-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (submitting || !pendingResult) return;
  const name = byId('in-name'), phone = byId('in-phone');
  name.setCustomValidity(name.value.trim() ? '' : 'Enter your first name.');
  phone.setCustomValidity(/^\+?[\d\s().-]+$/.test(phone.value) && phone.value.replace(/\D/g, '').length >= 10 && phone.value.replace(/\D/g, '').length <= 15 ? '' : 'Enter a valid mobile number, including country code if outside the UK.');
  if (!event.target.reportValidity()) return;
  byId('lead-error').textContent = '';
  const result = {...pendingResult, name:name.value.trim(), email:byId('in-email').value.trim(), phone:phone.value.trim()};
  const body = {
    firstName:result.name, email:result.email, mobile:result.phone, postcode:result.postcode,
    bedrooms:null, result, consent:true, consentVersion:'property-enquiry-v1',
    source:'Property Earnings Calculator', status:'New Lead',
    website:byId('website').value, origin:location.origin
  };
  const fingerprint = JSON.stringify(body);
  if (!retry || retry.fingerprint !== fingerprint) retry = {fingerprint, requestId:crypto.randomUUID()};
  submitting = true;
  byId('submit-lead').disabled = true;
  byId('back-property').disabled = true;
  byId('submit-lead').textContent = 'Saving your enquiry…';
  try {
    await storeLead({...body, requestId:retry.requestId});
    lastResult = result;
    leadSaved = true;
    renderResult();
    window.scrollTo(0, 0);
  } catch (error) {
    byId('lead-error').textContent = error.message;
  } finally {
    submitting = false;
    byId('submit-lead').disabled = false;
    byId('back-property').disabled = false;
    byId('submit-lead').textContent = 'See My Estimate';
  }
});
['in-name','in-phone'].forEach(id => byId(id).addEventListener('input', () => byId(id).setCustomValidity('')));
