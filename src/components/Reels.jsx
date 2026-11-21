import { useEffect, useState } from 'react';
import { Heart, RefreshCw, Upload } from 'lucide-react';
import { supabase } from '../supabase';

export default function Reels() {
  const [userId, setUserId] = useState(null);
  const [reels, setReels] = useState([]);
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyLike, setBusyLike] = useState(null);
  const [message, setMessage] = useState('');

  const loadReels = async (uid) => {
    setLoading(true);
    setMessage('');

    const { data: rows, error } = await supabase
      .from('reels')
      .select('id, user_id, video_path, caption, created_at')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const ids = (rows || []).map((r) => r.id);
    const authorIds = [...new Set((rows || []).map((r) => r.user_id))];

    let likes = [];
    let profiles = [];

    if (ids.length) {
      const { data } = await supabase
        .from('reel_likes')
        .select('reel_id, user_id')
        .in('reel_id', ids);
      likes = data || [];
    }

    if (authorIds.length) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name')
        .in('id', authorIds);
      profiles = data || [];
    }

    setReels((rows || []).map((r) => ({
      ...r,
      videoUrl: supabase.storage.from('reels').getPublicUrl(r.video_path).data.publicUrl,
      likeCount: likes.filter((x) => x.reel_id === r.id).length,
      likedByMe: likes.some((x) => x.reel_id === r.id && x.user_id === uid),
      author: profiles.find((p) => p.id === r.user_id),
    })));

    setLoading(false);
  };

  useEffect(() => {
    let active = true;

    const start = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;

      const uid = data.session?.user?.id;
      setUserId(uid || null);

      if (uid) {
        await loadReels(uid);
      } else {
        setMessage('Login karke Reels dekho.');
        setLoading(false);
      }
    };

    start();

    const { data: authData } = supabase.auth.onAuthStateChange((_event, session) => {
      const uid = session?.user?.id || null;
      setUserId(uid);
      if (uid) loadReels(uid);
    });

    return () => {
      active = false;
      authData.subscription.unsubscribe();
    };
  }, []);

  const uploadReel = async () => {
    if (!userId) {
      setMessage('Reel upload karne ke liye login zaroori hai.');
      return;
    }
    if (!file) {
      setMessage('Pehle video select karo.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setMessage('Video 100 MB se chhota hona chahiye.');
      return;
    }

    setUploading(true);
    setMessage('');

    const ext = file.name.split('.').pop()?.toLowerCase() || 'mp4';
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('reels')
      .upload(path, file, {
        contentType: file.type || 'video/mp4',
        upsert: false,
      });

    if (uploadError) {
      setMessage(uploadError.message);
      setUploading(false);
      return;
    }

    const { error: saveError } = await supabase.from('reels').insert({
      user_id: userId,
      video_path: path,
      caption: caption.trim(),
    });

    if (saveError) {
      await supabase.storage.from('reels').remove([path]);
      setMessage(saveError.message);
      setUploading(false);
      return;
    }

    setFile(null);
    setCaption('');
    setUploading(false);
    setMessage('Reel upload ho gayi!');
    await loadReels(userId);
  };

  const toggleLike = async (reel) => {
    if (!userId) return;

    setBusyLike(reel.id);

    const result = reel.likedByMe
      ? await supabase
          .from('reel_likes')
          .delete()
          .eq('reel_id', reel.id)
          .eq('user_id', userId)
      : await supabase
          .from('reel_likes')
          .insert({ reel_id: reel.id, user_id: userId });

    if (result.error) setMessage(result.error.message);
    else await loadReels(userId);

    setBusyLike(null);
  };

  return (
    <section className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">Reels</h3>
        <button
          onClick={() => userId && loadReels(userId)}
          className="text-slate-300"
          aria-label="Refresh Reels"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      <div className="rounded-2xl border border-[#222736] bg-[#13161f] p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-amber-300">
          <Upload size={17} />
          Upload a reel
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="block min-w-0 text-xs text-slate-400"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </label>

        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Write a caption"
          maxLength={500}
          className="w-full rounded-xl border border-[#262b3a] bg-[#171a24] px-3 py-2 text-sm text-white"
        />

        <button
          onClick={uploadReel}
          disabled={uploading}
          className="w-full rounded-xl bg-amber-400 py-2.5 font-bold text-[#1a1300] disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Post reel'}
        </button>
      </div>

      {message && <p className="text-sm text-slate-300">{message}</p>}
      {loading && <p className="text-sm text-slate-400">Loading Reels...</p>}

      <div className="space-y-5">
        {reels.map((reel) => (
          <article key={reel.id} className="overflow-hidden rounded-2xl border border-[#222736] bg-[#13161f]">
            <div className="p-3">
              <p className="text-sm font-bold">{reel.author?.full_name || 'Caspian Pal member'}</p>
              <p className="text-xs text-teal-300">
                @{reel.author?.username || 'member'}
              </p>
            </div>

            <video
              src={reel.videoUrl}
              controls
              playsInline
              loop
              className="aspect-[9/16] max-h-[520px] w-full bg-black object-contain"
            />

            <div className="flex items-center gap-3 p-3">
              <button
                onClick={() => toggleLike(reel)}
                disabled={busyLike === reel.id}
                aria-label="Like reel"
                className={reel.likedByMe ? 'text-rose-400' : 'text-slate-300'}
              >
                <Heart size={22} fill={reel.likedByMe ? 'currentColor' : 'none'} />
              </button>
              <span className="text-sm text-slate-300">{reel.likeCount} likes</span>
              {reel.caption && <p className="ml-auto text-sm text-slate-200">{reel.caption}</p>}
            </div>
          </article>
        ))}

        {!loading && reels.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">
            Abhi koi Reel nahi hai. Pehli Reel upload karo!
          </p>
        )}
      </div>
    </section>
  );
}