/**
 * PuzzleBoard — 拼图游戏画板组件
 * 
 * 交互模式：
 * - 点击选中 → 再点击目标 → 交换
 * - 按住拖动 → 释放到目标 → 交换
 * 
 * 使用 mousedown/mouseup/mousemove + touch 事件
 * 不使用 setPointerCapture（会干扰 click 事件）
 */

import { forwardRef, type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { PuzzleEngine } from '@/lib/puzzleEngine';
import { playPickup, playPlace, playMerge } from '@/lib/puzzleSound';

export interface PuzzleBoardHandle {
  /** 触发合并动效与音效（磁铁等外部操作导致合并时调用） */
  triggerMergeEffect: (groups: number[][]) => void;
}

interface PuzzleBoardProps {
  engine: PuzzleEngine;
  imageUrl: string;
  showNumbers: boolean;
  onMove: () => void;
  onWin: () => void;
}

function PuzzleBoardInner({ engine, imageUrl, showNumbers, onMove, onWin }: PuzzleBoardProps, ref: Ref<PuzzleBoardHandle>) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const rafRef = useRef<number>(0);
  const [, forceRender] = useState(0);

  // 选中状态
  const selectedPosRef = useRef<number>(-1);

  // 拖拽状态
  const isDraggingRef = useRef(false);
  const dragStartPosRef = useRef(-1);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const dragCurrentXRef = useRef(0);
  const dragCurrentYRef = useRef(0);
  const dragGroupRef = useRef<number[]>([]);
  const dragGroupPosRef = useRef<number[]>([]);
  const dragHoverPosRef = useRef(-1);
  const dragThresholdMetRef = useRef(false);
  const dragDisplayXRef = useRef(0);
  const dragDisplayYRef = useRef(0);

  const MERGE_FLASH_DURATION = 480;
  const mergeFlashRef = useRef<{ groups: number[][]; startTime: number } | null>(null);
  const selectionPopStartTimeRef = useRef(0);
  const popGroupPositionsRef = useRef<Set<number>>(new Set());
  const SELECTION_POP_DURATION = 260;
  const SELECTION_POP_PEAK = 0.045;

  useImperativeHandle(ref, () => ({
    triggerMergeEffect(groups: number[][]) {
      if (groups.length === 0) return;
      playMerge();
      mergeFlashRef.current = { groups, startTime: Date.now() };
      forceRender((n) => n + 1);
    },
  }), []);

  const getCanvasSize = useCallback(() => {
    // 优先使用容器尺寸，如果没有容器则使用窗口尺寸
    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      return Math.min(Math.floor(rect.width), Math.floor(rect.height));
    }
    return Math.min(window.innerWidth - 32, 440);
  }, []);

  const [canvasSize, setCanvasSize] = useState(getCanvasSize);

  /** 图片尺寸（加载后用于与画布宽高比一致，避免变形） */
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);

  /** 图块宽高比：使用图片实际比例，未加载时默认 2:3 */
  const tileAspect = imageSize ? imageSize.w / imageSize.h : 2 / 3;

  const layout = useMemo(() => {
    const gridSize = engine.gridSize;
    const gap = Math.max(6, Math.round(canvasSize * 0.018));
    const boardWidth = canvasSize;
    const cellWidth = (boardWidth - gap * (gridSize + 1)) / gridSize;
    const cellHeight = cellWidth / tileAspect;
    const boardHeight = gap * (gridSize + 1) + gridSize * cellHeight;
    const colEdges = Array.from({ length: gridSize + 1 }, (_, c) =>
      Math.round(gap + c * (cellWidth + gap)),
    );
    const rowEdges = Array.from({ length: gridSize + 1 }, (_, r) =>
      Math.round(gap + r * (cellHeight + gap)),
    );
    return {
      boardWidth,
      boardHeight,
      gap,
      cellWidth,
      cellHeight,
      gridSize,
      colEdges,
      rowEdges,
    };
  }, [canvasSize, engine.gridSize, tileAspect]);

  useEffect(() => {
    const handleResize = () => setCanvasSize(getCanvasSize());
    window.addEventListener('resize', handleResize);
    // 使用 ResizeObserver 监听容器尺寸变化
    const container = containerRef.current;
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        setCanvasSize(getCanvasSize());
      });
      resizeObserver.observe(container);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver && container) {
        resizeObserver.unobserve(container);
      }
    };
  }, [getCanvasSize]);

  // 加载图片；失败时用占位图并标记已加载，避免移动端一直卡在「画卷展开中」或触发异常
  useEffect(() => {
    setImageLoaded(false);
    setImageSize(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImageLoaded(true);
    };
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => {
        imageRef.current = img2;
        setImageSize(img2.naturalWidth ? { w: img2.naturalWidth, h: img2.naturalHeight } : null);
        setImageLoaded(true);
      };
      img2.onerror = () => {
        // 两次都失败时用 1x1 占位，避免 draw 里 img 为 null 导致崩溃
        const placeholder = new Image();
        placeholder.onload = () => {
          imageRef.current = placeholder;
          setImageSize({ w: 1, h: 1 });
          setImageLoaded(true);
        };
        placeholder.src = 'data:image/gif;base64,R0lGOODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      };
      img2.src = imageUrl;
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // 屏幕坐标转网格位置
  const screenToGrid = useCallback((clientX: number, clientY: number): number => {
    const canvas = canvasRef.current;
    if (!canvas) return -1;

    const rect = canvas.getBoundingClientRect();
    const scaleX = layout.boardWidth / rect.width;
    const scaleY = layout.boardHeight / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    const col = Math.floor((x - layout.gap / 2) / (layout.cellWidth + layout.gap));
    const row = Math.floor((y - layout.gap / 2) / (layout.cellHeight + layout.gap));

    if (col < 0 || col >= layout.gridSize || row < 0 || row >= layout.gridSize) return -1;
    return row * layout.gridSize + col;
  }, [layout]);

  // 将屏幕像素偏移转换为 canvas 逻辑坐标偏移
  const screenToCanvasOffset = useCallback((screenDx: number, screenDy: number): { dx: number; dy: number } => {
    const canvas = canvasRef.current;
    if (!canvas) return { dx: screenDx, dy: screenDy };
    const rect = canvas.getBoundingClientRect();
    return {
      dx: screenDx * (layout.boardWidth / rect.width),
      dy: screenDy * (layout.boardHeight / rect.height),
    };
  }, [layout.boardWidth, layout.boardHeight]);

  /**
   * 拖拽结束：用「锚点 + 拖动偏移」决定是否移动，与松手所在格无关。
   * 仅当偏移量在任一方向上大于半格时触发移动；目标格 = 锚点 + round(偏移格数)。
   * 边界：纵向或横向超出单格一半距离即视为越界，当次移动拒绝。
   */
  const getToPosFromDragOffset = useCallback(
    (
      anchorRow: number,
      anchorCol: number,
      groupHeight: number,
      groupWidth: number,
      screenDx: number,
      screenDy: number,
    ): { toPos: number; shouldMove: boolean } => {
      const { gridSize, gap, cellWidth, cellHeight } = layout;
      const stepX = cellWidth + gap;
      const stepY = cellHeight + gap;
      const { dx: canvasDx, dy: canvasDy } = screenToCanvasOffset(screenDx, screenDy);
      const offsetCol = canvasDx / stepX;
      const offsetRow = canvasDy / stepY;
      const colOff = Math.round(offsetCol);
      const rowOff = Math.round(offsetRow);
      const shouldMove = Math.abs(offsetCol) > 0.5 || Math.abs(offsetRow) > 0.5;

      const newAnchorRow = anchorRow + offsetRow;
      const newAnchorCol = anchorCol + offsetCol;
      const half = 0.5;
      if (newAnchorRow < -half || newAnchorRow + groupHeight > gridSize + half) {
        return { toPos: -1, shouldMove: false };
      }
      if (newAnchorCol < -half || newAnchorCol + groupWidth > gridSize + half) {
        return { toPos: -1, shouldMove: false };
      }

      const toRow = anchorRow + rowOff;
      const toCol = anchorCol + colOff;
      if (toRow < 0 || toRow >= gridSize || toCol < 0 || toCol >= gridSize) {
        return { toPos: -1, shouldMove };
      }
      return { toPos: toRow * gridSize + toCol, shouldMove };
    },
    [layout, screenToCanvasOffset],
  );

  const doSwap = useCallback((fromPos: number, toPos: number) => {
    const totalPieces = engine.totalPieces;
    const groupSizesBefore = new Map<number, number>();
    for (let id = 0; id < totalPieces; id++) {
      groupSizesBefore.set(id, engine.uf.getGroupSize(id));
    }
    const success = engine.swap(fromPos, toPos);
    if (success) {
      playPlace();
      const mergedRoots = new Set<number>();
      for (let id = 0; id < totalPieces; id++) {
        if (engine.uf.getGroupSize(id) > (groupSizesBefore.get(id) ?? 0)) {
          mergedRoots.add(engine.uf.find(id));
        }
      }
      if (mergedRoots.size > 0) {
        playMerge();
        const groups: number[][] = [];
        mergedRoots.forEach((root) => {
          for (let id = 0; id < totalPieces; id++) {
            if (engine.uf.find(id) === root) {
              groups.push(engine.uf.getGroupMembers(id));
              break;
            }
          }
        });
        mergeFlashRef.current = { groups, startTime: Date.now() };
      }
      onMove();
      forceRender(n => n + 1);
      if (engine.isComplete) {
        setTimeout(() => onWin(), 400);
      }
    }
    return success;
  }, [engine, onMove, onWin]);

  // 统一的交互处理
  const handleInteractionStart = useCallback((clientX: number, clientY: number) => {
    if (engine.isComplete) return;

    const pos = screenToGrid(clientX, clientY);
    if (pos === -1) return;

    const pieceId = engine.getPieceAtPos(pos);
    if (pieceId === -1) return;

    const groupMembers = engine.uf.getGroupMembers(pieceId);
    const groupPositions = groupMembers.map(id => engine.getPiece(id).currentPos);

    popGroupPositionsRef.current = new Set(groupPositions);
    selectionPopStartTimeRef.current = Date.now();

    playPickup();
    isDraggingRef.current = true;
    dragStartPosRef.current = pos;
    dragStartXRef.current = clientX;
    dragStartYRef.current = clientY;
    dragCurrentXRef.current = clientX;
    dragCurrentYRef.current = clientY;
    dragDisplayXRef.current = clientX;
    dragDisplayYRef.current = clientY;
    dragGroupRef.current = groupMembers;
    dragGroupPosRef.current = groupPositions;
    dragHoverPosRef.current = pos;
    dragThresholdMetRef.current = false;
  }, [engine, screenToGrid]);

  const handleInteractionMove = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) return;

    const dx = clientX - dragStartXRef.current;
    const dy = clientY - dragStartYRef.current;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 10) {
      dragThresholdMetRef.current = true;
    }

    dragCurrentXRef.current = clientX;
    dragCurrentYRef.current = clientY;
    dragHoverPosRef.current = screenToGrid(clientX, clientY);
  }, [screenToGrid]);

  const handleInteractionEnd = useCallback((clientX: number, clientY: number) => {
    if (!isDraggingRef.current) {
      return;
    }

    const startPos = dragStartPosRef.current;
    const gridSize = engine.gridSize;
    const positions = dragGroupPosRef.current;

    if (dragThresholdMetRef.current) {
      // 拖拽模式：与松手所在格无关，用主动组锚点 + 拖动偏移判定；仅当偏移 > 半格时移动；超出半格即越界拒绝
      const anchorRow = positions.length
        ? Math.min(...positions.map(p => Math.floor(p / gridSize)))
        : 0;
      const anchorCol = positions.length
        ? Math.min(...positions.map(p => p % gridSize))
        : 0;
      const maxRow = positions.length ? Math.max(...positions.map(p => Math.floor(p / gridSize))) : 0;
      const maxCol = positions.length ? Math.max(...positions.map(p => p % gridSize)) : 0;
      const groupHeight = maxRow - anchorRow + 1;
      const groupWidth = maxCol - anchorCol + 1;
      const screenDx = clientX - dragStartXRef.current;
      const screenDy = clientY - dragStartYRef.current;
      const { toPos, shouldMove } = getToPosFromDragOffset(
        anchorRow,
        anchorCol,
        groupHeight,
        groupWidth,
        screenDx,
        screenDy,
      );
      // 允许 toPos === startPos：组整体平移时目标格可能恰为按下格（如按下 6 向下拖）
      if (shouldMove && toPos !== -1) {
        doSwap(startPos, toPos);
      }
      selectedPosRef.current = -1;
    } else {
      // 点击模式
      const upPos = screenToGrid(clientX, clientY);
      const clickedPos = upPos !== -1 ? upPos : startPos;
      const currentSel = selectedPosRef.current;

      if (currentSel >= 0 && currentSel !== clickedPos) {
        doSwap(currentSel, clickedPos);
        selectedPosRef.current = -1;
      } else if (currentSel === clickedPos) {
        selectedPosRef.current = -1;
      } else {
        selectedPosRef.current = clickedPos;
        // 不在此处再次触发 pop：按下时已触发一次，松开不再二次闪动
      }
    }

    // 重置拖拽状态
    isDraggingRef.current = false;
    dragStartPosRef.current = -1;
    dragGroupRef.current = [];
    dragGroupPosRef.current = [];
    dragHoverPosRef.current = -1;
    dragThresholdMetRef.current = false;

    forceRender(n => n + 1);
  }, [engine, screenToGrid, getToPosFromDragOffset, doSwap]);

  // 处理纯 click 事件（兼容 CDP 自动化和某些浏览器）
  const handleClick = useCallback((clientX: number, clientY: number) => {
    if (engine.isComplete) return;

    const pos = screenToGrid(clientX, clientY);
    if (pos === -1) {
      selectedPosRef.current = -1;
      forceRender(n => n + 1);
      return;
    }

    const pieceId = engine.getPieceAtPos(pos);
    if (pieceId === -1) return;

    const currentSel = selectedPosRef.current;

    if (currentSel >= 0 && currentSel !== pos) {
      doSwap(currentSel, pos);
      selectedPosRef.current = -1;
    } else if (currentSel === pos) {
      selectedPosRef.current = -1;
    } else {
      selectedPosRef.current = pos;
      const selPositions = engine.uf.getGroupMembers(pieceId).map((id: number) => engine.getPiece(id).currentPos);
      popGroupPositionsRef.current = new Set(selPositions);
      selectionPopStartTimeRef.current = Date.now();
    }

    forceRender(n => n + 1);
  }, [engine, screenToGrid, doSwap]);

  // 标记是否通过mousedown/mouseup完成了交互
  const mouseHandledRef = useRef(false);

  // Mouse 事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      mouseHandledRef.current = true;
      handleInteractionStart(e.clientX, e.clientY);
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      handleInteractionMove(e.clientX, e.clientY);
    };

    const onMouseUp = (e: MouseEvent) => {
      handleInteractionEnd(e.clientX, e.clientY);
    };

    const onClick = (e: MouseEvent) => {
      if (mouseHandledRef.current) {
        mouseHandledRef.current = false;
        return;
      }
      handleClick(e.clientX, e.clientY);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('click', onClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('click', onClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [handleInteractionStart, handleInteractionMove, handleInteractionEnd, handleClick]);

  // Touch 事件
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      handleInteractionStart(touch.clientX, touch.clientY);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      handleInteractionMove(touch.clientX, touch.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length < 1) return;
      const touch = e.changedTouches[0];
      handleInteractionEnd(touch.clientX, touch.clientY);
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [handleInteractionStart, handleInteractionMove, handleInteractionEnd]);

  // 主绘制函数（棋盘画布；拖拽跟随由全屏 overlay 绘制）
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !imageLoaded) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    // 移动端限制 DPR 以降低 canvas 内存，避免 OOM 导致页面被系统关闭
    const rawDpr = window.devicePixelRatio || 1;
    const isMobile = /Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent);
    const dpr = isMobile ? Math.min(rawDpr, 2) : rawDpr;
    const { boardWidth, boardHeight, gap, cellWidth, cellHeight, gridSize, colEdges, rowEdges } = layout;

    if (canvas.width !== Math.round(boardWidth * dpr) || canvas.height !== Math.round(boardHeight * dpr)) {
      canvas.width = Math.round(boardWidth * dpr);
      canvas.height = Math.round(boardHeight * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, boardWidth, boardHeight);

    const isDragging = isDraggingRef.current && dragThresholdMetRef.current;
    const dragPosSet = new Set(isDragging ? dragGroupPosRef.current : []);
    const currentSelectedPos = selectedPosRef.current;
    const flash = mergeFlashRef.current;

    // 高亮选中的块（朱砂红边框）
    if (currentSelectedPos >= 0 && !isDragging) {
      const selPieceId = engine.getPieceAtPos(currentSelectedPos);
      if (selPieceId !== -1) {
        const selGroup = engine.uf.getGroupMembers(selPieceId);
        for (const memberId of selGroup) {
          const memberPos = engine.getPiece(memberId).currentPos;
          const sr = Math.floor(memberPos / gridSize);
          const sc = memberPos % gridSize;
          const sx = gap + sc * (cellWidth + gap);
          const sy = gap + sr * (cellHeight + gap);
          ctx.fillStyle = 'rgba(196, 70, 58, 0.10)';
          ctx.fillRect(sx - 1, sy - 1, cellWidth + 2, cellHeight + 2);
          ctx.strokeStyle = '#C4463A';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(sx - 1, sy - 1, cellWidth + 2, cellHeight + 2);
        }
      }
    }

    // 拖拽时高亮目标位置
    if (isDragging && dragHoverPosRef.current >= 0 && dragHoverPosRef.current !== dragStartPosRef.current) {
      const hoverPieceId = engine.getPieceAtPos(dragHoverPosRef.current);
      if (hoverPieceId !== -1 && !dragGroupRef.current.includes(hoverPieceId)) {
        const hoverGroup = engine.uf.getGroupMembers(hoverPieceId);
        for (const memberId of hoverGroup) {
          const memberPos = engine.getPiece(memberId).currentPos;
          const hr = Math.floor(memberPos / gridSize);
          const hc = memberPos % gridSize;
          const hx = gap + hc * (cellWidth + gap);
          const hy = gap + hr * (cellHeight + gap);
          ctx.fillStyle = 'rgba(196, 70, 58, 0.08)';
          ctx.fillRect(hx, hy, cellWidth, cellHeight);
          ctx.strokeStyle = 'rgba(196, 70, 58, 0.45)';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(hx, hy, cellWidth, cellHeight);
          ctx.setLineDash([]);
        }
      }
    }

    // 绘制拼图块；scaleOrigin 为合并动效时整组缩放中心，未传则绕本格中心缩放
    const drawPieceAt = (
      pieceId: number,
      pos: number,
      offsetX: number,
      offsetY: number,
      alpha: number = 1,
      scale: number = 1,
      scaleOrigin?: { cx: number; cy: number },
    ) => {
      const piece = engine.getPiece(pieceId);
      const row = Math.floor(pos / gridSize);
      const col = pos % gridSize;

      // 使用整数像素边界，相邻图块共享同一边界，消除竖向/横向拼接缝
      const baseX = colEdges[col] + offsetX;
      const baseY = rowEdges[row] + offsetY;

      // 使用整数像素边界切图，避免亚像素采样产生拼接缝
      const srcX = Math.floor((piece.col * img.naturalWidth) / gridSize);
      const srcY = Math.floor((piece.row * img.naturalHeight) / gridSize);
      const srcX2 = Math.floor(((piece.col + 1) * img.naturalWidth) / gridSize);
      const srcY2 = Math.floor(((piece.row + 1) * img.naturalHeight) / gridSize);
      const srcW = srcX2 - srcX;
      const srcH = srcY2 - srcY;

      // 合并检测 — 相邻正确块之间消除间隙
      const mergedRight = col < gridSize - 1 && !engine.shouldShowBorder(pos, pos + 1);
      const mergedDown = row < gridSize - 1 && !engine.shouldShowBorder(pos, pos + gridSize);
      const mergedLeft = col > 0 && !engine.shouldShowBorder(pos, pos - 1);
      const mergedUp = row > 0 && !engine.shouldShowBorder(pos, pos - gridSize);

      const drawX = (mergedLeft ? colEdges[col] - gap : colEdges[col]) + offsetX;
      const drawY = (mergedUp ? rowEdges[row] - gap : rowEdges[row]) + offsetY;
      const drawW =
        (mergedRight ? colEdges[col + 1] + gap : colEdges[col + 1]) -
        (mergedLeft ? colEdges[col] - gap : colEdges[col]);
      const drawH =
        (mergedDown ? rowEdges[row + 1] + gap : rowEdges[row + 1]) -
        (mergedUp ? rowEdges[row] - gap : rowEdges[row]);

      const gapRatioX = gap / cellWidth;
      const gapRatioY = gap / cellHeight;
      const sSrcX = srcX - (mergedLeft ? srcW * gapRatioX : 0);
      const sSrcY = srcY - (mergedUp ? srcH * gapRatioY : 0);
      const sSrcW = srcW + (mergedLeft ? srcW * gapRatioX : 0) + (mergedRight ? srcW * gapRatioX : 0);
      const sSrcH = srcH + (mergedUp ? srcH * gapRatioY : 0) + (mergedDown ? srcH * gapRatioY : 0);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (scale !== 1) {
        const cx = scaleOrigin ? scaleOrigin.cx : drawX + drawW / 2;
        const cy = scaleOrigin ? scaleOrigin.cy : drawY + drawH / 2;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        ctx.translate(-cx, -cy);
      }

      // 圆角裁剪
      ctx.beginPath();
      const r = 3;
      ctx.moveTo(drawX + r, drawY);
      ctx.lineTo(drawX + drawW - r, drawY);
      ctx.quadraticCurveTo(drawX + drawW, drawY, drawX + drawW, drawY + r);
      ctx.lineTo(drawX + drawW, drawY + drawH - r);
      ctx.quadraticCurveTo(drawX + drawW, drawY + drawH, drawX + drawW - r, drawY + drawH);
      ctx.lineTo(drawX + r, drawY + drawH);
      ctx.quadraticCurveTo(drawX, drawY + drawH, drawX, drawY + drawH - r);
      ctx.lineTo(drawX, drawY + r);
      ctx.quadraticCurveTo(drawX, drawY, drawX + r, drawY);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sSrcX, sSrcY, sSrcW, sSrcH, drawX, drawY, drawW, drawH);
      ctx.restore();

      // 未合并边框 — 白色分隔线效果；每条边只画一次，避免相邻两块重复绘制同一条线导致白条加粗
      ctx.save();
      ctx.globalAlpha = alpha;

      // 外阴影层 - 模拟截图中的立体边界感
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 0.5;
      ctx.shadowOffsetY = 0.5;

      // 白色主边框：仅画「上」「左」；右/下由右侧/下侧格子画，最右列与最下行补画右/下
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.5;
      const isRightmost = col === gridSize - 1;
      const isBottommost = row === gridSize - 1;

      if (!mergedUp) {
        ctx.beginPath(); ctx.moveTo(drawX, drawY); ctx.lineTo(drawX + drawW, drawY); ctx.stroke();
      }
      if (!mergedLeft) {
        ctx.beginPath(); ctx.moveTo(drawX, drawY); ctx.lineTo(drawX, drawY + drawH); ctx.stroke();
      }
      if (!mergedRight && isRightmost) {
        ctx.beginPath(); ctx.moveTo(drawX + drawW, drawY); ctx.lineTo(drawX + drawW, drawY + drawH); ctx.stroke();
      }
      if (!mergedDown && isBottommost) {
        ctx.beginPath(); ctx.moveTo(drawX, drawY + drawH); ctx.lineTo(drawX + drawW, drawY + drawH); ctx.stroke();
      }

      // 内阴影线 - 增加立体感（同样每条只画一次）
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 0.5;

      if (!mergedUp) {
        ctx.beginPath(); ctx.moveTo(drawX, drawY + 1); ctx.lineTo(drawX + drawW, drawY + 1); ctx.stroke();
      }
      if (!mergedLeft) {
        ctx.beginPath(); ctx.moveTo(drawX + 1, drawY); ctx.lineTo(drawX + 1, drawY + drawH); ctx.stroke();
      }

      ctx.restore();

      // 数字角标
      if (showNumbers) {
        ctx.save();
        ctx.globalAlpha = alpha;
        const numSize = Math.max(14, Math.min(cellWidth, cellHeight) * 0.22);
        ctx.fillStyle = 'rgba(196, 70, 58, 0.92)';
        ctx.beginPath();
        ctx.arc(baseX + numSize * 0.8, baseY + numSize * 0.8, numSize * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = `bold ${Math.round(numSize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pieceId + 1), baseX + numSize * 0.8, baseY + numSize * 0.85);
        ctx.restore();
      }
    };

    // 合并时该组图块的轻微放大抖动系数（前 20% 放大到 1.06，20%–50% 收回 1）
    const mergeScaleAt = (pos: number): number => {
      if (!flash) return 1;
      const inGroup = flash.groups.some((ids) =>
        ids.some((id) => engine.getPiece(id).currentPos === pos),
      );
      if (!inGroup) return 1;
      const elapsed = Date.now() - flash.startTime;
      const t = elapsed / MERGE_FLASH_DURATION;
      if (t <= 0.2) return 1 + 0.06 * (t / 0.2);
      if (t <= 0.5) return 1 + 0.06 * (1 - (t - 0.2) / 0.3);
      return 1;
    };

    // 点击或按下时图块/组整体放大缩小一下（幅度不大，约 1 → 1.045 → 1）
    const selectionPopScaleAt = (pos: number): number => {
      if (!popGroupPositionsRef.current.has(pos)) return 1;
      const elapsed = Date.now() - selectionPopStartTimeRef.current;
      if (elapsed >= SELECTION_POP_DURATION) return 1;
      const t = elapsed / SELECTION_POP_DURATION;
      const up = 0.32;
      if (t <= up) return 1 + SELECTION_POP_PEAK * (t / up);
      return 1 + SELECTION_POP_PEAK * (1 - (t - up) / (1 - up));
    };

    const selectionPopCenterByPos = new Map<number, { cx: number; cy: number }>();
    if (popGroupPositionsRef.current.size > 0) {
      const elapsed = Date.now() - selectionPopStartTimeRef.current;
      if (elapsed < SELECTION_POP_DURATION) {
        const positions = Array.from(popGroupPositionsRef.current);
        let sumCx = 0;
        let sumCy = 0;
        for (const p of positions) {
          const r = Math.floor(p / gridSize);
          const c = p % gridSize;
          sumCx += (colEdges[c] + colEdges[c + 1]) / 2;
          sumCy += (rowEdges[r] + rowEdges[r + 1]) / 2;
        }
        const n = positions.length;
        const cx = sumCx / n;
        const cy = sumCy / n;
        for (const p of positions) {
          selectionPopCenterByPos.set(p, { cx, cy });
        }
      }
    }

    // 合并动效：每组一个几何中心，整组绕该中心缩放，而不是每格独立缩放
    const mergeGroupCenterByPos = new Map<number, { cx: number; cy: number }>();
    if (flash) {
      flash.groups.forEach((memberIds) => {
        const positions = memberIds.map((id) => engine.getPiece(id).currentPos);
        let sumCx = 0;
        let sumCy = 0;
        for (const pos of positions) {
          const r = Math.floor(pos / gridSize);
          const c = pos % gridSize;
          sumCx += (colEdges[c] + colEdges[c + 1]) / 2;
          sumCy += (rowEdges[r] + rowEdges[r + 1]) / 2;
        }
        const n = positions.length;
        const cx = sumCx / n;
        const cy = sumCy / n;
        for (const pos of positions) {
          mergeGroupCenterByPos.set(pos, { cx, cy });
        }
      });
    }

    // 绘制非拖拽块
    for (let pos = 0; pos < engine.totalPieces; pos++) {
      if (dragPosSet.has(pos)) continue;
      const pieceId = engine.getPieceAtPos(pos);
      if (pieceId === -1) continue;
      const mergeScale = mergeScaleAt(pos);
      const selectionScale = selectionPopScaleAt(pos);
      const scale = mergeScale * selectionScale;
      const scaleOrigin = mergeGroupCenterByPos.get(pos) ?? selectionPopCenterByPos.get(pos);
      drawPieceAt(pieceId, pos, 0, 0, 1, scale, scaleOrigin);
    }

    // 拖拽时：棋盘上只画 ghost；跟随鼠标的浮动块由全屏 overlay 绘制
    if (isDragging && dragGroupRef.current.length > 0) {
      for (let i = 0; i < dragGroupRef.current.length; i++) {
        drawPieceAt(dragGroupRef.current[i], dragGroupPosRef.current[i], 0, 0, 0.2);
      }
    }

    // 合并亮光闪烁：沿合并后图块组的真实边界（每条外边）描一圈亮光并淡出
    if (flash) {
      const elapsed = Date.now() - flash.startTime;
      if (elapsed >= MERGE_FLASH_DURATION) {
        mergeFlashRef.current = null;
      } else {
        const t = elapsed / MERGE_FLASH_DURATION;
        const alpha = 1 - t * t;

        flash.groups.forEach((memberIds) => {
          const posSet = new Set(memberIds.map((id) => engine.getPiece(id).currentPos));
          const cellSet = new Set(
            Array.from(posSet).map((pos) => `${Math.floor(pos / gridSize)},${pos % gridSize}`),
          );
          const inSet = (r: number, c: number) => cellSet.has(`${r},${c}`);

          // 用扩展边界（含 gap）使相邻格共享顶点，整圈才能首尾相接
          const stepX = cellWidth + gap;
          const stepY = cellHeight + gap;
          type Seg = { ax: number; ay: number; bx: number; by: number };
          const segments: Seg[] = [];
          posSet.forEach((pos) => {
            const r = Math.floor(pos / gridSize);
            const c = pos % gridSize;
            const left = gap + c * stepX;
            const top = gap + r * stepY;
            const right = left + stepX;
            const bottom = top + stepY;
            if (!inSet(r - 1, c)) segments.push({ ax: right, ay: top, bx: left, by: top });
            if (!inSet(r + 1, c)) segments.push({ ax: left, ay: bottom, bx: right, by: bottom });
            if (!inSet(r, c - 1)) segments.push({ ax: left, ay: top, bx: left, by: bottom });
            if (!inSet(r, c + 1)) segments.push({ ax: right, ay: bottom, bx: right, by: top });
          });

          if (segments.length === 0) return;

          const eps = 1e-4;
          const eq = (a: { x: number; y: number }, b: { x: number; y: number }) =>
            Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;
          const path: { x: number; y: number }[] = [
            { x: segments[0].ax, y: segments[0].ay },
            { x: segments[0].bx, y: segments[0].by },
          ];
          const used = new Set<number>();
          used.add(0);
          const first = path[0];
          while (used.size < segments.length) {
            const last = path[path.length - 1];
            const idx = segments.findIndex(
              (s, i) => !used.has(i) && eq({ x: s.ax, y: s.ay }, last),
            );
            if (idx === -1) break;
            used.add(idx);
            const s = segments[idx];
            const next = { x: s.bx, y: s.by };
            if (eq(next, first)) break;
            path.push(next);
          }

          ctx.save();
          ctx.lineJoin = 'round';
          ctx.lineCap = 'round';
          for (let i = 3; i >= 0; i--) {
            const layerAlpha = alpha * (0.35 - i * 0.07);
            ctx.strokeStyle = `rgba(255, 230, 180, ${layerAlpha})`;
            ctx.lineWidth = 8 + i * 4;
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
            ctx.closePath();
            ctx.stroke();
          }
          ctx.strokeStyle = `rgba(255, 248, 220, ${alpha * 0.95})`;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(path[0].x, path[0].y);
          for (let j = 1; j < path.length; j++) ctx.lineTo(path[j].x, path[j].y);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
        });
      }
    }

    // 完成状态 — 金色边框
    if (engine.isComplete) {
      ctx.strokeStyle = '#D4A017';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, boardWidth - 4, boardHeight - 4);
    }
  }, [layout, engine, imageLoaded, showNumbers]);

  // 全屏拖拽层：在视口内用屏幕坐标绘制跟随的图块，支持拖出棋盘仍全页跟随
  const drawDragOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    const boardCanvas = canvasRef.current;
    const img = imageRef.current;
    if (!overlay || !boardCanvas || !img || !imageLoaded) return;

    const isDragging = isDraggingRef.current && dragThresholdMetRef.current;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const rawDpr = window.devicePixelRatio || 1;
    const isMobile = /Android|iPhone|iPad|iPod|webOS|Mobile/i.test(navigator.userAgent);
    const dpr = isMobile ? Math.min(rawDpr, 2) : rawDpr;
    const rect = overlay.getBoundingClientRect();
    if (overlay.width !== Math.round(rect.width * dpr) || overlay.height !== Math.round(rect.height * dpr)) {
      overlay.width = Math.round(rect.width * dpr);
      overlay.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!isDragging || dragGroupRef.current.length === 0) return;

    const LERP = 0.2;
    dragDisplayXRef.current += (dragCurrentXRef.current - dragDisplayXRef.current) * LERP;
    dragDisplayYRef.current += (dragCurrentYRef.current - dragDisplayYRef.current) * LERP;

    const boardRect = boardCanvas.getBoundingClientRect();
    const { boardWidth, boardHeight, gap, cellWidth, cellHeight, gridSize, colEdges, rowEdges } = layout;
    const scaleX = boardRect.width / boardWidth;
    const scaleY = boardRect.height / boardHeight;
    const dx = dragDisplayXRef.current - dragStartXRef.current;
    const dy = dragDisplayYRef.current - dragStartYRef.current;

    for (let i = 0; i < dragGroupRef.current.length; i++) {
      const pieceId = dragGroupRef.current[i];
      const pos = dragGroupPosRef.current[i];
      const piece = engine.getPiece(pieceId);
      const row = Math.floor(pos / gridSize);
      const col = pos % gridSize;

      const mergedRight = col < gridSize - 1 && !engine.shouldShowBorder(pos, pos + 1);
      const mergedDown = row < gridSize - 1 && !engine.shouldShowBorder(pos, pos + gridSize);
      const mergedLeft = col > 0 && !engine.shouldShowBorder(pos, pos - 1);
      const mergedUp = row > 0 && !engine.shouldShowBorder(pos, pos - gridSize);
      const drawXBoard = (mergedLeft ? colEdges[col] - gap : colEdges[col]);
      const drawYBoard = (mergedUp ? rowEdges[row] - gap : rowEdges[row]);
      const drawWBoard =
        (mergedRight ? colEdges[col + 1] + gap : colEdges[col + 1]) -
        (mergedLeft ? colEdges[col] - gap : colEdges[col]);
      const drawHBoard =
        (mergedDown ? rowEdges[row + 1] + gap : rowEdges[row + 1]) -
        (mergedUp ? rowEdges[row] - gap : rowEdges[row]);

      const screenX = boardRect.left + drawXBoard * scaleX + dx;
      const screenY = boardRect.top + drawYBoard * scaleY + dy;
      const drawW = drawWBoard * scaleX;
      const drawH = drawHBoard * scaleY;

      const srcX = Math.floor((piece.col * img.naturalWidth) / gridSize);
      const srcY = Math.floor((piece.row * img.naturalHeight) / gridSize);
      const srcW = Math.floor(((piece.col + 1) * img.naturalWidth) / gridSize) - srcX;
      const srcH = Math.floor(((piece.row + 1) * img.naturalHeight) / gridSize) - srcY;
      const gapRatioX = gap / cellWidth;
      const gapRatioY = gap / cellHeight;
      const sSrcX = srcX - (mergedLeft ? srcW * gapRatioX : 0);
      const sSrcY = srcY - (mergedUp ? srcH * gapRatioY : 0);
      const sSrcW = srcW + (mergedLeft ? srcW * gapRatioX : 0) + (mergedRight ? srcW * gapRatioX : 0);
      const sSrcH = srcH + (mergedUp ? srcH * gapRatioY : 0) + (mergedDown ? srcH * gapRatioY : 0);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.translate(screenX + drawW / 2, screenY + drawH / 2);
      ctx.scale(1.04, 1.04);
      ctx.translate(-drawW / 2, -drawH / 2);
      const r = 3 * Math.min(scaleX, scaleY);
      ctx.beginPath();
      ctx.moveTo(r, 0); ctx.lineTo(drawW - r, 0);
      ctx.quadraticCurveTo(drawW, 0, drawW, r);
      ctx.lineTo(drawW, drawH - r);
      ctx.quadraticCurveTo(drawW, drawH, drawW - r, drawH);
      ctx.lineTo(r, drawH);
      ctx.quadraticCurveTo(0, drawH, 0, drawH - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sSrcX, sSrcY, sSrcW, sSrcH, 0, 0, drawW, drawH);
      ctx.restore();

      if (showNumbers) {
        ctx.save();
        const numSize = Math.max(14, Math.min(cellWidth * scaleX, cellHeight * scaleY) * 0.22);
        ctx.fillStyle = 'rgba(196, 70, 58, 0.92)';
        ctx.beginPath();
        ctx.arc(screenX + numSize * 0.8, screenY + numSize * 0.8, numSize * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = `bold ${Math.round(numSize * 0.7)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(pieceId + 1), screenX + numSize * 0.8, screenY + numSize * 0.85);
        ctx.restore();
      }
    }
  }, [layout, engine, imageLoaded, showNumbers]);

  // 动画循环（棋盘 + 全屏拖拽层）；try-catch 防止单帧错误导致移动端整页崩溃
  useEffect(() => {
    const animate = () => {
      try {
        draw();
        drawDragOverlay();
      } catch (err) {
        console.error('[PuzzleBoard] draw error', err);
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, drawDragOverlay]);

  return (
    <div className="relative">
      {/* 全屏拖拽层：图块在页面范围内跟随鼠标 */}
      <canvas
        ref={overlayCanvasRef}
        className="pointer-events-none fixed inset-0 z-10"
        style={{ width: '100%', height: '100%' }}
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        className="touch-none select-none"
        style={{
          width: layout.boardWidth,
          height: layout.boardHeight,
          borderRadius: '8px',
          boxShadow: '0 4px 24px rgba(60, 50, 40, 0.18), inset 0 0 0 1px rgba(60, 50, 40, 0.06)',
        }}
      />
      {/* Loading 状态 */}
      {!imageLoaded && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-lg bg-transparent"
        >
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-3 border-t-transparent animate-spin"
              style={{ borderColor: '#C4463A', borderTopColor: 'transparent' }}
            />
            <span
              className="text-xs"
              style={{ color: '#8B8680', fontFamily: "'Noto Serif SC', serif" }}
            >
              画卷展开中...
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const PuzzleBoard = forwardRef(PuzzleBoardInner);
export default PuzzleBoard;
