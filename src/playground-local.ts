import type { Server } from "bun";

export function startPlayground(
  endpoint: string,
  model: string,
  port: number = 3000
): Server {
  const html = buildHTML(endpoint, model);

  return Bun.serve({
    port,
    idleTimeout: 255,
    async fetch(req) {
      const url = new URL(req.url);

      if (url.pathname === "/" || url.pathname === "") {
        return new Response(html, { headers: { "content-type": "text/html" } });
      }

      // Proxy chat requests to vLLM
      if (url.pathname === "/api/chat" && req.method === "POST") {
        const body = await req.json();
        try {
          const res = await fetch(`${endpoint}/v1/chat/completions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model,
              messages: body.messages,
              max_tokens: body.max_tokens ?? 4096,
              temperature: body.temperature ?? 0.7,
              stream: true,
            }),
          });
          // Stream SSE through
          return new Response(res.body, {
            headers: {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
              connection: "keep-alive",
            },
          });
        } catch (err) {
          return Response.json({ error: String(err) }, { status: 502 });
        }
      }

      return new Response("Not found", { status: 404 });
    },
  });
}

export function stopPlayground(server: Server): void {
  server.stop(true);
}

function buildHTML(endpoint: string, model: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>vlmxbox playground</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0a0a0a;color:#e5e5e5;height:100vh;display:flex;flex-direction:column}
header{padding:12px 20px;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center}
header h1{font-size:14px;font-weight:600;color:#888}
header .model{font-size:12px;color:#555;background:#161616;padding:4px 10px;border-radius:6px}
.chat{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px}
.msg{max-width:80%;padding:12px 16px;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap;word-wrap:break-word}
.msg.user{align-self:flex-end;background:#1a3a5c;color:#c5ddf5;border-bottom-right-radius:4px}
.msg.bot{align-self:flex-start;background:#1a1a1a;color:#d4d4d4;border-bottom-left-radius:4px}
.msg.bot.streaming{border-left:2px solid #3b82f6}
.input-area{padding:12px 20px;border-top:1px solid #222;display:flex;gap:8px}
textarea{flex:1;background:#161616;color:#e5e5e5;border:1px solid #333;border-radius:8px;padding:10px 14px;font-size:14px;font-family:inherit;resize:none;outline:none;min-height:44px;max-height:120px}
textarea:focus{border-color:#3b82f6}
button{background:#3b82f6;color:white;border:none;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer;font-weight:500}
button:hover{background:#2563eb}
button:disabled{background:#333;color:#666;cursor:not-allowed}
.thinking{color:#888;font-size:12px;padding:4px 0}
</style>
</head>
<body>
<header>
  <h1>vlmxbox playground</h1>
  <span class="model">${model}</span>
</header>
<div class="chat" id="chat"></div>
<div class="input-area">
  <textarea id="input" placeholder="Type a message..." rows="1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();send()}"></textarea>
  <button id="btn" onclick="send()">Send</button>
</div>
<script>
const chat=document.getElementById('chat');
const input=document.getElementById('input');
const btn=document.getElementById('btn');
let messages=[];
let streaming=false;

input.addEventListener('input',()=>{
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,120)+'px';
});

async function send(){
  const text=input.value.trim();
  if(!text||streaming)return;
  input.value='';input.style.height='auto';

  messages.push({role:'user',content:text});
  addMsg('user',text);

  streaming=true;btn.disabled=true;
  const botEl=addMsg('bot','');
  botEl.classList.add('streaming');

  try{
    const res=await fetch('/api/chat',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({messages,max_tokens:4096})
    });

    const reader=res.body.getReader();
    const decoder=new TextDecoder();
    let full='';let buf='';

    while(true){
      const{value,done}=await reader.read();
      if(done)break;
      buf+=decoder.decode(value,{stream:true});

      const lines=buf.split('\\n');
      buf=lines.pop()||'';

      for(const line of lines){
        if(!line.startsWith('data: '))continue;
        const data=line.slice(6);
        if(data==='[DONE]')continue;
        try{
          const j=JSON.parse(data);
          const delta=j.choices?.[0]?.delta?.content||'';
          full+=delta;
          botEl.textContent=full;
          chat.scrollTop=chat.scrollHeight;
        }catch{}
      }
    }

    messages.push({role:'assistant',content:full});
  }catch(err){
    botEl.textContent='Error: '+err.message;
  }

  botEl.classList.remove('streaming');
  streaming=false;btn.disabled=false;
  input.focus();
}

function addMsg(role,text){
  const el=document.createElement('div');
  el.className='msg '+role;
  el.textContent=text;
  chat.appendChild(el);
  chat.scrollTop=chat.scrollHeight;
  return el;
}

input.focus();
</script>
</body>
</html>`;
}
