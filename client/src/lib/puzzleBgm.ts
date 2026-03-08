/**
 * 拼图关卡背景音乐：HTML5 Audio 循环播放
 * 必须在用户点击的同一事件链内调用 startBgm()，否则会被浏览器自动播放策略拦截
 */

/** 与 levelConfig 一致：dev 下 public 也在 base 路径下，必须带 base */
const getBaseUrl = () =>
  typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL
    ? (import.meta.env.BASE_URL as string)
    : '/';

const BGM_URL = `${getBaseUrl()}bgm.mp3`;

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement | null {
  if (typeof document === 'undefined') return null;
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.volume = 0.5;
    audio.preload = 'auto';
    audio.addEventListener('error', () => {
      console.error('[puzzleBgm] 加载失败，请确认 client/public/bgm.mp3 存在。URL:', audio?.src);
    });
  }
  return audio;
}

/**
 * 开始播放关卡背景音乐（循环）。
 * 必须在用户点击的同一事件链内调用，否则可能被拦截。
 * @returns play() 的 Promise，失败时可据此提示用户
 */
export function startBgm(): Promise<void> {
  const el = getAudio();
  if (!el) return Promise.reject(new Error('no document'));
  try {
    if (!el.src.endsWith('bgm.mp3') || el.readyState < 2) {
      el.src = BGM_URL;
      el.load();
    }
    const p = el.play();
    if (p !== undefined) {
      return p.then(
        () => {},
        (e) => {
          console.warn('[puzzleBgm] play 被拒绝（常见原因：未在用户点击时调用或文件缺失）:', e);
          throw e;
        }
      );
    }
    return Promise.resolve();
  } catch (e) {
    console.warn('[puzzleBgm] start 异常:', e);
    return Promise.reject(e);
  }
}

/** 停止关卡背景音乐 */
export function stopBgm(): void {
  try {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {
    // ignore
  }
}
