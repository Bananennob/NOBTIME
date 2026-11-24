// NOBTIME community server (Cloudflare Worker + D1). Bind your D1 database as "DB".
const SCHEMA=[
"CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,u TEXT NOT NULL,ulc TEXT NOT NULL UNIQUE,salt TEXT,hash TEXT,rs TEXT,rh TEXT,created INTEGER,prof TEXT,pub TEXT,img TEXT,seen INTEGER,fn INTEGER DEFAULT 0,ft INTEGER DEFAULT 0)",
"CREATE TABLE IF NOT EXISTS tokens(th TEXT PRIMARY KEY,uid TEXT,created INTEGER)",
"CREATE TABLE IF NOT EXISTS sync(uid TEXT,idx INTEGER,part TEXT,ts INTEGER,PRIMARY KEY(uid,idx))",
"CREATE TABLE IF NOT EXISTS friends(a TEXT,b TEXT,st TEXT,ts INTEGER,PRIMARY KEY(a,b))",
"CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY,kind TEXT,name TEXT,owner TEXT,code TEXT,created INTEGER)",
"CREATE TABLE IF NOT EXISTS members(room TEXT,uid TEXT,joined INTEGER,PRIMARY KEY(room,uid))",
"CREATE TABLE IF NOT EXISTS msgs(id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT,uid TEXT,txt TEXT,att TEXT,ts INTEGER)",
"CREATE INDEX IF NOT EXISTS msgs_room ON msgs(room,id)",
"CREATE TABLE IF NOT EXISTS rx(msg INTEGER,uid TEXT,k TEXT,PRIMARY KEY(msg,uid,k))",
"INSERT OR IGNORE INTO rooms(id,kind,name,owner,code,created) VALUES('global','global','Global','',NULL,0)"];
let ready=false;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization,Content-Type','Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Max-Age':'86400'};
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{...CORS,'Content-Type':'application/json'}});
const ER=(m,s=400)=>J({error:m},s);
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const rnd=n=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return a};
const b64=a=>btoa(String.fromCharCode(...new Uint8Array(a)));
async function pw(p,salt){const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(p),'PBKDF2',false,['deriveBits']);return b64(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},k,256))}
const sha=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const rcGen=()=>{const al='ABCDEFGHJKLMNPQRSTUVWXYZ23456789',r=rnd(12);let s='';for(let i=0;i<12;i++){s+=al[r[i]%al.length];if(i%4==3&&i<11)s+='-'}return s};
const rcN=s=>String(s||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
const uid=()=>hex(rnd(8));
const pj=(s,d)=>{try{return s?JSON.parse(s):d}catch(e){return d}};
const NAME=/^[A-Za-z0-9_.-]{3,20}$/;
const now=()=>Date.now();
const pubU=r=>({id:r.id,u:r.u,prof:pj(r.prof,{}),pub:pj(r.pub,{}),seen:r.seen||0});
export default{async fetch(req,env){
 if(req.method=='OPTIONS')return new Response(null,{headers:CORS});
 const url=new URL(req.url),P=url.pathname.replace(/\/+$/,''),DB=env.DB;
 if(!DB)return ER('DB binding missing',500);
 if(!ready){for(const q of SCHEMA)await DB.prepare(q).run();ready=true}
 if(P=='/api/ping')return J({ok:true,v:1});
 let body={};if(req.method!='GET'){try{body=await req.json()}catch(e){body={}}}
 const q=(s,...a)=>DB.prepare(s).bind(...a);
 // auth-free
 if(P=='/api/register'&&req.method=='POST'){const u=String(body.u||'').trim(),p=String(body.p||'');if(!NAME.test(u))return ER('bad_username');if(p.length<6)return ER('bad_password');if(await q('SELECT 1 FROM users WHERE ulc=?',u.toLowerCase()).first())return ER('taken',409);
  const id=uid(),salt=b64(rnd(16)),rs=b64(rnd(16)),rc=rcGen(),t=now();await q('INSERT INTO users(id,u,ulc,salt,hash,rs,rh,created,prof,pub,seen) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,u,u.toLowerCase(),salt,await pw(p,salt),rs,await pw(rcN(rc),rs),t,JSON.stringify({n:u}),'{}',t).run();
  await q('INSERT OR IGNORE INTO members(room,uid,joined) VALUES(\'global\',?,?)',id,t).run();const tk=hex(rnd(24));await q('INSERT INTO tokens(th,uid,created) VALUES(?,?,?)',await sha(tk),id,t).run();return J({token:tk,rc,id,u})}
 if(P=='/api/login'&&req.method=='POST'){const u=String(body.u||'').trim().toLowerCase(),r=await q('SELECT * FROM users WHERE ulc=?',u).first();if(r&&r.fn>=5&&now()<r.ft)return ER('wait',429);
  if(!r||(await pw(String(body.p||''),r.salt))!==r.hash){if(r){const n=(r.fn||0)+1;await q('UPDATE users SET fn=?,ft=? WHERE id=?',n,n>=5?now()+30000:0,r.id).run()}return ER('bad_login',401)}
  await q('UPDATE users SET fn=0,ft=0,seen=? WHERE id=?',now(),r.id).run();const tk=hex(rnd(24));await q('INSERT INTO tokens(th,uid,created) VALUES(?,?,?)',await sha(tk),r.id,now()).run();return J({token:tk,id:r.id,u:r.u})}
 if(P=='/api/reset'&&req.method=='POST'){const u=String(body.u||'').trim().toLowerCase(),r=await q('SELECT * FROM users WHERE ulc=?',u).first();if(r&&r.fn>=5&&now()<r.ft)return ER('wait',429);
  if(!r||(await pw(rcN(body.rc),r.rs))!==r.rh){if(r){const n=(r.fn||0)+1;await q('UPDATE users SET fn=?,ft=? WHERE id=?',n,n>=5?now()+30000:0,r.id).run()}return ER('bad_reset',401)}
  const np=String(body.np||'');if(np.length<6)return ER('bad_password');const salt=b64(rnd(16)),rs=b64(rnd(16)),rc=rcGen();await q('UPDATE users SET salt=?,hash=?,rs=?,rh=?,fn=0,ft=0 WHERE id=?',salt,await pw(np,salt),rs,await pw(rcN(rc),rs),r.id).run();await q('DELETE FROM tokens WHERE uid=?',r.id).run();
  const tk=hex(rnd(24));await q('INSERT INTO tokens(th,uid,created) VALUES(?,?,?)',await sha(tk),r.id,now()).run();return J({token:tk,rc,id:r.id,u:r.u})}
 // public reads
 if(P=='/api/top'&&req.method=='GET'){const m=url.searchParams.get('m')||'b',asc=m!='n'&&m!='ls'?1:0,path={b:'$.st.b',a5:'$.st.a5',a12:'$.st.a12',n:'$.st.n',ls:'$.st.ls'}[m]||'$.st.b';
  const rows=(await q(`SELECT id,u,prof,pub,seen FROM users WHERE json_extract(pub,'${path}') IS NOT NULL ORDER BY CAST(json_extract(pub,'${path}') AS REAL) ${asc?'ASC':'DESC'} LIMIT 25`).all()).results||[];return J({list:rows.map(pubU)})}
 if(P=='/api/profiles'&&req.method=='GET'){const ids=(url.searchParams.get('ids')||'').split(',').filter(x=>/^[a-f0-9]{16}$/.test(x)).slice(0,50),img=url.searchParams.get('img')=='1';if(!ids.length)return J({list:[]});const rows=(await q(`SELECT id,u,prof,pub,seen${img?',img':''} FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`,...ids).all()).results||[];return J({list:rows.map(r=>({...pubU(r),img:img?r.img||'':undefined}))})}
 if(P=='/api/users'&&req.method=='GET'){const s=(url.searchParams.get('q')||'').toLowerCase().replace(/[^a-z0-9_.-]/g,'').slice(0,20);if(!s)return J({list:[]});const rows=(await q('SELECT id,u,prof,pub,seen FROM users WHERE ulc LIKE ? ORDER BY ulc LIMIT 20',s+'%').all()).results||[];return J({list:rows.map(pubU)})}
 // auth
 const ah=req.headers.get('Authorization')||'',tk=ah.startsWith('Bearer ')?ah.slice(7):'';const tr=tk?await q('SELECT uid FROM tokens WHERE th=?',await sha(tk)).first():null;
 const ME=tr?await q('SELECT * FROM users WHERE id=?',tr.uid).first():null;
 const gm=async(room)=>room=='global'||!!(ME&&await q('SELECT 1 FROM members WHERE room=? AND uid=?',room,ME.id).first());
 if(P=='/api/msgs'&&req.method=='GET'){const room=url.searchParams.get('room')||'global',after=+url.searchParams.get('after')||0,lim=Math.min(100,+url.searchParams.get('limit')||50);if(!(room=='global'||(ME&&await q('SELECT 1 FROM members WHERE room=? AND uid=?',room,ME.id).first())))return ER('forbidden',403);
  let rows;if(after)rows=(await q('SELECT id,uid,txt,att,ts FROM msgs WHERE room=? AND id>? ORDER BY id ASC LIMIT ?',room,after,lim).all()).results;else rows=((await q('SELECT id,uid,txt,att,ts FROM msgs WHERE room=? ORDER BY id DESC LIMIT ?',room,lim).all()).results||[]).reverse();
  return J({list:(rows||[]).map(r=>({id:r.id,uid:r.uid,txt:r.txt,att:pj(r.att,null),ts:r.ts}))})}
 if(!ME)return ER('auth',401);
 await q('UPDATE users SET seen=? WHERE id=?',now(),ME.id).run();
 if(P=='/api/me'&&req.method=='GET')return J({id:ME.id,u:ME.u,prof:pj(ME.prof,{}),pub:pj(ME.pub,{}),img:ME.img||'',created:ME.created});
 if(P=='/api/profile'&&req.method=='PUT'){const prof=JSON.stringify(body.prof||{}),pub=JSON.stringify(body.pub||{});if(prof.length>4000||pub.length>6000)return ER('too_big');let img=ME.img;if(body.img!==undefined){img=String(body.img||'');if(img.length>70000||(img&&!img.startsWith('data:image/')))return ER('bad_img')}await q('UPDATE users SET prof=?,pub=?,img=? WHERE id=?',prof,pub,img,ME.id).run();return J({ok:true})}
 if(P=='/api/sync'&&req.method=='GET'){const rows=(await q('SELECT idx,part,ts FROM sync WHERE uid=? ORDER BY idx',ME.id).all()).results||[];return J({ts:rows.length?rows[0].ts:0,parts:rows.map(r=>r.part)})}
 if(P=='/api/sync'&&req.method=='PUT'){const parts=Array.isArray(body.parts)?body.parts:[];if(parts.length>12||parts.some(x=>typeof x!='string'||x.length>450000))return ER('too_big');const ts=now();await q('DELETE FROM sync WHERE uid=?',ME.id).run();for(let i=0;i<parts.length;i++)await q('INSERT INTO sync(uid,idx,part,ts) VALUES(?,?,?,?)',ME.id,i,parts[i],ts).run();return J({ok:true,ts})}
 if(P=='/api/password'&&req.method=='POST'){if((await pw(String(body.op||''),ME.salt))!==ME.hash)return ER('bad_login',401);const np=String(body.np||'');if(np.length<6)return ER('bad_password');const salt=b64(rnd(16));await q('UPDATE users SET salt=?,hash=? WHERE id=?',salt,await pw(np,salt),ME.id).run();return J({ok:true})}
 if(P=='/api/delete'&&req.method=='POST'){if((await pw(String(body.p||''),ME.salt))!==ME.hash)return ER('bad_login',401);for(const t of['tokens','sync','members','msgs'])await q(`DELETE FROM ${t} WHERE ${t=='tokens'||t=='sync'||t=='members'||t=='msgs'?'uid':'uid'}=?`,ME.id).run();await q('DELETE FROM friends WHERE a=? OR b=?',ME.id,ME.id).run();await q('DELETE FROM users WHERE id=?',ME.id).run();return J({ok:true})}
 if(P=='/api/logout'&&req.method=='POST'){await q('DELETE FROM tokens WHERE th=?',await sha(tk)).run();return J({ok:true})}
 // friends
 if(P=='/api/friends'&&req.method=='GET'){const rows=(await q('SELECT a,b,st FROM friends WHERE a=? OR b=?',ME.id,ME.id).all()).results||[];const ids=rows.map(r=>r.a==ME.id?r.b:r.a);let us=[];if(ids.length)us=(await q(`SELECT id,u,prof,pub,seen FROM users WHERE id IN (${ids.map(()=>'?').join(',')})`,...ids).all()).results||[];const m={};us.forEach(x=>m[x.id]=x);
  return J({list:rows.map(r=>{const o=r.a==ME.id?r.b:r.a,x=m[o];return x?{...pubU(x),st:r.st=='ok'?'ok':(r.a==ME.id?'out':'in')}:null}).filter(Boolean)})}
 if(P=='/api/friend'&&req.method=='POST'){const tid=String(body.id||''),act=body.act;const tu=await q('SELECT id FROM users WHERE id=?',tid).first();if(!tu||tid==ME.id)return ER('nouser',404);const fa=await q('SELECT * FROM friends WHERE a=? AND b=?',ME.id,tid).first(),fb=await q('SELECT * FROM friends WHERE a=? AND b=?',tid,ME.id).first();
  if(act=='add'){if(fa||fb&&fb.st=='ok')return J({ok:true,st:'ok'});if(fb){await q('UPDATE friends SET st=\'ok\',ts=? WHERE a=? AND b=?',now(),tid,ME.id).run();return J({ok:true,st:'ok'})}await q('INSERT INTO friends(a,b,st,ts) VALUES(?,?,\'p\',?)',ME.id,tid,now()).run();return J({ok:true,st:'out'})}
  if(act=='accept'){if(fb&&fb.st=='p'){await q('UPDATE friends SET st=\'ok\',ts=? WHERE a=? AND b=?',now(),tid,ME.id).run();return J({ok:true})}return ER('none',404)}
  if(act=='remove'){await q('DELETE FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)',ME.id,tid,tid,ME.id).run();return J({ok:true})}return ER('bad_act')}
 // rooms
 if(P=='/api/rooms'&&req.method=='GET'){const rows=(await q('SELECT r.id,r.kind,r.name,r.owner,r.code,(SELECT MAX(id) FROM msgs WHERE room=r.id) AS last,(SELECT COUNT(*) FROM members WHERE room=r.id) AS n FROM rooms r JOIN members m ON m.room=r.id WHERE m.uid=? ORDER BY r.kind,r.name',ME.id).all()).results||[];
  const out=[];for(const r of rows){const o={id:r.id,kind:r.kind,name:r.name,owner:r.owner,code:r.owner==ME.id?r.code:null,last:r.last||0,n:r.n};if(r.kind=='dm'){const oid=r.id.split(':').slice(1).find(x=>x!=ME.id);o.other=oid}out.push(o)}return J({list:out})}
 if(P=='/api/room'&&req.method=='POST'){const name=String(body.name||'').trim().slice(0,24);if(name.length<2)return ER('bad_name');const cnt=await q('SELECT COUNT(*) c FROM members m JOIN rooms r ON r.id=m.room WHERE m.uid=? AND r.kind=\'group\'',ME.id).first();if(cnt.c>=20)return ER('limit');const id='g'+uid(),code=hex(rnd(3)).toUpperCase();await q('INSERT INTO rooms(id,kind,name,owner,code,created) VALUES(?,\'group\',?,?,?,?)',id,name,ME.id,code,now()).run();await q('INSERT INTO members(room,uid,joined) VALUES(?,?,?)',id,ME.id,now()).run();return J({id,code,name})}
 if(P=='/api/join'&&req.method=='POST'){const code=String(body.code||'').trim().toUpperCase(),r=await q('SELECT id,name FROM rooms WHERE code=? AND kind=\'group\'',code).first();if(!r)return ER('nocode',404);const n=await q('SELECT COUNT(*) c FROM members WHERE room=?',r.id).first();if(n.c>=200)return ER('full');await q('INSERT OR IGNORE INTO members(room,uid,joined) VALUES(?,?,?)',r.id,ME.id,now()).run();return J({id:r.id,name:r.name})}
 if(P=='/api/leave'&&req.method=='POST'){const room=String(body.room||'');if(room=='global')return ER('no');await q('DELETE FROM members WHERE room=? AND uid=?',room,ME.id).run();const n=await q('SELECT COUNT(*) c FROM members WHERE room=?',room).first();if(!n.c){await q('DELETE FROM rooms WHERE id=?',room).run();await q('DELETE FROM msgs WHERE room=?',room).run()}return J({ok:true})}
 if(P=='/api/members'&&req.method=='GET'){const room=url.searchParams.get('room')||'';if(!await gm(room))return ER('forbidden',403);const rows=(await q('SELECT u.id,u.u,u.prof,u.pub,u.seen FROM members m JOIN users u ON u.id=m.uid WHERE m.room=? LIMIT 200',room).all()).results||[];return J({list:rows.map(pubU)})}
 if(P=='/api/dm'&&req.method=='POST'){const oid=String(body.id||'');const f=await q('SELECT st FROM friends WHERE (a=? AND b=?) OR (a=? AND b=?)',ME.id,oid,oid,ME.id).first();if(!f||f.st!='ok')return ER('notfriends',403);const ids=[ME.id,oid].sort(),id='dm:'+ids[0]+':'+ids[1];await q('INSERT OR IGNORE INTO rooms(id,kind,name,owner,code,created) VALUES(?,\'dm\',\'\',\'\',NULL,?)',id,now()).run();for(const x of ids)await q('INSERT OR IGNORE INTO members(room,uid,joined) VALUES(?,?,?)',id,x,now()).run();return J({id})}
 if(P=='/api/msg'&&req.method=='POST'){const room=String(body.room||'global'),txt=String(body.txt||'').trim().slice(0,300);if(!txt&&!body.att)return ER('empty');if(!await gm(room))return ER('forbidden',403);const l=await q('SELECT MAX(ts) t FROM msgs WHERE uid=?',ME.id).first();if(l&&l.t&&now()-l.t<800)return ER('slow',429);const att=body.att?JSON.stringify(body.att).slice(0,1500):null;const r=await q('INSERT INTO msgs(room,uid,txt,att,ts) VALUES(?,?,?,?,?)',room,ME.id,txt,att,now()).run();return J({ok:true,id:r.meta&&r.meta.last_row_id})}
 if(P=='/api/react'&&req.method=='POST'){const id=+body.msg,k=String(body.k||'');if(!id||!/^[a-z]{2,10}$/.test(k))return ER('bad');const m=await q('SELECT room FROM msgs WHERE id=?',id).first();if(!m||!await gm(m.room))return ER('forbidden',403);const ex=await q('SELECT 1 x FROM rx WHERE msg=? AND uid=? AND k=?',id,ME.id,k).first();if(ex)await q('DELETE FROM rx WHERE msg=? AND uid=? AND k=?',id,ME.id,k).run();else{const c=await q('SELECT COUNT(*) n FROM rx WHERE msg=? AND uid=?',id,ME.id).first();if(c&&c.n>=3)return ER('toomany');await q('INSERT INTO rx(msg,uid,k) VALUES(?,?,?)',id,ME.id,k).run()}return J({ok:true})}
 if(P=='/api/reacts'&&req.method=='GET'){const room=url.searchParams.get('room')||'global';if(!await gm(room))return ER('forbidden',403);const ids=((await q('SELECT id FROM msgs WHERE room=? ORDER BY id DESC LIMIT 80',room).all()).results||[]).map(r=>r.id);const out={},my={};if(ids.length){const rows=(await q('SELECT msg,k,COUNT(*) n,MAX(uid=?) me FROM rx WHERE msg IN ('+ids.map(()=>'?').join(',')+') GROUP BY msg,k',ME.id,...ids).all()).results||[];rows.forEach(r=>{(out[r.msg]=out[r.msg]||{})[r.k]=r.n;if(r.me)(my[r.msg]=my[r.msg]||[]).push(r.k)})}return J({rx:out,my})}
 if(P=='/api/pb'&&req.method=='POST'){const t=Math.round(+body.t),z=String(body.z||'').slice(0,12),ty=body.ty=='ao5'?'ao5':'single';if(!(t>0&&t<36000000)||!/^[A-Za-z0-9_]{1,12}$/.test(z))return ER('bad');const l=await q("SELECT MAX(ts) t FROM msgs WHERE uid=? AND att LIKE '%\"k\":\"pb\"%'",ME.id).first();if(l&&l.t&&now()-l.t<30000)return ER('slow',429);const r=await q('INSERT INTO msgs(room,uid,txt,att,ts) VALUES(?,?,?,?,?)','global',ME.id,'',JSON.stringify({k:'pb',t,z,ty}),now()).run();return J({ok:true,id:r.meta&&r.meta.last_row_id})}
 return ER('notfound',404)}};
