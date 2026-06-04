import React from 'react';
import { useFont, AVAILABLE_FONTS } from 'exo-shared';

export default function AppearancePanel() {
  const { fontPreference, setFont } = useFont();

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-xl px-8 py-8">
        {/* Section header */}
        <h2 className="text-sm font-semibold text-chat-text/90 tracking-tight mb-6">
          🎨 Appearance
        </h2>

        {/* Font selector */}
        <div className="space-y-4">
          <label className="block">
            <span className="text-xs font-medium text-chat-muted uppercase tracking-wider">
              Interface Font · 界面字体
            </span>
          </label>

          <div className="space-y-2">
            {AVAILABLE_FONTS.map((font) => (
              <button
                key={font.value}
                onClick={() => setFont(font.value)}
                className={`w-full text-left px-4 py-3 rounded-md border transition-all ${
                  fontPreference === font.value
                    ? 'border-chat-accent bg-chat-accent/10 text-chat-text'
                    : 'border-white/5 bg-white/[0.02] text-chat-muted hover:border-white/10 hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Radio indicator */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    fontPreference === font.value
                      ? 'border-chat-accent'
                      : 'border-chat-muted/30'
                  }`}>
                    {fontPreference === font.value && (
                      <div className="w-2 h-2 rounded-full bg-chat-accent" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {font.label}
                      {font.value === 'sarasa' && (
                        <span className="ml-2 text-[10px] text-chat-muted font-normal">默认</span>
                      )}
                    </p>
                    <p
                      className="text-[11px] text-chat-muted/70 mt-0.5 truncate"
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

        {/* Preview card */}
        <div className="mt-8 p-5 rounded-lg border border-white/5 bg-chat-panel/50">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-chat-muted mb-3">
            Preview · 字体预览
          </p>
          <div style={{ fontFamily: 'var(--font-body)' }}>
            <p className="text-base text-chat-text leading-relaxed mb-2">
              春江潮水连海平，海上明月共潮生。
            </p>
            <p className="text-sm text-chat-muted leading-relaxed mb-3">
              The quick brown fox jumps over the lazy dog. 0123456789
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-nav)' }} className="mb-2">
            <p className="text-xs text-chat-muted">
              — Navigation text (霞鹜文楷) · 导航文字
            </p>
          </div>
          <div style={{ fontFamily: 'var(--font-code)' }}>
            <p className="text-xs text-chat-muted">
              <code>const code = "Maple Mono" · 代码块文字</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
