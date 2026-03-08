/**
 * 游戏外页面统一背景音乐：all-bgm.mp3 循环播放
 * 仅在用户点击后调用 startAllBgm()，否则会被浏览器自动播放策略拦截
 */

/** 与 levelConfig 一致：dev 下 public 也在 base 路径下，必须带 base */
const getBaseUrl = () =>
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? (import.meta.env.BASE_URL as string)
    : '/';

const ALL_BGM_URL = `${getBaseUrl()}all-bgm.mp3`;

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      console.error('[allBgm] 加载失败，请确认 client/public/all-bgm.mp3 存在。URL:', audio?.src);
    });
  }
  return audio;
}

/**
 * 开始播放统一背景音乐（循环）。
 * 必须在用户点击后调用，否则可能被拦截。
 * @returns play() 的 Promise，失败时可据此提示用户
 */
export function startAllBgm(): Promise<void> {
  const el = getAudio();
  if (!el) return Promise.reject(new Error('no document'));
  try {
    if (!el.src.endsWith('all-bgm.mp3') || el.readyState < 2) {
      el.src = ALL_BGM_URL;
      el.load();
    }
    const p = el.play();
    if (p !== undefined) {
      return p.then(
        () => {},
        (e) => {
          console.warn('[allBgm] play 被拒绝（常见原因：未在用户点击时调用或文件缺失）:', e);
          throw e;
        }
      );
    }
    return Promise.resolve();
  } catch (e) {
    console.warn('[allBgm] start 异常:', e);
    return Promise.reject(e);
  }
}

/** 停止统一背景音乐 */
export function stopAllBgm(): void {
  try {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {
    // ignore
  }
}

/** 在用户首次交互时开始播放（用于通过自动播放策略） */
export function resumeAndStartAllBgm(): Promise<void> {
  return startAllBgm();
}
