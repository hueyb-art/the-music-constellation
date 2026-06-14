/* Shared MusicBrainz access: one rate-limited request queue for the whole app
   (discographies + collaborations), plus collaboration lookup.
   MusicBrainz asks for <=1 request/second; mbGet serialises every call >=1.1s apart. */
(function(){
  let last=0, chain=Promise.resolve();
  function mbGet(url){
    const run=chain
      .then(()=>new Promise(res=>setTimeout(res,Math.max(0,1100-(Date.now()-last)))))
      .then(()=>{last=Date.now();return fetch(url).then(r=>{if(!r.ok)throw new Error("http "+r.status);return r.json();});});
    chain=run.catch(()=>{}); // keep the queue alive even if one request fails
    return run;
  }

  /* Shared recordings between two artists — the hard data of "what did they make together".
     MusicBrainz co-credit search catches joint billings and features well; pure uncredited
     sideman sessions can be partial. Deduped by title, earliest year kept, sorted. */
  function collab(a,b){
    const clean=s=>String(s||"").replace(/"/g,"").trim();
    const q=encodeURIComponent('artist:"'+clean(a)+'" AND artist:"'+clean(b)+'"');
    return mbGet("https://musicbrainz.org/ws/2/recording?query="+q+"&fmt=json&limit=50").then(d=>{
      const seen={},out=[];
      (d.recordings||[]).forEach(r=>{
        const title=(r.title||"").trim();
        const key=title.toLowerCase().replace(/\s*[\(\[].*?[\)\]]\s*/g," ").replace(/[^a-z0-9]+/g," ").trim();
        if(!key)return;
        const year=(r["first-release-date"]||"").slice(0,4);
        if(!seen[key]){seen[key]={title,year};out.push(seen[key]);}
        else if(year&&(!seen[key].year||year<seen[key].year))seen[key].year=year;
      });
      out.sort((x,y)=>(x.year||"9999").localeCompare(y.year||"9999"));
      return out;
    });
  }

  function collabCached(a,b,key){
    let c=null;try{c=JSON.parse(localStorage.getItem(key)||"null");}catch(e){}
    if(c&&c.items&&Date.now()-(c.ts||0)<30*864e5)return Promise.resolve(c.items);
    return collab(a,b).then(items=>{try{localStorage.setItem(key,JSON.stringify({items,ts:Date.now()}));}catch(e){}return items;});
  }

  window.MB={get:mbGet,collab:collabCached};
})();
