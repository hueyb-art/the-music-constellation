/* The Music Constellation — shared engine.
   Renders any genre dataset registered on window.GENRE_DATA (see js/data/*.js).
   One engine, many skies: the genre switcher swaps data + theme in place. */

/* ----------  GENRE REGISTRY & ACTIVE STATE  ---------- */
const GENRES=window.GENRE_DATA||{};
const GENRE_ORDER=["jazz","hiphop","reggae"].filter(k=>GENRES[k]);
let G=null;
let ERAS={},NODES=[],EDGES=[],LIB={},CRITICS=[],RESOURCES=[],WIKI={},SYM=[];
let byId={},adj={};
const lsKey=s=>"tmc_"+G.key+"_"+s;

const canvas=document.getElementById("c"),ctx=canvas.getContext("2d");
let W,H,DPR;
function resize(){DPR=window.devicePixelRatio||1;W=innerWidth;H=innerHeight;canvas.width=W*DPR;canvas.height=H*DPR;canvas.style.width=W+"px";canvas.style.height=H+"px";ctx.setTransform(DPR,0,0,DPR,0,0);}
addEventListener("resize",resize);resize();

const radius=nd=>6+Math.sqrt(nd.deg)*3.0;
let activeEras=new Set();
let instrFilter=null;
const visible=nd=>activeEras.has(nd.era)&&(!instrFilter||nd.instr===instrFilter);

/* Directional relationship words across all genres; symmetric ones come from data (sym). */
const REL_DIR={
  mentored:["mentored","mentored by"],
  influenced:["influenced","influenced by"],
  "influenced by":["influenced by","influenced"],
  "arranged for":["arranged for","used arranger"],
  produced:["produced","produced by"],
  engineered:["engineered","engineered by"],
  member:["member of","includes"],
  founded:["founded","founded by"],
  signed:["signed to","signed"],
  dj:["DJ for","backed by"],
};
function relWord(ed,nd){const dir=ed.a===nd.id;if(SYM.includes(ed.rel))return ed.rel;const m=REL_DIR[ed.rel];return m?m[dir?0:1]:ed.rel;}
/* Connection taxonomy for line styling */
function kindOf(rel){if(rel==="mentored")return"mentor";if(/influenc/.test(rel))return"influence";if(rel==="rivals"||rel==="beef")return"rivalry";return"collab";}
const KIND_LABEL={collab:"Collaboration",mentor:"Mentorship",influence:"Influence",rivalry:"Rivalry"};
const KIND_DASH={collab:[],mentor:[],influence:[6,5],rivalry:[2,5]};
/* warm gold = working together, bright gold = the torch passed, cool silver-blue = indirect influence, rose = rivalry */
const KIND_COLOR={collab:"224,177,90",mentor:"245,222,150",influence:"150,180,215",rivalry:"217,96,122"};

let yaw=0,pitch=0,tyaw=null,tpitch=0,vyaw=0.0012,vpitch=0,zoom=1,tzoom=1,tick=0,pulse=0,spread=1.5,viewY=0,tviewY=0;
/* ----------  TIMELINE VIEW  ---------- */
let viewMode="globe",viewX=0,tviewX=0,panVX=0,panVY=0;
const THIS_YEAR=new Date().getFullYear();
/* the timeline is a long road, not a compressed chart: pxy world-units per year,
   so a century stretches thousands of px and you travel along it */
let TL={y0:1900,y1:THIS_YEAR,laneH:74,pxy:44};
const TLX=yr=>(yr-(TL.y0+TL.y1)/2)*TL.pxy;
const CAM=760;
const MOBILE=(typeof window!=="undefined"&&window.matchMedia&&window.matchMedia("(max-width:700px)").matches)||false;
const BLURK=MOBILE?0.5:1;
let pointer={x:0,y:0,down:false,moved:false};
const stars=[];for(let i=0;i<240;i++){const u=Math.random(),v=Math.random(),th=Math.acos(2*u-1),ph=2*Math.PI*v;stars.push({x:Math.sin(th)*Math.cos(ph),y:Math.sin(th)*Math.sin(ph),z:Math.cos(th),r:Math.random()*1.1+0.25,tw:Math.random()*6.28});}

let alpha=1;
function step(){
  const vis=NODES.filter(visible);
  const rep=5200*spread,link=120*spread;
  const tl=viewMode==="timeline";
  /* timeline: springs own the layout; only contact collision remains, so era lanes hold.
     Collision is soft and capped there — hard kicks against pinned springs make names jitter */
  const repK=tl?0:1,colK=tl?0.55:0.6,damp=tl?0.78:0.85;
  for(let i=0;i<vis.length;i++){
    const a=vis[i];
    if(tl){a.vx+=(a._tx-a.x)*0.08;a.vy+=(a._ty-a.y)*0.08;a.vz-=a.z*0.08;}
    else{a.vx-=a.x*0.0010*alpha;a.vy-=a.y*0.0010*alpha;a.vz-=a.z*0.0010*alpha;}
    for(let j=i+1;j<vis.length;j++){
      const b=vis[j];let dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z,d2=dx*dx+dy*dy+dz*dz||.01,d=Math.sqrt(d2);
      const minD=26;let f=rep*repK/d2;if(d<minD)f+=(minD-d)*colK/(tl?Math.max(d,10):d);
      /* in timeline mode the x spring owns chronology — repulsion mostly spreads the lanes vertically */
      const kx=tl?0.12:1,kz=tl?0:1;
      const fx=dx/d*f*kx,fy=dy/d*f,fz=dz/d*f*kz;a.vx+=fx;a.vy+=fy;a.vz+=fz;b.vx-=fx;b.vy-=fy;b.vz-=fz;
    }
  }
  if(!tl)EDGES.forEach(ed=>{if(!ed.s||!visible(ed.s)||!visible(ed.t))return;let dx=ed.t.x-ed.s.x,dy=ed.t.y-ed.s.y,dz=ed.t.z-ed.s.z,d=Math.sqrt(dx*dx+dy*dy+dz*dz)||.01;const f=(d-link)*0.010,fx=dx/d*f,fy=dy/d*f,fz=dz/d*f;ed.s.vx+=fx;ed.s.vy+=fy;ed.s.vz+=fz;ed.t.vx-=fx;ed.t.vy-=fy;ed.t.vz-=fz;});
  vis.forEach(nd=>{nd.vx*=damp;nd.vy*=damp;nd.vz*=damp;nd.x+=nd.vx;nd.y+=nd.vy;nd.z+=nd.vz;});
  if(alpha>0.05)alpha*=0.992;
}

let hoverNode=null,selNode=null,focusSet=null,pageOpen=false,curId=null;
function computeFocus(nd){if(!nd){focusSet=null;return;}focusSet=new Set([nd.id]);adj[nd.id].forEach(id=>focusSet.add(id));}
function hexA(hex,a){const v=parseInt(hex.slice(1),16);return`rgba(${v>>16&255},${v>>8&255},${v&255},${a})`;}
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ----------  GENRE-SWITCH TRANSITION  ---------- */
let fade=1,trans=null;
const easeF=t=>t*t*(3-2*t);
function switchGenre(key){
  if(trans||!GENRES[key]||(G&&G.key===key))return;
  if(location.hash!=="#/"+key)location.hash="#/"+key;
  trans={to:key,phase:"out"};
}

/* ----------  PHOTOS ON ZOOM (Wikipedia thumbnails)  ---------- */
const PHOTO_ZOOM=1.5,PHOTO_MAX=14;
const photoMem={};let photoActive=0;
function photoState(nd){
  const k=G.key+"_"+nd.id;
  let st=photoMem[k];
  if(st)return st;
  let cached=null;try{cached=localStorage.getItem(lsKey("photo_"+nd.id));}catch(e){}
  if(cached==="none")return photoMem[k]={ok:false};
  if(cached){const img=new Image();img.crossOrigin="anonymous";st=photoMem[k]={ok:false,img};img.onload=()=>{st.ok=true;};img.onerror=()=>{st.ok=false;st.img=null;};img.src=cached;return st;}
  if(photoActive>=2)return null; // try again on a later frame
  photoActive++;st=photoMem[k]={ok:false};
  const title=WIKI[nd.id]||nd.name,key=lsKey("photo_"+nd.id);
  fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    .then(r=>r.ok?r.json():Promise.reject())
    .then(d=>{photoActive--;const url=(d.type==="standard"&&d.thumbnail&&d.thumbnail.source)?d.thumbnail.source:"none";try{localStorage.setItem(key,url);}catch(e){}
      if(url!=="none"){const img=new Image();img.crossOrigin="anonymous";st.img=img;img.onload=()=>{st.ok=true;};img.src=url;}})
    .catch(()=>{photoActive--;delete photoMem[k];});
  return st;
}

function draw(){
  ctx.clearRect(0,0,W,H);
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),spp=Math.sin(pitch);
  const Rstar=0.62*Math.max(W,H);
  for(const st of stars){
    let rx=st.x*cy-st.z*sy,rz=st.x*sy+st.z*cy,ry=st.y*cp-rz*spp;rz=st.y*spp+rz*cp;
    const t=(rz+1)/2,a=(0.10+0.42*t)*(0.6+0.4*Math.sin(tick*0.02+st.tw));
    let px=W/2+rx*Rstar,py=H/2+ry*Rstar;
    if(viewMode==="timeline"){ /* depth-weighted parallax: the sky drifts past as you travel */
      px=(((px+viewX*(0.04+0.06*t))%(W+80))+(W+80))%(W+80)-40;
      py=(((py+viewY*(0.04+0.06*t))%(H+80))+(H+80))%(H+80)-40;
    }
    ctx.beginPath();ctx.arc(px,py,st.r*(0.5+t),0,6.283);
    ctx.fillStyle="rgba(226,212,184,"+a.toFixed(3)+")";ctx.fill();
  }
  const F=easeF(fade);
  if(F<=0.01)return;
  const vis=[];
  for(const nd of NODES){
    if(!visible(nd)){nd._sx=null;continue;}
    let x=nd.x*cy-nd.z*sy,z=nd.x*sy+nd.z*cy,y=nd.y*cp-z*spp;z=nd.y*spp+z*cp;
    const zz=z*zoom,pf=CAM/Math.max(120,CAM-zz);
    nd._sx=W/2+viewX+x*zoom*pf;nd._sy=H/2+viewY+y*zoom*pf;nd._d=zz;nd._pf=pf;
    vis.push(nd);
  }
  let dmin=1e9,dmax=-1e9;for(const nd of vis){if(nd._d<dmin)dmin=nd._d;if(nd._d>dmax)dmax=nd._d;}
  /* depth shading is meaningless on the flat timeline (z≈0) and its jitter makes labels flicker — light uniformly there */
  const dr=Math.max(1,dmax-dmin),bright=viewMode==="timeline"?(nd=>0.55):(nd=>(nd._d-dmin)/dr);
  const key=hoverNode||selNode;
  if(viewMode==="timeline"){
    /* axis, era lanes, career lines, record dots — fade in as the globe finishes flattening */
    const ax=Math.max(0,1-(Math.abs(yaw)+Math.abs(pitch))*2.5)*F;
    if(ax>0.02){
      const sx=x=>W/2+viewX+x*zoom,sy=y=>H/2+viewY+y*zoom;
      const stepY=(10*TL.pxy*zoom<64)?20:10;
      ctx.textAlign="center";ctx.textBaseline="top";ctx.font="400 11px Helvetica Neue, Arial";
      for(let yr=Math.ceil(TL.y0/stepY)*stepY;yr<=TL.y1;yr+=stepY){
        const x=sx(TLX(yr));
        ctx.strokeStyle="rgba(226,212,184,"+(0.05*ax).toFixed(3)+")";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(x,sy(-280));ctx.lineTo(x,sy(280));ctx.stroke();
        ctx.fillStyle="rgba(226,212,184,"+(0.35*ax).toFixed(3)+")";
        ctx.fillText(String(yr),x,sy(288));
      }
      ctx.textAlign="left";ctx.textBaseline="middle";ctx.font="600 10px Helvetica Neue, Arial";
      const lx=Math.max(sx(TLX(TL.y0))-150,14); // sticky at the viewport edge while panning
      Object.keys(ERAS).forEach((k,i)=>{ctx.fillStyle=hexA(ERAS[k].color,0.5*ax);ctx.fillText(ERAS[k].label.toUpperCase(),lx,sy(-260+(i+0.5)*TL.laneH));});
      /* where in history you are right now */
      const cyr=Math.max(TL.y0,Math.min(TL.y1,Math.round((TL.y0+TL.y1)/2-viewX/(zoom*TL.pxy))));
      ctx.textAlign="center";ctx.textBaseline="top";ctx.font="600 13px Helvetica Neue, Arial";
      ctx.fillStyle="rgba(226,212,184,"+(0.30*ax).toFixed(3)+")";
      ctx.fillText("· "+cyr+" ·",W/2,175);
      for(const nd of vis){
        const dim=focusSet&&!focusSet.has(nd.id),col=ERAS[nd.era].color,b=bright(nd);
        const x0=sx(TLX(nd._y0)),x1=sx(TLX(nd._y1));
        ctx.strokeStyle=hexA(col,(dim?0.05:0.10+0.18*b)*ax);ctx.lineWidth=Math.max(1,(nd._r||4)*0.18);
        ctx.beginPath();ctx.moveTo(x0,nd._sy);ctx.lineTo(x1,nd._sy);ctx.stroke();
        const hot=nd===hoverNode||nd===selNode;
        for(const ry of nd._recs){
          ctx.fillStyle=hexA(col,(dim?0.10:hot?0.95:0.45)*ax);
          ctx.beginPath();ctx.arc(sx(TLX(ry)),nd._sy,hot?2.6:1.7,0,6.283);ctx.fill();
        }
      }
    }
  }
  EDGES.forEach(ed=>{
    if(!ed.s||!visible(ed.s)||!visible(ed.t))return;
    const s=ed.s,t=ed.t,on=!focusSet||(focusSet.has(ed.a)&&focusSet.has(ed.b)),lit=key&&(ed.a===key.id||ed.b===key.id);
    const tb=(bright(s)+bright(t))/2;
    ctx.beginPath();ctx.moveTo(s._sx,s._sy);ctx.lineTo(t._sx,t._sy);
    ctx.setLineDash(KIND_DASH[ed.kind]);
    const cc=KIND_COLOR[ed.kind];
    if(lit){ctx.strokeStyle=`rgba(${cc},${((0.25+0.45*tb)*F).toFixed(3)})`;ctx.lineWidth=ed.kind==="mentor"?2:1.6;}
    else if(on){ctx.strokeStyle=`rgba(${cc},${((0.05+0.12*tb)*F).toFixed(3)})`;ctx.lineWidth=ed.kind==="mentor"?1.25:1;}
    else{ctx.strokeStyle=`rgba(${cc},${((0.02+0.03*tb)*F).toFixed(3)})`;ctx.lineWidth=0.8;}
    ctx.stroke();
    if(lit){const tt=(pulse+(ed.a===key.id?0:0.5))%1;ctx.setLineDash([]);ctx.beginPath();ctx.arc(s._sx+(t._sx-s._sx)*tt,s._sy+(t._sy-s._sy)*tt,2.4,0,6.283);ctx.fillStyle=`rgba(245,225,170,${(0.9*F).toFixed(3)})`;ctx.fill();}
  });
  ctx.setLineDash([]);
  vis.sort((a,b)=>a._d-b._d);
  for(const nd of vis){
    const dim=focusSet&&!focusSet.has(nd.id),col=ERAS[nd.era].color,b=bright(nd);
    const twk=0.9+0.1*Math.sin(tick*0.045+nd.twp);
    const r=Math.max(1.3,radius(nd)*nd._pf*zoom*0.9*(1+0.5*nd.hl));nd._r=r;
    ctx.save();
    ctx.globalAlpha=(dim?0.28:Math.min(1,(0.45+0.55*b)*twk))*F;
    ctx.shadowColor=col;ctx.shadowBlur=(dim?2:(6+16*nd.hl)*twk)*(0.6+b)*BLURK;
    ctx.beginPath();ctx.arc(nd._sx,nd._sy,r,0,6.283);ctx.fillStyle=col;ctx.fill();
    ctx.restore();
    if(nd===selNode||nd===hoverNode){ctx.globalAlpha=F;ctx.lineWidth=2;ctx.strokeStyle="#f3ece0";ctx.beginPath();ctx.arc(nd._sx,nd._sy,r+1,0,6.283);ctx.stroke();ctx.globalAlpha=1;}
  }
  const cand=vis.filter(nd=>!focusSet||focusSet.has(nd.id)||nd===hoverNode||nd===selNode);
  cand.sort((a,b)=>prio(b)-prio(a));
  /* photos fade in on close zoom: the stars become faces */
  const showPhotos=zoom>PHOTO_ZOOM&&!trans;
  let shown=0;
  for(const nd of cand){
    const onScreen=nd._sx>-40&&nd._sx<W+40&&nd._sy>-40&&nd._sy<H+40;
    const want=showPhotos&&onScreen&&shown<PHOTO_MAX&&!(focusSet&&!focusSet.has(nd.id));
    let st=null;
    if(want){st=photoState(nd);shown++;}
    const ok=st&&st.ok&&st.img;
    nd._pa=nd._pa||0;nd._pa+=(((want&&ok)?1:0)-nd._pa)*0.12;
    if(nd._pa>0.02&&ok){
      const pr=Math.max(12,nd._r*1.7);
      ctx.save();ctx.globalAlpha=nd._pa*F;
      ctx.beginPath();ctx.arc(nd._sx,nd._sy,pr,0,6.283);ctx.clip();
      ctx.drawImage(st.img,nd._sx-pr,nd._sy-pr,pr*2,pr*2);
      ctx.restore();
      ctx.save();ctx.globalAlpha=nd._pa*F;ctx.lineWidth=1.5;ctx.strokeStyle=ERAS[nd.era].color;ctx.beginPath();ctx.arc(nd._sx,nd._sy,pr,0,6.283);ctx.stroke();ctx.restore();
    }
  }
  const placed=[];ctx.textAlign="center";ctx.textBaseline="top";
  for(const nd of cand){
    const big=nd===hoverNode||nd===selNode,b=bright(nd);
    const fs=Math.max(10.5,(9+3*b)*(0.85+0.35*zoom));
    ctx.font=(big?"600 ":"400 ")+fs.toFixed(1)+"px Helvetica Neue, Arial";
    const off=nd._pa>0.02?Math.max(12,nd._r*1.7):nd._r;
    const w=ctx.measureText(nd.name).width,y=nd._sy+off+3,rc={x:nd._sx-w/2-3,y:y-1,w:w+6,h:fs+3};
    let clash=false;if(!big)for(const o of placed){if(rc.x<o.x+o.w&&rc.x+rc.w>o.x&&rc.y<o.y+o.h&&rc.y+rc.h>o.y){clash=true;break;}}
    if(clash)continue;placed.push(rc);
    const dim=focusSet&&!focusSet.has(nd.id);
    ctx.fillStyle=dim?`rgba(243,236,224,${(0.18*F).toFixed(3)})`:`rgba(243,236,224,${((0.4+0.5*b)*F).toFixed(2)})`;
    ctx.fillText(nd.name,nd._sx,y);
  }
}
function prio(nd){return (nd===hoverNode||nd===selNode?1e9:0)+(focusSet&&focusSet.has(nd.id)?1e6:0)+nd.deg*120+(viewMode==="timeline"?nd.twp:(nd._d||0));}
function loop(){
  tick++;pulse=(pulse+0.012)%1;
  if(trans){
    if(trans.phase==="out"){fade=Math.max(0,fade-0.055);if(fade<=0){loadGenre(trans.to);trans.phase="in";}}
    else{fade=Math.min(1,fade+0.04);if(fade>=1)trans=null;}
  }
  if(!pointer.down){
    /* timeline owns the camera: always ease flat, so an interrupted flatten can never strand the axis invisible */
    if(viewMode==="timeline"){yaw+=(0-yaw)*0.12;pitch+=(0-pitch)*0.12;vyaw=0;vpitch=0;if(Math.abs(yaw)<0.0005)yaw=0;if(Math.abs(pitch)<0.0005)pitch=0;
      /* released drags keep floating through the years */
      if(panVX||panVY){tviewX+=panVX;viewX+=panVX;tviewY+=panVY;viewY+=panVY;panVX*=0.94;panVY*=0.94;if(Math.abs(panVX)<0.05)panVX=0;if(Math.abs(panVY)<0.05)panVY=0;}}
    else if(tyaw!=null){const dd=((tyaw-yaw+Math.PI*3)%(Math.PI*2))-Math.PI;yaw+=dd*0.12;pitch+=(tpitch-pitch)*0.12;vyaw=0;vpitch=0;if(Math.abs(dd)<0.01&&Math.abs(tpitch-pitch)<0.01)tyaw=null;}
    else{yaw+=vyaw;pitch+=vpitch;vyaw+=(0.0012-vyaw)*0.03;vpitch*=0.9;}
    pitch=Math.max(-1.3,Math.min(1.3,pitch));
  }
  zoom+=(tzoom-zoom)*0.12;viewY+=(tviewY-viewY)*0.12;viewX+=(tviewX-viewX)*0.12;
  if(viewMode==="timeline"){
    const lo=-(TLX(TL.y1)+60)*zoom,hi=-(TLX(TL.y0)-60)*zoom;
    tviewX=Math.max(lo,Math.min(hi,tviewX));viewX=Math.max(lo,Math.min(hi,viewX));
    const vy=340*zoom; // keep the era lanes on screen
    tviewY=Math.max(-vy,Math.min(vy,tviewY));viewY=Math.max(-vy,Math.min(vy,viewY));
  }
  NODES.forEach(nd=>{nd.hl+=(((nd===hoverNode||nd===selNode)?1:0)-nd.hl)*0.16;});
  if(!pageOpen)step();
  draw();requestAnimationFrame(loop);
}

/* pointer */
function nodeAt(px,py){let best=null,bz=-1e9;for(const nd of NODES){if(!visible(nd)||nd._sx==null)continue;const r=(nd._r||6)+6;if(Math.hypot(px-nd._sx,py-nd._sy)<r&&nd._d>bz){bz=nd._d;best=nd;}}return best;}
canvas.addEventListener("mousemove",ev=>{
  const px=ev.clientX,py=ev.clientY;
  if(pointer.down){const dx=px-pointer.x,dy=py-pointer.y;if(Math.abs(dx)+Math.abs(dy)>1){pointer.moved=true;tyaw=null;
    if(viewMode==="timeline"){tviewX=viewX+=dx;tviewY=viewY+=dy;panVX=panVX*0.5+dx*0.5;panVY=panVY*0.5+dy*0.5;}
    else{yaw+=dx*0.005;pitch=Math.max(-1.3,Math.min(1.3,pitch+dy*0.005));vyaw=dx*0.005;vpitch=dy*0.005;}}
    pointer.x=px;pointer.y=py;return;}
  const nd=nodeAt(px,py);if(nd!==hoverNode){hoverNode=nd;if(!selNode)computeFocus(nd);canvas.style.cursor=nd?"pointer":"grab";}
  pointer.x=px;pointer.y=py;
});
canvas.addEventListener("mousedown",ev=>{unlockAudio();pointer.down=true;pointer.moved=false;pointer.x=ev.clientX;pointer.y=ev.clientY;panVX=0;panVY=0;canvas.style.cursor="grabbing";});
addEventListener("mouseup",ev=>{if(pointer.down&&!pointer.moved){const nd=nodeAt(ev.clientX,ev.clientY);if(nd)select(nd);else deselect();}pointer.down=false;canvas.style.cursor="grab";});
canvas.addEventListener("dblclick",ev=>{const nd=nodeAt(ev.clientX,ev.clientY);if(nd)openPage(nd);});
canvas.addEventListener("wheel",ev=>{ev.preventDefault();
  /* in timeline, scrolling travels along the years; pinch (ctrl/meta+wheel) still zooms */
  if(viewMode==="timeline"&&!ev.ctrlKey&&!ev.metaKey){tviewX-=(ev.deltaY+ev.deltaX);return;}
  const f=ev.deltaY<0?1.1:0.91;tzoom=Math.max(0.3,Math.min(3,tzoom*f));},{passive:false});
/* touch */
let touchMode=0,pinchD=0,tapXY=null,lastTap=0;
canvas.addEventListener("touchstart",ev=>{
  ev.preventDefault();unlockAudio();
  if(ev.touches.length===1){pointer.down=true;pointer.moved=false;pointer.x=ev.touches[0].clientX;pointer.y=ev.touches[0].clientY;tapXY={x:pointer.x,y:pointer.y};touchMode=1;panVX=0;panVY=0;}
  else if(ev.touches.length>=2){touchMode=2;pointer.down=false;pinchD=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,ev.touches[0].clientY-ev.touches[1].clientY);}
},{passive:false});
canvas.addEventListener("touchmove",ev=>{
  ev.preventDefault();
  if(touchMode===1&&ev.touches.length===1){
    const px=ev.touches[0].clientX,py=ev.touches[0].clientY,dx=px-pointer.x,dy=py-pointer.y;
    if(Math.abs(dx)+Math.abs(dy)>1.5){pointer.moved=true;tyaw=null;
      if(viewMode==="timeline"){tviewX=viewX+=dx;tviewY=viewY+=dy;panVX=panVX*0.5+dx*0.5;panVY=panVY*0.5+dy*0.5;}
      else{yaw+=dx*0.006;pitch=Math.max(-1.3,Math.min(1.3,pitch+dy*0.006));vyaw=dx*0.006;vpitch=dy*0.006;}}
    pointer.x=px;pointer.y=py;
  } else if(touchMode===2&&ev.touches.length>=2){
    const d=Math.hypot(ev.touches[0].clientX-ev.touches[1].clientX,ev.touches[0].clientY-ev.touches[1].clientY);
    if(pinchD>0)tzoom=Math.max(0.3,Math.min(3,tzoom*(d/pinchD)));
    pinchD=d;
  }
},{passive:false});
canvas.addEventListener("touchend",ev=>{
  if(touchMode===1&&!pointer.moved&&tapXY){const now=Date.now(),nd=nodeAt(tapXY.x,tapXY.y);if(now-lastTap<300&&nd){openPage(nd);}else if(nd){select(nd);}else{deselect();}lastTap=now;}
  pointer.down=false;
  if(ev.touches.length===0)touchMode=0;
  else if(ev.touches.length===1){touchMode=1;pointer.down=true;pointer.moved=true;pointer.x=ev.touches[0].clientX;pointer.y=ev.touches[0].clientY;}
},{passive:false});

/* quick card panel */
const panel=document.getElementById("panel"),panelBody=document.getElementById("panelBody");
function select(nd){selNode=nd;computeFocus(nd);renderPanel(nd);panel.classList.add("open");if(MOBILE){tviewY=-H*0.24;centerOn(nd);}playClip(nd);}
function deselect(){selNode=null;if(!hoverNode)focusSet=null;panel.classList.remove("open");tviewY=0;if(clip)clip.pause();clipNote("");}
document.getElementById("close").onclick=deselect;
function connsFor(nd){return EDGES.filter(ed=>ed.a===nd.id||ed.b===nd.id).map(ed=>({other:ed.a===nd.id?byId[ed.b]:byId[ed.a],rel:relWord(ed,nd)})).sort((a,b)=>b.other.deg-a.other.deg);}
function renderPanel(nd){
  const era=ERAS[nd.era],cs=connsFor(nd);
  panelBody.innerHTML=`
    <span class="pill" style="background:${hexA(era.color,0.18)};color:${era.color}">${era.label}</span>
    <h2>${nd.name}</h2><div class="role">${nd.role}</div><div class="life">${nd.life}</div>
    <div class="bio">${nd.blurb}</div>
    <button class="openpage" id="opBtn">Open full page <span>&rarr;</span></button>
    <div class="sec">Connections (${cs.length})</div>
    <div class="conns">${cs.map(c=>`<div class="conn" data-id="${c.other.id}"><span class="rel">${c.rel}</span><span class="nm">${c.other.name}</span></div>`).join("")}</div>`;
  document.getElementById("opBtn").onclick=()=>openPage(nd);
  panelBody.querySelectorAll(".conn").forEach(el=>{el.onclick=()=>{const t=byId[el.dataset.id];centerOn(t);select(t);};});
}
function centerOn(nd){
  if(viewMode==="timeline"){tzoom=Math.max(tzoom,1.2);tviewX=-nd.x*tzoom;tviewY=-nd.y*tzoom-(MOBILE?H*0.18:0);return;}
  const R=Math.hypot(nd.x,nd.z);tyaw=Math.atan2(nd.x,nd.z);tpitch=Math.max(-1.3,Math.min(1.3,Math.atan2(nd.y,R)));tzoom=Math.max(tzoom,1.2);}

/* full encyclopedia page */
const pageEl=document.getElementById("page"),pageInner=document.getElementById("pageInner");
function openPage(nd){
  const era=ERAS[nd.era],cs=connsFor(nd);
  pageInner.innerHTML=`
    <button class="back" id="backBtn"><span>&larr;</span> Back to the constellation</button>
    <div class="phead">
      <div class="pavcol"><div class="pavatar" id="pavatar" style="background:${era.color}">${mono(nd.name)}</div><a id="pcredit" class="pcredit" target="_blank" rel="noopener"></a></div>
      <div class="pheadtext">
        <span class="pill" style="background:${hexA(era.color,0.18)};color:${era.color}">${era.label}</span>
        <h1>${nd.name}</h1>
        <div class="prole">${nd.role}</div>
        <div class="plife">${nd.life}</div>
      </div>
    </div>
    <p class="pbio">${nd.bio}</p>
    <h3>Discography</h3>
    <div id="discoBox"><div class="discoloading">Loading the full discography from MusicBrainz…</div></div>
    ${(()=>{const L=LIB[nd.id]||{};const bs=(t,a)=>(a&&a.length)?`<h3>${t}</h3><div>`+a.map(b=>`<div class="brow"><span class="btitle">${b[1]}</span> <span class="bmeta">— ${b[0]}, ${b[2]}</span></div>`).join("")+`</div>`:"";return bs("Biographies & memoirs",L.bios)+bs("Further reading",L.reads);})()}
    <h3>Connections (${cs.length})</h3>
    <div class="chips">${cs.map(c=>`<span class="chip" data-id="${c.other.id}"><span class="cd" style="background:${ERAS[c.other.era].color}"></span><span class="cr">${c.rel}</span> ${c.other.name}</span>`).join("")}</div>`;
  document.getElementById("backBtn").onclick=closePage;
  pageInner.querySelectorAll(".chip").forEach(el=>{el.onclick=()=>{openPage(byId[el.dataset.id]);pageEl.scrollTop=0;};});
  curId=nd.id;loadDisco(nd);loadPhoto(nd);
  pageEl.scrollTop=0;pageEl.classList.add("open");pageOpen=true;
  selNode=nd;computeFocus(nd);centerOn(nd);
}
function closePage(){pageEl.classList.remove("open");pageOpen=false;}
function openReadingRoom(){
  pageInner.innerHTML=`<button class="back" id="backBtn"><span>&larr;</span> Back to the constellation</button>
    <span class="pill" style="background:rgba(224,177,90,.18);color:#e0b15a">The reading room</span>
    <h1>The reading room</h1>
    <p class="lead">A shelf of the writers who shaped how we hear this music — the critics, historians, and memoirists worth seeking out beyond any single musician's page.</p>
    ${CRITICS.map(c=>`<div class="critic"><h4>${c.name}</h4><div class="cnote">${c.note}</div>${c.books.map(b=>`<div class="brow"><span class="btitle">${b[0]}</span> <span class="bmeta">— ${b[1]}</span></div>`).join("")}</div>`).join("")}
    <h3 style="margin-top:40px">Periodicals, archives &amp; forums</h3>
    <div class="reslist">${RESOURCES.map(r=>`<a class="reslink" href="${r[2]}" target="_blank" rel="noopener"><span class="rt">${r[0]}</span><span class="rn">${r[1]}</span><span class="ra">&#8599;</span></a>`).join("")}</div>`;
  document.getElementById("backBtn").onclick=closePage;
  pageEl.scrollTop=0;pageEl.classList.add("open");pageOpen=true;
}
document.getElementById("rrBtn").onclick=openReadingRoom;

/* ----------  LIVE DISCOGRAPHY (MusicBrainz)  ---------- */
let mbLast=0;
function mbFetch(url){const wait=Math.max(0,1100-(Date.now()-mbLast));return new Promise((res,rej)=>setTimeout(()=>{mbLast=Date.now();fetch(url).then(r=>{if(!r.ok)throw new Error("http "+r.status);return r.json();}).then(res,rej);},wait));}
function resolveAndFetch(nd){
  const getRGs=mbid=>{let items=[],offset=0;const more=()=>mbFetch(`https://musicbrainz.org/ws/2/release-group?artist=${mbid}&fmt=json&limit=100&offset=${offset}`).then(d=>{(d["release-groups"]||[]).forEach(rg=>items.push({title:rg.title,year:(rg["first-release-date"]||"").slice(0,4),primary:rg["primary-type"]||"",secondary:rg["secondary-types"]||[]}));const total=d["release-group-count"]||items.length;offset+=100;return(offset<total&&offset<400)?more():items;});return more();};
  if(nd.mbid)return getRGs(nd.mbid);
  const byName=nm=>mbFetch(`https://musicbrainz.org/ws/2/artist?query=${encodeURIComponent('artist:"'+nm+'"')}&fmt=json&limit=8`).then(d=>{const list=d.artists||[];if(!list.length)throw new Error("no match");const best=list.find(a=>a.name.toLowerCase()===nm.toLowerCase())||list[0];return getRGs(best.id);});
  const names=nd.discoAs?(Array.isArray(nd.discoAs)?nd.discoAs:[nd.discoAs]):[nd.name];
  if(names.length===1)return byName(names[0]);
  return names.reduce((p,nm)=>p.then(acc=>byName(nm).then(r=>acc.concat(r)).catch(()=>acc)),Promise.resolve([])).then(all=>{const seen={},out=[];all.forEach(i=>{const k=(i.title||"").toLowerCase();if(k&&!seen[k]){seen[k]=1;out.push(i);}});return out;});
}
function dtag(i){const t=(i.secondary&&i.secondary.length)?i.secondary.join(", "):(i.primary&&i.primary!=="Album"?i.primary:"");return t?`<span class="dtag">${esc(t)}</span>`:"";}
function svc(q){const e=encodeURIComponent(q.replace(/\s+/g," ").trim());return `<span class="svc"><a href="https://open.spotify.com/search/${e}" target="_blank" rel="noopener">Spotify</a><a class="apple" data-q="${e}" href="https://music.apple.com/us/search?term=${e}" target="_blank" rel="noopener">Apple</a><a href="https://www.youtube.com/results?search_query=${e}" target="_blank" rel="noopener">YouTube</a></span>`;}
function wireApple(box){if(!box||!box.querySelectorAll)return;box.querySelectorAll("a.apple").forEach(a=>{a.onclick=appleClick;});}
function appleClick(ev){
  ev.preventDefault();
  const q=decodeURIComponent(this.dataset.q||"");
  const fb="https://music.apple.com/us/search?term="+encodeURIComponent(q);
  let w=null;try{w=window.open("","_blank");}catch(e){}
  let done=false;const go=u=>{if(done)return;done=true;const url=u||fb;try{if(w&&!w.closed){w.location.href=url;return;}}catch(e){}window.location.href=url;};
  let cached=null;try{cached=localStorage.getItem("tmc_apple_"+q);}catch(e){}
  if(cached&&cached.indexOf("/album/")>=0){go(cached);return false;}
  setTimeout(()=>go(fb),8000);
  if(typeof fetch==="undefined"){go(fb);return false;}
  const api="https://itunes.apple.com/search?term="+encodeURIComponent(q)+"&media=music&entity=album&limit=5";
  fetchJSON(api).then(d=>{const r=((d&&d.results)||[]).find(x=>x.collectionViewUrl);if(r){try{localStorage.setItem("tmc_apple_"+q,r.collectionViewUrl);}catch(e){}go(r.collectionViewUrl);}else{go(fb);}}).catch(()=>go(fb));
  return false;
}
function renderDisco(box,nd,items){
  const sorted=items.slice().sort((a,b)=>(a.year||"9999").localeCompare(b.year||"9999"));
  const isMain=i=>i.primary==="Album"&&!i.secondary.includes("Compilation");
  const main=sorted.filter(isMain),other=sorted.filter(i=>!isMain(i));
  const row=i=>`<div class="drow"><span class="dyear">${esc(i.year)||"—"}</span><span class="dmain"><span class="dtitle">${esc(i.title)}</span>${dtag(i)}${svc(nd.name+" "+i.title)}</span></div>`;
  let html=`<div class="discometa">${items.length} releases · via MusicBrainz</div><div class="disco">${main.map(row).join("")||'<div class="dnote">No studio albums listed.</div>'}</div>`;
  if(other.length)html+=`<button class="moreBtn" id="moreBtn">Show ${other.length} more — EPs, live &amp; compilations</button><div class="disco" id="otherDisco" style="display:none">${other.map(row).join("")}</div>`;
  box.innerHTML=html;wireApple(box);
  const mb=document.getElementById("moreBtn");
  if(mb)mb.onclick=()=>{const o=document.getElementById("otherDisco"),sh=o.style.display==="none";o.style.display=sh?"":"none";mb.innerHTML=sh?"Hide EPs, live &amp; compilations":`Show ${other.length} more — EPs, live &amp; compilations`;};
}
function renderFallback(box,nd){box.innerHTML=`<div class="discometa">Showing essentials — connect to the internet to load the full discography from MusicBrainz.</div><div class="disco">${(nd.disco||[]).map(d=>`<div class="drow"><span class="dyear">${d[0]}</span><span class="dmain"><span class="dtitle">${d[1]}</span>${d[2]?`<span class="dnote">— ${d[2]}</span>`:""}${svc(nd.name+" "+d[1])}</span></div>`).join("")}</div>`;wireApple(box);}
function loadDisco(nd){
  const box=document.getElementById("discoBox");if(!box)return;
  const key=lsKey("disco_"+nd.id);let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||"null");}catch(e){}
  if(cached&&cached.items&&Date.now()-(cached.ts||0)<30*864e5){renderDisco(box,nd,cached.items);return;}
  resolveAndFetch(nd).then(items=>{try{localStorage.setItem(key,JSON.stringify({items,ts:Date.now()}));}catch(e){}if(curId===nd.id)renderDisco(box,nd,items);}).catch(()=>{if(curId===nd.id)renderFallback(box,nd);});
}
function mono(name){const p=name.split(" ").filter(Boolean);return((p[0][0]||"")+(p.length>1?p[p.length-1][0]:"")).toUpperCase();}
function loadPhoto(nd){
  const av=document.getElementById("pavatar");if(!av)return;
  const key=lsKey("photo_"+nd.id);let cached=null;try{cached=localStorage.getItem(key);}catch(e){}
  const set=url=>{if(url&&url!=="none"&&curId===nd.id){const img=new Image();img.alt=nd.name;img.onload=()=>{if(curId===nd.id){av.classList.add("hasimg");av.innerHTML="";av.appendChild(img);const cr=document.getElementById("pcredit");if(cr){cr.href="https://en.wikipedia.org/wiki/"+encodeURIComponent(WIKI[nd.id]||nd.name);cr.textContent="Photo: Wikipedia";cr.classList.add("show");}}};img.src=url;}};
  if(cached!==null){set(cached);return;}
  const title=WIKI[nd.id]||nd.name;
  fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`).then(r=>r.ok?r.json():Promise.reject()).then(d=>{const url=(d.type==="standard"&&d.thumbnail&&d.thumbnail.source)?d.thumbnail.source:"none";try{localStorage.setItem(key,url);}catch(e){}set(url);}).catch(()=>{});
}
addEventListener("keydown",ev=>{if(ev.key==="Escape"){if(pageOpen)closePage();else deselect();}});

/* ----------  SEARCH (diacritic-folded, typo-tolerant, scored)  ---------- */
const fold=s=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
function levCap(a,b,cap){ // Levenshtein distance, bails out above cap
  if(Math.abs(a.length-b.length)>cap)return cap+1;
  let prev=[];for(let j=0;j<=b.length;j++)prev[j]=j;
  for(let i=1;i<=a.length;i++){
    const cur=[i];let rowMin=i;
    for(let j=1;j<=b.length;j++){
      cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));
      if(cur[j]<rowMin)rowMin=cur[j];
    }
    if(rowMin>cap)return cap+1;
    prev=cur;
  }
  return prev[b.length];
}
function searchScore(nd,v){
  if(nd._sname.startsWith(v))return 100;
  for(const w of nd._swords)if(w.startsWith(v))return 84;
  if(nd._sname.includes(v))return 66;
  if(v.length>=4){ // typo tolerance: "thelonius" still finds Thelonious
    const cap=v.length>=7?2:1;
    let best=cap+1;
    for(const w of nd._swords.concat([nd._sname])){const d=levCap(v,w,cap);if(d<best)best=d;}
    if(best<=cap)return 58-12*best;
  }
  if(nd._srole.includes(v))return 40;
  return 0;
}
const q=document.getElementById("q"),suggest=document.getElementById("suggest");
let sIdx=-1,sList=[];
q.addEventListener("input",()=>{
  const v=fold(q.value.trim());
  if(!v){suggest.style.display="none";return;}
  sList=NODES.map(nd=>[searchScore(nd,v),nd]).filter(x=>x[0]>0)
    .sort((x,y)=>y[0]-x[0]||y[1].deg-x[1].deg).slice(0,12).map(x=>x[1]);sIdx=-1;
  if(!sList.length){suggest.style.display="none";return;}
  suggest.innerHTML=sList.map((nd,i)=>`<div data-i="${i}">${nd.name} <span style="color:var(--muted);font-size:11px">${nd.instr}</span></div>`).join("");
  suggest.style.display="block";
  suggest.querySelectorAll("div").forEach(el=>{el.onclick=()=>pick(sList[+el.dataset.i]);});
});
q.addEventListener("keydown",ev=>{
  if(suggest.style.display!=="block")return;
  const items=suggest.querySelectorAll("div");
  if(ev.key==="ArrowDown")sIdx=Math.min(sList.length-1,sIdx+1);
  else if(ev.key==="ArrowUp")sIdx=Math.max(0,sIdx-1);
  else if(ev.key==="Enter"){pick(sList[sIdx<0?0:sIdx]);return;}
  else return;
  items.forEach((el,i)=>el.classList.toggle("active",i===sIdx));ev.preventDefault();
});
function pick(nd){if(!nd)return;if(!activeEras.has(nd.era)){activeEras.add(nd.era);const lab=legend.querySelector(`[data-era="${nd.era}"]`);if(lab)lab.classList.remove("off");}if(instrFilter&&nd.instr!==instrFilter){instrFilter=null;const ie=document.getElementById("instr");if(ie)ie.value="";}q.value="";suggest.style.display="none";centerOn(nd);select(nd);}
document.addEventListener("click",ev=>{if(!q.parentNode.contains(ev.target))suggest.style.display="none";});

const spreadEl=document.getElementById("spread");
if(spreadEl){spreadEl.value=spread;spreadEl.oninput=()=>{spread=parseFloat(spreadEl.value);alpha=Math.max(alpha,0.75);};}

/* ----------  AUDIO PREVIEW CLIPS (Deezer / Apple iTunes)  ---------- */
const clip=(typeof Audio!=="undefined")?new Audio():null;
let clipFor=null;
const SILENT="data:audio/wav;base64,UklGRoQJAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YWAJAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIA=";
let audioUnlocked=false;
function unlockAudio(){if(!clip||audioUnlocked)return;audioUnlocked=true;try{clip.src=SILENT;const p=clip.play();if(p&&p.catch)p.catch(()=>{audioUnlocked=false;});}catch(e){audioUnlocked=false;}}
function clipNote(msg,hold){const el=document.getElementById("clipnote");if(!el)return;clearTimeout(clipNote._t);if(!msg){el.classList.remove("show");return;}el.textContent=msg;el.classList.add("show");clipNote._t=setTimeout(()=>el.classList.remove("show"),hold||2600);}
function playPreview(url,name){if(!clip)return;if(!url||url==="none"){clipNote("No preview found for "+name);return;}clip.src=url;try{clip.currentTime=0;}catch(e){}const p=clip.play();if(p&&p.catch)p.catch(()=>{clipNote("Tap again to hear "+name);});clipNote("♪  "+name,32000);}
function jsonpLookup(term,cb){
  if(typeof document==="undefined"||!document.body){cb(null);return;}
  const id="itcb"+(Math.random()*1e9|0);let done=false;
  const s=document.createElement("script");
  function cleanup(){try{delete window[id];}catch(e){window[id]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);}
  window[id]=data=>{if(done)return;done=true;cleanup();const r=((data&&data.results)||[]).find(x=>x.previewUrl);cb(r?r.previewUrl:"none");};
  s.onerror=()=>{if(!done){done=true;cleanup();cb(null);}};
  s.src="https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&media=music&entity=song&attribute=artistTerm&limit=4&callback="+id;
  document.body.appendChild(s);
  setTimeout(()=>{if(!done){done=true;cleanup();cb(null);}},6500);
}
function tfetch(u,ms){return Promise.race([fetch(u).then(r=>r.ok?r.json():Promise.reject()),new Promise((_,rej)=>setTimeout(rej,ms))]);}
function fetchJSON(url){let p=Promise.reject();["https://jazz-itunes.hueyb.workers.dev/?url=","","https://corsproxy.io/?url=","https://api.allorigins.win/raw?url="].forEach(px=>{p=p.catch(()=>tfetch(px?px+encodeURIComponent(url):url,3500));});return p;}
/* Verified previews: only play a clip whose artist actually matches the star.
   pnorm() normalises names so "Lee \"Scratch\" Perry" == "lee scratch perry", etc. */
function pnorm(s){return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/&/g," and ").replace(/\bthe\b/g," ").replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();}
function artistMatch(a,b){a=pnorm(a);b=pnorm(b);return !!a&&!!b&&a===b;}
function jsonp(url,cb){if(typeof document==="undefined"||!document.body){cb(null);return;}const id="jp"+(Math.random()*1e9|0);let done=false;const s=document.createElement("script");const fin=v=>{if(done)return;done=true;try{delete window[id];}catch(e){window[id]=undefined;}if(s.parentNode)s.parentNode.removeChild(s);cb(v);};window[id]=d=>fin(d);s.onerror=()=>fin(null);s.src=url+(url.indexOf("?")<0?"?":"&")+"output=jsonp&callback="+id;document.body.appendChild(s);setTimeout(()=>fin(null),6500);}
function dzSearch(q,cb){jsonp("https://api.deezer.com/search?q="+encodeURIComponent(q)+"&limit=12",d=>cb((d&&d.data)||[]));}
function dzArtistTop(aid,cb){jsonp("https://api.deezer.com/artist/"+aid+"/top?limit=1",d=>{const t=(d&&d.data&&d.data[0]);cb(t&&t.preview?t.preview:null);});}
function itSearch(term,want,cb){let done=false;const fin=v=>{if(done)return;done=true;cb(v);};setTimeout(()=>fin(null),12000);const u="https://itunes.apple.com/search?term="+encodeURIComponent(term)+"&media=music&entity=song&limit=12";const match=res=>{const r=(res||[]).find(x=>x.previewUrl&&artistMatch(x.artistName,want));fin(r?r.previewUrl:null);};if(typeof fetch==="undefined"){jsonp(u,d=>match(d&&d.results));return;}fetchJSON(u).then(d=>match(d&&d.results)).catch(()=>jsonp(u,d=>match(d&&d.results)));}
function playClip(nd){
  if(!clip)return;
  clipFor=nd.id;
  let cached=null;try{cached=localStorage.getItem(lsKey("clip_"+nd.id));}catch(e){}
  if(cached){if(cached!=="none")playPreview(cached,nd.name);else clipNote("No verified preview for "+nd.name);return;}
  clipNote("♪  finding "+nd.name+"…",6500);
  const ov=(G.preview||{})[nd.id]||{}, want=ov.artist||nd.name;
  const seed=(nd.disco&&nd.disco[0]&&nd.disco[0][1])||"";
  const q1=ov.q||(seed&&!/^with /i.test(seed)?nd.name+" "+seed:nd.name);
  const q2=nd.name;
  const done=url=>{if(clipFor!==nd.id)return;try{localStorage.setItem(lsKey("clip_"+nd.id),url||"none");}catch(e){}if(url)playPreview(url,nd.name);else clipNote("No verified preview for "+nd.name);};
  const search=(q,next)=>dzSearch(q,arr=>{if(clipFor!==nd.id)return;const t=(arr||[]).find(x=>x&&x.preview&&artistMatch(x.artist&&x.artist.name,want));if(t)done(t.preview);else next();});
  const itun=()=>itSearch(q2,want,url=>{if(clipFor!==nd.id)return;done(url);});
  /* ov.only = trust ONLY the specific query (skip plain-name + iTunes), for names a
     famous namesake dominates (e.g. Charlie Chaplin the film composer). */
  const afterQ1=ov.only?(()=>done(null)):(()=>q1!==q2?search(q2,itun):itun());
  if(ov.did){dzArtistTop(ov.did,u=>{if(clipFor!==nd.id)return;if(u)done(u);else search(q1,afterQ1);});}
  else search(q1,afterQ1);
}

/* frame the timeline: fit the era lanes vertically; x stays wherever you've travelled
   (toStart=true jumps to the genre's beginnings) */
function frameTimeline(toStart){
  tzoom=Math.max(0.3,Math.min(2.4,(H-170)/620));
  if(toStart)tviewX=180-W/2-TLX(TL.y0)*tzoom;
  tviewY=0;
}
function fitView(){if(viewMode==="timeline"){frameTimeline(false);tyaw=null;return;}let R=1;for(const nd of NODES){if(!visible(nd))continue;R=Math.max(R,Math.hypot(nd.x,nd.y,nd.z));}tzoom=Math.max(0.3,Math.min(2.4,(Math.min(W,H)*0.46)/R));tyaw=null;}
const fitBtn=document.getElementById("fitBtn");if(fitBtn)fitBtn.onclick=fitView;
let userFramed=false;["wheel","mousedown"].forEach(ev=>canvas.addEventListener(ev,()=>{userFramed=true;}));

/* ----------  GLOBE ⇄ TIMELINE TOGGLE  ---------- */
const tlBtn=document.getElementById("tlBtn");
const hintEl=document.querySelector(".hint");
const HINT_GLOBE=hintEl?hintEl.innerHTML:"";
const HINT_TL='<b>Hover</b> to trace ties &middot; <b>Click</b> for a card &middot; <b>Double-click</b> for the full page<br><b>Drag</b> to pan the years &middot; <b>Scroll</b> to zoom &middot; small dots are essential records';
function setView(mode){
  if(viewMode===mode)return;
  viewMode=mode;
  if(tlBtn)tlBtn.classList.toggle("on",mode==="timeline");
  if(hintEl)hintEl.innerHTML=mode==="timeline"?HINT_TL:HINT_GLOBE;
  alpha=1;userFramed=false;
  panVX=0;panVY=0;
  if(mode==="timeline"){tyaw=0;tpitch=0;vyaw=0;vpitch=0;frameTimeline(true);}
  else{NODES.forEach(nd=>{nd.vz+=(Math.random()-.5)*8;});tviewX=0;tviewY=0;setTimeout(fitView,1800);} // globe needs time to fold back in from far down the road
}
if(tlBtn)tlBtn.onclick=()=>setView(viewMode==="globe"?"timeline":"globe");

/* ----------  GENRE LOADING, THEME & ROUTING  ---------- */
const legend=document.getElementById("legend");
const instrEl=document.getElementById("instr");
const gtabs=document.getElementById("gtabs");
GENRE_ORDER.forEach(k=>{
  const b=document.createElement("button");
  b.className="gtab";b.dataset.g=k;b.textContent=GENRES[k].shortName;
  b.onclick=()=>switchGenre(k);
  gtabs.appendChild(b);
});
function loadGenre(key){
  G=GENRES[key];
  ERAS=G.eras;NODES=G.nodes;EDGES=G.edges;LIB=G.lib;CRITICS=G.critics;RESOURCES=G.resources;WIKI=G.wiki;SYM=G.sym;
  /* reset interaction state */
  hoverNode=null;selNode=null;focusSet=null;curId=null;
  panel.classList.remove("open");closePage();if(clip)clip.pause();clipNote("");
  /* index, degrees, adjacency, edge kinds */
  byId={};NODES.forEach(nd=>{byId[nd.id]=nd;nd.deg=0;});
  EDGES.forEach(ed=>{ed.s=byId[ed.a];ed.t=byId[ed.b];ed.kind=kindOf(ed.rel);if(ed.s&&ed.t){ed.s.deg++;ed.t.deg++;}});
  adj={};NODES.forEach(nd=>adj[nd.id]=new Set());EDGES.forEach(ed=>{if(ed.s&&ed.t){adj[ed.a].add(ed.b);adj[ed.b].add(ed.a);}});
  /* role categories + search index + sphere seeding */
  const rules=G.roleGroups.map(([re,label])=>[new RegExp(re),label]);
  const instrumentOf=role=>{const r=role.split("·")[0].trim().toLowerCase();for(const [re,label] of rules)if(re.test(r))return label;return"Other";};
  NODES.forEach(nd=>{
    const u=Math.random(),v=Math.random(),th=Math.acos(2*u-1),ph=2*Math.PI*v,rr=170*Math.cbrt(Math.random());
    nd.x=rr*Math.sin(th)*Math.cos(ph);nd.y=rr*Math.sin(th)*Math.sin(ph);nd.z=rr*Math.cos(th);
    nd.vx=0;nd.vy=0;nd.vz=0;nd.hl=0;nd._pa=0;nd.twp=Math.random()*6.28;
    nd.instr=instrumentOf(nd.role);
    nd.discoAs=G.discoAs[nd.id]||null;
  });
  NODES.forEach(nd=>{nd._sname=fold(nd.name);nd._swords=nd._sname.split(/\s+/);nd._srole=fold(nd.role+" "+nd.instr);});
  /* timeline targets: lifespan from `life`, record years from the curated essentials */
  let ymin=1e9,ymax=-1e9;
  NODES.forEach(nd=>{
    const yrs=(nd.life.match(/\d{4}/g)||[]).map(Number);
    const recs=nd.disco.map(d=>{const m=String(d[0]).match(/\d{4}/);return m?+m[0]:null;}).filter(Boolean);
    nd._y0=yrs[0]||recs[0]||1950;
    nd._y1=Math.min(yrs[1]||THIS_YEAR,THIS_YEAR);
    nd._recs=recs.filter(y=>y>=nd._y0-5&&y<=THIS_YEAR);
    ymin=Math.min(ymin,nd._y0);ymax=Math.max(ymax,nd._y1);
  });
  TL={y0:Math.floor(ymin/10)*10,y1:Math.min(THIS_YEAR,Math.ceil(ymax/10)*10),laneH:520/Object.keys(ERAS).length,pxy:MOBILE?26:44};
  const eraIdx={};Object.keys(ERAS).forEach((k,i)=>eraIdx[k]=i);
  NODES.forEach((nd,i)=>{
    nd._tx=TLX((nd._y0+nd._y1)/2);
    nd._ty=-260+(eraIdx[nd.era]+0.5)*TL.laneH+(((i*7919)%1000)/1000-0.5)*TL.laneH*0.7;
  });
  viewX=0;tviewX=0;viewY=0;tviewY=0;
  /* theme — @property-registered vars cross-fade in CSS */
  const rs=document.documentElement.style;
  rs.setProperty("--bg",G.theme.bg);rs.setProperty("--glow",G.theme.glow);
  rs.setProperty("--deep",G.theme.deep);rs.setProperty("--panel",G.theme.panel);
  /* identity: umbrella brand stays in the tab title so no genre route
     can be mistaken for one of the legacy single-genre sites */
  document.title=G.shortName+" · The Music Constellation — who shaped whom";
  document.getElementById("gname").innerHTML=`${G.name} <span class="ver">${window.MC_BUILD||""}</span>`;
  gtabs.querySelectorAll(".gtab").forEach(b=>b.classList.toggle("on",b.dataset.g===key));
  /* legend: eras + connection-line key */
  const kinds=[...new Set(EDGES.map(ed=>ed.kind))];
  legend.innerHTML=`<div class="lh">Eras — click to filter</div>`
    +Object.entries(ERAS).map(([k,v])=>`<label data-era="${k}"><span class="dot" style="background:${v.color}"></span>${v.label}</label>`).join("")
    +`<div class="ekey"><div class="lh" style="margin-top:8px">Connections</div>`
    +["collab","mentor","influence","rivalry"].filter(k=>kinds.includes(k)).map(k=>`<label class="ek"><span class="eline ${k}"></span>${KIND_LABEL[k]}</label>`).join("")
    +`</div>`;
  legend.querySelectorAll("label[data-era]").forEach(el=>{el.onclick=()=>{const k=el.dataset.era;if(activeEras.has(k)){activeEras.delete(k);el.classList.add("off");}else{activeEras.add(k);el.classList.remove("off");}alpha=Math.max(alpha,0.4);};});
  /* filters */
  activeEras=new Set(Object.keys(ERAS));instrFilter=null;
  instrEl.innerHTML="";
  const all=document.createElement("option");all.value="";all.textContent=G.filterLabel;instrEl.appendChild(all);
  [...new Set(NODES.map(nd=>nd.instr))].sort().forEach(i=>{const o=document.createElement("option");o.value=i;o.textContent=i;instrEl.appendChild(o);});
  /* reheat the simulation and reframe */
  alpha=1;userFramed=false;
  setTimeout(()=>{if(!userFramed)fitView();},1600);
  try{localStorage.setItem("tmc_last",key);}catch(e){}
}
instrEl.onchange=()=>{instrFilter=instrEl.value||null;alpha=Math.max(alpha,0.8);userFramed=true;setTimeout(fitView,650);};

function genreFromHash(){const m=location.hash.match(/^#\/?([a-z]+)/);return m&&GENRES[m[1]]?m[1]:null;}
addEventListener("hashchange",()=>{const k=genreFromHash();if(k&&!trans&&(!G||G.key!==k))switchGenre(k);});

let last=null;try{last=localStorage.getItem("tmc_last");}catch(e){}
const initial=genreFromHash()||((last&&GENRES[last])?last:GENRE_ORDER[0]);
if(location.hash!=="#/"+initial)try{history.replaceState(null,"","#/"+initial);}catch(e){location.hash="#/"+initial;}
loadGenre(initial);
loop();
