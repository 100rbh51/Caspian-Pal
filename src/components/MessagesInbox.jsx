import React, { useMemo, useRef, useState } from 'react';
import { Check, Clock3, MessageCircle, Plane, Search, SquarePen, Users, X } from 'lucide-react';

function Avatar({ person, size = 'w-12 h-12' }) {
  return <div className={size + ' shrink-0 rounded-full bg-gradient-to-br from-sky-400 via-indigo-500 to-violet-500 p-[2px]'}>
    <div className="w-full h-full rounded-full bg-[#0e1017] flex items-center justify-center font-bold overflow-hidden">
      {person?.avatar_url ? <img src={person.avatar_url} alt="" className="w-full h-full object-cover" /> : (person?.full_name || person?.username || 'T').slice(0,1).toUpperCase()}
    </div>
  </div>;
}

export default function MessagesInbox({ currentUser, friends, incomingRequests, outgoingRequests, people, query, setQuery, results, searching, renderPerson, openChat, respond, recentMessages }) {
  const [section, setSection] = useState('messages');
  const searchRef = useRef(null);
  const visibleFriends = useMemo(() => {
    const term = query.trim().replace(/^@/, '').toLowerCase();
    return friends.filter((p) => !term || (p.full_name || '').toLowerCase().includes(term) || (p.username || '').toLowerCase().includes(term));
  }, [friends, query]);
  const preview = (friend) => {
    const m = recentMessages[friend.id];
    return m ? (m.sender_id === currentUser?.id ? 'You: ' : '') + m.body : 'You are connected — say hello!';
  };
  const time = (friend) => recentMessages[friend.id] ? new Date(recentMessages[friend.id].created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';

  return <div className="flex flex-col h-full min-h-0 bg-[#0b0d13]">
    <header className="px-4 pt-4 pb-3 space-y-3 border-b border-[#1c2030]">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">@{currentUser?.username || 'traveler'}</h2><p className="text-xs text-slate-500">Caspian Pal inbox</p></div>
        <button aria-label="New message" onClick={() => searchRef.current?.focus()} className="w-10 h-10 rounded-xl hover:bg-[#171a24] flex items-center justify-center"><SquarePen size={21}/></button>
      </div>
      <div className="relative"><Search size={17} className="absolute left-3.5 top-3.5 text-slate-500"/>
        <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search travelers or usernames" className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#171a24] border border-[#262b3a] text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-400"/>
      </div>
    </header>

    {friends.length > 0 && <section className="px-4 py-4 border-b border-[#1c2030]">
      <div className="flex justify-between mb-3"><h3 className="text-xs font-semibold text-slate-300">Your travel friends</h3><span className="text-[11px] text-slate-500">{friends.length}</span></div>
      <div className="flex gap-4 overflow-x-auto pb-1">{friends.map((friend) => <button key={friend.id} onClick={() => openChat(friend)} className="w-[62px] shrink-0 flex flex-col items-center gap-1.5">
        <Avatar person={friend} size="w-14 h-14"/><span className="w-full truncate text-[11px] text-slate-400">{friend.full_name || friend.username}</span>
      </button>)}</div>
    </section>}

    <div className="grid grid-cols-2 px-4 border-b border-[#1c2030]">
      <button onClick={() => setSection('messages')} className={'py-3 text-left text-sm font-bold border-b-2 ' + (section === 'messages' ? 'border-amber-300 text-white' : 'border-transparent text-slate-500')}>Messages <span className="ml-1 text-xs text-slate-500">{friends.length}</span></button>
      <button onClick={() => setSection('requests')} className={'py-3 text-right text-sm font-bold border-b-2 ' + (section === 'requests' ? 'border-amber-300 text-amber-300' : 'border-transparent text-slate-500')}>Requests {incomingRequests.length > 0 && <span className="ml-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] text-[#1a1300]">{incomingRequests.length}</span>}</button>
    </div>

    <main className="flex-1 overflow-y-auto min-h-0">
      {searching && <p className="px-4 pt-4 text-xs text-slate-400">Searching travelers…</p>}
      {query.trim().length >= 2 && results.length > 0 && <section className="px-4 pt-4 space-y-2"><h3 className="text-xs uppercase tracking-wider text-slate-500">People</h3>{results.map(renderPerson)}</section>}
      {query.trim().length >= 2 && !searching && results.length === 0 && <p className="px-4 pt-5 text-sm text-slate-500">No travelers found for “{query}”.</p>}

      {section === 'messages' && <section className="divide-y divide-[#1c2030]">
        {visibleFriends.map((friend) => <button key={friend.id} onClick={() => openChat(friend)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[#11141d]">
          <Avatar person={friend}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{friend.full_name || friend.username}</p><p className="text-xs text-slate-400 truncate">{preview(friend)}</p></div>
          <span className="shrink-0 text-[10px] text-slate-500">{time(friend)}</span><MessageCircle size={16} className="shrink-0 text-sky-300"/>
        </button>)}
        {visibleFriends.length === 0 && <div className="px-5 py-12 text-center"><MessageCircle size={27} className="mx-auto mb-2 text-slate-500"/><p className="text-sm text-slate-300 font-semibold">Your messages will appear here</p><p className="mt-1 text-xs text-slate-500">Username search karo. Chat aur calls request accept hone ke baad khulenge.</p><button onClick={() => searchRef.current?.focus()} className="mt-4 h-10 px-4 rounded-xl bg-amber-400 text-[#1a1300] text-sm font-bold">Find travelers</button></div>}
      </section>}

      {section === 'requests' && <div className="p-4 space-y-5">
        <section className="space-y-2"><div className="flex items-center justify-between"><h3 className="font-bold text-sm">Friend requests</h3><span className="text-xs text-slate-500">{incomingRequests.length}</span></div>
          {incomingRequests.map((request) => { const person = people[request.sender_id] || { id: request.sender_id, username: 'traveler', full_name: 'Caspian Pal member' }; return <div key={request.id} className="flex items-center gap-3 rounded-2xl border border-[#252a35] bg-[#12151e] p-3">
            <Avatar person={person}/><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{person.full_name}</p><p className="text-xs text-sky-300 truncate">@{person.username}</p><p className="text-[10px] text-slate-500">Wants to connect for travel</p></div>
            <button aria-label="Accept request" onClick={() => respond(request,'accepted')} className="w-9 h-9 rounded-lg bg-amber-400 text-[#1a1300] flex items-center justify-center"><Check size={17}/></button>
            <button aria-label="Decline request" onClick={() => respond(request,'declined')} className="w-9 h-9 rounded-lg bg-[#252a35] text-slate-300 flex items-center justify-center"><X size={17}/></button>
          </div>; })}
          {incomingRequests.length === 0 && <p className="py-4 text-sm text-slate-500">No new requests right now.</p>}
        </section>
        {outgoingRequests.length > 0 && <section className="space-y-2"><h3 className="font-bold text-sm">Sent requests</h3>{outgoingRequests.map((request) => { const person = people[request.recipient_id] || { id: request.recipient_id, username: 'traveler', full_name: 'Caspian Pal member' }; return <div key={request.id} className="flex items-center gap-3 rounded-xl bg-[#12151e] p-3"><Avatar person={person} size="w-10 h-10"/><div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{person.full_name}</p><p className="text-xs text-slate-400 truncate">@{person.username}</p></div><span className="flex items-center gap-1 text-[11px] text-slate-500"><Clock3 size={13}/>Pending</span></div>; })}</section>}
        {incomingRequests.length === 0 && outgoingRequests.length === 0 && <div className="py-8 text-center text-xs text-slate-500"><Users size={24} className="mx-auto mb-2"/>Requests will appear here</div>}
      </div>}
      {section === 'messages' && query.trim().length < 2 && friends.length > 0 && <div className="px-4 pb-4 pt-2 text-center text-[10px] text-slate-600"><Plane size={13} className="inline mr-1"/>Private travel chats are for accepted friends</div>}
    </main>
  </div>;
}
