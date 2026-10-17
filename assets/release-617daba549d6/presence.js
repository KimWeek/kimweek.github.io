const STATES = new Set(['online','idle','dnd','offline']);

export function subscribePresence(userId,onStatus,onUnavailable=()=>{}) {
  let socket,heartbeat=0,retry=0,deadline=0,pollTimer=0,controller;
  let disposed=false,active=true,live=false,attempt=0,revision=0,known=false,lastStatus;
  const visible=()=>!disposed&&active&&!document.hidden&&navigator.onLine!==false;
  function publish(data){
    if(!STATES.has(data?.discord_status))return false;
    if(data.discord_user?.id&&data.discord_user.id!==userId)return false;
    revision++;known=true;if(lastStatus!==data.discord_status){lastStatus=data.discord_status;onStatus(lastStatus);}return true;
  }
  function clearSocket(){
    clearInterval(heartbeat);clearTimeout(deadline);heartbeat=deadline=0;live=false;
    if(socket){const old=socket;socket=null;old.onopen=old.onmessage=old.onclose=old.onerror=null;old.close();}
  }
  function pause(){
    clearTimeout(retry);clearTimeout(pollTimer);retry=pollTimer=0;
    controller?.abort();controller=null;clearSocket();
  }
  async function poll(){
    if(!visible()||live||controller)return;
    clearTimeout(pollTimer);pollTimer=0;
    const request=new AbortController(),sample=revision;controller=request;
    const timeout=setTimeout(()=>request.abort(),8000);
    try{
      const response=await fetch(`https://api.lanyard.rest/v1/users/${userId}`,{cache:'no-store',signal:request.signal});
      if(!response.ok)throw new Error('Presence unavailable');
      const payload=await response.json();
      if(!request.signal.aborted&&visible()&&!live&&sample===revision&&(!payload.success||!publish(payload.data)))throw new Error('Invalid presence');
    }catch{if(!known&&!request.signal.aborted&&visible())onUnavailable();}
    finally{
      clearTimeout(timeout);if(controller===request)controller=null;
      if(visible()&&!live)pollTimer=setTimeout(poll,20000);
    }
  }
  function reconnect(){
    clearSocket();
    if(!visible()||retry)return;
    retry=setTimeout(()=>{retry=0;connect();},Math.min(30000,1000*2**Math.min(attempt++,5)));
    poll();
  }
  function connect(){
    if(!visible()||socket)return;
    let current;
    try{current=new WebSocket('wss://api.lanyard.rest/socket');socket=current;}catch{reconnect();return;}
    deadline=setTimeout(()=>{if(socket===current)reconnect();},8000);
    current.onmessage=event=>{
      if(socket!==current||!visible())return;
      let message;try{message=JSON.parse(event.data);}catch{return;}
      if(message.op===1){
        const interval=Number(message.d?.heartbeat_interval);
        clearInterval(heartbeat);
        current.send(JSON.stringify({op:2,d:{subscribe_to_id:userId}}));
        heartbeat=setInterval(()=>{if(current.readyState===1)current.send(JSON.stringify({op:3}));},interval>=1000&&interval<=120000?interval:30000);
      }else if(message.op===0&&['INIT_STATE','PRESENCE_UPDATE'].includes(message.t)){
        if(publish(message.d?.[userId]||message.d)){
          live=true;attempt=0;clearTimeout(deadline);deadline=0;
          clearTimeout(pollTimer);pollTimer=0;controller?.abort();
        }
      }
    };
    current.onclose=current.onerror=()=>{if(socket===current)reconnect();};
  }
  function refresh(){if(!visible())return;connect();if(!live)poll();}
  function visibility(){if(document.hidden)pause();else refresh();}
  function hide(){active=false;pause();}
  function show(){active=true;refresh();}
  document.addEventListener('visibilitychange',visibility);
  addEventListener('online',refresh);addEventListener('offline',pause);
  addEventListener('pagehide',hide);addEventListener('pageshow',show);
  refresh();
  return {refresh,dispose(){disposed=true;pause();document.removeEventListener('visibilitychange',visibility);removeEventListener('online',refresh);removeEventListener('offline',pause);removeEventListener('pagehide',hide);removeEventListener('pageshow',show);}};
}
