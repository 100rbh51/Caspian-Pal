import Reels from './components/Reels';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft, Eye, EyeOff, Home, MessageSquare, User, Video, Search,
  Plus, Send, MapPin, Users, Compass, LogOut, X, Mail,
  AtSign, PhoneOff, RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { App as CapApp } from '@capacitor/app';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE = 13;
const YEARS = Array.from({ length: CURRENT_YEAR - MIN_AGE - 1920 + 1 }, (_, i) => CURRENT_YEAR - MIN_AGE - i);
const normalizePhone = (v) => {
  const d = v.replace(/[^\d+]/g, '');
  if (/^\d{10}$/.test(d)) return '+91' + d;
  if (/^91\d{10}$/.test(d)) return '+' + d;
  return d;
};
const PHONE_RE = /^\+\d{10,15}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const SEED_ACTIVITIES = [
  { id: 1, author: 'Caspian Pal', category: 'Study', section: 'school', subLevel: '6-8', title: 'Middle School Foundation (Classes 6-8)', desc: 'Strong foundation classes for Maths, Science and Olympiad preparation.', venue: 'Online Interactive Class', location: 'Online', members: 45 },
  { id: 2, author: 'Caspian Pal', category: 'Study', section: 'school', subLevel: '9-12', title: 'Class 9-12 Board & Career Guidance', desc: 'Complete roadmap for CBSE, ICSE and State board students.', venue: 'Online Guidance Room', location: 'Online', members: 124 },
  { id: 3, author: 'Caspian Pal', category: 'Study', section: 'college', subLevel: 'graduation', title: 'College & Placement Guidance', desc: 'Coding, DSA, internships and career preparation.', venue: 'Online & Campus Connect', location: 'Online', members: 85 },
  { id: 4, author: 'Caspian Pal', category: 'Study', section: 'govjobs', subLevel: 'Group A', title: 'Government Job Preparation Hub', desc: 'UPSC, SSC, banking and other competitive exam preparation.', venue: 'Virtual Study Room', location: 'Online', members: 210 },
  { id: 5, author: 'Community Member', category: 'Travel', section: 'travel', subLevel: '', title: 'Weekend Jaipur Exploration', desc: 'Explore Jaipur attractions with a group of fellow travellers.', venue: 'Jaipur', location: 'Jaipur', members: 8 },
  { id: 6, author: 'Community Member', category: 'Sports', section: 'sports', subLevel: '', title: 'Weekend Cricket Match', desc: 'Looking for people interested in a friendly cricket match.', venue: 'Local Sports Ground', location: 'India', members: 12 }
];

/* ---------- small shared pieces ---------- */
const inputCls = 'w-full h-12 px-4 rounded-xl bg-[#171a24] border border-[#262b3a] text-[15px] text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition';
const selectCls = 'h-12 px-3 rounded-xl bg-[#171a24] border border-[#262b3a] text-sm text-slate-100 outline-none focus:border-amber-400';
const primaryBtn = 'w-full h-12 rounded-xl bg-amber-400 text-[#1a1300] font-bold text-[15px] active:scale-[0.98] transition disabled:opacity-40';
const ghostBtn = 'w-full h-12 rounded-xl border border-[#262b3a] text-slate-200 font-semibold text-[15px] active:scale-[0.98] transition';

const Field = ({ label, error, children, hint }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-semibold text-slate-400">{label}</label>}
    {children}
    {error ? (
      <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle size={13} />{error}</p>
    ) : hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const PasswordInput = ({ value, onChange, placeholder = 'Password', onEnter }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'} value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter && onEnter()}
        className={inputCls + ' pr-12'}
      />
      <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-3 top-3 text-slate-400">
        {show ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
};

const OtpInput = ({ value, onChange, error }) => (
  <div className="relative">
    <div className="flex gap-2 justify-between">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`flex-1 h-14 rounded-xl border flex items-center justify-center text-xl font-bold bg-[#171a24] ${
          error ? 'border-rose-500 text-rose-300' : value.length === i ? 'border-amber-400 ring-2 ring-amber-400/20 text-white' : 'border-[#262b3a] text-white'}`}>
          {value[i] || ''}
        </div>
      ))}
    </div>
    <input
      autoFocus inputMode="numeric" maxLength={6} value={value} aria-label="6 digit code"
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      className="absolute inset-0 w-full h-full opacity-0 cursor-text"
    />
  </div>
);

/* Photo: tries the bundled file in /public first, then the web URL, then hides itself */
const Photo = ({ local, remote, alt, className }) => {
  const [src, setSrc] = useState(local);
  return (
    <img src={src} alt={alt} className={className}
      onError={() => setSrc((cur) => (cur === local ? remote : ''))}
      style={src ? undefined : { display: 'none' }} />
  );
};

const getStrength = (p) => {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
};

/* ---------- app ---------- */
export default function App() {
  const [screen, setScreen] = useState('welcome');
  const [toast, setToast] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const signingUp = useRef(false);

  // signup
  const [step, setStep] = useState(1);
  const [f, setF] = useState({ name: '', email: '', password: '', day: '1', month: 'January', year: String(CURRENT_YEAR - 18), username: '' });
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [resend, setResend] = useState(0);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  // login
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loginMode, setLoginMode] = useState('email');
  const [phone, setPhone] = useState('');
  const [phoneStage, setPhoneStage] = useState('enter');
  const [phoneOtp, setPhoneOtp] = useState('');

  // dashboard
  const [tab, setTab] = useState('home');
  const [category, setCategory] = useState('All');
  const [studySub, setStudySub] = useState('school');
  const [level, setLevel] = useState({ school: '9-12', college: 'graduation', govjobs: 'Group A' });
  const [query, setQuery] = useState('');
  const [userResults, setUserResults] = useState([]);
const [searchBusy, setSearchBusy] = useState(false);
  const [activities, setActivities] = useState(SEED_ACTIVITIES);
  const [joined, setJoined] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ category: 'Study', section: 'school', title: '', venue: '', desc: '' });
  const [draftErr, setDraftErr] = useState('');
  const [messages, setMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState('');
  const [inputMessage, setInputMessage] = useState('');
  const [inCall, setInCall] = useState(false);
  const chatEnd = useRef(null);

  const showToast = (text, type = 'ok') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (resend <= 0) return;
    const t = setTimeout(() => setResend((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resend]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, tab]);

  useEffect(() => {
    if (screen !== 'dashboard' || tab !== 'message' || !currentUser?.id) return;

    let active = true;
    setChatLoading(true);
    setChatError('');

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from('community_messages')
        .select('id, user_id, sender_name, body, created_at')
        .order('created_at', { ascending: false })
        .limit(100);

      if (!active) return;
      setChatLoading(false);
      if (error) {
        console.error('Community chat load error:', error.message);
        setChatError('Messages load nahi hue. Supabase table setup check karein.');
        return;
      }
      setMessages((data || []).reverse());
    };

    loadMessages();

    const channel = supabase
      .channel('community-messages-live')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_messages',
      }, (payload) => {
        if (!active) return;
        setMessages((previous) => {
          if (previous.some((message) => message.id === payload.new.id)) return previous;
          return [...previous, payload.new];
        });
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Community chat realtime status:', status);
          if (active) setChatError('Live updates connect nahi hue. Supabase Realtime setup check karein.');
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [screen, tab, currentUser?.id]);
useEffect(() => {
  const term = query.trim().replace(/^@/, '');

  if (term.length < 2) {
    setUserResults([]);
    setSearchBusy(false);
    return;
  }

  let cancelled = false;

  const timer = setTimeout(async () => {
    setSearchBusy(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url, bio')
      .ilike('username', `%${term}%`)
      .limit(20);

    if (cancelled) return;

    setSearchBusy(false);

    if (error) {
      console.error('Profile search error:', error.message);
      setUserResults([]);
      return;
    }

    setUserResults(data || []);
  }, 300);

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, [query]);
  const toUser = (u) => ({
    id: u.id,
    name: u.user_metadata?.name || u.user_metadata?.full_name || u.email || u.phone || 'Member',
    email: u.email || '',
    phone: u.phone ? '+' + u.phone.replace('+', '') : '',
    username: u.user_metadata?.username || (u.email ? u.email.split('@')[0] : 'user_' + (u.phone || '0000').slice(-4)),
    dob: u.user_metadata?.dob || 'Not set'
  });

     useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      console.log(
        'Supabase session found:',
        Boolean(data?.session),
        error?.message || ''
      );

      if (error) {
        showToast(error.message, 'err');
        return;
      }

      if (data.session) {
        setCurrentUser(toUser(data.session.user));
        setTab('home');
        setScreen('dashboard');
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth event:', _event, 'Session found:', Boolean(session));

      if (signingUp.current) return;

      if (session) {
        setCurrentUser(toUser(session.user));
        setTab('home');
        setScreen('dashboard');
      } else {
        setCurrentUser(null);
      }
    });

    const urlHandle = CapApp.addListener('appUrlOpen', async ({ url }) => {
      const code = new URL(url).searchParams.get('code');

      if (code) {
        await supabase.auth.exchangeCodeForSession(code);
        await Browser.close();
      }
    });

    return () => {
      sub.subscription.unsubscribe();
      urlHandle.then((handle) => handle.remove());
    };
  }, []);

  const suggestUsername = (name) => {
    const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'caspian_user';
    set('username', `${base}_${Math.floor(1000 + Math.random() * 9000)}`);
  };

  /* signup flow */
  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (f.name.trim().length < 2) e.name = 'Enter your full name.';
    }
    if (step === 2) {
      if (!EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email, like name@example.com.';
      if (getStrength(f.password) < 3 || f.password.length < 8) e.password = 'Use 8+ characters with upper and lower case letters and a number.';
    }
    if (step === 3) {
      const d = +f.day, m = MONTHS.indexOf(f.month), y = +f.year;
      const dt = new Date(y, m, d);
      if (dt.getMonth() !== m) e.dob = `${f.month} ${y} does not have ${d} days.`;
      else {
        const now = new Date();
        let age = now.getFullYear() - y;
        if (now < new Date(now.getFullYear(), m, d)) age--;
        if (age < MIN_AGE) e.dob = `You must be at least ${MIN_AGE} years old to join.`;
      }
    }
    if (step === 4) {
      if (!/^[a-z0-9_]{3,20}$/.test(f.username)) e.username = 'Use 3–20 lowercase letters, numbers or underscores.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const sendCode = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: f.email.trim().toLowerCase(),
      options: { shouldCreateUser: true, data: { name: f.name.trim(), username: f.username, dob: `${f.day} ${f.month} ${f.year}` } }
    });
    setBusy(false);
    if (error) { showToast(error.message, 'err'); return false; }
    setResend(30); setOtp('');
    return true;
  };

  const next = async () => {
    if (step === 5) {
      setBusy(true);
      signingUp.current = true;
      const email = f.email.trim().toLowerCase();
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) {
        signingUp.current = false; setBusy(false);
        setErrors({ otp: 'That code is wrong or expired. Request a new one.' });
        return;
      }
      const { error: e2 } = await supabase.auth.updateUser({
        password: f.password,
        data: { name: f.name.trim(), username: f.username, dob: `${f.day} ${f.month} ${f.year}` }
      });
      signingUp.current = false; setBusy(false);
      if (e2) { showToast(e2.message, 'err'); return; }
      const { data } = await supabase.auth.getSession();
      setCurrentUser(toUser(data.session.user));
      setScreen('dashboard');
      showToast('Email verified. Welcome to Caspian Pal!');
      return;
    }
    if (!validateStep()) return;
    if (step === 3 && !f.username) suggestUsername(f.name);
    if (step === 4 && !(await sendCode())) return;
    setStep(step + 1);
  };

  const back = () => { setErrors({}); step > 1 ? setStep(step - 1) : setScreen('auth'); };

  const startSignup = () => { setStep(1); setErrors({}); setOtp(''); setScreen('signup'); };

  const handleLogin = async () => {
    const email = loginId.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) { setLoginErr('Enter the email you signed up with.'); return; }
    if (!loginPw) { setLoginErr('Enter your password.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: loginPw });
    setBusy(false);
    if (error) {
      setLoginErr(error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message);
      return;
    }
    setLoginErr(''); setTab('home');
    showToast('Welcome back!');
  };

  const sendPhoneOtp = async () => {
    const num = normalizePhone(phone);
    if (!PHONE_RE.test(num)) { setLoginErr('Enter a valid mobile number, like 9876543210.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: num });
    setBusy(false);
    if (error) { setLoginErr(error.message); return; }
    setLoginErr(''); setPhoneOtp(''); setPhoneStage('code'); setResend(30);
    showToast('OTP sent by SMS.');
  };

  const verifyPhoneOtp = async () => {
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone: normalizePhone(phone), token: phoneOtp, type: 'sms' });
    setBusy(false);
    if (error) { setLoginErr('That OTP is wrong or expired. Request a new one.'); return; }
    setLoginErr(''); setPhone(''); setPhoneStage('enter'); setPhoneOtp(''); setTab('home');
    showToast('Logged in with your phone number.');
  };

  const googleLogin = async () => {
    const native = Capacitor.isNativePlatform();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: native ? 'in.caspianpal.app://login-callback' : window.location.origin, skipBrowserRedirect: native, queryParams: { prompt: 'select_account' } }
    });
    if (error) { showToast(error.message, 'err'); return; }
    if (native) await Browser.open({ url: data.url });
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null); setLoginId(''); setLoginPw(''); setTab('home'); setScreen('welcome');
  };

  /* data */
  const visible = useMemo(() => {
    return activities.filter((a) => {
      if (category === 'All') return true;
      if (category !== 'Study') return a.category === category;
      return a.category === 'Study' && a.section === studySub && a.subLevel === level[studySub];
    });
  }, [activities, category, studySub, level]);

  const searched = activities.filter((a) => {
    const q = query.toLowerCase();
    return [a.title, a.desc, a.category, a.location].some((s) => s.toLowerCase().includes(q));
  });

  const publish = () => {
    if (!draft.title.trim() || !draft.desc.trim()) { setDraftErr('Add a title and a short description.'); return; }
    const isStudy = draft.category === 'Study';
    setActivities((p) => [{
      id: Date.now(), author: currentUser?.name || 'Community Member', category: draft.category,
      section: isStudy ? draft.section : draft.category.toLowerCase(),
      subLevel: isStudy ? level[draft.section] : '', title: draft.title.trim(), desc: draft.desc.trim(),
      venue: draft.venue.trim() || 'Online Community', location: draft.venue.trim() || 'Online', members: 1
    }, ...p]);
    setDraft({ category: 'Study', section: 'school', title: '', venue: '', desc: '' });
    setDraftErr(''); setShowCreate(false); setCategory('All'); setTab('home');
    showToast('Activity published.');
  };

  const send = async () => {
    const body = inputMessage.trim();
    if (!body || chatBusy || !currentUser?.id) return;
    if (body.length > 2000) {
      showToast('Message 2000 characters se chhota rakhein.', 'err');
      return;
    }

    setChatBusy(true);
    setChatError('');
    const { data, error } = await supabase
      .from('community_messages')
      .insert({ user_id: currentUser.id, sender_name: currentUser.name || 'Member', body })
      .select('id, user_id, sender_name, body, created_at')
      .single();
    setChatBusy(false);

    if (error) {
      console.error('Community chat send error:', error.message);
      setChatError('Message send nahi hua. Table/policy setup check karein.');
      return;
    }

    setMessages((previous) => previous.some((message) => message.id === data.id)
      ? previous
      : [...previous, data]);
    setInputMessage('');
  };

  const toggleJoin = (a) => {
    const isIn = joined.includes(a.id);
    setJoined((j) => (isIn ? j.filter((x) => x !== a.id) : [...j, a.id]));
    setActivities((p) => p.map((x) => (x.id === a.id ? { ...x, members: x.members + (isIn ? -1 : 1) } : x)));
    showToast(isIn ? 'You left the activity.' : 'You joined. Say hi in Messages!');
  };

  const initial = (currentUser?.name || 'C').charAt(0).toUpperCase();

  const ActivityCard = ({ a }) => (
    <article className="rounded-2xl bg-[#13161f] border border-[#222736] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-amber-400/10 text-amber-300">{a.category}</span>
        <span className="text-xs text-slate-400 flex items-center gap-1"><MapPin size={13} />{a.location}</span>
      </div>
      <div>
        <h4 className="font-bold text-slate-100 leading-snug">{a.title}</h4>
        <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">{a.desc}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0e1017] rounded-xl px-3 py-2.5">
        <Compass size={15} className="text-teal-300 shrink-0" />{a.venue}
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-teal-300 font-semibold flex items-center gap-1.5"><Users size={14} />{a.members} members</span>
        <div className="flex gap-2">
          <button onClick={() => setTab('message')} className="h-9 px-3 rounded-lg border border-[#2a3043] text-xs font-semibold text-slate-200">Chat</button>
          <button onClick={() => toggleJoin(a)} className={`h-9 px-4 rounded-lg text-xs font-bold ${joined.includes(a.id) ? 'bg-teal-400/15 text-teal-300' : 'bg-amber-400 text-[#1a1300]'}`}>
            {joined.includes(a.id) ? 'Joined' : 'Join'}
          </button>
        </div>
      </div>
    </article>
  );

  const stepTitles = ['What is your name?', 'Email and password', 'Your birthday', 'Pick a username', 'Verify your email'];
  const strength = getStrength(f.password);

  return (
    <div className="min-h-screen bg-[#07080c] flex items-center justify-center sm:p-4 text-slate-100" style={{ fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <div className="w-full sm:max-w-[430px] h-screen sm:h-[860px] bg-[#0e1017] sm:rounded-[32px] relative flex flex-col overflow-hidden sm:border border-[#1c2030] shadow-2xl">

        {toast && (
          <div className={`absolute top-4 left-4 right-4 z-[60] px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-lg ${toast.type === 'ok' ? 'bg-teal-400 text-[#04201c]' : 'bg-rose-500 text-white'}`}>
            {toast.type === 'ok' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}{toast.text}
          </div>
        )}

        {/* WELCOME */}
        {screen === 'welcome' && (
          <div className="cp-welcome relative flex flex-col h-full p-6 justify-between overflow-hidden bg-gradient-to-b from-sky-50 to-white text-slate-900">
            <style>{`
              @keyframes cpRise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
              @keyframes cpPop{0%{opacity:0;transform:scale(.6) rotate(-6deg)}70%{transform:scale(1.06) rotate(1deg)}100%{opacity:1;transform:none}}
              @keyframes cpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
              @keyframes cpSpin{to{transform:rotate(360deg)}}
              @keyframes cpDrift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(18px,-22px) scale(1.12)}}
              @keyframes cpShine{0%{transform:translateX(-120%) skewX(-20deg)}60%,100%{transform:translateX(260%) skewX(-20deg)}}
              @keyframes cpNudge{0%,100%{transform:translateX(0)}50%{transform:translateX(5px)}}
              @keyframes cpPulse{0%{box-shadow:0 0 0 0 rgba(37,99,235,.45)}100%{box-shadow:0 0 0 18px rgba(37,99,235,0)}}
              .cp-in{opacity:0;animation:cpRise .7s cubic-bezier(.2,.8,.2,1) forwards}
              .cp-chip{opacity:0;animation:cpPop .6s cubic-bezier(.2,.8,.2,1) forwards,cpFloat 4s ease-in-out infinite}
              .cp-btn{animation:cpPulse 2.2s ease-out infinite}
              @media (prefers-reduced-motion:reduce){.cp-welcome *{animation:none!important;opacity:1!important}}
            `}</style>

            <div aria-hidden className="absolute -top-16 -left-16 w-56 h-56 rounded-full bg-sky-300/40 blur-3xl" style={{ animation: 'cpDrift 9s ease-in-out infinite' }} />
            <div aria-hidden className="absolute top-1/2 -right-20 w-56 h-56 rounded-full bg-indigo-300/30 blur-3xl" style={{ animation: 'cpDrift 11s ease-in-out infinite reverse' }} />

            <div className="relative">
              <div className="relative w-44 h-44 mx-auto mt-6">
                <div aria-hidden className="absolute inset-0 rounded-[2rem] blur-md opacity-70" style={{ background: 'conic-gradient(from 0deg,#38bdf8,#6366f1,#a78bfa,#38bdf8)', animation: 'cpSpin 6s linear infinite' }} />
                <div className="cp-in absolute inset-[6px] rounded-[1.7rem] overflow-hidden border-4 border-white shadow-xl bg-slate-200" style={{ animation: 'cpPop .8s cubic-bezier(.2,.8,.2,1) .1s forwards, cpFloat 5s ease-in-out 1s infinite' }}>
                  <Photo local="welcome.jpg" remote="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=500&q=80" alt="Caspian Pal" className="w-full h-full object-cover" />
                </div>
              </div>

              <h1 className="cp-in text-3xl font-extrabold text-center mt-9" style={{ animationDelay: '.35s' }}>Welcome to Caspian Pal</h1>

              <div className="cp-in mt-5 space-y-3 bg-white/90 backdrop-blur p-5 rounded-3xl border border-slate-100 shadow-[0_12px_40px_-16px_rgba(30,64,175,.35)] text-sm text-slate-600 text-center" style={{ animationDelay: '.55s' }}>
                <p className="font-bold text-slate-900 text-lg cp-in" style={{ animationDelay: '.7s' }}>Namaskar Dosto!</p>
                <p className="cp-in" style={{ animationDelay: '.85s' }}>Find companions for travel, sports, study guidance and interesting activities.</p>
                <p className="cp-in" style={{ animationDelay: '1s' }}>Connect with people who share your interests and discover new experiences together.</p>
                <p className="font-bold text-slate-900 cp-in" style={{ animationDelay: '1.15s' }}>Caspian Pal</p>
              </div>
            </div>

            <div className="relative cp-in space-y-3" style={{ animationDelay: '1.3s' }}>
              <button onClick={() => setScreen('auth')} className="cp-btn relative overflow-hidden w-full h-14 bg-blue-600 text-white font-extrabold rounded-2xl text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
                <span aria-hidden className="absolute inset-y-0 left-0 w-1/3 bg-white/25" style={{ animation: 'cpShine 3.2s ease-in-out 2s infinite' }} />
                <span className="relative">Get Started</span>
                <ChevronLeft size={20} className="relative rotate-180" style={{ animation: 'cpNudge 1.4s ease-in-out infinite' }} />
              </button>
            </div>
          </div>
        )}

        {/* AUTH */}
        {screen === 'auth' && (
          <div className="cp-auth relative flex flex-col h-full p-6 overflow-hidden bg-[#0e1017]">
            <style>{`
              @keyframes cpAuthDrift{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(14px,-18px,0) scale(1.1)}}
              @media (prefers-reduced-motion:reduce){.cp-auth-glow{animation:none!important}}
            `}</style>
            <div aria-hidden className="cp-auth-glow absolute -top-16 -left-20 w-64 h-64 rounded-full bg-sky-400/25 blur-[85px] pointer-events-none" style={{ animation: 'cpAuthDrift 9s ease-in-out infinite' }} />
            <div aria-hidden className="cp-auth-glow absolute top-[28%] -right-24 w-64 h-64 rounded-full bg-indigo-500/25 blur-[90px] pointer-events-none" style={{ animation: 'cpAuthDrift 11s ease-in-out infinite reverse' }} />
            <div aria-hidden className="cp-auth-glow absolute -bottom-24 left-1/3 w-56 h-56 rounded-full bg-blue-500/15 blur-[85px] pointer-events-none" style={{ animation: 'cpAuthDrift 12s ease-in-out infinite' }} />
            <button aria-label="Back" onClick={() => setScreen('welcome')} className="relative z-10 self-start p-2 -ml-2 text-slate-300"><ChevronLeft /></button>
            <div className="relative z-10 my-auto text-center">
              <div className="relative w-20 h-20 mx-auto rounded-3xl bg-amber-400 text-[#1a1300] flex items-center justify-center text-3xl font-black mb-6 shadow-[0_0_34px_rgba(59,130,246,.24)]">CP</div>
              <h2 className="text-2xl font-extrabold">Join Caspian Pal</h2>
              <p className="text-sm text-slate-400 mt-2">Create an account or log in to continue.</p>
            </div>
            <div className="relative z-10 space-y-3">
              <button className={primaryBtn} onClick={startSignup}>Create account</button>
              <button className={ghostBtn} onClick={() => { setLoginMode('email'); setLoginErr(''); setScreen('login'); }}>Log in</button>
              <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-[#222736]" /><span className="text-xs text-slate-500">or</span><div className="flex-1 h-px bg-[#222736]" /></div>
              <button className={ghostBtn} onClick={googleLogin}>Continue with Google</button>
              <button className={ghostBtn} onClick={() => { setLoginMode('phone'); setPhoneStage('enter'); setLoginErr(''); setScreen('login'); }}>Continue with phone number</button>
            </div>
          </div>
        )}

        {/* SIGNUP */}
        {screen === 'signup' && (
          <div className="flex flex-col h-full p-6">
            <div className="flex items-center gap-3 mb-8">
              <button aria-label="Back" onClick={back} className="p-2 -ml-2 text-slate-300"><ChevronLeft /></button>
              <div className="flex-1 h-1.5 rounded-full bg-[#1c2030] overflow-hidden">
                <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${(step / 5) * 100}%` }} />
              </div>
              <span className="text-xs text-slate-500 tabular-nums">{step}/5</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5">
              <h2 className="text-2xl font-extrabold">{stepTitles[step - 1]}</h2>

              {step === 1 && (
                <Field error={errors.name} hint="This is how other members will see you.">
                  <input autoFocus className={inputCls} placeholder="Full name" value={f.name}
                    onChange={(e) => { set('name', e.target.value); }} onKeyDown={(e) => e.key === 'Enter' && next()} />
                </Field>
              )}

              {step === 2 && (
                <>
                  <Field label="Email" error={errors.email}>
                    <div className="relative">
                      <Mail size={18} className="absolute left-4 top-3.5 text-slate-500" />
                      <input autoFocus type="email" className={inputCls + ' pl-11'} placeholder="name@example.com" value={f.email} onChange={(e) => set('email', e.target.value)} />
                    </div>
                  </Field>
                  <Field label="Password" error={errors.password}>
                    <PasswordInput value={f.password} onChange={(v) => set('password', v)} placeholder="Create a password" onEnter={next} />
                  </Field>
                  <div className="space-y-1.5">
                    <div className="flex gap-1.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full ${strength >= i ? (strength <= 2 ? 'bg-rose-400' : strength === 3 ? 'bg-amber-400' : 'bg-teal-400') : 'bg-[#1c2030]'}`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">{f.password ? ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'][strength] : 'Use 8+ characters, upper and lower case, and a number.'}</p>
                  </div>
                </>
              )}

              {step === 3 && (
                <Field error={errors.dob} hint={`You must be at least ${MIN_AGE} years old.`}>
                  <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
                    <select aria-label="Day" className={selectCls} value={f.day} onChange={(e) => set('day', e.target.value)}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d}>{d}</option>)}
                    </select>
                    <select aria-label="Month" className={selectCls} value={f.month} onChange={(e) => set('month', e.target.value)}>
                      {MONTHS.map((m) => <option key={m}>{m}</option>)}
                    </select>
                    <select aria-label="Year" className={selectCls} value={f.year} onChange={(e) => set('year', e.target.value)}>
                      {YEARS.map((y) => <option key={y}>{y}</option>)}
                    </select>
                  </div>
                </Field>
              )}

              {step === 4 && (
                <>
                  <Field error={errors.username}>
                    <div className="relative">
                      <AtSign size={18} className="absolute left-4 top-3.5 text-slate-500" />
                      <input autoFocus className={inputCls + ' pl-11 font-semibold'} value={f.username}
                        onChange={(e) => set('username', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" />
                    </div>
                  </Field>
                  <button onClick={() => suggestUsername(f.name)} className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                    <RefreshCw size={15} /> Suggest another
                  </button>
                </>
              )}

              {step === 5 && (
                <>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    We sent a 6-digit code to <span className="text-slate-100 font-semibold">{f.email}</span>. Enter it below.
                  </p>
                  <OtpInput value={otp} onChange={(v) => { setOtp(v); setErrors({}); }} error={errors.otp} />
                  {errors.otp && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle size={13} />{errors.otp}</p>}
                  <button disabled={resend > 0} onClick={async () => { if (await sendCode()) showToast('A new code was sent.'); }}
                    className="text-sm font-semibold text-amber-300 disabled:text-slate-500">
                    {resend > 0 ? `Resend code in ${resend}s` : 'Resend code'}
                  </button>
                </>
              )}
            </div>

            <button className={primaryBtn + ' mt-4'} onClick={next} disabled={busy || (step === 5 && otp.length < 6)}>
              {busy ? 'Please wait...' : step === 5 ? 'Verify and finish' : 'Continue'}
            </button>
          </div>
        )}

        {/* LOGIN */}
        {screen === 'login' && (
          <div className="flex flex-col h-full p-6 overflow-y-auto">
            <button aria-label="Back" onClick={() => setScreen('auth')} className="self-start p-2 -ml-2 mb-6 text-slate-300"><ChevronLeft /></button>
            <h2 className="text-3xl font-extrabold">Welcome back</h2>
            <p className="text-sm text-slate-400 mt-2 mb-6">Log in with your email or your phone number.</p>

            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#171a24] mb-6">
              {[['email', 'Email'], ['phone', 'Phone']].map(([v, l]) => (
                <button key={v} onClick={() => { setLoginMode(v); setLoginErr(''); }}
                  className={`h-10 rounded-lg text-sm font-bold ${loginMode === v ? 'bg-[#2a3043] text-white' : 'text-slate-400'}`}>{l}</button>
              ))}
            </div>

            {loginMode === 'email' && (
              <div className="space-y-4">
                <Field>
                  <div className="relative">
                    <Mail size={18} className="absolute left-4 top-3.5 text-slate-500" />
                    <input type="email" className={inputCls + ' pl-11'} placeholder="Email" value={loginId}
                      onChange={(e) => { setLoginId(e.target.value); setLoginErr(''); }} />
                  </div>
                </Field>
                <Field>
                  <PasswordInput value={loginPw} onChange={(v) => { setLoginPw(v); setLoginErr(''); }} onEnter={handleLogin} />
                </Field>
                {loginErr && <p className="text-sm text-rose-400 flex items-start gap-1.5"><AlertCircle size={16} className="mt-0.5 shrink-0" />{loginErr}</p>}
                <button className="text-sm font-semibold text-amber-300 w-full text-right" onClick={async () => { const em = loginId.trim().toLowerCase(); if (!EMAIL_RE.test(em)) { setLoginErr('Enter your email above first.'); return; } const { error } = await supabase.auth.resetPasswordForEmail(em); showToast(error ? error.message : 'Check your email for the reset link.', error ? 'err' : 'ok'); }}>Forgot password?</button>
                <button className={primaryBtn} onClick={handleLogin} disabled={busy}>{busy ? 'Please wait...' : 'Log in'}</button>
                <div className="flex items-center gap-3 py-1"><div className="flex-1 h-px bg-[#222736]" /><span className="text-xs text-slate-500">or</span><div className="flex-1 h-px bg-[#222736]" /></div>
                <button className={ghostBtn} onClick={googleLogin}>Continue with Google</button>
              </div>
            )}

            {loginMode === 'phone' && (
              <div className="space-y-4">
                {phoneStage === 'enter' && (
                  <>
                    <Field hint="We will send a 6-digit OTP by SMS.">
                      <div className="flex gap-2">
                        <div className="h-12 px-3 rounded-xl bg-[#171a24] border border-[#262b3a] flex items-center text-sm text-slate-300">+91</div>
                        <input autoFocus inputMode="tel" className={inputCls} placeholder="Mobile number" value={phone}
                          onChange={(e) => { setPhone(e.target.value.replace(/[^\d+ ]/g, '')); setLoginErr(''); }}
                          onKeyDown={(e) => e.key === 'Enter' && sendPhoneOtp()} />
                      </div>
                    </Field>
                    {loginErr && <p className="text-sm text-rose-400 flex items-start gap-1.5"><AlertCircle size={16} className="mt-0.5 shrink-0" />{loginErr}</p>}
                    <button className={primaryBtn} onClick={sendPhoneOtp} disabled={busy}>{busy ? 'Sending...' : 'Send OTP'}</button>
                  </>
                )}
                {phoneStage === 'code' && (
                  <>
                    <p className="text-sm text-slate-400">Enter the 6-digit OTP sent to <span className="text-slate-100 font-semibold">{normalizePhone(phone)}</span>.</p>
                    <OtpInput value={phoneOtp} onChange={(v) => { setPhoneOtp(v); setLoginErr(''); }} error={loginErr} />
                    {loginErr && <p className="text-sm text-rose-400 flex items-start gap-1.5"><AlertCircle size={16} className="mt-0.5 shrink-0" />{loginErr}</p>}
                    <button className={primaryBtn} onClick={verifyPhoneOtp} disabled={busy || phoneOtp.length < 6}>{busy ? 'Please wait...' : 'Verify and log in'}</button>
                    <div className="flex justify-between">
                      <button disabled={resend > 0} onClick={sendPhoneOtp} className="text-sm font-semibold text-amber-300 disabled:text-slate-500">
                        {resend > 0 ? `Resend OTP in ${resend}s` : 'Resend OTP'}
                      </button>
                      <button onClick={() => { setPhoneStage('enter'); setLoginErr(''); }} className="text-sm font-semibold text-slate-400">Change number</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* DASHBOARD */}
        {screen === 'dashboard' && (
          <div className="flex flex-col h-full">
            <header className="px-4 py-3 border-b border-[#1c2030] flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-amber-400 text-[#1a1300] flex items-center justify-center font-bold">{initial}</div>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm truncate">{currentUser?.name}</h3>
                  <p className="text-[11px] text-teal-300">@{currentUser?.username}</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(true)} className="h-9 px-3.5 rounded-full bg-amber-400 text-[#1a1300] text-xs font-bold flex items-center gap-1.5">
                <Plus size={16} />New post
              </button>
            </header>

            <main className="flex-1 overflow-y-auto min-h-0">
              {tab === 'home' && (
                <div className="p-4 space-y-4">
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {['All', 'Study', 'Travel', 'Sports', 'Dancing', 'Other'].map((c) => (
                      <button key={c} onClick={() => setCategory(c)}
                        className={`shrink-0 h-9 px-4 rounded-full text-[13px] font-semibold border ${category === c ? 'bg-amber-400 text-[#1a1300] border-amber-400' : 'border-[#2a3043] text-slate-300'}`}>{c}</button>
                    ))}
                  </div>

                  {category === 'Study' && (
                    <div className="rounded-2xl bg-[#13161f] border border-[#222736] p-3 space-y-3">
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#0e1017]">
                        {[['school', 'School'], ['college', 'College'], ['govjobs', 'Govt jobs']].map(([v, l]) => (
                          <button key={v} onClick={() => setStudySub(v)} className={`h-9 rounded-lg text-xs font-bold ${studySub === v ? 'bg-[#242a3c] text-white' : 'text-slate-400'}`}>{l}</button>
                        ))}
                      </div>
                      <select className={selectCls + ' w-full'} value={level[studySub]} onChange={(e) => setLevel({ ...level, [studySub]: e.target.value })}>
                        {studySub === 'school' && <><option value="6-8">Classes 6-8</option><option value="9-12">Classes 9-12</option></>}
                        {studySub === 'college' && <><option value="graduation">Graduation</option><option value="postgraduation">Post graduation</option><option value="higher">Higher studies</option></>}
                        {studySub === 'govjobs' && ['Group A', 'Group B', 'Group C', 'Group D'].map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm">Explore activities</h3>
                    <span className="text-xs text-slate-500">{visible.length} found</span>
                  </div>
                  {visible.map((a) => <ActivityCard key={a.id} a={a} />)}
                  {visible.length === 0 && (
                    <div className="text-center py-10 space-y-3">
                      <p className="text-sm text-slate-400">Nothing here yet. Be the first to start one.</p>
                      <button onClick={() => setShowCreate(true)} className="h-10 px-5 rounded-xl bg-amber-400 text-[#1a1300] text-sm font-bold">Create an activity</button>
                    </div>
                  )}
                </div>
              )}

             {tab === 'reels' && <Reels />}

              {tab === 'message' && (
                <div className="flex flex-col h-full">
                  <div className="px-4 py-3 border-b border-[#1c2030] flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm">Community chat</h4>
                      <p className="text-xs text-teal-300">Shared chat · Live updates</p>
                    </div>
                    <button aria-label="Start video call" onClick={() => setInCall(true)} className="w-10 h-10 rounded-full bg-[#171a24] text-teal-300 flex items-center justify-center"><Video size={18} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                    {chatLoading && <p className="text-center text-sm text-slate-400 py-4">Loading messages...</p>}
                    {!chatLoading && messages.length === 0 && !chatError && (
                      <p className="text-center text-sm text-slate-400 py-8">Abhi koi message nahi. Pehla message aap bhejein!</p>
                    )}
                    {messages.map((m) => {
                      const mine = m.user_id === currentUser?.id;
                      const time = m.created_at
                        ? new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                        : '';
                      return (
                        <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[78%]">
                            <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${mine ? 'bg-amber-400 text-[#1a1300] rounded-br-md' : 'bg-[#1a1e2b] text-slate-100 rounded-bl-md'}`}>{m.body}</div>
                            <p className={`text-[10px] text-slate-500 mt-1 ${mine ? 'text-right' : ''}`}>{mine ? 'You' : m.sender_name} · {time}</p>
                          </div>
                        </div>
                      );
                    })}
                    {chatError && <p role="alert" className="text-center text-xs text-rose-300 py-2">{chatError}</p>}
                    <div ref={chatEnd} />
                  </div>
                  <div className="p-3 border-t border-[#1c2030] flex gap-2">
                    <input value={inputMessage} maxLength={2000} onChange={(e) => setInputMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
                      placeholder="Write a message" className={inputCls + ' h-11 text-sm'} />
                    <button aria-label="Send" onClick={send} disabled={chatBusy || !inputMessage.trim()} className="w-11 h-11 shrink-0 rounded-xl bg-amber-400 text-[#1a1300] flex items-center justify-center disabled:opacity-50"><Send size={17} /></button>
                  </div>
                </div>
              )}

              {tab === 'search' && (
                <div className="p-4 space-y-4">
                  <h3 className="font-bold text-lg">Discover</h3>
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-3.5 text-slate-500" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title, place or topic" className={inputCls + ' pl-11'} />
                  </div>
                  <h4 className="font-bold text-sm">People</h4>

{searchBusy && (
  <p className="text-sm text-slate-400">Searching people...</p>
)}

{userResults.map((person) => (
  <div
    key={person.id}
    className="rounded-xl border border-[#222736] bg-[#13161f] p-3"
  >
    <p className="font-semibold">{person.full_name}</p>
    <p className="text-sm text-teal-300">@{person.username}</p>
    {person.bio && (
      <p className="mt-1 text-xs text-slate-400">{person.bio}</p>
    )}
  </div>
))}

{query.trim().length >= 2 && !searchBusy && userResults.length === 0 && (
  <p className="text-sm text-slate-400">No matching users found.</p>
)}

<h4 className="mt-4 font-bold text-sm">Activities</h4>
                  {searched.map((a) => <ActivityCard key={a.id} a={a} />)}
                  {searched.length === 0 && <p className="text-center text-sm text-slate-400 py-8">No activities match "{query}". Try a different word.</p>}
                </div>
              )}

              {tab === 'profile' && (
                <div className="p-4 space-y-4">
                  <div className="rounded-2xl bg-[#13161f] border border-[#222736] p-6 text-center space-y-3">
                    <div className="w-20 h-20 mx-auto rounded-full bg-amber-400 text-[#1a1300] flex items-center justify-center text-3xl font-bold">{initial}</div>
                    <div>
                      <h3 className="font-bold text-lg">{currentUser?.name}</h3>
                      <p className="text-sm text-teal-300 font-semibold">@{currentUser?.username}</p>
                    </div>
                    <div className="text-left text-sm space-y-2 pt-2">
                      <div className="flex justify-between border-t border-[#222736] pt-3"><span className="text-slate-500">{currentUser?.email ? 'Email' : 'Phone'}</span><span>{currentUser?.email || currentUser?.phone}</span></div>
                      <div className="flex justify-between border-t border-[#222736] pt-3"><span className="text-slate-500">Birthday</span><span>{currentUser?.dob}</span></div>
                      <div className="flex justify-between border-t border-[#222736] pt-3"><span className="text-slate-500">Activities joined</span><span>{joined.length}</span></div>
                    </div>
                  </div>
                  <button onClick={logout} className="w-full h-12 rounded-xl bg-rose-500/10 text-rose-300 font-bold flex items-center justify-center gap-2"><LogOut size={17} />Log out</button>
                </div>
              )}
            </main>

            <nav className="px-2 py-2 border-t border-[#1c2030] bg-[#0b0d13] grid grid-cols-5">
              {[['home', 'Home', Home], ['reels', 'Reels', Video], ['message', 'Messages', MessageSquare], ['search', 'Search', Search], ['profile', 'Profile', User]].map(([id, label, Icon]) => (
                <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-1.5 text-[11px] ${tab === id ? 'text-amber-300 font-bold' : 'text-slate-500'}`}>
                  <Icon size={21} />{label}
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* CREATE MODAL */}
        {showCreate && (
          <div className="absolute inset-0 z-50 bg-black/70 flex items-end" onClick={() => setShowCreate(false)}>
            <div className="w-full bg-[#13161f] rounded-t-3xl p-5 space-y-3 max-h-[90%] overflow-y-auto border-t border-[#222736]" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Create activity</h3>
                <button aria-label="Close" onClick={() => setShowCreate(false)}><X /></button>
              </div>
              <select className={selectCls + ' w-full'} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {['Study', 'Travel', 'Sports', 'Dancing', 'Other'].map((c) => <option key={c}>{c}</option>)}
              </select>
              {draft.category === 'Study' && (
                <select className={selectCls + ' w-full'} value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value })}>
                  <option value="school">School</option><option value="college">College</option><option value="govjobs">Government jobs</option>
                </select>
              )}
              <input className={inputCls} placeholder="Activity title" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setDraftErr(''); }} />
              <input className={inputCls} placeholder="Venue or online" value={draft.venue} onChange={(e) => setDraft({ ...draft, venue: e.target.value })} />
              <textarea className={inputCls + ' h-24 py-3 resize-none'} placeholder="Describe your activity" value={draft.desc} onChange={(e) => { setDraft({ ...draft, desc: e.target.value }); setDraftErr(''); }} />
              {draftErr && <p className="text-xs text-rose-400 flex items-center gap-1"><AlertCircle size={13} />{draftErr}</p>}
              <button className={primaryBtn} onClick={publish}>Publish activity</button>
            </div>
          </div>
        )}

        {/* CALL */}
        {inCall && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-between p-8" style={{ background: 'radial-gradient(100% 50% at 50% 20%, #1f2a2a 0%, #07080c 70%)' }}>
            <div className="pt-24 text-center space-y-3">
              <div className="w-24 h-24 mx-auto bg-amber-400 text-[#1a1300] rounded-full flex items-center justify-center text-3xl font-black">CP</div>
              <h2 className="text-xl font-bold">Caspian Pal</h2>
              <p className="text-sm text-teal-300">Demo call screen</p>
            </div>
            <button aria-label="End call" onClick={() => setInCall(false)} className="w-16 h-16 rounded-full bg-rose-500 flex items-center justify-center mb-6"><PhoneOff size={26} /></button>
          </div>
        )}
      </div>
    </div>
  );
}