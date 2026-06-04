/**
 * Resize an image file to max 200x200, store as dataURL in localStorage,
 * and invoke the callback with the dataURL.
 */
export function resizeAndStoreAvatar(file, storageKey, onDone) {
  const img = new Image();
  const blobUrl = URL.createObjectURL(file);
  img.onload = () => {
    const MAX = 200;
    const scale = Math.min(MAX / img.width, MAX / img.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    localStorage.setItem(storageKey, dataUrl);
    onDone(dataUrl);
  };
  img.onerror = () => {
    URL.revokeObjectURL(blobUrl);
  };
  img.src = blobUrl;
}
