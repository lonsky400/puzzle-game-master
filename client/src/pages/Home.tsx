/**
 * Home — 游戏主页面
 *
 * 按《游戏玩法说明》重构：四大主题 → 每主题 70 关 → 星级与进度；道具无限量（开发环境）
 * 界面风格、拼图交互保持当前不变
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PuzzleBoard, { type PuzzleBoardHandle } from '@/components/PuzzleBoard';
import ThemeSelect from '@/components/ThemeSelect';
import LevelSelect from '@/components/LevelSelect';
import WinOverlay from '@/components/WinOverlay';
import ReferenceImage from '@/components/ReferenceImage';
import Gallery from '@/components/Gallery';
import { PuzzleEngine } from '@/lib/puzzleEngine';
import {
  type ThemeId,
  type LevelInfo,
  getLevelInfo,
  getLevelsForTheme,
  computeStars,
  THEMES,
} from '@/lib/levelConfig';
import {
  loadStars,
  saveStars,
  setStarForLevel,
  type StarsMap,
} from '@/lib/progressStorage';
import { startAllBgm, stopAllBgm, resumeAndStartAllBgm } from '@/lib/allBgm';
import { startBgm, stopBgm } from '@/lib/puzzleBgm';

const BG_URL =
  'https://d2xsxph8kpxj0f.cloudfront.net/310419663028373717/gXcdKD4ijsoo6c6S8DJhhB/puzzle-bg-9orue8KtPNBbe5YaNbq2Xw.webp';

type GameState = 'themeSelect' | 'levelSelect' | 'playing' | 'win';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState>('themeSelect');
  const [currentTheme, setCurrentTheme] = useState<ThemeId | null>(null);
  const [themeLevels, setThemeLevels] = useState<LevelInfo[]>([]);
  const [currentLevel, setCurrentLevel] = useState<LevelInfo | null>(null);
  const [stars, setStars] = useState<StarsMap>(() => loadStars());
  const [engine, setEngine] = useState<PuzzleEngine | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [, setRenderTick] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showNumbers, setShowNumbers] = useState(false);
  const [bgLoaded, setBgLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'gallery'>('home');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStars(loadStars());
  }, []);

  // 背景图懒加载，首屏先展示渐变占位，不阻塞交互
  useEffect(() => {
    const img = new Image();
    img.onload = () => setBgLoaded(true);
    img.src = BG_URL;
  }, []);

  useEffect(() => {
    if (gameState === 'playing') {
      stopAllBgm();
      setElapsedTime(0);
      timerRef.current = setInterval(() => setElapsedTime((t) => t + 1), 1000);
      // 若进入时 BGM 未播（如解码未完成），首次触摸再试一次
      const onFirstInteraction = () => {
        startBgm();
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
      };
      document.addEventListener('click', onFirstInteraction, { once: true });
      document.addEventListener('touchstart', onFirstInteraction, { once: true });
      return () => {
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
      };
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopBgm();
      // 背景音乐必须在用户点击后才能播放（浏览器策略），仅注册首次点击时再试
      const onFirstInteraction = () => {
        resumeAndStartAllBgm().catch(() => {});
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
      };
      document.addEventListener('click', onFirstInteraction, { once: true });
      document.addEventListener('touchstart', onFirstInteraction, { once: true });
      return () => {
        document.removeEventListener('click', onFirstInteraction);
        document.removeEventListener('touchstart', onFirstInteraction);
      };
    }
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopBgm();
      stopAllBgm();
    };
  }, []);

  const startGame = useCallback((level: LevelInfo) => {
    // 必须在用户点击的同一事件链里最先启动 BGM，否则会被自动播放策略拦截
    startBgm().catch(() => {});
    setCurrentLevel(level);
    setEngine(new PuzzleEngine(level.gridSize));
    setMoveCount(0);
    setElapsedTime(0);
    setGameState('playing');
    setRenderTick((n) => n + 1);
  }, []);

  const handleThemeSelect = useCallback((themeId: ThemeId) => {
    setCurrentTheme(themeId);
    setThemeLevels(getLevelsForTheme(themeId));
    setGameState('levelSelect');
  }, []);

  const handleLevelSelect = useCallback((level: LevelInfo) => {
    startGame(level);
  }, [startGame]);

  const handleBackFromLevelSelect = useCallback(() => {
    setGameState('themeSelect');
    setCurrentTheme(null);
    setThemeLevels([]);
  }, []);

  const handleBackFromPlaying = useCallback(() => {
    setGameState('levelSelect');
    setCurrentLevel(null);
    setEngine(null);
  }, []);

  const handleRestart = useCallback(() => {
    if (!currentLevel) return;
    startBgm();
    setEngine(new PuzzleEngine(currentLevel.gridSize));
    setMoveCount(0);
    setElapsedTime(0);
    setGameState('playing');
    setRenderTick((n) => n + 1);
  }, [currentLevel]);

  const handleMove = useCallback(() => {
    if (engine) {
      setMoveCount(engine.moveCount);
      setRenderTick((n) => n + 1);
    }
  }, [engine]);

  const handleWin = useCallback(() => {
    if (!engine || !currentLevel) return;
    const star = computeStars(engine.moveCount, currentLevel.gridSize);
    setStars((prev) => {
      const next = setStarForLevel(prev, currentLevel.themeId, currentLevel.levelIndex, star);
      saveStars(next);
      return next;
    });
    setGameState('win');
  }, [engine, currentLevel]);

  const progress = useMemo(() => {
    if (!engine) return 0;
    return engine.getProgress();
  }, [engine, moveCount]);

  const groupCount = useMemo(() => {
    if (!engine) return 0;
    return engine.getGroupCount();
  }, [engine, moveCount]);

  const themeName = useMemo(
    () => THEMES.find((t) => t.id === currentTheme)?.name ?? '',
    [currentTheme],
  );

  const puzzleBoardRef = useRef<PuzzleBoardHandle | null>(null);

  const useMagnet = useCallback(() => {
    if (!engine) return;
    const totalPieces = engine.totalPieces;
    const groupSizesBefore = new Map<number, number>();
    for (let id = 0; id < totalPieces; id++) {
      groupSizesBefore.set(id, engine.uf.getGroupSize(id));
    }
    for (let id = 0; id < totalPieces; id++) {
      const pos = engine.getPiece(id).currentPos;
      if (pos !== id) {
        engine.swap(pos, id);
        setMoveCount(engine.moveCount);
        setRenderTick((n) => n + 1);
        const mergedRoots = new Set<number>();
        for (let i = 0; i < totalPieces; i++) {
          if (engine.uf.getGroupSize(i) > (groupSizesBefore.get(i) ?? 0)) {
            mergedRoots.add(engine.uf.find(i));
          }
        }
        if (mergedRoots.size > 0) {
          const groups: number[][] = [];
          mergedRoots.forEach((root) => {
            for (let i = 0; i < totalPieces; i++) {
              if (engine.uf.find(i) === root) {
                groups.push(engine.uf.getGroupMembers(i));
                break;
              }
            }
          });
          puzzleBoardRef.current?.triggerMergeEffect(groups);
        }
        if (engine.isComplete) setTimeout(() => handleWin(), 400);
        break;
      }
    }
  }, [engine, handleWin]);

  const addThirtySeconds = useCallback(() => {
    setElapsedTime((t) => t + 30);
  }, []);

  const goNextLevel = useCallback(() => {
    if (!currentLevel || currentLevel.levelIndex >= 70) return;
    startGame(getLevelInfo(currentLevel.themeId, currentLevel.levelIndex + 1));
  }, [currentLevel, startGame]);

  return (
    <div
      className="w-full h-dvh min-h-[100dvh] max-h-dvh flex flex-col overflow-hidden"
      style={{
        backgroundImage: bgLoaded ? `url(${BG_URL})` : 'linear-gradient(180deg, #E8E4DC 0%, #D8D0C4 100%)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <main
        className={`flex-1 flex flex-col items-center min-h-0 overflow-x-hidden pt-2 sm:pt-3 pb-4 sm:pb-6 ${activeTab === 'gallery' ? 'overflow-y-auto' : gameState === 'levelSelect' ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {activeTab === 'gallery' ? (
          <Gallery stars={stars} />
        ) : (
        <AnimatePresence mode="wait">
          {gameState === 'themeSelect' && (
            <motion.div
              key="themeSelect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col items-center gap-3 sm:gap-4 pt-1 sm:pt-2"
            >
              <ThemeSelect onSelect={handleThemeSelect} />
            </motion.div>
          )}

          {gameState === 'levelSelect' && currentTheme && (
            <motion.div
              key="levelSelect"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1 flex flex-col items-center min-h-0 pt-1 sm:pt-2"
            >
              <LevelSelect
                themeId={currentTheme}
                themeName={themeName}
                levels={themeLevels}
                stars={stars}
                onSelect={handleLevelSelect}
                onBack={handleBackFromLevelSelect}
              />
            </motion.div>
          )}

          {gameState === 'playing' && engine && currentLevel && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex-1 flex flex-col items-center min-h-0 overflow-y-auto overflow-x-hidden py-2 sm:py-3 px-0"
            >
              <div className="relative z-20 flex items-start justify-between gap-2 w-full max-w-[500px] px-3 sm:px-4 min-w-0 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                  <ReferenceImage imageUrl={currentLevel.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs sm:text-sm font-semibold truncate"
                      style={{ color: '#2C2C2C', fontFamily: "'Noto Serif SC', serif" }}
                      title={currentLevel.name}
                    >
                      {currentLevel.name}
                    </p>
                    <div
                      className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 sm:gap-x-2 text-[11px] sm:text-xs"
                      style={{ color: '#8B8680' }}
                    >
                      <span className="shrink-0">
                        步数：<span style={{ color: '#C4463A', fontWeight: 700 }}>{moveCount}</span>
                      </span>
                      <span className="shrink-0" style={{ color: '#D0C9BE' }}>|</span>
                      <span className="shrink-0">
                        <span style={{ color: '#C4463A', fontWeight: 700 }}>
                          {formatTime(elapsedTime)}
                        </span>
                      </span>
                      <span className="shrink-0" style={{ color: '#D0C9BE' }}>|</span>
                      <span className="min-w-0">
                        {currentLevel.zoneName} {currentLevel.gridSize}×{currentLevel.gridSize}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleBackFromPlaying}
                  className="shrink-0 px-3 py-1.5 rounded-md text-xs font-semibold transition-all active:scale-95"
                  style={{
                    backgroundColor: 'rgba(232, 224, 208, 0.85)',
                    color: '#6B6560',
                    border: '1px solid rgba(139, 134, 128, 0.25)',
                    fontFamily: "'Noto Serif SC', serif",
                    boxShadow: '0 1px 3px rgba(60,50,40,0.08)',
                  }}
                  title="退出本局，返回关卡选择"
                >
                  退出
                </button>
              </div>

              <div className="relative z-20 w-full max-w-[500px] px-3 sm:px-4 shrink-0 mt-2 mb-3 sm:mt-2.5 sm:mb-4">
                <div className="flex gap-2 items-center">
                  <div
                    className="flex-1 h-1 sm:h-1.5 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(232, 224, 208, 0.8)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: '#C4463A' }}
                      initial={{ width: '0%' }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <span
                    className="text-[11px] sm:text-xs font-semibold shrink-0"
                    style={{ color: '#C4463A', minWidth: 28 }}
                  >
                    {progress}%
                  </span>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center w-full min-h-0 min-w-0 pt-1 pb-4 sm:pt-2 sm:pb-5">
                <PuzzleBoard
                  ref={puzzleBoardRef}
                  engine={engine}
                  imageUrl={currentLevel.imageUrl}
                  showNumbers={showNumbers}
                  onMove={handleMove}
                  onWin={handleWin}
                />
              </div>

              <div className="relative z-20 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 w-full px-2 sm:px-4 pt-3 pb-3 sm:pt-4 sm:pb-4 shrink-0">
                <button
                  onClick={useMagnet}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                  style={{
                    backgroundColor: 'rgba(232, 224, 208, 0.85)',
                    color: '#6B6560',
                    border: '1px solid rgba(139, 134, 128, 0.25)',
                    fontFamily: "'Noto Serif SC', serif",
                    boxShadow: '0 1px 3px rgba(60,50,40,0.08)',
                  }}
                  title="吸附一块到正确位置"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 5v13a7 7 0 0 0 14 0V5" />
                  </svg>
                  磁铁
                </button>
                <button
                  onClick={addThirtySeconds}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                  style={{
                    backgroundColor: 'rgba(232, 224, 208, 0.85)',
                    color: '#6B6560',
                    border: '1px solid rgba(139, 134, 128, 0.25)',
                    fontFamily: "'Noto Serif SC', serif",
                    boxShadow: '0 1px 3px rgba(60,50,40,0.08)',
                  }}
                  title="增加 30 秒"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v10l4 4" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  加30s
                </button>
                <button
                  onClick={() => setShowNumbers(!showNumbers)}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                  style={{
                    backgroundColor: showNumbers ? '#C4463A' : 'rgba(232, 224, 208, 0.85)',
                    color: showNumbers ? '#FFF' : '#6B6560',
                    border: showNumbers ? '1px solid #C4463A' : '1px solid rgba(139, 134, 128, 0.25)',
                    fontFamily: "'Noto Serif SC', serif",
                    boxShadow: '0 1px 3px rgba(60,50,40,0.08)',
                  }}
                  title="图块序号角标"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                  角标
                </button>
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-semibold transition-all active:scale-95 whitespace-nowrap"
                  style={{
                    backgroundColor: 'rgba(232, 224, 208, 0.85)',
                    color: '#6B6560',
                    border: '1px solid rgba(139, 134, 128, 0.25)',
                    fontFamily: "'Noto Serif SC', serif",
                    boxShadow: '0 1px 3px rgba(60,50,40,0.08)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  重来
                </button>
                <div
                  className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-md text-[10px] sm:text-xs font-semibold whitespace-nowrap"
                  style={{
                    backgroundColor: 'rgba(232, 224, 208, 0.65)',
                    color: '#6B6560',
                    fontFamily: "'Noto Serif SC', serif",
                  }}
                >
                  剩余 <span style={{ color: '#C4463A', fontWeight: 700 }}>{groupCount}</span> 组
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </main>

      {/* 底部 Tab：仅在主题选择页或相册页显示，进入某主题的关卡选择后不显示 */}
      {((activeTab === 'home' && gameState === 'themeSelect') || activeTab === 'gallery') && (
      <footer
        className="shrink-0 flex items-center justify-center gap-0 w-full max-w-[500px] mx-auto px-4 py-2.5 sm:py-3 border-t border-[rgba(139,134,128,0.2)]"
      >
        <button
          onClick={() => setActiveTab('home')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            color: activeTab === 'home' ? '#C4463A' : '#6B6560',
            fontFamily: "'Noto Serif SC', serif",
            backgroundColor: activeTab === 'home' ? 'rgba(196, 70, 58, 0.1)' : 'transparent',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          主页
        </button>
        <button
          onClick={() => setActiveTab('gallery')}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            color: activeTab === 'gallery' ? '#C4463A' : '#6B6560',
            fontFamily: "'Noto Serif SC', serif",
            backgroundColor: activeTab === 'gallery' ? 'rgba(196, 70, 58, 0.1)' : 'transparent',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          相册
        </button>
      </footer>
      )}

      <AnimatePresence>
        {gameState === 'win' && currentLevel && (
          <WinOverlay
            moveCount={moveCount}
            elapsedTime={elapsedTime}
            imageUrl={currentLevel.imageUrl}
            stars={computeStars(
              moveCount,
              currentLevel.gridSize,
            )}
            onRestart={handleRestart}
            onBackToLevels={handleBackFromPlaying}
            onNextLevel={currentLevel.levelIndex < 70 ? goNextLevel : undefined}
            hasNextLevel={currentLevel.levelIndex < 70}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
