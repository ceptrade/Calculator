// The public model preserves the original calculator's rounding and seasonality.
(function(root){
  function calculate(monthlyRent) {
    if(typeof monthlyRent!=='number'||!Number.isFinite(monthlyRent)||monthlyRent<=0||monthlyRent>100000||Math.abs(monthlyRent*100-Math.round(monthlyRent*100))>0.00001)throw new Error('Enter a valid monthly rent.');
    const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const seasons=[-.2,-.2,0,0,0,.2,.2,.2,0,0,-.2,-.2],baseMonthly=monthlyRent*(1+40/100);
    const months=names.map((name,i)=>({name,amount:Math.round(baseMonthly*(1+seasons[i])),type:seasons[i]<0?'winter':seasons[i]>0?'summer':'base'}));
    const annual=months.reduce((sum,m)=>sum+m.amount,0),standardAnnual=monthlyRent*12;
    return{monthlyRent,baseMonthly,months,annual,averageMonthly:Math.round(annual/12),standardAnnual,extraAnnual:annual-standardAnnual,benchmark:40};
  }
  function pdf(projection,contact,JsPDF) {
    const q=projection,doc=new JsPDF({orientation:'portrait',unit:'mm',format:'a4'}),gold=[201,173,90],dark=[26,26,26],light=[205,205,200],white=[240,240,232];
    const money=n=>'£'+Math.round(n).toLocaleString('en-GB');
    const text=(value,x,y,size=9,color=light,bold=false,opts={})=>{doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...color);doc.text(String(value),x,y,opts);};
    const fitted=(value,x,y,width,size=9)=>{doc.setFont('helvetica','normal');doc.setFontSize(size);while(doc.getTextWidth(String(value))>width&&size>6.5){size-=.25;doc.setFontSize(size);}let output=String(value);while(doc.getTextWidth(output)>width&&output.length>3)output=output.slice(0,-4)+'...';text(output,x,y,size,white);};
    doc.setFillColor(...dark);doc.rect(0,0,210,297,'F');doc.setFillColor(17,18,14);doc.rect(0,0,210,50,'F');doc.setDrawColor(...gold);doc.setLineWidth(.5);doc.line(0,50,210,50);
    text('CorporateLuxe',105,22,28,gold,true,{align:'center'});text('In partnership with AirLandlords',105,30,8,light,false,{align:'center'});text('SHORT-LET INCOME PROJECTION',105,43,11,gold,true,{align:'center'});
    doc.setFillColor(31,32,27);doc.roundedRect(15,57,180,34,3,3,'F');text('YOUR PROPERTY',21,64,8,gold,true);fitted(contact.fullName||'Landlord',21,72,100);fitted(contact.postcode||'',133,72,55);fitted(contact.email||'',21,80,100);fitted(contact.mobile||'',133,80,55);text('Bedrooms: '+(contact.bedrooms===0?'Studio':contact.bedrooms),21,87,8);text('Report date: '+new Date().toLocaleDateString('en-GB'),133,87,8);
    const cards=[['AVG MONTHLY INCOME',q.averageMonthly],['PROJECTED ANNUAL',q.annual],['ANNUAL DIFFERENCE',q.extraAnnual]];
    cards.forEach(([label,value],i)=>{const x=15+i*62;doc.setFillColor(20,21,17);doc.roundedRect(x,98,56,30,3,3,'F');doc.setDrawColor(...gold);doc.roundedRect(x,98,56,30,3,3,'S');text(label,x+28,107,6.7,light,true,{align:'center'});text(money(value),x+28,120,16,gold,true,{align:'center'});});
    text('Based on CorporateLuxe\'s data and seasonal assumptions.',105,136,8,gold,false,{align:'center'});
    const note='Illustrative figures before management fees, platform fees, bills and other costs. Actual income is not guaranteed; a property-specific review is required.';
    text(doc.splitTextToSize(note,174),18,143,7.5,light,false,{lineHeightFactor:1.4});
    text('JANUARY-TO-DECEMBER PROJECTED BREAKDOWN',15,161,9,gold,true);
    const max=Math.max(1,...q.months.map(m=>m.amount)),barMax=129;
    q.months.forEach((m,i)=>{const y=168+i*6; text(m.name,15,y+3.7,8);doc.setFillColor(50,51,45);doc.roundedRect(30,y,barMax,4.5,1,1,'F');doc.setFillColor(...(m.type==='summer'?gold:m.type==='winter'?[91,144,196]:[95,99,84]));doc.roundedRect(30,y,Math.max(2,m.amount/max*barMax),4.5,1,1,'F');text(money(m.amount),164,y+3.7,8,white,true);});
    [['Summer',gold],['Winter',[91,144,196]],['Base months',[95,99,84]]].forEach(([label,color],i)=>{const x=15+i*61;doc.setFillColor(...color);doc.rect(x,242,5,3,'F');text(label,x+8,245,7);});
    doc.setFillColor(20,21,17);doc.roundedRect(15,251,180,22,3,3,'F');text('ANNUAL COMPARISON',21,258,8,gold,true);text('Current rent: '+money(q.standardAnnual),21,266,9);text('Projected: '+money(q.annual),112,266,9,gold,true);
    text('Projection model uses the rent entered as a comparison point and a fixed seasonal benchmark.',105,279,6.8,light,false,{align:'center'});
    doc.setDrawColor(...gold);doc.line(0,283,210,283);text('www.corporateluxe.co.uk | info@airlandlords.co.uk | +44 7537 105075',105,290,7,light,false,{align:'center'});
    return doc;
  }
  root.CorporateLuxeProjection=Object.freeze({calculate,pdf});
})(typeof window!=='undefined'?window:globalThis);
