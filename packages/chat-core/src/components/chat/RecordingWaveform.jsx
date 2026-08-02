import React, { useEffect, useRef, useState } from 'react';

/**
 * 录音动态波形动画组件 (Recording Waveform Animation)
 * - 传入 MediaStream 时：基于 Web Audio API AnalyserNode 真实可视化麦克风音量/频域数据
 * - 未传入 MediaStream 或静音时：提供流畅的有机声波脉冲动画
 *
 * @param {Object} props
 * @param {boolean} [props.isRecording=true] - 是否处于录音状态
 * @param {MediaStream} [props.stream] - 麦克风音频流 (可选)
 * @param {number} [props.barCount=24] - 波形条数量
 * @param {string} [props.className] - 容器 CSS
 */
export default function RecordingWaveform({
  isRecording = true,
  stream = null,
  barCount = 24,
  className = ''
}) {
  const [heights, setHeights] = useState(() => new Array(barCount).fill(15));
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!isRecording) {
      setHeights(new Array(barCount).fill(15));
      return;
    }

    let audioContext = null;
    let analyser = null;
    let source = null;
    let dataArray = null;

    // 尝试初始化真实音频分析节点
    if (stream && typeof window.AudioContext !== 'undefined') {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioCtx();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // 低 FFT 尺寸，低延迟高灵敏
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      } catch (err) {
        console.warn('[RecordingWaveform] Realtime audio analyser unavailable, falling back to simulated wave:', err);
        analyser = null;
      }
    }

    let phase = 0;

    const renderFrame = () => {
      phase += 0.15;
      const nextHeights = [];

      if (analyser && dataArray) {
        analyser.getByteFrequencyData(dataArray);
        const step = Math.max(1, Math.floor(dataArray.length / barCount));

        for (let i = 0; i < barCount; i++) {
          const val = dataArray[i * step] || 0;
          // 归一化到 10% - 100% 相对高度
          const heightPercent = Math.min(100, Math.max(12, Math.round((val / 255) * 100)));
          nextHeights.push(heightPercent);
        }
      } else {
        // 模拟动感声波 (结合正弦波与随机微动)
        for (let i = 0; i < barCount; i++) {
          const wave = Math.sin(phase + i * 0.4) * 35 + 45;
          const noise = Math.random() * 15;
          const heightPercent = Math.min(100, Math.max(15, Math.round(wave + noise)));
          nextHeights.push(heightPercent);
        }
      }

      setHeights(nextHeights);
      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (source) {
        try { source.disconnect(); } catch (_) {}
      }
      if (analyser) {
        try { analyser.disconnect(); } catch (_) {}
      }
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch (_) {}
      }
    };
  }, [isRecording, stream, barCount]);

  return (
    <div
      className={`flex items-center justify-center gap-[3px] h-8 px-2 py-1 select-none overflow-hidden ${className}`}
      aria-label="Recording Waveform Visualizer"
    >
      {heights.map((h, idx) => (
        <span
          key={idx}
          className="w-[3px] rounded-full bg-exo-accent transition-all duration-75 ease-out opacity-85"
          style={{
            height: `${h}%`,
            minHeight: '4px'
          }}
        />
      ))}
    </div>
  );
}
