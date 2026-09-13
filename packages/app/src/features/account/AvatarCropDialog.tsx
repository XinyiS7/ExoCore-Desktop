import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { useDialogA11y } from '../chat/dialogA11y';

const CROP_BOX_SIZE = 220;
const OUTPUT_SIZE = 200;

interface AvatarCropDialogProps {
  file: File;
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
}

export function AvatarCropDialog({ file, onConfirm, onCancel }: AvatarCropDialogProps) {
  const dialogRef = useDialogA11y(true, onCancel);
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  // Object URL lifecycle
  useEffect(() => {
    let url = '';
    try {
      url = URL.createObjectURL(file);
      setBlobUrl(url);
    } catch {
      setError('无法读取所选图片文件');
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleImgLoad = () => {
    if (!imgRef.current) return;
    const { naturalWidth, naturalHeight } = imgRef.current;
    if (!naturalWidth || !naturalHeight) {
      setError('图片解码失败，请选择有效的图片文件');
      return;
    }
    const initialScale = Math.max(CROP_BOX_SIZE / naturalWidth, CROP_BOX_SIZE / naturalHeight);
    setScale(initialScale);
    setPos({ x: 0, y: 0 });
    setReady(true);
  };

  const handleImgError = () => {
    setError('图片文件损坏或格式不支持');
  };

  // Pointer drag on crop container
  const handlePointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX - pos.x, startY: e.clientY - pos.y };
  };

  const handlePointerMove = (e: ReactPointerEvent) => {
    if (!dragRef.current) return;
    setPos({
      x: e.clientX - dragRef.current.startX,
      y: e.clientY - dragRef.current.startY,
    });
  };

  const handlePointerUp = (e: ReactPointerEvent) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleWheel = (e: ReactWheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.min(5, Math.max(0.1, prev * (e.deltaY > 0 ? 0.9 : 1.1))));
  };

  const handleCrop = () => {
    const img = imgRef.current;
    const box = cropBoxRef.current;
    if (!img || !box) return;

    try {
      const imgRect = img.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();

      // Box center relative to image
      const boxCenterX = boxRect.left + boxRect.width / 2;
      const boxCenterY = boxRect.top + boxRect.height / 2;

      const rx = img.naturalWidth / imgRect.width;
      const ry = img.naturalHeight / imgRect.height;

      const sourceHalfW = (CROP_BOX_SIZE / 2) * rx;
      const sourceHalfH = (CROP_BOX_SIZE / 2) * ry;

      const sx = (boxCenterX - imgRect.left) * rx - sourceHalfW;
      const sy = (boxCenterY - imgRect.top) * ry - sourceHalfH;
      const sWidth = sourceHalfW * 2;
      const sHeight = sourceHalfH * 2;

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Canvas 初始化失败');
        return;
      }

      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onConfirm(dataUrl);
    } catch (err) {
      setError(`头像裁剪失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div
      className="app-dialog-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="app-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-crop-title"
      >
        <header className="app-dialog-header">
          <h2 id="avatar-crop-title" className="app-h2">
            裁剪头像
          </h2>
          <button
            type="button"
            className="app-icon-btn"
            onClick={onCancel}
            aria-label="关闭"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="avatar-crop-body">
          {error ? (
            <div className="app-field-error" role="alert">
              {error}
            </div>
          ) : null}

          <div
            ref={cropBoxRef}
            className="avatar-crop-viewport"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: `${CROP_BOX_SIZE}px`, height: `${CROP_BOX_SIZE}px` }}
          >
            {blobUrl ? (
              <img
                ref={imgRef}
                src={blobUrl}
                alt="头像原图预览"
                className="avatar-crop-image"
                onLoad={handleImgLoad}
                onError={handleImgError}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
                }}
                draggable={false}
              />
            ) : null}
            <div className="avatar-crop-mask" aria-hidden="true" />
          </div>

          <div className="avatar-crop-controls">
            <button
              type="button"
              className="app-icon-btn"
              onClick={() => setScale((s) => Math.max(0.1, s * 0.9))}
              aria-label="缩小"
              disabled={!ready}
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              aria-label="缩放比例"
              className="avatar-crop-slider"
              disabled={!ready}
            />
            <button
              type="button"
              className="app-icon-btn"
              onClick={() => setScale((s) => Math.min(5, s * 1.1))}
              aria-label="放大"
              disabled={!ready}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <footer className="app-dialog-footer">
          <button type="button" className="app-btn app-btn-ghost" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="app-btn"
            onClick={handleCrop}
            disabled={!ready || Boolean(error)}
          >
            确认并使用
          </button>
        </footer>
      </div>
    </div>
  );
}
