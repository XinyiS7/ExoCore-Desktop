import React from 'react';
import {
  MessageSquare, BrainCircuit, ScrollText,
  ArrowRight, Calendar
} from 'lucide-react';
import CalendarWidget from './CalendarWidget';

const QUICK_ACTIONS = [
  {
    tab: 'chat',
    icon: MessageSquare,
    label: '即时会话',
    desc: '与 AI 节点建立即时链路',
    color: 'text-exo-accent'
  },
  {
    tab: 'agent_hub',
    icon: BrainCircuit,
    label: '代理中心',
    desc: '调整代理预设与认知模型',
    color: 'text-exo-accent'
  },
  {
    tab: 'timeline',
    icon: ScrollText,
    label: '时间线',
    desc: '查看节点动态与交互记录',
    color: 'text-purple-400'
  },
  {
    tab: 'calendar',
    icon: Calendar,
    label: '日程管理',
    desc: '同步任务与时序计划',
    color: 'text-blue-400'
  },
];

export default function HomePanel({ setCurrentTab }) {
  const userNick = localStorage.getItem('exo_user_nick') || 'Exo User';

  return (
    <div className="flex-1 h-full overflow-y-auto bg-exo-bg relative scrollbar-hide">
      {/* Decorative Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-exo-accent/5 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto px-6 md:px-12 py-16 md:py-24 flex flex-col gap-16 relative z-10">

        {/* Hero Section */}
        <div className="space-y-8 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-exo-accent/40" />
            <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-exo-accent/60">ExoCore Neural Link // System.Init()</div>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-5xl md:text-7xl font-display font-light leading-ultra-tight tracking-tight text-white">
              Welcome back, <span className="text-exo-accent font-medium">{userNick.toUpperCase()}</span>
            </h1>
            <p className="text-lg text-exo-muted max-w-2xl font-light leading-tight-12">
              您的个人 AI 协作中枢已就绪。所有子系统运行正常，<span className="text-exo-accent/60 font-mono">链路延迟 2ms</span>。
            </p>
            <div className="pt-4 flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Layout</span>
              <button
                onClick={() => {
                  const next = localStorage.getItem('exo_layout_version') === 'v2' ? 'v1' : 'v2';
                  localStorage.setItem('exo_layout_version', next);
                  window.dispatchEvent(new CustomEvent('layout-version-changed', { detail: next }));
                }}
                className="relative w-10 h-5 rounded-full border border-exo-mist-10 bg-exo-pure transition-colors hover:border-exo-accent/30"
              >
                <div
                  className="absolute top-0.5 transition-all w-4 h-4 rounded-full bg-exo-accent/60"
                  style={{ left: localStorage.getItem('exo_layout_version') === 'v2' ? '1.25rem' : '0.125rem' }}
                />
              </button>
              <span className="text-[10px] font-mono text-exo-muted">
                {localStorage.getItem('exo_layout_version') === 'v2' ? 'v2 (new)' : 'v1'}
              </span>
            </div>
          </div>
        </div>

        {/* Main Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          {QUICK_ACTIONS.map(({ tab, icon: Icon, label, desc, color }) => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className="group relative flex items-center gap-8 p-10 bg-exo-pure border border-exo-mist-10 rounded-[4px] hover:border-exo-accent/40 hover:shadow-brutalist transition-all text-left overflow-hidden"
            >
              <div className="absolute -top-4 -right-4 p-8 opacity-0 group-hover:opacity-[0.03] transition-all duration-700 group-hover:scale-150 group-hover:-rotate-12">
                <Icon size={160} />
              </div>

              <div className={`p-4 rounded-[2px] bg-white/[0.03] border border-exo-mist-10 ${color} group-hover:border-exo-accent/40 group-hover:shadow-glow-gold transition-all`}>
                <Icon size={32} />
              </div>

              <div className="flex-1 space-y-2 relative z-10">
                <div className="text-2xl font-display font-light tracking-wide text-white group-hover:text-exo-accent transition-colors leading-tight">{label}</div>
                <div className="text-[11px] font-mono uppercase tracking-widest text-exo-muted group-hover:text-exo-muted/80 transition-colors">{desc}</div>
              </div>

              <ArrowRight className="text-exo-mist-20 group-hover:text-exo-accent transition-colors translate-x-0 group-hover:translate-x-1" size={24} />
            </button>
          ))}
        </div>

        {/* Calendar Section */}
        <div id="home-calendar-section" className="space-y-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-exo-accent/40" />
            <div className="text-[10px] font-mono uppercase tracking-[0.5em] text-exo-accent/60">Chronos System // Task.Scheduler</div>
          </div>
          <div className="bg-exo-pure border border-exo-mist-10 rounded-[4px] p-1">
            <CalendarWidget />
          </div>
        </div>

        {/* System Stats / Bottom Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-10 border-t border-exo-mist-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Active Nodes</div>
            <div className="text-3xl font-light font-mono text-exo-accent">12</div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Memory Link</div>
            <div className="text-3xl font-light font-mono text-white tracking-widest uppercase">Stable</div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Core Version</div>
            <div className="text-3xl font-light font-mono text-white">2.1.92</div>
          </div>
          <div className="space-y-2">
            <div className="text-[10px] font-mono uppercase tracking-[0.3em] text-exo-muted">Uptime</div>
            <div className="text-3xl font-light font-mono text-exo-accent">99.9%</div>
          </div>
        </div>

      </div>
    </div>
  );
}
