const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('dotenv').config({path:path.join(__dirname,'.env'),quiet:true});
const jwt=require('jsonwebtoken');
const {LOGIN_USERNAME,LOGIN_PASSWORD,JWT_SECRET}=process.env;
if(!LOGIN_USERNAME||!LOGIN_PASSWORD||!JWT_SECRET||JWT_SECRET.length<32)throw Error('Set LOGIN_USERNAME, LOGIN_PASSWORD and a JWT_SECRET of at least 32 characters in .env');
const root=path.join(__dirname,'public'),vendor=path.join(__dirname,'node_modules/pdfjs-dist'),sessions=new Map(),attempts=new Map();
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.wasm':'application/wasm','.bcmap':'application/octet-stream','.ttf':'font/ttf'};
const ttl=3600,cookieName='feedback_session';
function equal(a,b){const hash=x=>crypto.createHash('sha256').update(String(x)).digest();return crypto.timingSafeEqual(hash(a),hash(b))}
function cookie(req,value,maxAge){const secure=req.headers['x-forwarded-proto']==='https';return `${cookieName}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure?'; Secure':''}`}
function session(req){try{let token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);let claims=jwt.verify(token,JWT_SECRET,{algorithms:['HS256'],issuer:'feedback-lens',audience:'feedback-lens-browser'});if(claims.sub!==LOGIN_USERNAME||!sessions.has(claims.jti))return null;return claims}catch{return null}}
function json(res,status,data,headers={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...headers});res.end(JSON.stringify(data))}
async function body(req){let chunks=[],size=0;for await(const chunk of req){size+=chunk.length;if(size>4096)throw Error('Request too large');chunks.push(chunk)}return JSON.parse(Buffer.concat(chunks).toString())}
const server=http.createServer(async(req,res)=>{let url;try{url=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return}
res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
if(req.method==='POST'){
 const origin=req.headers.origin;if(origin){try{if(new URL(origin).host!==req.headers.host)return json(res,403,{error:'Request origin is not allowed.'})}catch{return json(res,403,{error:'Invalid origin.'})}}
}
if(url==='/api/auth/login'&&req.method==='POST'){
 const now=Date.now(),key=req.socket.remoteAddress;let rate=attempts.get(key);if(!rate||rate.until<now){rate={count:0,until:now+60000};attempts.set(key,rate)}if(++rate.count>10)return json(res,429,{error:'Too many attempts. Try again in a minute.'},{'Retry-After':'60'});
 try{const {username,password}=await body(req);if(typeof username!=='string'||typeof password!=='string'||!equal(username,LOGIN_USERNAME)||!equal(password,LOGIN_PASSWORD))return json(res,401,{error:'Invalid username or password.'});const jti=crypto.randomUUID(),expiresAt=Date.now()+ttl*1000;sessions.set(jti,expiresAt);const token=jwt.sign({},JWT_SECRET,{algorithm:'HS256',expiresIn:ttl,subject:LOGIN_USERNAME,issuer:'feedback-lens',audience:'feedback-lens-browser',jwtid:jti});return json(res,200,{username:LOGIN_USERNAME,expiresAt},{'Set-Cookie':cookie(req,token,ttl)})}catch{return json(res,400,{error:'Invalid login request.'})}
}
if(url==='/api/auth/session'&&req.method==='GET'){let user=session(req);return user?json(res,200,{username:user.sub,expiresAt:user.exp*1000}):json(res,401,{error:'Please sign in.'})}
if(url==='/api/auth/logout'&&req.method==='POST'){let user=session(req);if(user)sessions.delete(user.jti);return json(res,200,{ok:true},{'Set-Cookie':cookie(req,'',0)})}
if(url.startsWith('/api/'))return json(res,404,{error:'Not found'});
if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return}
if(url.startsWith('/vendor/')&&!session(req))return json(res,401,{error:'Please sign in.'});
let base=url.startsWith('/vendor/')?vendor:root;let relative=url.startsWith('/vendor/')?url.slice(8):url;let file=path.resolve(base,'.'+(relative==='/'?'/index.html':relative.startsWith('/')?relative:'/'+relative));if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return}fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res)})});
setInterval(()=>{const now=Date.now();for(const[k,v]of sessions)if(v<now)sessions.delete(k);for(const[k,v]of attempts)if(v.until<now)attempts.delete(k)},60000).unref();
server.listen(Number(process.env.PORT)||4318,'127.0.0.1',()=>console.log('Feedback Lens running at http://127.0.0.1:'+(process.env.PORT||4318)));
