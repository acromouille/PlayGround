(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('world'), ctx = canvas.getContext('2d');
  const radarCanvas = $('radar'), radarCtx = radarCanvas.getContext('2d');
  const mapCanvas = $('minimap'), mapCtx = mapCanvas.getContext('2d');
  const keys = new Set();
  const vehicles = [
    { name:'Storm Scout 4×4', type:'SUV blindé léger', icon:'▰', price:0, speed:115, armor:78, fuel:78, owned:true, desc:'Tout-terrain · Radar embarqué' },
    { name:'Prairie King pickup', type:'Pick-up météo', icon:'▰', price:1800, speed:108, armor:64, fuel:86, desc:'4×4 · Capacité sondes +1' },
    { name:'Atmos Lab Van', type:'Van scientifique', icon:'▱', price:3600, speed:92, armor:57, fuel:92, desc:'Labo mobile · Données +25%' },
    { name:'Intercept Mk. II', type:'Intercepteur blindé', icon:'▰', price:7200, speed:88, armor:100, fuel:70, owned:true, desc:'Blindage lourd · Ancrages' },
    { name:'Doppler on Wheels', type:'Camion radar mobile', icon:'▰', price:9800, speed:72, armor:81, fuel:100, desc:'Radar longue portée · Scan +' },
    { name:'Ranger X', type:'Tout-terrain rapide', icon:'▰', price:5200, speed:132, armor:53, fuel:73, desc:'Vitesse + · Adhérence pluie' }
  ];
  const state = {
    w: innerWidth, h: innerHeight, dpr: Math.min(devicePixelRatio || 1, 2), last: 0, time: 0,
    speed: 42, fuel: 78, damage: 100, money: 2450, xp: 1280, vehicle: 0,
    x: 0, traveled: 0, stormX: 125, stormZ: 1040, stormPhase: 0,
    ef: 2, probe: false, photo: false, completed: false,
    siren: false, paused: false, night: false, rain: .42,
    toastTimer: 0, flash: 0, shake: 0, gear: 'D', dayTime: 16.7,
    photoCooldown: 0, probeCooldown: 0, audio: false, selectedVehicle: 0,
    objects: [], camera: 'chase'
  };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const rand = (a,b) => a + Math.random()*(b-a);
  const resize = () => {
    state.w = innerWidth; state.h = innerHeight; state.dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(state.w*state.dpr); canvas.height = Math.floor(state.h*state.dpr);
    canvas.style.width = `${state.w}px`; canvas.style.height = `${state.h}px`;
    ctx.setTransform(state.dpr,0,0,state.dpr,0,0);
  };
  addEventListener('resize', resize); resize();
  function makeObjects(){
    state.objects=[];
    for(let i=0;i<38;i++){
      const side=i%2?1:-1;
      state.objects.push({z:rand(100,3000),x:side*rand(95,240),kind:Math.random()<.67?'tree':'building',seed:rand(0,100)});
    }
    state.objects.sort((a,b)=>b.z-a.z);
  }
  makeObjects();
  function showToast(message){
    const el=$('toast');el.textContent=message;el.classList.add('show');state.toastTimer=2.5;
  }
  function projection(wx,z){
    const horizon=state.h*.39,depth=clamp(z,8,3400),scale=680/(depth+170);
    const roadHalf=state.w*.52*scale+state.w*.025,center=state.w/2+(wx-state.x)*scale;
    return {x:center,y:horizon+(state.h*.78)*scale,scale,roadHalf,horizon};
  }
  function polygon(points,fill,stroke){
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();
    if(fill){ctx.fillStyle=fill;ctx.fill()} if(stroke){ctx.strokeStyle=stroke;ctx.stroke()}
  }
  function drawSky(){
    const w=state.w,h=state.h;
    const sky=ctx.createLinearGradient(0,0,0,h*.66);
    sky.addColorStop(0,state.night?'#17232d':'#344650');sky.addColorStop(.52,state.night?'#53636a':'#87918d');sky.addColorStop(1,state.night?'#bfaa8b':'#d5bb94');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h*.66);
    const sunX=w*.72,sunY=h*.29,glow=ctx.createRadialGradient(sunX,sunY,5,sunX,sunY,w*.25);
    glow.addColorStop(0,'rgba(239,197,135,.34)');glow.addColorStop(1,'rgba(239,197,135,0)');ctx.fillStyle=glow;ctx.fillRect(sunX-w*.25,sunY-w*.25,w*.5,w*.5);
    for(let layer=0;layer<4;layer++){
      const y=h*(.12+layer*.065),alpha=.17+layer*.085,grad=ctx.createLinearGradient(0,y,0,y+h*.2);
      grad.addColorStop(0,`rgba(30,40,44,${alpha})`);grad.addColorStop(1,`rgba(48,57,58,${alpha*.24})`);ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(0,y+h*.015);
      for(let x=0;x<=w+45;x+=45){const wave=Math.sin(x*.009+layer*2.7+state.time*.055)*14+Math.sin(x*.021+layer)*7;ctx.lineTo(x,y+wave+Math.sin(x*.002+layer)*10)}
      ctx.lineTo(w,h*.58);ctx.lineTo(0,h*.53);ctx.closePath();ctx.fill();
    }
    for(let i=0;i<17;i++){
      const x=((i*173+state.time*5)%(w+120))-60,y=h*.29+(i%4)*10,streak=ctx.createLinearGradient(x,y,x+12,y+h*.19);
      streak.addColorStop(0,'rgba(71,86,87,0)');streak.addColorStop(1,'rgba(62,78,79,.24)');ctx.strokeStyle=streak;ctx.lineWidth=7+i%4*2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+12,y+h*.18);ctx.stroke();
    }
    if(state.flash>0){ctx.fillStyle=`rgba(218,229,226,${state.flash*.34})`;ctx.fillRect(0,0,w,h*.65)}
    ctx.fillStyle='#777b63';ctx.beginPath();ctx.moveTo(0,h*.53);
    for(let x=0;x<=w+10;x+=10)ctx.lineTo(x,h*.51+Math.sin(x*.004)*h*.016+Math.sin(x*.013)*h*.009);
    ctx.lineTo(w,h*.66);ctx.lineTo(0,h*.66);ctx.fill();
  }
  function drawFields(){
    const w=state.w,h=state.h,horizon=h*.52,field=ctx.createLinearGradient(0,horizon,0,h);
    field.addColorStop(0,'#7c7d5a');field.addColorStop(.42,'#847747');field.addColorStop(1,'#423f2e');ctx.fillStyle=field;ctx.fillRect(0,horizon,w,h-horizon);
    ctx.save();ctx.globalAlpha=.23;ctx.strokeStyle='#c2ad6c';ctx.lineWidth=1;
    for(let i=-12;i<=12;i++){ctx.beginPath();ctx.moveTo(w/2+i*w*.046,horizon);ctx.quadraticCurveTo(w/2+i*w*.19,h*.74,w/2+i*w*.36,h*1.1);ctx.stroke()}ctx.restore();
    ctx.fillStyle='rgba(40,47,43,.56)';ctx.fillRect(0,horizon-11,w,12);
    for(let i=0;i<5;i++){const x=((i*269-state.x*.12)%w+w)%w;ctx.fillStyle='rgba(46,50,42,.68)';ctx.fillRect(x,horizon-25,12,25);ctx.fillRect(x+5,horizon-33,3,9)}
    const cx=w*.5-state.x*.07,topY=h*.535,bottomY=h*1.06,topHalf=w*.012,bottomHalf=w*.29;
    polygon([[cx-topHalf,topY],[cx+topHalf,topY],[cx+bottomHalf,bottomY],[cx-bottomHalf,bottomY]],'#3e4543');
    polygon([[cx-topHalf,topY],[cx-topHalf*.55,topY],[cx-bottomHalf*.88,bottomY],[cx-bottomHalf,bottomY]],'rgba(202,195,166,.7)');
    polygon([[cx+topHalf*.55,topY],[cx+topHalf,topY],[cx+bottomHalf,bottomY],[cx+bottomHalf*.88,bottomY]],'rgba(202,195,166,.7)');
    ctx.strokeStyle='rgba(232,222,184,.8)';ctx.lineCap='round';
    for(let i=0;i<8;i++){const z=((i*240-state.traveled*2.5)%1800+1800)%1800+55,p=projection(0,z),stripeH=clamp(360/(z+100),2,18),stripeW=clamp(2+900/(z+100),1,7);ctx.lineWidth=stripeW;ctx.beginPath();ctx.moveTo(p.x,p.y-stripeH);ctx.lineTo(p.x,p.y+stripeH);ctx.stroke()}
    ctx.strokeStyle='rgba(224,203,146,.37)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(cx-w*.017,topY);ctx.lineTo(cx-w*.31,bottomY);ctx.moveTo(cx+w*.017,topY);ctx.lineTo(cx+w*.31,bottomY);ctx.stroke();
  }
  function drawTornado(){
    const w=state.w,h=state.h,dist=Math.max(80,state.stormZ),base=projection(state.stormX,dist);
    const x=base.x,y=base.y-7,scale=base.scale,eh=clamp(470*scale,35,h*.63),width=clamp(145*scale,12,w*.23);
    const top=y-eh, sway=Math.sin(state.time*1.1)*width*.12;
    const glow=ctx.createRadialGradient(x,y,1,x,y,width*1.8);
    glow.addColorStop(0,'rgba(174,157,126,.25)');glow.addColorStop(1,'rgba(174,157,126,0)');ctx.fillStyle=glow;ctx.fillRect(x-width*2,y-width*2,width*4,width*2);
    ctx.save();ctx.translate(sway,0);
    const funnel=ctx.createLinearGradient(x-width,0,x+width,0);
    funnel.addColorStop(0,'rgba(49,54,51,.10)');funnel.addColorStop(.24,'rgba(55,59,54,.78)');funnel.addColorStop(.53,'rgba(92,91,79,.94)');funnel.addColorStop(.78,'rgba(54,58,54,.84)');funnel.addColorStop(1,'rgba(34,40,39,.1)');
    ctx.beginPath();ctx.moveTo(x-width*.12,top);ctx.bezierCurveTo(x-width*.19,top+eh*.33,x-width*.34,y-eh*.28,x-width*.26,y-eh*.08);ctx.bezierCurveTo(x-width*.31,y-eh*.02,x-width*.8,y-eh*.01,x-width,y);ctx.quadraticCurveTo(x,y+eh*.08,x+width,y);ctx.bezierCurveTo(x+width*.62,y-eh*.1,x+width*.35,y-eh*.15,x+width*.31,y-eh*.26);ctx.bezierCurveTo(x+width*.21,top+eh*.44,x+width*.19,top+eh*.2,x+width*.12,top);ctx.closePath();ctx.fillStyle=funnel;ctx.fill();
    ctx.globalAlpha=.27;ctx.strokeStyle='#c1bba4';ctx.lineWidth=Math.max(1,width*.035);
    for(let i=0;i<5;i++){const yy=top+eh*(.2+i*.14),rw=width*(.13+i*.11);ctx.beginPath();ctx.ellipse(x,yy,rw,Math.max(1,eh*.012),Math.sin(state.time*2+i)*.14,0,Math.PI*1.8);ctx.stroke()}
    ctx.restore();
    for(let i=0;i<14;i++){const a=i*2.399+state.time*(.5+i%3*.16),r=width*(.55+(i%4)*.16),px=x+Math.cos(a)*r,py=y-eh*.03+Math.sin(a)*r*.23;ctx.fillStyle=`rgba(184,169,136,${.16+(i%3)*.07})`;ctx.beginPath();ctx.arc(px,py,Math.max(1,width*.018),0,Math.PI*2);ctx.fill()}
  }
  function drawObjects(){
    for(const o of state.objects){const z=o.z-state.traveled%2600;if(z<20||z>3200)continue;const p=projection(o.x-state.x*.28,z),s=p.scale;
      if(o.kind==='tree'){const size=clamp(43*s,2,43);ctx.fillStyle='#353b31';ctx.fillRect(p.x-size*.08,p.y-size*.5,size*.16,size*.5);ctx.fillStyle=o.seed%2?'#394239':'#45483a';ctx.beginPath();ctx.arc(p.x,p.y-size*.68,size*.34,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(p.x-size*.2,p.y-size*.59,size*.23,0,Math.PI*2);ctx.fill()}
      else{const bw=clamp(70*s,3,70),bh=clamp(38*s,2,38);ctx.fillStyle='#665f4e';ctx.fillRect(p.x-bw/2,p.y-bh,bw,bh);ctx.fillStyle='#4b4c42';ctx.beginPath();ctx.moveTo(p.x-bw*.58,p.y-bh);ctx.lineTo(p.x,p.y-bh*1.48);ctx.lineTo(p.x+bw*.58,p.y-bh);ctx.fill();ctx.fillStyle='rgba(223,190,126,.4)';ctx.fillRect(p.x-bw*.3,p.y-bh*.72,bw*.14,bh*.2);ctx.fillRect(p.x+bw*.15,p.y-bh*.72,bw*.14,bh*.2)}
    }
  }
  function drawVehicle(){
    const w=state.w,h=state.h,cx=w*.5+clamp(state.x*.24,-w*.22,w*.22),y=h*.83+Math.sin(state.time*12)*Math.min(3,state.speed*.025),s=clamp(w/1000,.65,1.35);
    ctx.save();ctx.translate(cx,y);ctx.scale(s,s);ctx.fillStyle='rgba(0,0,0,.4)';ctx.beginPath();ctx.ellipse(0,14,92,17,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#171d1c';ctx.fillRect(-77,-8,18,42);ctx.fillRect(59,-8,18,42);
    ctx.fillStyle=state.vehicle===3?'#59635f':'#a7a78e';ctx.beginPath();ctx.moveTo(-66,2);ctx.lineTo(-56,-36);ctx.quadraticCurveTo(-50,-49,-32,-51);ctx.lineTo(37,-51);ctx.quadraticCurveTo(53,-49,60,-34);ctx.lineTo(70,3);ctx.quadraticCurveTo(72,20,56,22);ctx.lineTo(-55,22);ctx.quadraticCurveTo(-71,19,-66,2);ctx.fill();
    ctx.fillStyle='#252f31';ctx.beginPath();ctx.moveTo(-43,-37);ctx.lineTo(-32,-46);ctx.lineTo(27,-46);ctx.lineTo(43,-36);ctx.lineTo(48,-14);ctx.lineTo(-49,-14);ctx.fill();
    ctx.fillStyle='rgba(166,198,195,.56)';ctx.beginPath();ctx.moveTo(-27,-42);ctx.lineTo(1,-42);ctx.lineTo(1,-18);ctx.lineTo(-42,-18);ctx.fill();ctx.beginPath();ctx.moveTo(6,-42);ctx.lineTo(25,-42);ctx.lineTo(39,-32);ctx.lineTo(42,-18);ctx.lineTo(6,-18);ctx.fill();
    ctx.fillStyle='#e2d7a4';ctx.fillRect(-58,-3,13,7);ctx.fillRect(47,-3,13,7);ctx.fillStyle='#252b29';ctx.fillRect(-47,8,94,8);ctx.fillStyle='#8c906f';ctx.fillRect(-17,4,34,10);ctx.fillStyle='#d5d0b6';ctx.fillRect(-9,6,18,6);ctx.restore();
  }
  function drawRain(){
    if(state.rain<.08)return;ctx.save();ctx.strokeStyle=`rgba(197,210,207,${.12+state.rain*.22})`;ctx.lineWidth=1;
    const count=Math.floor(35+state.rain*120);for(let i=0;i<count;i++){const x=(i*97+state.time*(90+i%5*12))%state.w,y=(i*61+state.time*(210+i%7*10))%state.h;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-7,y+16);ctx.stroke()}ctx.restore();
  }
  function drawRadar(){
    const c=radarCanvas,w=c.width,h=c.height,cx=w*.52,cy=h*.53,r=Math.min(w,h)*.43,t=state.time;
    radarCtx.clearRect(0,0,w,h);radarCtx.fillStyle='#122327';radarCtx.fillRect(0,0,w,h);
    radarCtx.save();radarCtx.translate(cx,cy);radarCtx.strokeStyle='rgba(171,209,187,.2)';radarCtx.lineWidth=1;
    for(let i=1;i<=3;i++){radarCtx.beginPath();radarCtx.arc(0,0,r*i/3,0,Math.PI*2);radarCtx.stroke()}
    radarCtx.beginPath();radarCtx.moveTo(-r,0);radarCtx.lineTo(r,0);radarCtx.moveTo(0,-r);radarCtx.lineTo(0,r);radarCtx.stroke();
    const stormX=clamp(state.stormX/420,-.9,.9)*r,stormY=-clamp(state.stormZ/1700,.12,.95)*r;
    radarCtx.fillStyle='rgba(177,111,71,.34)';radarCtx.beginPath();radarCtx.ellipse(stormX,stormY,r*.55,r*.33,-.4,0,Math.PI*2);radarCtx.fill();
    radarCtx.fillStyle='rgba(98,170,134,.55)';radarCtx.beginPath();radarCtx.ellipse(stormX-r*.18,stormY+r*.08,r*.17,r*.1,.5,0,Math.PI*2);radarCtx.fill();
    radarCtx.fillStyle='#ec8267';radarCtx.beginPath();radarCtx.arc(stormX,stormY,r*.09,0,Math.PI*2);radarCtx.fill();
    radarCtx.strokeStyle='rgba(190,234,157,.85)';radarCtx.beginPath();radarCtx.moveTo(0,0);radarCtx.lineTo(Math.cos(t*.55)*r,Math.sin(t*.55)*r);radarCtx.stroke();
    radarCtx.fillStyle='#c7ee9a';radarCtx.beginPath();radarCtx.arc(0,0,3.5,0,Math.PI*2);radarCtx.fill();radarCtx.restore();
  }
  function drawMap(){
    const w=mapCanvas.width,h=mapCanvas.height;mapCtx.clearRect(0,0,w,h);mapCtx.fillStyle='#283b38';mapCtx.fillRect(0,0,w,h);
    mapCtx.strokeStyle='rgba(205,194,153,.28)';mapCtx.lineWidth=1;
    for(let x=16;x<w;x+=37){mapCtx.beginPath();mapCtx.moveTo(x,0);mapCtx.lineTo(x+8,h);mapCtx.stroke()}
    for(let y=13;y<h;y+=31){mapCtx.beginPath();mapCtx.moveTo(0,y);mapCtx.lineTo(w,y+5);mapCtx.stroke()}
    mapCtx.strokeStyle='#d7bd75';mapCtx.lineWidth=3;mapCtx.beginPath();mapCtx.moveTo(-10,h*.77);mapCtx.bezierCurveTo(w*.3,h*.61,w*.53,h*.8,w+10,h*.27);mapCtx.stroke();
    const sx=w*.5+clamp(state.stormX/700,-.35,.35)*w,sy=h*.2+clamp(state.stormZ/1800,0,.8)*h*.72;
    mapCtx.setLineDash([4,4]);mapCtx.strokeStyle='rgba(233,131,102,.6)';mapCtx.beginPath();mapCtx.moveTo(sx,sy);mapCtx.lineTo(sx+20,sy-27);mapCtx.lineTo(sx+38,sy-42);mapCtx.stroke();mapCtx.setLineDash([]);
    mapCtx.fillStyle='#f17c61';mapCtx.beginPath();mapCtx.arc(sx,sy,5,0,Math.PI*2);mapCtx.fill();mapCtx.fillStyle='#c7ef96';mapCtx.beginPath();mapCtx.arc(w*.5,h*.78,4,0,Math.PI*2);mapCtx.fill();
  }
  function render(){
    ctx.clearRect(0,0,state.w,state.h);drawSky();drawFields();drawObjects();drawTornado();drawVehicle();drawRain();drawRadar();drawMap();
  }
  function setText(id,text){const el=$(id);if(el)el.textContent=text}
  function updateHud(){
    const dist=Math.max(0,Math.round(state.stormZ));
    setText('speedRead',String(Math.round(state.speed)).padStart(3,'0'));setText('fuelRead',`${Math.round(state.fuel)}%`);setText('damageRead',`${Math.round(state.damage)}%`);setText('gearRead',state.gear);
    $('fuelBar').style.width=`${state.fuel}%`;$('damageBar').style.width=`${state.damage}%`;
    setText('cashRead',`$${state.money.toLocaleString('en-US')}`);setText('xpRead',`${state.xp.toLocaleString('en-US')} XP`);setText('garageMoney',`$${state.money.toLocaleString('en-US')}`);
    setText('clock',`${String(Math.floor(state.dayTime)%24).padStart(2,'0')}:${String(Math.floor((state.dayTime%1)*60)).padStart(2,'0')}`);
    setText('windRead',`SW · ${Math.round(34+state.ef*8+state.rain*14)} km/h`);setText('pressureRead',`${Math.round(1005-state.ef*7-state.rain*12)} hPa`);setText('rainRead',state.rain>.7?'Intense':state.rain>.38?'Modérée':'Faible');setText('rotationRead',`${Math.round(24+state.ef*13)} kt`);
    setText('probeState',state.probe?'Sonde déployée · données reçues':dist<240?'À portée · appuie sur E':'En attente · portée < 240 m');setText('photoState',state.photo?'Image enregistrée · nette':dist<500?'Vortex en vue · appuie sur F':`En attente · distance < 500 m`);
    $('probeCheck').textContent=state.probe?'✓':'○';$('photoCheck').textContent=state.photo?'✓':'○';$('missionProgress').style.width=`${(Number(state.probe)+Number(state.photo))*50}%`;
    $('probeAction').classList.toggle('ready',dist<240&&!state.probe);$('photoAction').classList.toggle('ready',dist<500&&!state.photo);
    const warning=$('warningPill');warning.querySelector('small').textContent=`EF${state.ef} · trajectoire NE`;warning.classList.toggle('danger',dist<350);
  }
  function completeMission(){if(state.completed||!state.probe||!state.photo)return;state.completed=true;state.money+=850;state.xp+=240;$('completeCard').classList.add('show');showToast('Mission accomplie · données transmises');}
  function deployProbe(){if(state.probe){showToast('Sonde déjà déployée · télémétrie active');return}if(state.stormZ>240){showToast(`Approche-toi de la supercellule · ${Math.round(state.stormZ)} m`);return}state.probe=true;state.money+=120;state.xp+=60;showToast('Sonde déployée · +120 $ · +60 XP');completeMission()}
  function takePhoto(){if(state.photo){showToast('Photo déjà enregistrée dans le carnet');return}if(state.stormZ>500){showToast('Rapproche-toi à moins de 500 m du vortex');return}if(state.stormZ<70){state.damage=Math.max(20,state.damage-12);showToast('Trop près ! La grêle endommage le véhicule');return}state.photo=true;state.money+=180;state.xp+=90;state.flash=.75;showToast('Cliché scientifique capturé · +180 $ · +90 XP');completeMission()}
  function makeClick(){try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ac=new AC(),osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.value=state.siren?720:520;gain.gain.setValueAtTime(.035,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.18);osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+.2)}catch(_){}}
  function toggleSiren(){state.siren=!state.siren;$('sirenAction').classList.toggle('active',state.siren);showToast(state.siren?'Sirène activée · restez vigilant':'Sirène coupée');if(state.audio)makeClick()}
  function togglePause(){state.paused=!state.paused;$('pauseBtn').textContent=state.paused?'▶':'Ⅱ';showToast(state.paused?'Simulation en pause':'Simulation reprise')}
  function renderGarage(){
    const list=$('vehicleList');list.innerHTML='';vehicles.forEach((v,i)=>{const card=document.createElement('button');card.type='button';card.className=`vehicle-card${i===state.selectedVehicle?' selected':''}`;card.innerHTML=`<span class="vehicle-icon">${v.icon}</span><span class="vehicle-detail"><b>${v.name}</b><small>${v.type} · ${v.desc}</small></span><span class="vehicle-price">${v.owned?(i===state.vehicle?'ACTIF':'DISPONIBLE'):`$${v.price.toLocaleString('en-US')}`}</span>`;card.addEventListener('click',()=>{state.selectedVehicle=i;renderGarage()});list.append(card)});
    const v=vehicles[state.selectedVehicle],action=$('garageAction');action.innerHTML=`${v.owned?(state.vehicle===state.selectedVehicle?'VÉHICULE ACTUEL':'SÉLECTIONNER'):`ACHETER · $${v.price.toLocaleString('en-US')}`} <span>→</span>`;$('garageHint').textContent=v.owned?(state.vehicle===state.selectedVehicle?'Votre véhicule actuel est prêt à partir.':'Véhicule disponible dans votre flotte.'):(state.money>=v.price?'Prêt à rejoindre votre flotte.':'Fonds insuffisants pour cet achat.');action.disabled=!v.owned&&state.money<v.price;
  }
  function openGarage(){renderGarage();$('modalBackdrop').classList.add('show')}
  function closeGarage(){$('modalBackdrop').classList.remove('show')}
  function garageAction(){const v=vehicles[state.selectedVehicle];if(!v.owned){if(state.money<v.price)return;state.money-=v.price;v.owned=true;showToast(`${v.name} ajouté à la flotte`)}state.vehicle=state.selectedVehicle;closeGarage();showToast(`${v.name} prêt pour la chasse`)}
  function performAction(key){if(key==='e')deployProbe();if(key==='f')takePhoto();if(key==='q')toggleSiren();if(key==='r'){const radar=document.querySelector('.radar-card');radar.classList.toggle('expanded');$('expandRadar').textContent=radar.classList.contains('expanded')?'RÉDUIRE ↙':'PLEIN ÉCRAN ↗'};if(key===' '||key==='escape')togglePause()}
  function bind(){
    addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault();if(!e.repeat){keys.add(k);if(['e','f','q','r',' '].includes(k))performAction(k)} });
    addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());
    document.querySelectorAll('[data-key]').forEach(btn=>{const k=btn.dataset.key;const down=e=>{e.preventDefault();keys.add(k);btn.classList.add('pressed')},up=e=>{e.preventDefault();keys.delete(k);btn.classList.remove('pressed')};btn.addEventListener('pointerdown',down);['pointerup','pointercancel','pointerleave'].forEach(ev=>btn.addEventListener(ev,up))});
    $('probeAction').addEventListener('click',deployProbe);$('mobileProbe').addEventListener('click',deployProbe);$('photoAction').addEventListener('click',takePhoto);$('mobilePhoto').addEventListener('click',takePhoto);$('sirenAction').addEventListener('click',toggleSiren);$('radarAction').addEventListener('click',()=>performAction('r'));$('expandRadar').addEventListener('click',()=>performAction('r'));
    $('pauseBtn').addEventListener('click',togglePause);$('soundBtn').addEventListener('click',()=>{state.audio=!state.audio;$('soundBtn').classList.toggle('active',state.audio);showToast(state.audio?'Son activé':'Son désactivé');if(state.audio)makeClick()});
    $('garageBtn').addEventListener('click',openGarage);$('closeGarage').addEventListener('click',closeGarage);$('garageAction').addEventListener('click',garageAction);$('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))closeGarage()});
    $('mapToggle').addEventListener('click',()=>$('mapCard').classList.toggle('expanded'));
    $('nextMission').addEventListener('click',()=>{$('completeCard').classList.remove('show');state.completed=false;state.probe=false;state.photo=false;state.stormZ=1300;state.ef=clamp(state.ef+1,1,5);const code=document.querySelector('.mission-code');code.textContent=`#${String(Number(code.textContent.slice(1))+1).padStart(2,'0')}`;showToast(`Nouvelle cellule détectée · EF${state.ef}`)});
    document.querySelector('.brand').addEventListener('click',e=>e.preventDefault());
  }
  function update(dt){
    if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)$('toast').classList.remove('show')}
    if(state.paused)return;
    state.time+=dt;state.dayTime=(state.dayTime+dt*.018)%24;state.stormPhase+=dt;
    const up=keys.has('w')||keys.has('arrowup'),down=keys.has('s')||keys.has('arrowdown'),left=keys.has('a')||keys.has('arrowleft'),right=keys.has('d')||keys.has('arrowright');
    const vehicle=vehicles[state.vehicle];if(up&&state.fuel>0)state.speed=Math.min(vehicle.speed,state.speed+31*dt);else if(down)state.speed=Math.max(0,state.speed-54*dt);else state.speed=Math.max(0,state.speed-7*dt);
    if(state.fuel<=0)state.speed=Math.min(state.speed,28);state.gear=down?'R':state.speed<1?'P':'D';
    if(left)state.x-=dt*(36+state.speed*.28);if(right)state.x+=dt*(36+state.speed*.28);state.x=clamp(state.x,-260,260);
    const movement=state.speed*dt*.095;state.traveled+=movement;if(state.speed>2){state.stormZ=Math.max(75,state.stormZ-movement);state.fuel=Math.max(0,state.fuel-dt*(.018+state.speed*.00014))}
    state.stormX+=Math.sin(state.stormPhase*.15)*dt*1.4;state.rain=clamp(.42+Math.sin(state.time*.07)*.18+(state.ef-2)*.07,0.12,.95);
    if(Math.random()<dt*.035){state.flash=1;state.shake=5}state.flash=Math.max(0,state.flash-dt*1.8);state.shake=Math.max(0,state.shake-dt*12);
    if(state.stormZ<280&&Math.random()<dt*.07){state.damage=Math.max(25,state.damage-dt*(100-vehicle.armor)*.035);}
    if(state.photo&&state.probe)completeMission();
  }
  function frame(now){const dt=Math.min(.05,(now-state.last)/1000||0);state.last=now;update(dt);if(state.shake){ctx.save();ctx.translate(rand(-state.shake,state.shake),rand(-state.shake,state.shake));render();ctx.restore()}else render();updateHud();requestAnimationFrame(frame)}
  bind();updateHud();requestAnimationFrame(frame);
})();
