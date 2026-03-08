/**
 * LevelSelect — 关卡选择（1-70 关，按五区：新手村、进阶区、挑战区、大师区、王者区）
 * 国潮水墨风，与现有界面风格一致
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { LevelInfo } from '@/lib/levelConfig';
import { getGridSizeForLevel, getZoneName } from '@/lib/levelConfig';
import type { StarsMap } from '@/lib/progressStorage';
import { getStarForLevel } from '@/lib/progressStorage';

export type { LevelInfo };

/** 五区关卡范围（含首含尾）：新手村 1-10、进阶区 11-25、挑战区 26-40、大师区 41-55、王者区 56-70 */
const ZONE_RANGES: { start: number; end: number }[] = [
  { start: 1, end: 10 },
  { start: 11, end: 25 },
  { start: 26, end: 40 },
  { start: 41, end: 55 },
  { start: 56, end: 70 },
];

interface LevelSelectProps {
  themeId: string;
  themeName: string;
  levels: LevelInfo[];
  stars: StarsMap;
  onSelect: (level: LevelInfo) => void;
  onBack: () => void;
}

/** 星级角标：仅星星、无背景，叠在缩略图左下角 */
function StarBadge({ count }: { count: number }) {
  return (
    <span className="absolute bottom-1 left-1 flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <svg
          key={i}
          width="7"
          height="7"
          viewBox="0 0 24 24"
          fill={i <= count ? '#D4A017' : 'rgba(139, 134, 128, 0.4)'}
          className="shrink-0 drop-shadow-[0_0_1px_rgba(0,0,0,0.8)]"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </span>
  );
}

const REWARD_PROP_TYPES = ['addTime', 'badge', 'magnet'] as const;
type RewardPropType = (typeof REWARD_PROP_TYPES)[number];

/** 道具/奖励图标占位：随机展示加时、角标、磁铁之一（与游戏界面图标一致） */
function RewardPropSlot() {
  const [propType] = useState<RewardPropType>(
    () => REWARD_PROP_TYPES[Math.floor(Math.random() * REWARD_PROP_TYPES.length)]
  );

  const stroke = '#6B6560';
  const size = 18;

  const icon =
    propType === 'addTime' ? (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" className="shrink-0" aria-hidden>
        <path d="M12 2v10l4 4" />
        <circle cx="12" cy="12" r="10" />
      </svg>
    ) : propType === 'magnet' ? (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <path d="M5 5v13a7 7 0 0 0 14 0V5" />
      </svg>
    ) : (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );

  const label = propType === 'addTime' ? '30s' : propType === 'magnet' ? '2次' : '1次';
  const title = propType === 'addTime' ? '增加 30 秒' : propType === 'magnet' ? '磁铁次数' : '图块序号角标';

  return (
    <div
      className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center shrink-0 overflow-visible"
      style={{
        backgroundColor: 'rgba(232, 224, 208, 0.9)',
        border: '1px solid rgba(139, 134, 128, 0.2)',
        boxShadow: '0 1px 4px rgba(60,50,40,0.08)',
      }}
      title={title}
    >
      <div className="flex flex-col items-center justify-center gap-0.5 min-w-0 min-h-0">
        {icon}
        <span className="text-[9px] leading-none font-semibold whitespace-nowrap" style={{ color: stroke }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/** 关卡缩略图卡片（可点击）；道具 icon 由上层放在时间轴对侧单独渲染 */
function LevelCard({
  level,
  starCount,
  onSelect,
  groupIndex,
  idx,
}: {
  level: LevelInfo;
  starCount: number;
  onSelect: (level: LevelInfo) => void;
  groupIndex: number;
  idx: number;
}) {
  return (
    <div className="shrink-0">
      <motion.button
        type="button"
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: groupIndex * 0.04 + idx * 0.015 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => onSelect(level)}
        className="relative flex flex-col items-center rounded-lg overflow-hidden w-[88px] sm:w-[96px] shrink-0"
        style={{
          boxShadow: '0 2px 10px rgba(60, 50, 40, 0.12)',
          backgroundColor: 'rgba(232, 224, 208, 0.85)',
          border: '1px solid rgba(139, 134, 128, 0.25)',
        }}
      >
        <div className="relative aspect-square w-full overflow-hidden">
          <img
            src={level.thumbnailUrl}
            alt={level.name}
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
          <StarBadge count={starCount} />
          <span
            className="absolute bottom-1 right-1 px-1 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: 'rgba(44,44,44,0.75)', color: '#fff' }}
          >
            {level.levelIndex}
          </span>
        </div>
        {level.isBoss && (
          <div
            className="absolute top-0 right-0 text-[8px] px-1 rounded-bl"
            style={{ backgroundColor: '#C4463A', color: '#fff' }}
          >
            BOSS
          </div>
        )}
      </motion.button>
    </div>
  );
}

/** 长轴上的主题区块：胶片框风格，封面图放大，区名+范围，无锁定；背景不透明以遮挡时间轴 */
function ZoneSectionBlock({
  zoneName,
  rangeLabel,
  gridSize,
  firstLevel,
}: {
  zoneName: string;
  rangeLabel: string;
  gridSize: number;
  firstLevel: LevelInfo;
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border-2 flex items-stretch min-h-[100px] sm:min-h-[108px] z-10"
      style={{
        borderColor: 'rgba(139, 120, 100, 0.5)',
        backgroundColor: '#ebe4d8',
        boxShadow: '0 2px 8px rgba(60,50,40,0.1)',
      }}
    >
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-l-lg overflow-hidden bg-[#E8E0D0]">
        <img
          src={firstLevel.thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="flex-1 flex flex-col justify-center py-2 px-3 min-w-0">
        <span className="text-sm font-semibold" style={{ color: '#2C2C2C', fontFamily: "'Noto Serif SC', serif" }}>
          {zoneName}
        </span>
        <span className="text-xs mt-0.5" style={{ color: 'rgba(44,44,44,0.75)' }}>
          {rangeLabel}
        </span>
      </div>
      <div className="flex items-center pr-3">
        <span
          className="text-xs px-2 py-1 rounded font-bold"
          style={{ backgroundColor: 'rgba(196,70,58,0.15)', color: '#C4463A' }}
        >
          {gridSize}×{gridSize}
        </span>
      </div>
    </div>
  );
}

export default function LevelSelect({ themeName, levels, stars, onSelect, onBack }: LevelSelectProps) {
  const groups: LevelInfo[][] = ZONE_RANGES.map(({ start, end }) =>
    levels.filter((l) => l.levelIndex >= start && l.levelIndex <= end),
  );

  return (
    <div className="w-full flex flex-col items-center min-h-0 flex-1 gap-4 px-3 sm:px-4 pb-4 overflow-hidden">
      <div className="flex items-center gap-2 w-full max-w-[400px] shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-full transition-all active:scale-90 shrink-0"
          style={{ backgroundColor: 'rgba(232, 224, 208, 0.85)', boxShadow: '0 1px 4px rgba(60,50,40,0.1)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2C2C2C" strokeWidth="2.5" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <motion.h2
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl sm:text-2xl tracking-wider flex-1 text-center"
          style={{ fontFamily: "'ZCOOL KuaiLe', cursive", color: '#2C2C2C' }}
        >
          {themeName} · 选择关卡
        </motion.h2>
        <div className="w-8 shrink-0" />
      </div>

      <div
        className="w-full max-w-[400px] flex-1 min-h-0 h-0 min-h-[50vh] overflow-y-scroll overflow-x-hidden relative"
        style={{
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'pan-y',
          transform: 'translateZ(0)',
        }}
      >
        <div className="relative z-10 flex flex-col gap-2 w-full pb-8 pt-2">
          {/* 中央时间轴：在内容层内绝对定位，从顶部一直延长至王者区（整段内容高度） */}
          <div
            className="absolute top-0 bottom-0 left-1/2 w-2 -translate-x-1/2 rounded-full pointer-events-none z-0"
            style={{ backgroundColor: 'rgba(139, 100, 80, 0.5)', boxShadow: '0 0 0 1px rgba(139,100,80,0.25)' }}
          />
          {groups.map((group, groupIndex) => {
            const first = group[0];
            const gridSize = getGridSizeForLevel(first.levelIndex);
            const zoneName = getZoneName(first.levelIndex);
            const rangeLabel = `第 ${first.levelIndex}-${first.levelIndex + group.length - 1} 关`;

            return (
              <motion.div
                key={`group-${first.levelIndex}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.04 }}
                className="flex flex-col gap-2"
              >
                <ZoneSectionBlock
                  zoneName={zoneName}
                  rangeLabel={rangeLabel}
                  gridSize={gridSize}
                  firstLevel={first}
                />
                {group.map((level, idx) => {
                  const starCount = getStarForLevel(stars, level.themeId, level.levelIndex);
                  const isLeft = idx % 2 === 0;
                  return (
                    <div
                      key={`${level.themeId}-${level.levelIndex}`}
                      className="flex items-center min-h-[96px] sm:min-h-[100px]"
                    >
                      {/* 左栏：左侧卡只放缩略图，右侧卡放该关卡的道具 icon（时间轴对侧），与时间轴拉开距离 */}
                      <div className="flex flex-1 items-center justify-end pr-5 sm:pr-6">
                        {isLeft ? (
                          <LevelCard level={level} starCount={starCount} onSelect={onSelect} groupIndex={groupIndex} idx={idx} />
                        ) : (
                          <RewardPropSlot key={`prop-L-${level.levelIndex}`} />
                        )}
                      </div>
                      <div className="w-2 shrink-0" aria-hidden />
                      {/* 右栏：右侧卡只放缩略图，左侧卡放该关卡的道具 icon（时间轴对侧），与时间轴拉开距离 */}
                      <div className="flex flex-1 items-center justify-start pl-5 sm:pl-6">
                        {isLeft ? (
                          <RewardPropSlot key={`prop-R-${level.levelIndex}`} />
                        ) : (
                          <LevelCard level={level} starCount={starCount} onSelect={onSelect} groupIndex={groupIndex} idx={idx} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
