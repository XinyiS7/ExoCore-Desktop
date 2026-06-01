import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Check } from 'lucide-react';

const CROP_SIZE = 220;

const AvatarCropModal = ({ file, onConfirm, onCancel }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [ready, setReady] = useState(false);
  const [blobUrl, setBlobUrl] = useState('');
  const imgRef = useRef(null);
  const cropContainerRef = useRef(null);
  const dragRef = useRef(null);
  const pinchRef = useRef(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onImgLoad = (e) => {
    const { naturalWidth: w, naturalHeight: h } = e.target;
    setScale(CROP_SIZE / Math.min(w, h));
    setReady(true);
  };

  // 所有交互事件统一用 native addEventListener，绕开 React 合成事件与 setPointerCapture 的兼容问题
  useEffect(() => {
    const el = cropContainerRef.current;
    if (!el) return;

    // 拖拽：Pointer Events（覆盖鼠标和单指触摸）
    const onDown = (e) => {
      el.setPointerCapture(e.pointerId);
      dragRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMove = (e) => {
      if (!dragRef.current) return;
      setPos(p => ({ x: p.x + e.clientX - dragRef.current.x, y: p.y + e.clientY - dragRef.current.y }));
      dragRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => { dragRef.current = null; };

    // 双指缩放：Touch Events（pinchRef 仅在双指时设置）
    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        pinchRef.current = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && pinchRef.current !== null) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        setScale(s => Math.min(10, Math.max(0.1, s * dist / pinchRef.current)));
        pinchRef.current = dist;
      }
    };

    // 滚轮缩放
    const onWheel = (e) => {
      e.preventDefault();
      setScale(s => Math.min(10, Math.max(0.1, s * (e.deltaY > 0 ? 0.9 : 1.1))));
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('touchstart', onTouchStart);
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('wheel', onWheel);
    };
  }, []);  

  const handleConfirm = () => {
    const imgEl = imgRef.current;
    const containerEl = cropContainerRef.current;
    if (!imgEl || !containerEl) return;

    // getBoundingClientRect accounts for CSS transforms
    const imgRect = imgEl.getBoundingClientRect();
    const containerRect = containerEl.getBoundingClientRect();
    const cx = containerRect.left + containerRect.width / 2;
    const cy = containerRect.top + containerRect.height / 2;

    const rx = imgEl.naturalWidth / imgRect.width;
    const ry = imgEl.naturalHeight / imgRect.height;
    const halfW = (CROP_SIZE / 2) * rx;
    const halfH = (CROP_SIZE / 2) * ry;

    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    canvas.getContext('2d').drawImage(
      imgEl,
      (cx - imgRect.left) * rx - halfW,
      (cy - imgRect.top) * ry - halfH,
      halfW * 2, halfH * 2,
      0, 0, 200, 200
    );
    onConfirm(canvas.toDataURL('image/jpeg', 0.85));
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="bg-exo-pure border border-exo-mist-10 rounded-[2px] p-6 flex flex-col items-center gap-6 shadow-[0_0_60px_rgba(0,0,0,0.5)]"
        style={{ width: CROP_SIZE + 80 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-exo-accent" />
            <h3 className="text-[11px] font-bold text-white uppercase tracking-[0.2em] font-mono">Avatar Calibration</h3>
          </div>
          <button onClick={onCancel} className="text-exo-muted hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="relative p-1 bg-exo-bg border border-exo-mist-10 rounded-full shadow-inner">
          <div
            ref={cropContainerRef}
            className="relative rounded-full overflow-hidden cursor-move select-none bg-black"
            style={{ width: CROP_SIZE, height: CROP_SIZE, flexShrink: 0, touchAction: 'none' }}
          >
            {/* Flex wrapper centers the image so transform: translate+scale works cleanly */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <img
                ref={imgRef}
                src={blobUrl || undefined}
                onLoad={onImgLoad}
                draggable={false}
                style={{
                  display: 'block',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  opacity: ready ? 1 : 0,
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>
          {/* Static Overlay Circle */}
          <div className="absolute inset-0 rounded-full border border-exo-accent/40 pointer-events-none shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
        </div>

        <div className="text-center space-y-1">
          <p className="text-[10px] text-exo-muted font-mono uppercase tracking-widest opacity-60">Visual Normalization</p>
          <p className="text-[9px] text-exo-muted/40 font-mono italic">DRAG TO PAN · SCROLL TO SCALE</p>
        </div>

        <div className="flex gap-3 w-full pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 text-[11px] font-bold uppercase tracking-widest text-exo-muted border border-exo-mist-10 rounded-[2px] hover:text-white hover:bg-white/5 transition-all"
          >
            Abort
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2 text-[11px] font-bold text-exo-pure bg-white rounded-[2px] hover:bg-exo-accent transition-all shadow-brutalist active:scale-95 uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <Check size={14} /> Commit
          </button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropModal;
