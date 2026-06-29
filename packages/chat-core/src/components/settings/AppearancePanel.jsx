import React from 'react';
import { useFont, useTheme, AVAILABLE_FONTS, FONT_SCALE_CONFIG, getFontStack } from 'exo-shared';

function FontSelector({ label, description, value, onChange }) {
  return (
    <div className="space-y-2.5">
      <div>
        <span className="tx-decoration-normal">
          {label}
        </span>
        {description && (
          <p className="tx-decoration-mute mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>

      <div className="space-y-1">
        {AVAILABLE_FONTS.map((font) => (
          <button
            key={font.value}
            onClick={() => onChange(font.value)}
            className={`w-full text-left px-3 py-2 rounded-md border transition-all ${
              value === font.value
                ? 'border-chat-accent/30 bg-chat-accent/5 tx-system-normal'
                : 'border-transparent bg-cinder-surface tx-system-mute hover:border-exo-mist-10 hover:bg-exo-accent/[0.03]'
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
                <p className="tx-system-normal font-medium truncate">
                  {font.label}
                  {font.value === 'sarasa' && (
                    <span className="ml-1.5 tx-decoration-mute">默认</span>
                  )}
                </p>
                <p
                  className="tx-decoration-mute mt-0.5 truncate"
                  style={{ fontFamily: getFontStack(font.value) }}
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

function ScaleSlider({ value, onChange, config }) {
  const pct = Math.round(value);
  // snap to nearest step on change
  const handleChange = (e) => {
    const raw = parseInt(e.target.value, 10);
    onChange(raw);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="tx-decoration-normal">
          🔤 Font Scale · 全局缩放
        </span>
        <span className="tx-system-accent tabular-nums">
          {pct}%
        </span>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={handleChange}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer
            bg-cinder-line
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-chat-accent
            [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-glow-gold
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-110"
          style={{
            background: `linear-gradient(to right, rgb(var(--exo-accent-rgb) / 0.2) 0%, rgb(var(--exo-accent-rgb) / 0.2) ${((value - config.min) / (config.max - config.min)) * 100}%, rgb(var(--exo-metal-rgb) / 0.3) ${((value - config.min) / (config.max - config.min)) * 100}%, rgb(var(--exo-metal-rgb) / 0.3) 100%)`,
          }}
        />

        {/* Preset ticks */}
        <div className="flex justify-between px-0.5 mt-1.5">
          {config.presets.map((p) => (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`tx-decoration-normal transition-colors ${
                 Math.abs(value - p) < config.step
                   ? 'font-medium'
                   : 'tx-decoration-mute hover:tx-decoration-normal'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <p className="tx-decoration-mute leading-relaxed">
        基准字号 16px。拖动滑块调整全局文本缩放，所有 rem 单位同步响应。
      </p>
    </div>
  );
}

export default function AppearancePanel() {
  const {
    systemFont, messageFont, codeFont, fontScale,
    setSystemFont, setMessageFont, setCodeFont, setFontScale,
    scaleConfig,
  } = useFont();

  const { theme, setTheme } = useTheme();

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-xl px-8 py-8">
        <h2 className="tx-subtitle-normal mb-6">
          🎨 Appearance
        </h2>

        <div className="space-y-6">
          {/* System Font */}
          <FontSelector
            label="🖥️ System Font · 系统字体"
            description="侧边栏、导航、设置、按钮、标签等所有 UI 文本"
            value={systemFont}
            onChange={setSystemFont}
          />

          <div className="border-t border-cinder-line" />

          {/* Message Font */}
          <FontSelector
            label="💬 Message Font · 消息字体"
            description="聊天消息气泡、消息输入框"
            value={messageFont}
            onChange={setMessageFont}
          />

          <div className="border-t border-cinder-line" />

          {/* Code Font */}
          <FontSelector
            label="⌨️ Code Font · 代码字体"
            description="代码块、行内代码、Thinking 思考块"
            value={codeFont}
            onChange={setCodeFont}
          />

          <div className="border-t border-cinder-line" />

          {/* Font Scale Slider */}
          <ScaleSlider
            value={fontScale}
            onChange={setFontScale}
            config={scaleConfig}
          />

          <div className="border-t border-cinder-line" />

          {/* Theme Toggle */}
          <div className="space-y-3">
            <div>
              <span className="tx-decoration-normal">
                🎨 Theme · 主题
              </span>
              <p className="tx-decoration-mute mt-0.5 leading-relaxed">
                切换深色 / 浅色全局配色方案
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setTheme('dark')}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'border-chat-accent/40 bg-chat-accent/10 tx-system-accent shadow-glow-gold'
                    : 'border-cinder-line bg-cinder-surface tx-system-mute hover:border-exo-mist-20'
                }`}
              >
                <span className="block text-lg mb-1">🌙</span>
                Dark · 深色
              </button>

              <button
                onClick={() => setTheme('light')}
                className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                  theme === 'light'
                    ? 'border-chat-accent/40 bg-chat-accent/10 tx-system-accent shadow-glow-gold'
                    : 'border-cinder-line bg-cinder-surface tx-system-mute hover:border-exo-mist-20'
                }`}
              >
                <span className="block text-lg mb-1">☀️</span>
                Light · 浅色
              </button>
            </div>
          </div>
        </div>

        {/* Preview cards */}
        <div className="mt-8 space-y-4">
          {/* System font preview */}
          <div className="p-4 rounded-lg border border-cinder-line bg-chat-panel">
            <p className="tx-decoration-mute mb-3">
              System Font Preview · 系统字体
            </p>
            <div style={{ fontFamily: 'var(--font-system)' }}>
              <p className="text-sm tx-system-normal leading-relaxed mb-1">
                Settings · 设置面板 · Navigation · 导航
              </p>
              <p className="text-xs tx-system-mute">
                The quick brown fox jumps over the lazy dog. 0123456789
              </p>
            </div>
          </div>

          {/* Message font preview */}
          <div className="p-4 rounded-lg border border-cinder-line bg-chat-panel">
            <p className="tx-decoration-mute mb-3">
              Message Font Preview · 消息字体
            </p>
            <div style={{ fontFamily: 'var(--font-message)' }}>
              <p className="text-sm tx-system-normal leading-relaxed mb-1">
                こんにちは！今天想聊什么？春江潮水连海平。
              </p>
              <p className="text-xs tx-system-mute">
                Hello! How can I help you today? 0123456789
              </p>
            </div>
          </div>

          {/* Code font preview */}
          <div className="p-4 rounded-lg border border-cinder-line bg-chat-panel">
            <p className="tx-decoration-mute mb-3">
              Code Font Preview · 代码字体
            </p>
            <div style={{ fontFamily: 'var(--font-code)' }}>
              <p className="text-sm tx-system-normal leading-relaxed mb-1">
                  <code className="bg-cinder-surface px-1 py-0.5 rounded text-xs">
                  const hello = () =&gt; "Hello World";
                </code>
              </p>
              <p className="text-xs tx-system-mute">
                function fib(n) &#123; return n &lt;= 1 ? n : fib(n-1) + fib(n-2); &#125;
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
