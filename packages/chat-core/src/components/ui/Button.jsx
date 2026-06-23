import React from 'react';

/**
 * Button — 项目统一的操作型按钮样本。
 *
 * 设计基准：AgentProfile.New Session 的描边幽灵风
 * （透明底 + 描边 + rounded-md + hover 提亮），
 * 取代散落全项目的 bg-white / shadow-brutalist / rounded-[2px] 硬编码。
 *
 * variant
 *   primary — 主提交（Create / Save / Commit）：accent 描边，hover 微填充
 *   ghost   — 次级（Cancel / Abort）：无描边，hover 文字提亮
 *   danger  — 危险（Delete / Purge）：red 描边，hover 微填充
 *
 * loading 视觉由调用方控制（沿用 {saving ? <Spinner/> : <Icon/>} 约定），
 * Button 只负责 disabled 态。
 */
const VARIANTS = {
  primary: 'border-exo-accent/25 tx-system-accent hover:bg-exo-accent/5 hover:border-exo-accent/50',
  ghost: 'border-transparent tx-system-mute hover:tx-system-normal hover:bg-exo-mist-10/15',
  danger: 'border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50',
};

const SIZES = {
  md: 'px-5 py-2 text-[0.6875rem]',
  sm: 'px-3 py-1.5 text-[0.625rem]',
};

const Button = React.forwardRef(function Button(
  { variant = 'ghost', size = 'md', type = 'button', className = '', children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-md border bg-transparent',
        'font-mono tracking-[0.2em] transition-all duration-300 cursor-pointer select-none',
        'disabled:opacity-30 disabled:pointer-events-none',
        VARIANTS[variant] ?? VARIANTS.ghost,
        SIZES[size] ?? SIZES.md,
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </button>
  );
});

export default Button;
