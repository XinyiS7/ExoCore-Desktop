import React, { useState, useRef } from 'react';
import { Camera, Check, User, AtSign } from 'lucide-react';

export default function SettingsView() {
  const [userNick, setUserNick] = useState(() => localStorage.getItem('exo_user_nick') || 'Exo User');
  const [avatarUrl, setAvatarUrl] = useState(() => {
    const saved = localStorage.getItem('exo_user_avatar');
    return saved || `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(userNick)}`;
  });
  const [nickInput, setNickInput] = useState(userNick);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef(null);

  const handleAvatarUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result;
      localStorage.setItem('exo_user_avatar', base64);
      setAvatarUrl(base64);
      window.dispatchEvent(new CustomEvent('user-avatar-updated'));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNick = () => {
    const trimmed = nickInput.trim() || 'Exo User';
    localStorage.setItem('exo_user_nick', trimmed);
    setUserNick(trimmed);
    window.dispatchEvent(new CustomEvent('user-nick-updated'));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-chat-bg">
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-light text-chat-text tracking-tight">Settings</h1>
          <p className="text-sm text-chat-muted">Manage your profile and preferences</p>
        </div>

        {/* ── Profile Section ── */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <User size={16} className="text-chat-accent" />
            <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-chat-muted">Profile</h2>
          </div>

          <div className="bg-chat-panel border border-white/5 rounded-lg p-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                <img
                  src={avatarUrl}
                  alt="Avatar"
                  className="w-16 h-16 rounded-lg border border-white/10 object-cover bg-chat-bg"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Camera size={20} className="text-white" />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </div>
              <div>
                <p className="text-sm text-chat-text font-medium">{userNick}</p>
                <p className="text-xs text-chat-muted mt-0.5">Click avatar to change</p>
              </div>
            </div>

            {/* Nickname */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-chat-muted">
                <AtSign size={10} />
                Nickname
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nickInput}
                  onChange={e => setNickInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNick(); }}
                  placeholder="Your display name"
                  maxLength={30}
                  className="flex-1 px-3 py-2 bg-chat-bg border border-white/10 rounded text-sm text-chat-text outline-none focus:border-chat-accent/40 transition-colors placeholder:text-chat-muted/30"
                />
                <button
                  onClick={handleSaveNick}
                  className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                    saved
                      ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                      : 'bg-chat-accent text-white hover:brightness-110'
                  }`}
                >
                  {saved ? <Check size={14} /> : null}
                  {saved ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Placeholder Sections ── */}
        {[
          { icon: '🔔', title: 'Notifications', desc: 'Configure alert preferences and notification channels' },
          { icon: '🎨', title: 'Appearance', desc: 'Theme, font size, and display settings' },
          { icon: '🔑', title: 'API & Model Keys', desc: 'Manage provider API keys and model configurations' },
          { icon: '💾', title: 'Data & Storage', desc: 'Cache management, export, and storage preferences' },
          { icon: '🔗', title: 'Integrations', desc: 'Google Calendar, external services, webhooks' },
        ].map(({ icon, title, desc }) => (
          <section key={title} className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-sm">{icon}</span>
              <h2 className="text-xs font-mono uppercase tracking-[0.2em] text-chat-muted">{title}</h2>
            </div>
            <div className="bg-chat-panel border border-white/5 rounded-lg p-6">
              <p className="text-sm text-chat-muted/40 italic">{desc}</p>
              <p className="text-[10px] text-chat-muted/20 font-mono uppercase tracking-wider mt-2">Coming soon</p>
            </div>
          </section>
        ))}

        <div className="pb-16" />
      </div>
    </div>
  );
}
