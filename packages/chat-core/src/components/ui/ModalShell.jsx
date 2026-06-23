import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * ModalShell — 项目统一的弹窗外壳样本。
 *
 * 设计基准：EditPresetModal 的轻盈派
 * （毛玻璃遮罩 + backdrop-blur-2xl 容器 + rounded-2xl
 *   + 渐变下划线 Header / 渐变上划线 Footer），
 * 取代散落全项目的 bg-cinder-glass-heavy / rounded-[2px] / 硬实线分隔硬派外壳。
 *
 * 内置：ESC 关闭、点击遮罩关闭、Header（icon/title/subtitle/close）、
 *      渐变分隔线、Footer 槽位。
 *
 * 文本输入沿用 EditPresetModal 的下划线式（见 FIELD_INPUT 常量导出）。
 */
const MAXW = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
};

export default function ModalShell({
  isOpen,
  onClose,
  icon: Icon,
  title,
  subtitle,
  maxW = 'md',
  footer,
  bodyClassName = '',
  z = 'z-[100]',
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const showHeader = Icon || title || subtitle;

  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center bg-black/5 dark:bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-300`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className={`relative w-full ${MAXW[maxW] ?? MAXW.md} flex flex-col max-h-[90vh] bg-exo-pure/80 backdrop-blur-2xl border border-exo-mist-10/30 shadow-[0_16px_60px_rgba(0,0,0,0.05)] rounded-2xl overflow-hidden`}>

        {/* Header — 渐变下划线分隔 */}
        {showHeader && (
          <div className="flex items-center justify-between px-8 py-6 relative shrink-0">
            <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-exo-mist-10/60 via-exo-mist-10/20 to-transparent" />
            <div className="flex flex-col">
              {title && (
                <h2 className="text-sm font-bold tx-system-normal flex items-center gap-3 font-mono tracking-[0.2em]">
                  {Icon && <Icon size={16} className="tx-system-accent opacity-80" />}
                  {title}
                </h2>
              )}
              {subtitle && (
                <span className="text-[0.6rem] tx-system-mute font-mono tracking-widest opacity-50 mt-1.5 uppercase">
                  {subtitle}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 -mr-2 tx-system-mute hover:tx-system-accent hover:bg-exo-accent/5 rounded-full transition-all duration-300"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={`overflow-y-auto px-8 py-6 flex-1 scrollbar-hide ${bodyClassName}`}>
          {children}
        </div>

        {/* Footer — 渐变上划线分隔（布局由 footer 内容自定） */}
        {footer && (
          <div className="relative px-8 py-5 shrink-0">
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-exo-mist-10/20 to-exo-mist-10/60" />
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 下划线式文本输入 — 单行 input / select 用。
 * 对齐 EditPresetModal 的无框下划线风。
 */
export const FIELD_INPUT =
  'w-full bg-transparent border-b border-exo-mist-10/50 pb-2 text-sm tx-system-normal font-mono focus:border-exo-accent outline-none transition-all placeholder:opacity-20';

/**
 * 柔底 textarea — 多行用。淡背景 + 透明边框 + focus 描边。
 */
export const FIELD_AREA =
  'w-full bg-black/[0.02] dark:bg-white/[0.02] border border-transparent focus:border-exo-accent/30 rounded-xl px-5 py-4 text-[13px] tx-system-normal font-mono outline-none transition-all resize-y leading-relaxed';
