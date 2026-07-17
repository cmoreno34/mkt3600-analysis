import { useState, useRef, useEffect } from "react";
import * as XLSX from "xlsx";

const COLORS = ["#6c8fff","#ff6c8f","#6cffb8","#ffd96c","#c46cff","#ff9f6c","#6cfff2","#ff6cdc","#a8ff6c","#6cc8ff"];

/* ── Math ── */
const eucSq=(a,b)=>a.reduce((s,v,i)=>s+(v-b[i])**2,0);
const hamm=(a,b)=>a.reduce((s,v,i)=>s+(v!==b[i]?1:0),0);
const rndI=n=>Math.floor(Math.random()*n);
const wcssFn=(pts,c,a)=>pts.reduce((s,p,i)=>s+eucSq(p,c[a[i]]),0);
const meanOf=arr=>arr.reduce((a,b)=>a+b,0)/arr.length;
const medOf=arr=>{const s=[...arr].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const modeOf=arr=>{const f={};arr.forEach(v=>f[v]=(f[v]||0)+1);return Object.entries(f).sort((a,b)=>b[1]-a[1])[0]?.[0]??'';};
const isMiss=v=>v===''||v===null||v===undefined||/^(\?|NA|N\/A|nan|none|null)$/i.test(String(v));

function kInit(pts,k){const s=new Set();while(s.size<k)s.add(rndI(pts.length));return[...s].map(i=>[...pts[i]]);}

function kMeansRun(pts,k,maxIt){
  let c=kInit(pts,k),a=new Array(pts.length).fill(0),it=0;
  for(;it<maxIt;it++){
    let chg=false;
    for(let i=0;i<pts.length;i++){let b=0,bd=Infinity;c.forEach((v,j)=>{const d=eucSq(pts[i],v);if(d<bd){bd=d;b=j;}});if(a[i]!==b){a[i]=b;chg=true;}}
    if(!chg)break;
    const dim=pts[0].length,s=Array.from({length:k},()=>new Array(dim).fill(0)),n=new Array(k).fill(0);
    pts.forEach((p,i)=>{p.forEach((v,d)=>s[a[i]][d]+=v);n[a[i]]++;});
    c=s.map((v,i)=>n[i]>0?v.map(x=>x/n[i]):c[i]);
  }
  return{c,a,it,wcss:wcssFn(pts,c,a)};
}
function kMeansBest(pts,k,nI,mIt){let b=null;for(let i=0;i<nI;i++){const r=kMeansRun(pts,k,mIt);if(!b||r.wcss<b.wcss)b=r;}return b;}

function kProtoRun(nP,cP,k,g,maxIt){
  const s=new Set();while(s.size<k)s.add(rndI(nP.length));
  let nc=[...s].map(i=>[...nP[i]]),cc=[...s].map(i=>[...cP[i]]),a=new Array(nP.length).fill(0),it=0;
  for(;it<maxIt;it++){
    let chg=false;
    for(let i=0;i<nP.length;i++){let b=0,bd=Infinity;nc.forEach((_,j)=>{const d=eucSq(nP[i],nc[j])+g*hamm(cP[i],cc[j]);if(d<bd){bd=d;b=j;}});if(a[i]!==b){a[i]=b;chg=true;}}
    if(!chg)break;
    const nd=nP[0].length,cd=cP[0].length;
    const ns=Array.from({length:k},()=>new Array(nd).fill(0));
    const cb=Array.from({length:k},()=>Array.from({length:cd},()=>[]));
    const n=new Array(k).fill(0);
    nP.forEach((p,i)=>{p.forEach((v,d)=>ns[a[i]][d]+=v);cP[i].forEach((v,d)=>cb[a[i]][d].push(v));n[a[i]]++;});
    nc=ns.map((v,i)=>n[i]>0?v.map(x=>x/n[i]):nc[i]);
    cc=cb.map((cols,i)=>n[i]>0?cols.map(arr=>modeOf(arr)):cc[i]);
  }
  return{nc,cc,a,it,wcss:wcssFn(nP,nc,a)};
}
function kProtoBest(nP,cP,k,g,nI,mIt){let b=null;for(let i=0;i<nI;i++){const r=kProtoRun(nP,cP,k,g,mIt);if(!b||r.wcss<b.wcss)b=r;}return b;}

/* ── Canvas ── */
function drawScatter(cv,pts,asgn,cents,k,lx,ly){
  if(!cv)return;
  const W=cv.width,H=cv.height,P=48,ctx=cv.getContext('2d');
  const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
  const xr=(x1-x0)||1,yr=(y1-y0)||1;
  const tx=x=>P+(x-x0)/xr*(W-2*P),ty=y=>H-P-(y-y0)/yr*(H-2*P);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
  for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(P+i*(W-2*P)/4,P);ctx.lineTo(P+i*(W-2*P)/4,H-P);ctx.stroke();ctx.beginPath();ctx.moveTo(P,P+i*(H-2*P)/4);ctx.lineTo(W-P,P+i*(H-2*P)/4);ctx.stroke();}
  cents.forEach((c,ci)=>{const g=ctx.createRadialGradient(tx(c[0]),ty(c[1]),0,tx(c[0]),ty(c[1]),Math.max(W,H)*.55);g.addColorStop(0,COLORS[ci%10]+'22');g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);});
  ctx.fillStyle='#5e6278';ctx.font='11px monospace';ctx.textAlign='center';ctx.fillText(lx,W/2,H-5);
  ctx.save();ctx.translate(13,H/2);ctx.rotate(-Math.PI/2);ctx.fillText(ly,0,0);ctx.restore();
  for(let i=0;i<=4;i++){ctx.fillStyle='#5e6278';ctx.font='10px monospace';ctx.textAlign='center';ctx.fillText((x0+i*xr/4).toFixed(1),tx(x0+i*xr/4),H-P+13);ctx.textAlign='right';ctx.fillText((y0+i*yr/4).toFixed(1),P-5,ty(y0+i*yr/4)+4);}
  pts.forEach((p,i)=>{const col=COLORS[asgn[i]%10];ctx.beginPath();ctx.arc(tx(p[0]),ty(p[1]),5,0,Math.PI*2);ctx.fillStyle=col+'bb';ctx.fill();ctx.strokeStyle=col;ctx.lineWidth=1.5;ctx.stroke();});
  cents.forEach((c,ci)=>{const col=COLORS[ci%10],cx=tx(c[0]),cy=ty(c[1]);ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(cx-10,cy);ctx.lineTo(cx+10,cy);ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy-10);ctx.lineTo(cx,cy+10);ctx.stroke();ctx.beginPath();ctx.arc(cx,cy,7,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();});
}

function drawElbow(cv,wcss,curK){
  if(!cv||!wcss.length)return;
  const W=cv.width,H=cv.height,ctx=cv.getContext('2d');
  const PL=60,PR=16,PT=12,PB=26,n=wcss.length;
  const wMn=Math.min(...wcss),wMx=Math.max(...wcss),wr=(wMx-wMn)||1;
  const tx=i=>PL+i*(W-PL-PR)/(n-1),ty=v=>H-PB-(v-wMn)/wr*(H-PT-PB);
  ctx.clearRect(0,0,W,H);
  ctx.strokeStyle='rgba(255,255,255,.04)';ctx.lineWidth=1;
  for(let i=0;i<4;i++){const y=PT+i*(H-PT-PB)/3;ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(W-PR,y);ctx.stroke();}
  ctx.beginPath();ctx.moveTo(tx(0),H-PB);wcss.forEach((v,i)=>ctx.lineTo(tx(i),ty(v)));ctx.lineTo(tx(n-1),H-PB);ctx.closePath();ctx.fillStyle='rgba(108,143,255,.09)';ctx.fill();
  ctx.beginPath();wcss.forEach((v,i)=>i?ctx.lineTo(tx(i),ty(v)):ctx.moveTo(tx(i),ty(v)));ctx.strokeStyle='#6c8fff';ctx.lineWidth=2;ctx.stroke();
  ctx.setLineDash([3,4]);ctx.strokeStyle='rgba(108,143,255,.45)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tx(curK-1),PT);ctx.lineTo(tx(curK-1),H-PB);ctx.stroke();ctx.setLineDash([]);
  wcss.forEach((v,i)=>{const sel=(i+1)===curK;ctx.beginPath();ctx.arc(tx(i),ty(v),sel?5.5:3.5,0,Math.PI*2);ctx.fillStyle=sel?'#fff':'#6c8fff';ctx.fill();if(sel){ctx.strokeStyle='#6c8fff';ctx.lineWidth=2;ctx.stroke();}});
  ctx.font='10px monospace';ctx.textAlign='center';wcss.forEach((_,i)=>{ctx.fillStyle=(i+1)===curK?'#e2e5f0':'#5e6278';ctx.fillText(`k=${i+1}`,tx(i),H-5);});
  ctx.fillStyle='#5e6278';ctx.textAlign='right';ctx.font='10px monospace';for(let i=0;i<=3;i++)ctx.fillText((wMn+i*wr/3).toFixed(0),PL-5,ty(wMn+i*wr/3)+3);
  ctx.save();ctx.translate(11,H/2);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.fillText('WCSS',0,0);ctx.restore();
}

/* ── Claude API interpretation ── */
const MODEL = "claude-opus-4-8";

async function callClaude(centroidTable, numCols, catCols, algo, clusterSizes, apiKey) {
  const centroidDesc = centroidTable.map((row, i) => {
    const numParts = numCols.map(c => `${c}=${typeof row[c]==='number'?row[c].toFixed(2):row[c]}`);
    const catParts = catCols.map(c => `${c}=${row[c]}`);
    return `Cluster ${i+1} (n=${clusterSizes[i]}): ${[...numParts,...catParts].join(', ')}`;
  }).join('\n');

  const prompt = `You are a marketing analytics expert helping interpret customer segmentation results.

Algorithm used: ${algo}
Number of clusters: ${centroidTable.length}

Cluster centroids (numerical = means, categorical = modes):
${centroidDesc}

For each cluster provide:
1. A short memorable name (2-4 words, like a customer persona)
2. 2-3 sentences describing who these customers are based on the centroid values
3. One concrete marketing recommendation for this segment

Format your response as JSON array like this (no markdown, pure JSON):
[
  {
    "cluster": 1,
    "name": "Persona Name",
    "description": "Who they are...",
    "recommendation": "Marketing action..."
  }
]`;

  // The artifact version called api.anthropic.com with no Authorization header —
  // that only works inside the Claude artifact sandbox, which authenticates it for you.
  // On a static site the student supplies their own key. dangerouslyAllowBrowser is
  // required for any browser-side call; here the key is the student's own and is never
  // persisted or sent anywhere but Anthropic.
  // Loaded on demand: students who never touch the optional AI step never download the SDK.
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const data = await client.messages.create({
    model: MODEL,
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }]
  });
  const text = data.content?.find(b=>b.type==='text')?.text || '';
  // Strip markdown code fences if present
  const clean = text.replace(/```json|```/g,'').trim();
  return JSON.parse(clean);
}

/* ── App ── */
export default function ClusteringLab(){
  const [apiKey,setApiKey]=useState("");
  const [showKey,setShowKey]=useState(false);
  const xlsxReady=true; // SheetJS is bundled now, not fetched from a CDN
  const [algo,setAlgo]=useState('kmeans');
  const [step,setStep]=useState('upload');
  const [rawData,setRawData]=useState([]);
  const [cleanData,setCleanData]=useState([]);
  const [headers,setHeaders]=useState([]);
  const [numCols,setNumCols]=useState([]);
  const [catCols,setCatCols]=useState([]);
  const [selCat,setSelCat]=useState([]);
  const [missing,setMissing]=useState({});
  const [strategy,setStrategy]=useState({});
  const [wbState,setWbState]=useState(null);
  const [sheets,setSheets]=useState([]);
  const [selSheet,setSelSheet]=useState('');
  const [colX,setColX]=useState('');
  const [colY,setColY]=useState('');
  const [gamma,setGamma]=useState(1);
  const [K,setK]=useState(3);
  const [nI,setNI]=useState(10);
  const [mIt,setMIt]=useState(100);
  const [eMax,setEMax]=useState(8);
  const [running,setRunning]=useState(false);
  const [stats,setStats]=useState(null);
  const [elbowPts,setElbowPts]=useState([]);
  const [result,setResult]=useState(null);
  const [centroidTable,setCentroidTable]=useState(null); // [{col:val,...}] per cluster
  const [clusterSizes,setClusterSizes]=useState([]);
  const [interpretation,setInterpretation]=useState(null);
  const [interpreting,setInterpreting]=useState(false);
  const [msg,setMsg]=useState('');
  const scRef=useRef(null);
  const elRef=useRef(null);
  const bottomRef=useRef(null);

  useEffect(()=>{
    if(result&&scRef.current){
      const cv=scRef.current;cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;
      drawScatter(cv,result.pts,result.asgn,result.cents,K,colX,colY);
    }
  },[result]);

  useEffect(()=>{
    if(elbowPts.length&&elRef.current){
      const cv=elRef.current;cv.width=cv.offsetWidth;cv.height=cv.offsetHeight;
      drawElbow(cv,elbowPts,K);
    }
  },[elbowPts]);

  /* ── file ── */
  function onFile(e){const f=e.target.files[0];if(f)readFile(f);}
  function onDrop(e){e.preventDefault();const f=e.dataTransfer.files[0];if(f)readFile(f);}

  function readFile(file){
    const ext=file.name.split('.').pop().toLowerCase();
    const rd=new FileReader();
    if(ext==='csv'){rd.onload=ev=>parseCSV(ev.target.result);rd.readAsText(file);}
    else{
      rd.onload=ev=>{
        const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
        setWbState(wb);setSheets(wb.SheetNames);setSelSheet(wb.SheetNames[0]);
        ingestSheet(wb,wb.SheetNames[0]);
      };
      rd.readAsArrayBuffer(file);
    }
  }

  function ingestSheet(wb,sn){
    const ws=wb.Sheets[sn];
    const arr=XLSX.utils.sheet_to_json(ws,{header:1,defval:''});
    if(!arr.length)return;
    const hdrs=arr[0].map(h=>String(h||'').trim()).filter(h=>h);
    const rows=arr.slice(1).filter(r=>r.some(v=>v!=='')).map(r=>{
      const o={};hdrs.forEach((h,i)=>o[h]=r[i]===undefined?'':String(r[i]).trim());return o;
    });
    ingest(hdrs,rows);
  }

  function parseCSV(text){
    const lines=text.trim().split(/\r?\n/).filter(l=>l.trim());
    const hdrs=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
    const rows=lines.slice(1).map(l=>{
      const v=l.split(',').map(s=>s.trim().replace(/^"|"$/g,''));
      const o={};hdrs.forEach((h,i)=>o[h]=v[i]??'');return o;
    }).filter(r=>Object.values(r).some(v=>v!==''));
    ingest(hdrs,rows);
  }

  function ingest(hdrs,rows){
    const nums=hdrs.filter(h=>{
      const ne=rows.filter(r=>!isMiss(r[h]));
      return ne.length>0&&ne.every(r=>!isNaN(parseFloat(r[h])));
    });
    const cats=hdrs.filter(h=>!nums.includes(h));
    const miss={};
    hdrs.forEach(h=>{const c=rows.filter(r=>isMiss(r[h])).length;if(c>0)miss[h]={count:c,isNum:nums.includes(h)};});
    const strats={};
    Object.entries(miss).forEach(([h,{isNum}])=>strats[h]=isNum?'mean':'mode');
    setHeaders(hdrs);setRawData(rows);setCleanData(rows.map(r=>({...r})));
    setNumCols(nums);setCatCols(cats);setSelCat([...cats]);
    setMissing(miss);setStrategy(strats);
    setColX(nums[0]||'');setColY(nums[1]||nums[0]||'');
    setStep(Object.keys(miss).length?'clean':'run');
    setInterpretation(null);setCentroidTable(null);setResult(null);setElbowPts([]);
    setMsg(`Loaded ${rows.length} rows · ${nums.length} numerical · ${cats.length} categorical`);
  }

  function applyImpute(){
    let rows=rawData.map(r=>({...r}));
    Object.entries(strategy).forEach(([h,st])=>{
      if(st==='drop'){rows=rows.filter(r=>!isMiss(r[h]));}
      else if(numCols.includes(h)){
        const vals=rows.filter(r=>!isMiss(r[h])).map(r=>parseFloat(r[h]));
        const fill=st==='mean'?meanOf(vals):st==='median'?medOf(vals):0;
        rows.forEach(r=>{if(isMiss(r[h]))r[h]=+fill.toFixed(4);});
      } else {
        const vals=rows.filter(r=>!isMiss(r[h])).map(r=>r[h]);
        const fill=st==='mode'?modeOf(vals):'Unknown';
        rows.forEach(r=>{if(isMiss(r[h]))r[h]=fill;});
      }
    });
    setCleanData(rows);setStep('run');setMsg(`Cleaned · ${rows.length} rows ready`);
  }

  function toggleCat(col){setSelCat(p=>p.includes(col)?p.filter(c=>c!==col):[...p,col]);}

  async function run(){
    const rows=cleanData.length?cleanData:rawData;
    if(!rows.length){setMsg('⚠ Load data first');return;}
    setRunning(true);setMsg('Running…');setInterpretation(null);setCentroidTable(null);
    await new Promise(r=>setTimeout(r,20));

    const scPts=rows.map(r=>[parseFloat(r[colX])||0,parseFloat(r[colY])||0]);
    let asgn,cents,res;
    let fullNumCols=numCols; // all numerical cols used
    let fullCatCols=[];      // cat cols used (kproto)
    let fullNumCents=[];     // centroids for all numerical cols
    let fullCatCents=[];     // centroids for categorical cols

    if(algo==='kmeans'){
      // For K-means, compute centroids over ALL numerical columns (not just x,y)
      const allN=numCols;
      const allNPts=rows.map(r=>allN.map(c=>parseFloat(r[c])||0));
      res=kMeansBest(allNPts,K,nI,mIt);
      asgn=res.a;
      fullNumCents=res.c; // centroids over all numerical dims
      // For scatter plot, extract x,y dims
      const xi=allN.indexOf(colX),yi=allN.indexOf(colY);
      cents=res.c.map(c=>[xi>=0?c[xi]:c[0],yi>=0?c[yi]:c[Math.min(1,c.length-1)]]);
    } else {
      fullCatCols=selCat;
      const allN=numCols.filter(c=>!selCat.includes(c));
      if(!allN.length){setMsg('⚠ Need numerical columns');setRunning(false);return;}
      const nPts=rows.map(r=>allN.map(c=>parseFloat(r[c])||0));
      const cPts=rows.map(r=>selCat.map(c=>String(r[c]||'')));
      res=kProtoBest(nPts,cPts,K,gamma,nI,mIt);
      asgn=res.a;
      fullNumCents=res.nc;
      fullCatCents=res.cc;
      fullNumCols=allN;
      const xi=allN.indexOf(colX),yi=allN.indexOf(colY);
      cents=res.nc.map(c=>[xi>=0?c[xi]:c[0],yi>=0?c[yi]:c[Math.min(1,c.length-1)]]);
    }

    // Build centroid table rows: one per cluster
    const table=Array.from({length:K},(_,ci)=>{
      const row={};
      fullNumCols.forEach((c,di)=>row[c]=+fullNumCents[ci][di].toFixed(3));
      fullCatCols.forEach((c,di)=>row[c]=fullCatCents[ci]?.[di]??'');
      return row;
    });

    // Cluster sizes
    const sizes=new Array(K).fill(0);
    asgn.forEach(a=>sizes[a]++);

    setResult({pts:scPts,asgn,cents});
    setStats({wcss:res.wcss.toFixed(1),inits:nI,iters:res.it,algo:algo==='kmeans'?'K-Means':'K-Proto'});
    setCentroidTable({table,numCols:fullNumCols,catCols:fullCatCols});
    setClusterSizes(sizes);

    // Elbow
    setMsg('Computing elbow…');await new Promise(r=>setTimeout(r,10));
    const ew=[];
    for(let ek=1;ek<=eMax;ek++){
      if(ek===1){const mx=meanOf(scPts.map(p=>p[0])),my=meanOf(scPts.map(p=>p[1]));ew.push(scPts.reduce((s,p)=>s+eucSq(p,[mx,my]),0));}
      else ew.push(kMeansBest(scPts,ek,Math.max(3,nI),mIt).wcss);
    }
    setElbowPts(ew);
    setRunning(false);
    setMsg(`Done · best of ${nI} runs · WCSS = ${res.wcss.toFixed(2)}`);
  }

  function exportCSV(){
    if(!result||!result.asgn||!cleanData.length){setMsg("Run the clustering first");return;}
    const rows=cleanData.length?cleanData:rawData;
    const esc=v=>{const t=String(v??'');return /[",\n]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t;};
    const out=[[...headers,'Cluster'].map(esc).join(',')];
    rows.forEach((r,i)=>out.push([...headers.map(h=>esc(r[h])),result.asgn[i]+1].join(',')));
    const blob=new Blob([out.join('\n')],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download='clusters_k'+K+'_'+algo+'.csv';
    document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
    setMsg('Exported '+rows.length+' rows with their cluster number');
  }

  async function interpret(){
    if(!centroidTable)return;
    if(!apiKey){setShowKey(true);return;}
    setInterpreting(true);
    setInterpretation(null);
    try{
      const parsed=await callClaude(
        centroidTable.table,
        centroidTable.numCols,
        centroidTable.catCols,
        algo==='kmeans'?'K-Means':'K-Prototypes',
        clusterSizes,
        apiKey
      );
      setInterpretation(parsed);
      setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),100);
    }catch(e){
      setInterpretation([{cluster:0,name:'Error',description:'Could not parse Claude response: '+e.message,recommendation:'Try again.'}]);
    }
    setInterpreting(false);
  }

  /* ── Styles ── */
  const C={bg:'#0d0f14',surf:'#151720',card:'#1c1f2b',bord:'#252836',acc:'#6c8fff',warn:'#ffbb6c',txt:'#e2e5f0',mut:'#5e6278'};
  const inp={width:'100%',background:C.card,border:`1px solid ${C.bord}`,color:C.txt,borderRadius:5,padding:'6px 8px',fontFamily:'system-ui',fontSize:12,outline:'none'};
  const slabel={fontFamily:'monospace',fontSize:10,color:C.mut,textTransform:'uppercase',letterSpacing:'1.4px',marginBottom:6,display:'block'};
  const missCols=Object.keys(missing);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:C.bg,color:C.txt,fontFamily:'system-ui,sans-serif',fontSize:14,overflow:'hidden'}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} input[type=range]{accent-color:#6c8fff} ::-webkit-scrollbar{width:6px;background:transparent} ::-webkit-scrollbar-thumb{background:#252836;border-radius:3px}`}</style>

      {/* Header */}
      <div style={{padding:'11px 20px',borderBottom:`1px solid ${C.bord}`,background:C.surf,display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <strong style={{fontSize:16}}>Clustering Lab</strong>
        {['K-Means','K-Prototypes'].map(t=><span key={t} style={{fontSize:10,padding:'3px 7px',borderRadius:4,background:'rgba(108,143,255,.12)',color:C.acc,border:'1px solid rgba(108,143,255,.3)',fontFamily:'monospace'}}>{t}</span>)}
        <span style={{marginLeft:'auto',fontSize:11,color:C.mut}}>CSV · XLS · XLSX</span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'300px 1fr',flex:1,overflow:'hidden'}}>

        {/* ── Sidebar ── */}
        <div style={{background:C.surf,borderRight:`1px solid ${C.bord}`,padding:14,overflowY:'auto',display:'flex',flexDirection:'column',gap:14}}>

          {/* Algorithm */}
          <div>
            <span style={slabel}>Algorithm</span>
            <div style={{display:'flex',gap:5}}>
              {['kmeans','kproto'].map(a=>(
                <button key={a} onClick={()=>setAlgo(a)} style={{flex:1,padding:'9px 0',borderRadius:6,border:`1px solid ${algo===a?C.acc:C.bord}`,background:algo===a?'rgba(108,143,255,.14)':C.card,color:algo===a?C.acc:C.mut,cursor:'pointer',fontFamily:'system-ui',fontSize:13,fontWeight:500}}>
                  {a==='kmeans'?'K-Means':'K-Prototypes'}
                </button>
              ))}
            </div>
          </div>

          {/* Upload */}
          <div>
            <span style={slabel}>Data</span>
            <div onClick={()=>document.getElementById('_fi').click()}
              onDragOver={e=>e.preventDefault()} onDrop={onDrop}
              style={{border:`1.5px dashed ${headers.length?'#6cffb8':C.bord}`,borderRadius:8,padding:'14px 12px',textAlign:'center',cursor:'pointer',color:headers.length?'#6cffb8':C.mut,fontSize:12,lineHeight:1.7}}>
              {headers.length
                ?<><strong style={{display:'block',marginBottom:2}}>✅ {rawData.length} rows · {headers.length} cols</strong>
                  <span style={{fontSize:11}}>{numCols.length} numerical · {catCols.length} categorical</span></>
                :<><span style={{fontSize:22,display:'block',marginBottom:3}}>📂</span>
                  <strong>Upload CSV, XLS or XLSX</strong><br/>drag &amp; drop or click</>}
            </div>
            <input id="_fi" type="file" accept=".csv,.xls,.xlsx" style={{display:'none'}} onChange={onFile}/>
          </div>

          {sheets.length>1&&(
            <div>
              <span style={slabel}>Sheet</span>
              <select style={inp} value={selSheet} onChange={e=>{setSelSheet(e.target.value);ingestSheet(wbState,e.target.value);}}>
                {sheets.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Clean step */}
          {step==='clean'&&missCols.length>0&&(
            <div style={{background:'rgba(255,187,108,.06)',border:'1px solid rgba(255,187,108,.25)',borderRadius:8,padding:12,display:'flex',flexDirection:'column',gap:8}}>
              <span style={{fontSize:11,color:C.warn,fontFamily:'monospace',fontWeight:600}}>⚠ Missing values — strategy</span>
              {missCols.map(h=>{
                const {count,isNum}=missing[h];
                return(
                  <div key={h} style={{display:'grid',gridTemplateColumns:'1fr 40px 108px',gap:5,alignItems:'center'}}>
                    <span style={{fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.txt}} title={h}>{h}</span>
                    <span style={{fontSize:10,fontFamily:'monospace',color:C.warn,textAlign:'right'}}>{count}×</span>
                    <select style={{...inp,padding:'4px 6px',fontSize:11}} value={strategy[h]||''} onChange={e=>setStrategy(p=>({...p,[h]:e.target.value}))}>
                      {isNum?<><option value="mean">Mean</option><option value="median">Median</option><option value="zero">Zero</option><option value="drop">Drop rows</option></>
                            :<><option value="mode">Mode</option><option value="unk">Unknown</option><option value="drop">Drop rows</option></>}
                    </select>
                  </div>
                );
              })}
              <button onClick={applyImpute} style={{padding:'8px 10px',borderRadius:6,border:`1px solid ${C.warn}`,background:'rgba(255,187,108,.12)',color:C.warn,cursor:'pointer',fontFamily:'system-ui',fontSize:12,fontWeight:600}}>
                ✓ Apply &amp; continue
              </button>
            </div>
          )}

          {/* Run config */}
          {headers.length>0&&step==='run'&&(<>
            <hr style={{border:'none',borderTop:`1px solid ${C.bord}`}}/>
            <div>
              <span style={slabel}>Scatter axes</span>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                {[['X',colX,setColX],['Y',colY,setColY]].map(([lbl,val,fn])=>(
                  <div key={lbl}><div style={{fontSize:11,color:C.mut,marginBottom:3}}>{lbl}</div>
                    <select style={inp} value={val} onChange={e=>fn(e.target.value)}>
                      {numCols.map(c=><option key={c}>{c}</option>)}
                    </select></div>
                ))}
              </div>
            </div>

            {algo==='kproto'&&(
              <div>
                <span style={slabel}>Categorical columns</span>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:4,maxHeight:110,overflowY:'auto'}}>
                  {headers.map(h=>{const on=selCat.includes(h);return(
                    <div key={h} onClick={()=>toggleCat(h)} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,cursor:'pointer',padding:'4px 6px',borderRadius:4,border:`1px solid ${on?C.acc:C.bord}`,background:on?'rgba(108,143,255,.1)':C.bg,color:on?C.acc:C.mut,userSelect:'none',overflow:'hidden'}}>
                      <span>{on?'●':'○'}</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{h}</span>
                    </div>);
                  })}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8,marginTop:8}}>
                  <span style={{fontSize:12,color:C.mut,flex:1}}>γ (gamma) weight</span>
                  <input type="number" style={{...inp,width:65}} value={gamma} min="0" step="0.5" onChange={e=>setGamma(parseFloat(e.target.value)||1)}/>
                </div>
              </div>
            )}

            <hr style={{border:'none',borderTop:`1px solid ${C.bord}`}}/>
            <div>
              <span style={slabel}>Parameters</span>
              {[
                {label:'k — clusters',val:K,fn:setK,min:2,max:10},
                {label:'Initialisations',sub:'best run wins',val:nI,fn:setNI,min:1,max:30},
                {label:'Max iterations',val:mIt,fn:setMIt,min:10,max:300,step:10},
                {label:'Elbow k-max',val:eMax,fn:setEMax,min:2,max:12},
              ].map(({label,sub,val,fn,min,max,step:st=1})=>(
                <div key={label} style={{marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:500,marginBottom:3}}>{label}{sub&&<span style={{color:C.mut,fontWeight:400,fontSize:11}}> ({sub})</span>}</div>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <input type="range" style={{flex:1}} min={min} max={max} step={st} value={val} onChange={e=>fn(+e.target.value)}/>
                    <span style={{fontFamily:'monospace',fontSize:12,color:C.acc,minWidth:26,textAlign:'right'}}>{val}</span>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={run} disabled={running} style={{width:'100%',padding:11,borderRadius:7,border:'none',background:C.acc,color:'#fff',fontFamily:'system-ui',fontSize:14,fontWeight:600,cursor:running?'not-allowed':'pointer',opacity:running?.45:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
              {running?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Running…</>:'▶ Run Clustering'}
            </button>
          </>)}

          {msg&&<div style={{fontSize:11,color:C.mut,fontFamily:'monospace'}}>{msg}</div>}

          {stats&&(
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7}}>
              {[['WCSS (best)',stats.wcss],['Inits run',stats.inits],['Iterations',stats.iters],['Algorithm',stats.algo]].map(([l,v])=>(
                <div key={l} style={{background:C.card,border:`1px solid ${C.bord}`,borderRadius:6,padding:9}}>
                  <div style={{fontSize:10,fontFamily:'monospace',color:C.mut,marginBottom:3}}>{l}</div>
                  <div style={{fontSize:14,fontWeight:600,color:C.acc,fontFamily:'monospace'}}>{v}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Main panel ── */}
        <div style={{overflowY:'auto',display:'flex',flexDirection:'column'}}>

          {/* Scatter + Elbow */}
          <div style={{display:'grid',gridTemplateRows:'1fr 200px',minHeight:520,flexShrink:0}}>
            <div style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:6}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:10,fontFamily:'monospace',color:C.mut,textTransform:'uppercase',letterSpacing:'1.2px'}}>Scatter Plot</span>
                {result&&<div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                  {Array.from({length:K},(_,i)=><span key={i} style={{fontSize:11,color:C.mut,display:'inline-flex',alignItems:'center',gap:4}}>
                    <span style={{width:9,height:9,borderRadius:'50%',background:COLORS[i%10],display:'inline-block'}}/>Cluster {i+1}{clusterSizes[i]!==undefined&&<span style={{color:C.mut}}> ({clusterSizes[i]})</span>}
                  </span>)}
                </div>}
              </div>
              <canvas ref={scRef} style={{background:C.card,border:`1px solid ${C.bord}`,borderRadius:7,flex:1,width:'100%',minHeight:200}}/>
            </div>
            <div style={{background:C.surf,borderTop:`1px solid ${C.bord}`,padding:'10px 18px',display:'flex',flexDirection:'column',gap:5}}>
              <span style={{fontSize:10,fontFamily:'monospace',color:C.mut,textTransform:'uppercase',letterSpacing:'1.2px'}}>Elbow — WCSS vs k {elbowPts.length?`(k=${K} highlighted)`:''}</span>
              <canvas ref={elRef} style={{background:C.card,border:`1px solid ${C.bord}`,borderRadius:7,width:'100%',height:150}}/>
            </div>
          </div>

          {/* ── Centroid Table ── */}
          {centroidTable&&(
            <div style={{padding:'18px 18px 0',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:600}}>Cluster Centroids</span>
                <span style={{fontSize:11,color:C.mut,fontFamily:'monospace'}}>numerical = mean · categorical = mode</span>
              </div>
              <div style={{overflowX:'auto',borderRadius:8,border:`1px solid ${C.bord}`}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                  <thead>
                    <tr style={{background:C.card}}>
                      <th style={{padding:'9px 12px',textAlign:'left',color:C.mut,fontFamily:'monospace',fontSize:10,textTransform:'uppercase',letterSpacing:'1px',borderBottom:`1px solid ${C.bord}`,whiteSpace:'nowrap'}}>Cluster</th>
                      <th style={{padding:'9px 12px',textAlign:'right',color:C.mut,fontFamily:'monospace',fontSize:10,textTransform:'uppercase',letterSpacing:'1px',borderBottom:`1px solid ${C.bord}`,whiteSpace:'nowrap'}}>Size</th>
                      {[...centroidTable.numCols,...centroidTable.catCols].map(c=>(
                        <th key={c} style={{padding:'9px 12px',textAlign:'right',color:C.mut,fontFamily:'monospace',fontSize:10,textTransform:'uppercase',letterSpacing:'1px',borderBottom:`1px solid ${C.bord}`,whiteSpace:'nowrap'}}>
                          {c}
                          <span style={{marginLeft:4,fontSize:9,color:centroidTable.catCols.includes(c)?'#ff6c8f':'#6c8fff',fontWeight:400}}>
                            {centroidTable.catCols.includes(c)?'cat':'num'}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centroidTable.table.map((row,ci)=>(
                      <tr key={ci} style={{borderBottom:`1px solid ${C.bord}`,background:ci%2===0?'transparent':C.surf}}>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap'}}>
                          <span style={{display:'inline-flex',alignItems:'center',gap:7}}>
                            <span style={{width:10,height:10,borderRadius:'50%',background:COLORS[ci%10],display:'inline-block',flexShrink:0}}/>
                            <strong>Cluster {ci+1}</strong>
                          </span>
                        </td>
                        <td style={{padding:'9px 12px',textAlign:'right',fontFamily:'monospace',color:C.mut,fontSize:12}}>{clusterSizes[ci]}</td>
                        {[...centroidTable.numCols,...centroidTable.catCols].map(c=>(
                          <td key={c} style={{padding:'9px 12px',textAlign:'right',fontFamily:'monospace',fontSize:12,color:centroidTable.catCols.includes(c)?'#ff6c8f':C.txt}}>
                            {typeof row[c]==='number'?row[c].toFixed(3):row[c]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Export — always available, no key needed */}
              <div style={{marginTop:14,marginBottom:10,display:'flex',gap:10,flexWrap:'wrap'}}>
                <button onClick={exportCSV}
                  style={{padding:'11px 20px',borderRadius:7,border:`1px solid ${C.bord}`,background:C.card,color:C.txt,fontFamily:'inherit',fontSize:13,fontWeight:600,cursor:'pointer',display:'inline-flex',alignItems:'center',gap:8}}>
                  ⭳ Export data + cluster numbers (CSV)
                </button>
                <button onClick={()=>setShowKey(v=>!v)}
                  style={{padding:'11px 16px',borderRadius:7,border:`1px solid ${C.bord}`,background:'transparent',color:C.mut,fontFamily:'inherit',fontSize:12,cursor:'pointer'}}>
                  {showKey?'Hide':'✦ Optional: name the segments with AI'}
                </button>
              </div>

              {/* Optional AI panel — the tool is fully usable without this */}
              {showKey&&(
                <div style={{marginBottom:14,padding:14,background:C.card,border:`1px solid ${C.bord}`,borderRadius:8}}>
                  <div style={{fontSize:12,color:C.txt,marginBottom:8,lineHeight:1.6}}>
                    <strong>This step is optional.</strong> Read the centroid table above and name the
                    segments yourself — that is the skill this module is about, and it is what your
                    assignment is marked on. Use this only to compare your own naming against a machine's.
                  </div>
                  <div style={{fontSize:11,color:C.mut,marginBottom:10,lineHeight:1.6}}>
                    Needs your own Anthropic API key. It stays in this browser tab, is never saved and is
                    never sent anywhere except Anthropic. <strong style={{color:C.warn}}>Set a spend limit
                    on your key before using it.</strong> Close the tab and the key is gone.
                  </div>
                  <input type="password" value={apiKey} placeholder="sk-ant-..." style={inp}
                    onChange={e=>setApiKey(e.target.value)} />
                </div>
              )}

              <div style={{marginTop:0,marginBottom:18}}>
                <button onClick={interpret} disabled={interpreting||!apiKey}
                  style={{padding:'11px 20px',borderRadius:7,border:'none',background:'linear-gradient(135deg,#6c8fff,#c46cff)',color:'#fff',fontFamily:'system-ui',fontSize:13,fontWeight:600,cursor:interpreting?'not-allowed':'pointer',opacity:interpreting?.5:1,display:'flex',alignItems:'center',gap:8}}>
                  {interpreting
                    ?<><div style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>Asking Claude…</>
                    :<>✦ Interpret clusters with Claude</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Claude Interpretation ── */}
          {interpretation&&(
            <div style={{padding:'0 18px 28px'}} ref={bottomRef}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
                <span style={{fontSize:13,fontWeight:600}}>Claude's Segment Interpretation</span>
                <span style={{fontSize:10,color:C.mut,fontFamily:'monospace',padding:'3px 7px',background:C.card,border:`1px solid ${C.bord}`,borderRadius:4}}>AI-generated · based on centroids</span>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
                {interpretation.map((seg,i)=>{
                  const ci=(seg.cluster-1+interpretation.length)%interpretation.length;
                  const col=COLORS[ci%10];
                  return(
                    <div key={i} style={{background:C.card,border:`1px solid ${C.bord}`,borderRadius:10,padding:16,borderTop:`3px solid ${col}`,display:'flex',flexDirection:'column',gap:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <span style={{width:28,height:28,borderRadius:'50%',background:col+'22',border:`1.5px solid ${col}`,display:'inline-flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:col,flexShrink:0}}>{seg.cluster}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:C.txt,lineHeight:1.2}}>{seg.name}</div>
                          <div style={{fontSize:11,color:C.mut,marginTop:2}}>n = {clusterSizes[ci]} customers</div>
                        </div>
                      </div>
                      <p style={{fontSize:12,color:'#bbbdd0',lineHeight:1.6,margin:0}}>{seg.description}</p>
                      <div style={{background:C.surf,borderRadius:6,padding:'8px 10px',borderLeft:`2px solid ${col}`}}>
                        <div style={{fontSize:10,color:col,fontFamily:'monospace',fontWeight:600,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.8px'}}>Recommendation</div>
                        <p style={{fontSize:12,color:C.txt,margin:0,lineHeight:1.55}}>{seg.recommendation}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
