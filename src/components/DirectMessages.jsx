import React, { useEffect, useMemo, useState } from 'react';
import { LiveKitRoom, RoomAudioRenderer, VideoConference } from '@livekit/components-react';
import '@livekit/components-styles';
import { ChevronLeft, MessageSquare, Phone, Plane, Search, Send, UserPlus, Video } from 'lucide-react';
import { supabase } from '../supabase';

const inputClass = 'w-full h-11 px-4 rounded-xl bg-[#171a24] border border-[#262b3a] text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-400';
const buttonClass = 'h-10 px-3 rounded-xl bg-[#252a35] text-sm font-semibold';

function CallOverlay({ call, onEnd }) {
  const [connection, setConnection] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    supabase.functions.invoke('livekit-token', { body: { callRoomId: call.id } }).then(({ data, error: invokeError }) => {
      if (cancelled) return;
      if (invokeError || !data?.participantToken || !data?.serverUrl) {
        setError(data?.error || invokeError?.message || 'Call token nahi mila.');
        return;
      }
      setConnection({ token: data.participantToken, serverUrl: data.serverUrl });
    }).catch((cause) => { if (!cancelled) setError(cause?.message || 'Call connect nahi ho saki.'); });
    return () => { cancelled = true; };
  }, [call.id]);

  if (error) return <div className="absolute inset-0 z-[80] bg-[#07080c] flex flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-rose-300">{error}</p><button onClick={onEnd} className="rounded-xl bg-rose-500 px-5 py-3 font-bold">End call</button></div>;
  if (!connection) return <div className="absolute inset-0 z-[80] bg-[#07080c] flex flex-col items-center justify-center gap-4"><div className="w-16 h-16 rounded-full bg-amber-400 text-black flex items-center justify-center text-2xl font-black">CP</div><p>Connecting {call.call_type} call…</p><button onClick={onEnd} className="rounded-xl bg-rose-500 px-5 py-3 font-bold">Cancel call</button></div>;
  return <div className="absolute inset-0 z-[80] bg-[#07080c]"><LiveKitRoom token={connection.token} serverUrl={connection.serverUrl} connect audio video={call.call_type === 'video'} onDisconnected={onEnd} data-lk-theme="default" style={{ height: '100%' }}><VideoConference /><RoomAudioRenderer /></LiveKitRoom></div>;
}

export default function DirectMessages({ currentUser, showToast }) {
  const [requests, setRequests] = useState([]);
  const [people, setPeople] = useState({});
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeFriend, setActiveFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);

  const refreshRequests = async () => {
    if (!currentUser?.id) return;
    const { data, error: loadError } = await supabase.from('friend_requests')
      .select('id, sender_id, recipient_id, status, created_at')
      .or('sender_id.eq.' + currentUser.id + ',recipient_id.eq.' + currentUser.id)
      .order('created_at', { ascending: false });
    if (loadError) { console.error('Friend request load error:', loadError.message); return; }
    setRequests(data || []);
  };

  useEffect(() => {
    refreshRequests();
    const channel = supabase.channel('friend-requests-' + currentUser?.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, refreshRequests)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  useEffect(() => {
    const term = query.trim().replace(/^@/, '');
    if (term.length < 2) { setResults([]); setSearching(false); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data, error: searchError } = await supabase.from('profiles')
        .select('id, username, full_name, avatar_url, bio')
        .neq('id', currentUser.id)
        .ilike('username', '%' + term + '%')
        .limit(20);
      if (cancelled) return;
      setSearching(false);
      if (searchError) { setError('User search nahi hui. Profile table/RLS check karo.'); setResults([]); return; }
      setResults(data || []);
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, currentUser?.id]);

  const personIds = useMemo(() => [...new Set([
    ...requests.map((request) => request.sender_id === currentUser?.id ? request.recipient_id : request.sender_id),
    ...results.map((person) => person.id),
  ].filter(Boolean))], [requests, results, currentUser?.id]);

  useEffect(() => {
    if (!personIds.length) { setPeople({}); return; }
    let live = true;
    supabase.from('profiles').select('id, username, full_name, avatar_url, bio').in('id', personIds)
      .then(({ data, error: profileError }) => {
        if (!live) return;
        if (profileError) { console.error('People lookup error:', profileError.message); return; }
        setPeople(Object.fromEntries((data || []).map((person) => [person.id, person])));
      });
    return () => { live = false; };
  }, [personIds.join('|')]);

  const incomingRequests = requests.filter((request) => request.status === 'pending' && request.recipient_id === currentUser?.id);
  const outgoingRequests = requests.filter((request) => request.status === 'pending' && request.sender_id === currentUser?.id);
  const friends = requests.filter((request) => request.status === 'accepted').map((request) => {
    const id = request.sender_id === currentUser?.id ? request.recipient_id : request.sender_id;
    return people[id] ? { ...people[id], id } : { id, username: 'traveler', full_name: 'Caspian Pal member' };
  });

  const relationship = (personId) => requests.find((request) =>
    (request.sender_id === currentUser?.id && request.recipient_id === personId) ||
    (request.sender_id === personId && request.recipient_id === currentUser?.id)
  );

  const openChat = (person) => {
    setActiveFriend({ id: person.id, username: person.username || 'traveler', name: person.full_name || person.username || 'Traveler', avatar_url: person.avatar_url || '' });
    setMessages([]);
    setError('');
  };

  const sendRequest = async (person) => {
    const { data, error: requestError } = await supabase.from('friend_requests')
      .insert({ sender_id: currentUser.id, recipient_id: person.id })
      .select('id, sender_id, recipient_id, status, created_at').single();
    if (requestError) { showToast(requestError.message, 'err'); return; }
    setRequests((old) => [data, ...old]);
    showToast('Friend request bhej di.');
  };

  const respond = async (request, status) => {
    const { data, error: responseError } = await supabase.from('friend_requests')
      .update({ status, updated_at: new Date().toISOString() }).eq('id', request.id)
      .select('id, sender_id, recipient_id, status, created_at').single();
    if (responseError) { showToast(responseError.message, 'err'); return; }
    setRequests((old) => old.map((item) => item.id === data.id ? data : item));
    showToast(status === 'accepted' ? 'Friend request accept ho gayi.' : 'Request decline kar di.');
  };

  useEffect(() => {
    if (!currentUser?.id) return;
    let live = true;
    const findIncomingCall = async () => {
      const { data } = await supabase.from('call_rooms').select('*').eq('callee_id', currentUser.id)
        .eq('status', 'ringing').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (live && data) setIncomingCall(data);
    };
    findIncomingCall();
    const channel = supabase.channel('incoming-calls-' + currentUser.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'call_rooms', filter: 'callee_id=eq.' + currentUser.id },
        (payload) => { if (live && payload.new.status === 'ringing') setIncomingCall(payload.new); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_rooms', filter: 'callee_id=eq.' + currentUser.id },
        (payload) => { if (live && ['ended', 'rejected'].includes(payload.new.status)) setIncomingCall((old) => old?.id === payload.new.id ? null : old); })
      .subscribe();
    return () => { live = false; supabase.removeChannel(channel); };
  }, [currentUser?.id]);

  useEffect(() => {
    if (!activeCall?.id) return;
    const channel = supabase.channel('call-status-' + activeCall.id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'call_rooms', filter: 'id=eq.' + activeCall.id },
        (payload) => {
          if (['ended', 'rejected'].includes(payload.new.status)) {
            setActiveCall(null);
            showToast(payload.new.status === 'rejected' ? 'Call request decline ho gayi.' : 'Call end ho gayi.');
          }
        }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeCall?.id]);

  useEffect(() => {
    if (!activeFriend?.id) return;
    let live = true;
    setLoading(true); setError(''); setMessages([]);
    const filter = 'and(sender_id.eq.' + currentUser.id + ',recipient_id.eq.' + activeFriend.id + '),and(sender_id.eq.' + activeFriend.id + ',recipient_id.eq.' + currentUser.id + ')';
    const loadMessages = async () => {
      const { data, error: loadError } = await supabase.from('direct_messages')
        .select('id, sender_id, recipient_id, body, created_at').or(filter)
        .order('created_at', { ascending: true }).limit(200);
      if (!live) return;
      setLoading(false);
      if (loadError) { setError('Private chat setup nahi hua. SQL migration run hui hai?'); return; }
      setMessages(data || []);
    };
    loadMessages();
    const channel = supabase.channel('direct-messages-' + [currentUser.id, activeFriend.id].sort().join('-'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (payload) => {
        const message = payload.new;
        if (!live || ![message.sender_id, message.recipient_id].includes(currentUser.id) ||
          ![message.sender_id, message.recipient_id].includes(activeFriend.id)) return;
        setMessages((old) => old.some((item) => item.id === message.id) ? old : [...old, message]);
      }).subscribe();
    return () => { live = false; supabase.removeChannel(channel); };
  }, [activeFriend?.id, currentUser?.id]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body || busy || !activeFriend?.id) return;
    setBusy(true); setError('');
    const { data, error: sendError } = await supabase.from('direct_messages')
      .insert({ sender_id: currentUser.id, recipient_id: activeFriend.id, body })
      .select('id, sender_id, recipient_id, body, created_at').single();
    setBusy(false);
    if (sendError) { setError('Message send nahi hua. Check karo ki friend ne request accept ki hai.'); return; }
    setMessages((old) => old.some((item) => item.id === data.id) ? old : [...old, data]);
    setDraft('');
  };

  const startCall = async (kind) => {
    if (!activeFriend) return;
    const isFriend = requests.some((request) => request.status === 'accepted' &&
      [request.sender_id, request.recipient_id].includes(currentUser.id) &&
      [request.sender_id, request.recipient_id].includes(activeFriend.id));
    if (!isFriend) { showToast('Call ke liye pehle friend request accept honi chahiye.', 'err'); return; }
    const roomName = 'caspian-' + crypto.randomUUID();
    const { data, error: callError } = await supabase.from('call_rooms')
      .insert({ caller_id: currentUser.id, callee_id: activeFriend.id, created_by: currentUser.id, call_type: kind, room_name: roomName })
      .select('*').single();
    if (callError) { showToast(callError.message, 'err'); return; }
    setActiveCall(data);
  };

  const endCall = async () => {
    const call = activeCall || incomingCall;
    if (call?.id) await supabase.from('call_rooms').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', call.id);
    setActiveCall(null); setIncomingCall(null);
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    const { data, error: acceptError } = await supabase.from('call_rooms').update({ status: 'active' })
      .eq('id', incomingCall.id).select('*').single();
    if (acceptError) { showToast(acceptError.message, 'err'); return; }
    setActiveCall(data); setIncomingCall(null);
  };

  const declineCall = async () => {
    if (incomingCall) await supabase.from('call_rooms').update({ status: 'rejected', ended_at: new Date().toISOString() }).eq('id', incomingCall.id);
    setIncomingCall(null);
  };

  const statusButton = (person) => {
    const request = relationship(person.id);
    if (request?.status === 'accepted') return <button className="h-9 px-3 rounded-lg bg-sky-500/15 text-sky-200 text-xs font-bold" onClick={() => openChat(person)}>Message</button>;
    if (request?.status === 'pending' && request.recipient_id === currentUser.id) return <div className="flex gap-1"><button className="h-9 px-3 rounded-lg bg-amber-400 text-[#1a1300] text-xs font-bold" onClick={() => respond(request, 'accepted')}>Accept</button><button className="h-9 px-3 rounded-lg bg-[#252a35] text-xs" onClick={() => respond(request, 'declined')}>Decline</button></div>;
    if (request?.status === 'pending') return <span className="text-xs text-slate-400">Requested</span>;
    return <button className="h-9 px-3 rounded-lg bg-amber-400 text-[#1a1300] text-xs font-bold" onClick={() => sendRequest(person)}><UserPlus size={14} className="inline mr-1"/>Add friend</button>;
  };

  const renderPerson = (person) => <div key={person.id} className="flex items-center gap-3 rounded-2xl border border-[#252a35] bg-[#12151e] p-3">
    <div className="w-11 h-11 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 p-[1px]"><div className="w-full h-full rounded-full bg-[#0e1017] flex items-center justify-center text-sm font-bold overflow-hidden">{person.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover"/> : (person.full_name || person.username || 'T').slice(0,1).toUpperCase()}</div></div>
    <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{person.full_name || person.username}</p><p className="text-xs text-sky-300 truncate">@{person.username}</p>{person.bio && <p className="text-xs text-slate-500 truncate mt-1">{person.bio}</p>}</div>
    {statusButton(person)}
  </div>;

  if (activeFriend) return <div className="flex flex-col h-full min-h-0">
    <div className="px-3 py-3 border-b border-[#1c2030] flex items-center gap-2">
      <button aria-label="Back to messages" onClick={() => { setActiveFriend(null); setMessages([]); }} className="w-9 h-9 rounded-full flex items-center justify-center text-slate-300"><ChevronLeft size={21}/></button>
      <div className="flex-1 min-w-0"><h3 className="font-bold text-sm truncate">{activeFriend.name}</h3><p className="text-xs text-sky-300">@{activeFriend.username}</p></div>
      <button aria-label="Voice call" onClick={() => startCall('audio')} className="w-10 h-10 rounded-full bg-[#171a24] text-sky-300 flex items-center justify-center"><Phone size={17}/></button>
      <button aria-label="Video call" onClick={() => startCall('video')} className="w-10 h-10 rounded-full bg-[#171a24] text-sky-300 flex items-center justify-center"><Video size={18}/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
      {loading && <p className="text-center text-sm text-slate-400 py-5">Loading private messages…</p>}
      {!loading && messages.length === 0 && !error && <div className="text-center py-10"><MessageSquare size={27} className="mx-auto mb-2 text-slate-500"/><p className="text-sm text-slate-400">You are connected. Send the first message.</p></div>}
      {messages.map((message) => { const mine = message.sender_id === currentUser.id; return <div key={message.id} className={'flex ' + (mine ? 'justify-end' : 'justify-start')}><div className="max-w-[80%]"><div className={'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ' + (mine ? 'bg-amber-400 text-[#1a1300] rounded-br-md' : 'bg-[#1a1e2b] text-slate-100 rounded-bl-md')}>{message.body}</div><p className={'text-[10px] text-slate-500 mt-1 ' + (mine ? 'text-right' : '')}>{mine ? 'You' : activeFriend.name} · {new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div></div>; })}
      {error && <p role="alert" className="text-center text-xs text-rose-300 py-2">{error}</p>}
    </div>
    <div className="p-3 border-t border-[#1c2030] flex gap-2"><input value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && (event.preventDefault(), sendMessage())} placeholder="Message your travel friend…" className={inputClass}/><button aria-label="Send message" onClick={sendMessage} disabled={busy || !draft.trim()} className="w-11 h-11 shrink-0 rounded-xl bg-amber-400 text-[#1a1300] flex items-center justify-center disabled:opacity-40"><Send size={17}/></button></div>
    {incomingCall && <div className="absolute inset-0 z-[60] bg-black/70 flex items-center justify-center p-5"><div className="w-full rounded-3xl bg-[#13161f] border border-[#303648] p-5 text-center space-y-4"><div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-xl font-bold">{(people[incomingCall.caller_id]?.full_name || 'T').slice(0,1).toUpperCase()}</div><h3 className="font-bold">{people[incomingCall.caller_id]?.full_name || 'Your travel friend'} is calling</h3><p className="text-sm text-slate-400">{incomingCall.call_type === 'video' ? 'Video' : 'Voice'} call</p><div className="flex gap-3"><button onClick={declineCall} className="flex-1 h-11 rounded-xl bg-rose-500 font-bold">Decline</button><button onClick={acceptCall} className="flex-1 h-11 rounded-xl bg-emerald-500 text-black font-bold">Accept</button></div></div></div>}
    {activeCall && <CallOverlay call={activeCall} onEnd={endCall}/>}
  </div>;

  return <div className="flex flex-col h-full min-h-0">
    <div className="p-4 border-b border-[#1c2030] space-y-3">
      <div className="flex items-center justify-between"><div><h3 className="font-bold text-lg">Messages</h3><p className="text-xs text-slate-400">Friend request accept hone par private chat khulega.</p></div><MessageSquare size={20} className="text-sky-300"/></div>
      <div className="relative"><Search size={17} className="absolute left-3.5 top-3.5 text-slate-500"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Username search karo" className={inputClass + ' pl-10'}/></div>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-5 min-h-0">
      {searching && <p className="text-xs text-slate-400">Searching usernames…</p>}
      {results.length > 0 && <section className="space-y-2"><h4 className="text-xs uppercase tracking-wider text-slate-500">People</h4>{results.map(renderPerson)}</section>}
      {incomingRequests.length > 0 && <section className="space-y-2"><h4 className="text-xs uppercase tracking-wider text-slate-500">Friend requests · {incomingRequests.length}</h4>{incomingRequests.map((request) => { const person=people[request.sender_id] || {id:request.sender_id,username:'traveler',full_name:'Caspian Pal member'}; return <div key={request.id} className="flex items-center gap-3 rounded-2xl border border-[#252a35] bg-[#12151e] p-3"><div className="flex-1 min-w-0"><p className="text-sm font-semibold">{person.full_name}</p><p className="text-xs text-sky-300">@{person.username}</p></div><button onClick={() => respond(request,'accepted')} className="h-9 px-3 rounded-lg bg-amber-400 text-[#1a1300] text-xs font-bold">Accept</button><button onClick={() => respond(request,'declined')} className="h-9 px-3 rounded-lg bg-[#252a35] text-xs">Decline</button></div>; })}</section>}
      <section className="space-y-2"><h4 className="text-xs uppercase tracking-wider text-slate-500">Your travel friends · {friends.length}</h4>
        {friends.map((friend) => <button key={friend.id} onClick={() => openChat(friend)} className="w-full flex items-center gap-3 rounded-2xl border border-[#252a35] bg-[#12151e] p-3 text-left"><div className="w-11 h-11 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 p-[1px]"><div className="w-full h-full rounded-full bg-[#0e1017] flex items-center justify-center font-bold overflow-hidden">{friend.avatar_url ? <img src={friend.avatar_url} alt="" className="w-full h-full object-cover"/> : (friend.full_name || friend.username || 'T').slice(0,1).toUpperCase()}</div></div><div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{friend.full_name || friend.username}</p><p className="text-xs text-sky-300 truncate">@{friend.username}</p></div><MessageSquare size={17} className="text-slate-500"/></button>)}
        {friends.length === 0 && !query.trim() && incomingRequests.length === 0 && <div className="py-8 text-center"><Plane size={26} className="mx-auto text-slate-500 mb-2"/><p className="text-sm text-slate-400">Abhi friends nahi hain. Username se traveler dhoondo.</p></div>}
      </section>
    </div>
    {error && !activeFriend && <p role="alert" className="px-4 pb-2 text-xs text-rose-300">{error}</p>}
    {incomingCall && <div className="absolute inset-0 z-[60] bg-black/70 flex items-center justify-center p-5"><div className="w-full rounded-3xl bg-[#13161f] border border-[#303648] p-5 text-center space-y-4"><div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-sky-400 to-violet-500 flex items-center justify-center text-xl font-bold">{(people[incomingCall.caller_id]?.full_name || 'T').slice(0,1).toUpperCase()}</div><h3 className="font-bold">{people[incomingCall.caller_id]?.full_name || 'Your travel friend'} is calling</h3><p className="text-sm text-slate-400">{incomingCall.call_type === 'video' ? 'Video' : 'Voice'} call</p><div className="flex gap-3"><button onClick={declineCall} className="flex-1 h-11 rounded-xl bg-rose-500 font-bold">Decline</button><button onClick={acceptCall} className="flex-1 h-11 rounded-xl bg-emerald-500 text-black font-bold">Accept</button></div></div></div>}
    {activeCall && <CallOverlay call={activeCall} onEnd={endCall}/>}
  </div>;
}
