import { Sun, Moon, Type, Sliders, Check } from 'lucide-react';
import { useAppearance } from '../../app/appearanceContext';
import { useDocumentTitle } from '../../shared/useDocumentTitle';

export function AppearancePanel() {
  useDocumentTitle('外观设置');

  const {
    theme,
    setTheme,
    systemFont,
    setSystemFont,
    messageFont,
    setMessageFont,
    codeFont,
    setCodeFont,
    fontScale,
    setFontScale,
    availableFonts,
    scaleConfig,
  } = useAppearance();

  return (
    <div className="settings-panel">
      <div className="settings-panel-header">
        <h1 className="settings-panel-title">外观与体验</h1>
        <p className="settings-panel-desc">
          个性化定制应用界面的深浅色主题、系统与消息字体，以及全局文本缩放比例。
        </p>
      </div>

      <div className="settings-card-stack">
        {/* Theme Settings Card */}
        <section className="settings-card" aria-labelledby="theme-heading">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
            </div>
            <div>
              <h2 id="theme-heading" className="settings-card-title">界面主题</h2>
              <p className="settings-card-desc">选择深色或浅色视觉主题，所有界面与组件即时生效</p>
            </div>
          </div>

          <div className="theme-toggle-group" role="radiogroup" aria-label="界面主题">
            <button
              type="button"
              role="radio"
              aria-checked={theme === 'dark'}
              className={`theme-opt-btn${theme === 'dark' ? ' theme-opt-btn--active' : ''}`}
              onClick={() => setTheme('dark')}
            >
              <Moon size={16} aria-hidden="true" />
              <span>深色模式 (Dark)</span>
              {theme === 'dark' ? <Check size={14} className="theme-opt-check" /> : null}
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={theme === 'light'}
              className={`theme-opt-btn${theme === 'light' ? ' theme-opt-btn--active' : ''}`}
              onClick={() => setTheme('light')}
            >
              <Sun size={16} aria-hidden="true" />
              <span>浅色模式 (Light)</span>
              {theme === 'light' ? <Check size={14} className="theme-opt-check" /> : null}
            </button>
          </div>
        </section>

        {/* Font Family Settings Card */}
        <section className="settings-card" aria-labelledby="fonts-heading">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Type size={18} />
            </div>
            <div>
              <h2 id="fonts-heading" className="settings-card-title">字体偏好</h2>
              <p className="settings-card-desc">独立配置系统外壳、会话正文与代码块的排版字体</p>
            </div>
          </div>

          <div className="font-controls-grid">
            {/* System Font */}
            <div className="font-control-group">
              <label className="font-control-label" htmlFor="system-font-select">
                系统界面字体
              </label>
              <div className="font-pill-list" role="radiogroup" aria-label="系统界面字体">
                {availableFonts.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    role="radio"
                    aria-checked={systemFont === font.value}
                    className={`font-pill-btn${systemFont === font.value ? ' font-pill-btn--active' : ''}`}
                    onClick={() => setSystemFont(font.value)}
                  >
                    <span>{font.label}</span>
                    {systemFont === font.value ? <Check size={12} /> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Font */}
            <div className="font-control-group">
              <label className="font-control-label" htmlFor="message-font-select">
                会话正文字体
              </label>
              <div className="font-pill-list" role="radiogroup" aria-label="会话正文字体">
                {availableFonts.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    role="radio"
                    aria-checked={messageFont === font.value}
                    className={`font-pill-btn${messageFont === font.value ? ' font-pill-btn--active' : ''}`}
                    onClick={() => setMessageFont(font.value)}
                  >
                    <span>{font.label}</span>
                    {messageFont === font.value ? <Check size={12} /> : null}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Font */}
            <div className="font-control-group">
              <label className="font-control-label" htmlFor="code-font-select">
                代码与标记字体
              </label>
              <div className="font-pill-list" role="radiogroup" aria-label="代码与标记字体">
                {availableFonts.map((font) => (
                  <button
                    key={font.value}
                    type="button"
                    role="radio"
                    aria-checked={codeFont === font.value}
                    className={`font-pill-btn${codeFont === font.value ? ' font-pill-btn--active' : ''}`}
                    onClick={() => setCodeFont(font.value)}
                  >
                    <span>{font.label}</span>
                    {codeFont === font.value ? <Check size={12} /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Font Scale Settings Card */}
        <section className="settings-card" aria-labelledby="scale-heading">
          <div className="settings-card-header">
            <div className="settings-card-icon-wrap">
              <Sliders size={18} />
            </div>
            <div>
              <h2 id="scale-heading" className="settings-card-title">文本缩放比例</h2>
              <p className="settings-card-desc">调节全局文本尺寸（80%–150%），保持界面结构无损</p>
            </div>
          </div>

          <div className="scale-control-box">
            <div className="scale-slider-row">
              <span className="scale-bound-label">{scaleConfig.min}%</span>
              <input
                type="range"
                min={scaleConfig.min}
                max={scaleConfig.max}
                step={scaleConfig.step}
                value={fontScale}
                onChange={(e) => setFontScale(Number(e.target.value))}
                aria-label="文本缩放比例"
                aria-valuenow={fontScale}
                aria-valuemin={scaleConfig.min}
                aria-valuemax={scaleConfig.max}
                className="scale-range-slider"
              />
              <span className="scale-bound-label">{scaleConfig.max}%</span>
              <span className="scale-current-badge">{fontScale}%</span>
            </div>

            <div className="scale-preset-chips" aria-label="预设字号快速选择">
              {scaleConfig.presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`app-btn app-btn-ghost scale-chip-btn${fontScale === preset ? ' scale-chip-btn--active' : ''}`}
                  onClick={() => setFontScale(preset)}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Live Typography Previews */}
        <section className="settings-card" aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="settings-card-title" style={{ marginBottom: '12px' }}>
            效果实时预览
          </h2>

          <div className="appearance-previews-grid">
            {/* System UI Preview */}
            <div className="preview-box preview-box--system">
              <div className="preview-box-head">系统界面 (System UI)</div>
              <div className="preview-box-body">
                <div className="preview-sample-row">
                  <span className="app-h2">标题与控件示例</span>
                  <span className="app-phase-chip app-phase-chip--g045">G045</span>
                </div>
                <p className="app-muted">这里展示系统导航、按钮及普通标签的排版与层级对比。</p>
                <div className="preview-actions-row">
                  <button type="button" className="app-btn app-btn--primary">主要按钮</button>
                  <button type="button" className="app-btn">次要按钮</button>
                </div>
              </div>
            </div>

            {/* Message Typography Preview */}
            <div className="preview-box preview-box--message">
              <div className="preview-box-head">会话正文 (Message Typography)</div>
              <div className="preview-box-body app-md">
                <p>
                  <strong>自然语言对话体验</strong>：在秩序与理性的位面，言辞精准沉稳，排版清晰温润。
                </p>
                <blockquote>“对 Alicia 的专注、护佑与不可动摇的意志。”</blockquote>
              </div>
            </div>

            {/* Code Highlight Preview */}
            <div className="preview-box preview-box--code">
              <div className="preview-box-head">代码语法 (Code & Syntax)</div>
              <div className="app-code-wrap" style={{ margin: 0 }}>
                <div className="app-code-head">
                  <span className="app-code-lang">TypeScript</span>
                </div>
                <pre className="app-code-block">
                  <code className="hljs">
                    <span className="hljs-keyword">interface</span>{' '}
                    <span className="hljs-title class_">DesignTokens</span> {'{\n'}
                    {'  '}
                    <span className="hljs-attr">theme</span>: <span className="hljs-string">'dark'</span> |{' '}
                    <span className="hljs-string">'light'</span>;{'\n'}
                    {'  '}
                    <span className="hljs-attr">scale</span>: <span className="hljs-type">number</span>;{'\n'}
                    {'}'}
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
