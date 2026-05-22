function $(id){return document.getElementById(id)}
function val(id){return parseFloat($(id).value)||0}
function fmt(n){if(n===null||isNaN(n))return'₹0';const s=Math.abs(n)>=1e7?' Cr':Math.abs(n)>=1e5?' L':'';if(s)return'₹'+(n/(s===' Cr'?1e7:1e5)).toFixed(1)+s;return'₹'+Math.round(n).toLocaleString('en-IN')}
function r2(n){return Math.round(n*100)/100}

function getInputs(ov){const d=ov||{};return{
  age:d.age??val('age'),retireAge:d.retireAge??val('retireAge'),
  lifeExp:d.lifeExp??val('lifeExp'),income:d.income??val('income'),
  savings:d.savings??val('savings'),monthlyContrib:d.monthlyContrib??val('monthlyContrib'),
  employerMatch:(d.employerMatch??val('employerMatch'))/100,
  spending:d.spending??val('spending'),withdrawRate:(d.withdrawRate??val('withdrawRate'))/100,
  govtPension:d.govtPension??val('govtPension'),pensionStart:d.pensionStart??val('pensionStart'),
  privatePension:d.privatePension??val('privatePension'),rentalIncome:d.rentalIncome??val('rentalIncome'),
  preReturn:(d.preReturn??val('preReturn'))/100,postReturn:(d.postReturn??val('postReturn'))/100,
  inflation:(d.inflation??val('inflation'))/100,payRaise:(d.payRaise??val('payRaise'))/100
}}

function getPV(rate,years){return Math.pow(1+rate,years)}

function runFull(inp){
  const yrsR=inp.retireAge-inp.age;
  const yrsS=inp.lifeExp-inp.retireAge;
  const proj=[];
  let b=inp.savings;
  let mc=inp.monthlyContrib;
  const prem=Math.pow(1+inp.preReturn,1/12)-1;
  const posm=Math.pow(1+inp.postReturn,1/12)-1;
  let pvFactor=1;
  
  for(let y=0;y<yrsR;y++){
    const age=inp.age+y;
    const yr=2026+y;
    const annCont=mc*12+inp.income*inp.employerMatch;
    const growth=b*((1+prem)**12-1);
    b+=annCont+growth;
    mc*=1+inp.payRaise;
    proj.push({age,yr,phase:'Saving',balance:Math.round(b)});
    pvFactor*=1+inp.inflation;
  }
  
  const retireBalance=b;
  let spend=inp.spending*pvFactor;
  const otherIncRaw=inp.govtPension+inp.privatePension+inp.rentalIncome;
  
  let runsOut=0;let stillFunded=true;
  for(let y=0;y<yrsS;y++){
    const age=inp.retireAge+y;
    const yr=2026+yrsR+y;
    const phaseAge=inp.pensionStart+y;
    let otherInc=0;
    if(phaseAge>=inp.retireAge) otherInc=otherIncRaw*getPV(inp.inflation,y);
    const netSpend=Math.max(0,spend-otherInc);
    const withdrawal=Math.min(b,netSpend);
    const growth=b*((1+posm)**12-1);
    b=b-withdrawal+growth;
    if(b<=0&&stillFunded){runsOut=age;stillFunded=false;b=0;}
    proj.push({age,yr,phase:'Retired',balance:Math.round(Math.max(0,b)),spend:Math.round(spend),netSpend:Math.round(netSpend)});
    spend*=1+inp.inflation;
  }
  
  const amountNeeded=spend/inp.withdrawRate;
  const surplusRetire=retireBalance-amountNeeded;
  const score=Math.min(100,Math.max(0,50+(surplusRetire/amountNeeded)*50));
  const extraMonthly=surplusRetire<0?(-surplusRetire/(12*getPV(inp.preReturn,yrsR))):0;
  
  return{proj,retireBalance,amountNeeded,surplusRetire,score,extraMonthly,runsOut,yrsR,yrsS};
}

function calculate(){
  const inp=getInputs();
  const r=runFull(inp);
  
  // Verdict
  const banner=$('verdictBanner');
  const badge=$('verdictBadge');
  if(r.surplusRetire>=0){
    banner.className='verdict-banner on-track';
    banner.style.display='block';
    banner.innerHTML='<h2>✅ On Track</h2><p>You are on pace. Keep contributing and review once a year.</p>';
    badge.className='badge on-track';badge.textContent='✅ On Track';
  }else{
    banner.className='verdict-banner shortfall';
    banner.style.display='block';
    banner.innerHTML='<h2>⚠️ Shortfall</h2><p>Your plan falls short by '+fmt(Math.abs(r.surplusRetire))+'. Consider saving more, spending less, or delaying retirement.</p>';
    badge.className='badge shortfall';badge.textContent='⚠️ Shortfall';
  }
  
  // Dashboard numbers
  const dn=$('dashNumbers');
  const balanceLE=r.proj[r.proj.length-1].balance;
  const fundStatus=balanceLE>0?'✅ Yes — funded for life':'❌ Runs out at age '+r.runsOut;
  
  dn.innerHTML='<div class="stat"><div class="stat-label">Retirement Readiness Score</div><div class="stat-value '+(r.score>=70?'green':'red')+'">'+Math.round(r.score)+'/100</div></div>'+
    '<div class="stat"><div class="stat-label">Years Until Retirement</div><div class="stat-value">'+r.yrsR+'</div></div>'+
    '<div class="stat"><div class="stat-label">Projected Savings at Retirement</div><div class="stat-value accent">'+fmt(r.retireBalance)+'</div></div>'+
    '<div class="stat"><div class="stat-label">Amount Needed (4% Rule)</div><div class="stat-value">'+fmt(r.amountNeeded)+'</div></div>'+
    '<div class="stat"><div class="stat-label">Surplus / (Gap)</div><div class="stat-value '+(r.surplusRetire>=0?'green':'red')+'">'+fmt(r.surplusRetire)+'</div></div>'+
    '<div class="stat"><div class="stat-label">Extra Monthly Saving Needed</div><div class="stat-value '+(r.extraMonthly>0?'red':'green')+'">'+(r.extraMonthly>0?fmt(r.extraMonthly):'₹0')+'</div></div>'+
    '<div class="stat"><div class="stat-label">Money Lasts to Age 95?</div><div class="stat-value small '+(balanceLE>0?'green':'red')+'">'+fundStatus+'</div></div>';
  
  // Charts
  drawBarChart(r);
  drawLineChart(r);
  drawProjection(r);
  drawScenarios(inp);
}

function drawBarChart(r){
  const ctx=$('barChart').getContext('2d');
  if(window._barChart)window._barChart.destroy();
  window._barChart=new Chart(ctx,{
    type:'bar',
    data:{labels:['Projected Savings','Amount Needed'],datasets:[{
      data:[r.retireBalance,r.amountNeeded],
      backgroundColor:[r.surplusRetire>=0?'#22c55e':'#f59e0b','#3b82f6'],
      borderRadius:6
    }]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{ticks:{callback:v=>fmt(v)},grid:{color:'#1e293b'}}}}
  });
}

function drawLineChart(r){
  const ctx=$('lineChart').getContext('2d');
  if(window._lineChart)window._lineChart.destroy();
  const labels=r.proj.map(p=>p.age);
  const data=r.proj.map(p=>p.balance);
  const colors=data.map((v,i)=>i<r.yrsR?'#f59e0b':'#22c55e');
  
  window._lineChart=new Chart(ctx,{
    type:'line',
    data:{labels,datasets:[{data,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.1)',fill:true,tension:0.3,pointRadius:0}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{ticks:{callback:v=>fmt(v)},grid:{color:'#1e293b'}}}}
  });
}

function drawProjection(r){
  let html='<table><thead><tr><th>Age</th><th>Year</th><th>Phase</th><th>Balance</th>';
  if(r.proj.some(p=>p.spend))html+='<th>Spending</th><th>From Portfolio</th>';
  html+='</tr></thead><tbody>';
  for(const p of r.proj){
    const cls=p.balance<=0?'style="color:#ef4444"':'';
    html+='<tr '+cls+'><td>'+p.age+'</td><td>'+p.yr+'</td><td>'+p.phase+'</td><td>'+fmt(p.balance)+'</td>';
    if(p.spend)html+='<td>'+fmt(p.spend)+'</td><td>'+fmt(p.netSpend)+'</td>';
    html+='</tr>';
  }
  html+='</tbody></table>';
  $('projectionTable').innerHTML=html;
}

function drawScenarios(inp){
  const scenarios=[
    {name:'Your Plan (Base Case)',ov:{}},
    {name:'Retire 3 Years Later',ov:{retireAge:inp.retireAge+3}},
    {name:'Retire 3 Years Earlier',ov:{retireAge:Math.max(inp.age+1,inp.retireAge-3)}},
    {name:'Save ₹10K/month More',ov:{monthlyContrib:inp.monthlyContrib+10000}},
    {name:'Spend 15% Less',ov:{spending:Math.round(inp.spending*0.85)}},
    {name:'Markets Underperform (-2%)',ov:{preReturn:(val('preReturn')-2),postReturn:(val('postReturn')-1.5)}}
  ];
  
  let html='<div class="scenario-row header"><span>Scenario</span><span style="text-align:right">Nest Egg</span><span style="text-align:right">Amount Needed</span><span style="text-align:center">Status</span></div>';
  for(const s of scenarios){
    const merged=getInputs(s.ov);
    const r=runFull(merged);
    const cls=r.surplusRetire>=0?'green':'red';
    const txt=r.surplusRetire>=0?'✅ On Track':'⚠️ Shortfall';
    html+='<div class="scenario-row"><span class="s-name">'+s.name+'</span><span class="s-amount">'+fmt(r.retireBalance)+'</span><span class="s-amount">'+fmt(r.amountNeeded)+'</span><span class="s-status" style="color:var(--'+cls+')">'+txt+'</span></div>';
  }
  $('scenariosContainer').innerHTML=html;
}

function switchTab(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelector('.tab[data-tab="'+tab+'"]').classList.add('active');
  $('tab-'+tab).classList.add('active');
}

function resetDefaults(){
  $('age').value=40;$('retireAge').value=65;$('lifeExp').value=95;$('income').value=1200000;
  $('savings').value=1500000;$('monthlyContrib').value=25000;$('employerMatch').value=3;
  $('spending').value=900000;$('withdrawRate').value=4;
  $('govtPension').value=240000;$('pensionStart').value=60;
  $('privatePension').value=0;$('rentalIncome').value=0;
  $('preReturn').value=6;$('postReturn').value=4.5;$('inflation').value=2.5;$('payRaise').value=2.5;
  calculate();
}

window.onload=calculate;