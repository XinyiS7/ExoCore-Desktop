// 将图片文件压缩至 200x200 以内，存入 localStorage 并回调 dataURL
export const resizeAndStoreAvatar = (file, storageKey, onDone) => {
  const img = new Image();
  const blobUrl = URL.createObjectURL(file);
  img.onload = () => {
    const MAX = 200;
    const scale = Math.min(MAX / img.width, MAX / img.height, 1);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(blobUrl);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    localStorage.setItem(storageKey, dataUrl);
    onDone(dataUrl);
  };
  img.src = blobUrl;
};

export const getUserAvatarUrl = () =>
  localStorage.getItem('exo_user_avatar_url') ||
  `https://api.dicebear.com/7.x/notionists/svg?seed=${localStorage.getItem('exo_user_avatar_seed') || 'Elysia'}`;

export const getAgentAvatarUrl = (presetId, name) =>
  localStorage.getItem(`exo_agent_avatar_${presetId}`) ||
  `https://api.dicebear.com/7.x/bottts/svg?seed=${name}`;
