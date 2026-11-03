// Enquiry details stay in memory; only an acknowledged write shows success.
(() => {
  const $ = id => document.getElementById(id);
  const bookingUrl = window.AIRLANDLORDS_CONFIG?.calendlyUrl || '';
  try { const url=new URL(bookingUrl); if(url.protocol==='https:' && (url.hostname==='calendly.com'||url.hostname==='www.calendly.com') && url.pathname.length>1){$('book-call').href=url.href;$('book-call').textContent='Book a call ↗';$('book-call').target='_blank';$('book-call').rel='noopener';} } catch {}
  const form = $('enquiry-form'), steps = [...document.querySelectorAll('.wizard-step')];
  let step = 0, bedrooms = 1, saving = false, retry = null;
  const postcodePattern = /^(GIR 0AA|[A-Z]{1,2}[0-9][A-Z0-9]? [0-9][A-Z]{2})$/;
  function showStep(index) {
    step = index;
    steps.forEach((el, i) => { el.hidden = i !== index; el.querySelectorAll('input').forEach(input => input.disabled = i !== index); });
    document.querySelectorAll('.progress li').forEach((el,i) => {el.classList.toggle('complete',i<index); if(i===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    $('enquiry-error').textContent = '';
    if(index===2) {
      // Disabled previous controls keep their values; read them directly.
      $('enquiry-review').textContent = `${$('postcode').value} · ${bedrooms === 0 ? 'Studio' : bedrooms + (bedrooms===1?' bedroom':' bedrooms')} · ${form.querySelector('[name="propertyScope"]:checked').value} · ${form.querySelector('[name="lettingDuration"]:checked').value} · Start: ${form.querySelector('[name="startTime"]:checked').value}`;
    }
    window.scrollTo(0,0); steps[index].querySelector('h2').focus({preventScroll:true});
  }
  function start() {$('landing-screen').hidden=true;$('enquiry-screen').hidden=false;showStep(step);}
  document.querySelectorAll('[data-start-estimate]').forEach(el=>el.addEventListener('click',start));
  $('back-intro').addEventListener('click',()=>{if(saving)return;$('enquiry-screen').hidden=true;$('landing-screen').hidden=false;window.scrollTo(0,0);document.querySelector('[data-start-estimate]').focus({preventScroll:true});});
  function setBedrooms(n) {bedrooms=Math.min(10,Math.max(0,n));$('bedrooms').value=bedrooms;$('bedrooms-label').textContent=bedrooms===0?'Studio':bedrooms+(bedrooms===1?' bedroom':' bedrooms');$('bedrooms-minus').disabled=bedrooms===0;$('bedrooms-plus').disabled=bedrooms===10;}
  $('bedrooms-minus').addEventListener('click',()=>setBedrooms(bedrooms-1));$('bedrooms-plus').addEventListener('click',()=>setBedrooms(bedrooms+1));
  function validateStep() {
    if(step===0){const raw=$('postcode').value.toUpperCase().replace(/\s/g,'');$('postcode').value=raw.slice(0,-3)+' '+raw.slice(-3);$('postcode').setCustomValidity(postcodePattern.test($('postcode').value)?'':'Enter a full UK postcode, such as SW6 1AA.');}
    if(step===2){$('full-name').setCustomValidity($('full-name').value.trim()?'':'Enter your name.');const phone=$('mobile').value;$('mobile').setCustomValidity(/^\+?[\d\s().-]+$/.test(phone)&&phone.replace(/\D/g,'').length>=10&&phone.replace(/\D/g,'').length<=15?'':'Enter a valid mobile number.');}
    return [...steps[step].querySelectorAll('input')].every(input=>input.reportValidity());
  }
  ['postcode','full-name','mobile'].forEach(id=>$(id).addEventListener('input',()=>$(id).setCustomValidity('')));
  document.querySelectorAll('[data-next]').forEach(el=>el.addEventListener('click',()=>{if(validateStep())showStep(step+1);}));
  document.querySelectorAll('[data-back]').forEach(el=>el.addEventListener('click',()=>{if(!saving)showStep(step-1);}));
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(saving)return;
    if(step<2){if(validateStep())showStep(step+1);return;}
    if(!validateStep())return;
    const fullName=$('full-name').value.trim();
    const body={flow:'corporateluxe-v2',firstName:fullName.split(/\s+/)[0],fullName,email:$('email').value.trim(),mobile:$('mobile').value.trim(),postcode:$('postcode').value,bedrooms,lettingDuration:form.querySelector('[name="lettingDuration"]:checked').value,propertyScope:form.querySelector('[name="propertyScope"]:checked').value,startTime:form.querySelector('[name="startTime"]:checked').value,consent:$('consent').checked,consentVersion:'property-enquiry-v2',source:'Property Earnings Calculator',status:'New Lead',website:$('company-website').value,origin:location.origin};
    const fingerprint=JSON.stringify(body);if(!retry||retry.fingerprint!==fingerprint)retry={fingerprint,requestId:crypto.randomUUID()};
    const endpoint=window.AIRLANDLORDS_CONFIG?.leadEndpoint||'';
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint)){$('enquiry-error').textContent='Online enquiries are temporarily unavailable. Please call +44 7537 105075.';return;}
    saving=true;const button=$('submit-enquiry');button.disabled=true;button.textContent='Saving your property enquiry…';$('enquiry-error').textContent='';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(endpoint,{method:'POST',credentials:'omit',redirect:'follow',signal:controller.signal,body:new URLSearchParams({payload:JSON.stringify({...body,requestId:retry.requestId,transport:'fetch'})})});
      if(!response.ok)throw new Error('Storage unavailable');const receipt=await response.json();
      if(receipt.type!=='airlandlords-lead'||!receipt.ok||receipt.requestId!==retry.requestId||receipt.flow!=='corporateluxe-v2'||receipt.estimateStatus!=='Personal review requested')throw new Error('Unconfirmed enquiry');
      form.hidden=true;document.querySelector('.progress').hidden=true;document.querySelector('.wizard-intro').hidden=true;$('enquiry-success').hidden=false;
      $('success-detail').textContent=`Thank you, ${body.firstName}. We’ve received your enquiry for ${body.postcode} and will contact you using the details you provided.`;
      $('back-intro').hidden=true;window.scrollTo(0,0);$('success-title').focus({preventScroll:true});
    }catch(error){$('enquiry-error').textContent=error.name==='AbortError'?'The connection timed out. Please try again. Your details are still here; retrying will not duplicate your enquiry.':'We could not confirm your enquiry. Please try again or call +44 7537 105075.';}
    finally{clearTimeout(timeout);saving=false;button.disabled=false;button.innerHTML='Request my personal estimate <span>↗</span>';}
  });
  $('another-property').addEventListener('click',()=>{form.reset();setBedrooms(1);retry=null;form.hidden=false;document.querySelector('.progress').hidden=false;document.querySelector('.wizard-intro').hidden=false;$('enquiry-success').hidden=true;$('back-intro').hidden=false;showStep(0);});
  steps.slice(1).forEach(el=>el.querySelectorAll('input').forEach(input=>input.disabled=true));
  if(location.hash==='#estimate')start();
})();
