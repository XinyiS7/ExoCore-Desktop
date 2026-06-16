import React from 'react';
import { useFont, AVAILABLE_FONTS, FONT_SCALE_OPTIONS } from 'exo-shared';

function ScaleSelector({ label, description, value, onChange, options }) {
  return (
    <div className="space-y-2.5">
      <div>
        <span className="text-[10px] tracking-[0.12em] text-chat-text/70">
          {label}
        </span>
        {description && (
          <p className="text-[9px] text-chat-muted/40 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 py-2.5 rounded-md border text-center transition-all ${
              value === opt.value
                ? 'border-chat-accent/30 bg-chat-accent/5 text-chat-text'
                : 'border-transparent bg-white/[0.02] text-chat-muted hover:border-exo-mist-10 hover:bg-exo-accent/[0.03]'
            }`}
          >
            <p className="text-xs font-medium">{opt.shortLabel}</p>
            <p className="text-[9px] text-chat-muted/50 mt-0.5">
              {opt.value}x
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}

function FontSelector({ label, description, value, onChange }) {
  return (
    <div className="space-y-2.5">
      <div>
        <span className="text-[10px] tracking-[0.12em] text-chat-text/70">
          {label}
        </span>
        {description && (
          <p className="text-[9px] text-chat-muted/40 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>

      <div className="space-y-1">
        {AVAILABLE_FONTS.map((font) => (
          <button
            key={font.value}
            onClick={() => onChange(font.value)}
            className={`w-full text-left px-3 py-2 rounded-md border transition-all ${
              value === font.value
                ? 'border-chat-accent/30 bg-chat-accent/5 text-chat-text'
                : 'border-transparent bg-white/[0.02] text-chat-muted hover:border-exo-mist-10 hover:bg-exo-accent/[0.03]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                value === font.value ? 'border-chat-accent' : 'border-chat-muted/30'
              }`}>
                {value === font.value && (
                  <div className="w-1.5 h-1.5 rounded-full bg-chat-accent" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">
                  {font.label}
                  {font.value === 'sarasa' && (
                    <span className="ml-1.5 text-[9px] text-chat-muted font-normal">默认</span>
                  )}
                </p>
                <p
                  className="text-[10px] text-chat-muted/50 mt-0.5 truncate"
                  style={{ fontFamily: font.value === 'sarasa'
                    ? "'Sarasa Gothic Mono', monospace"
                    : font.value === 'wenkai'
                      ? "'LXGW WenKai', serif"
                      : "'Maple Mono', monospace"
                  }}
                >
                  {font.preview}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AppearancePanel() {
  const { systemFont, messageFont, fontScale, setSystemFont, setMessageFont, setFontScale } = useFont();

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-xl px-8 py-8">
        <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight mb-6">
          🎨 Appearance
        </h2>

        <div className="space-y-6">
          {/* System Font */}
          <FontSelector
            label="🖥️ System Font · 系统字体"
            description="应用于侧边栏、导航、设置、按钮、标签等所有非消息内容的 UI"
            value={systemFont}
            onChange={setSystemFont}
          />

          <div className="border-t border-white/5" />

          {/* Message Font */}
          <FontSelector
            label="💬 Message Font · 消息字体"
            description="仅应用于聊天消息气泡、群桥消息内容和消息输入框"
            value={messageFont}
            onChange={setMessageFont}
          />

          <div className="border-t border-white/5" />

          {/* Font Scale */}
          <ScaleSelector
            label="🔤 Font Scale · 全局缩放"
            description="缩放所有文本大小。不影响界面间距、图标和装饰元素。"
            value={fontScale}
            onChange={setFontScale}
            options={FONT_SCALE_OPTIONS}
          />
        </div>

        {/* Preview cards */}
        <div className="mt-8 space-y-4">
          {/* System font preview */}
          <div className="p-4 rounded-lg border border-white/5 bg-chat-panel">
            <p className="text-[10px] tracking-[0.2em] text-chat-muted/40 mb-3">
              System Font Preview · 系统字体
            </p>
            <div style={{ fontFamily: 'var(--font-system)' }}>
              <p className="text-sm text-chat-text leading-relaxed mb-1">
                Settings · 设置面板 · Navigation · 导航
              </p>
              <p className="text-xs text-chat-muted">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>
          </div>

          {/* Message font preview */}
          <div className="p-4 rounded-lg border border-white/5 bg-chat-panel">
            <p className="text-[10px] tracking-[0.2em] text-chat-muted/40 mb-3">
              Message Font Preview · 消息字体
            </p>
            <div style={{ fontFamily: 'var(--font-message)' }}>
              <p className="text-sm text-chat-text leading-relaxed mb-1">
                こんにちは！今天想聊什么？春江潮水连海平。
              </p>
              <p className="text-xs text-chat-muted">
                Hello! How can I help you today? 0123456789
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
