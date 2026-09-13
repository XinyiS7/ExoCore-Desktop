export function getUserAvatar(): string;
export function setUserAvatar(dataUrl: string): void;
export function getAvatarSeed(): string;
export function setAvatarSeed(seed: string): void;
export function getUserNick(): string;
export function setUserNick(nick: string): void;
export function getAgentAvatar(presetId: number | string, agentName?: string | null): string;
export function setAgentAvatar(presetId: number | string, dataUrl: string): void;
export function getAllAgentAvatars(): Record<string, string | null>;
