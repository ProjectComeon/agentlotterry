import { buildSlipDisplayGroups } from './slipGrouping';
import { formatMoney as money } from './formatters';

const REM = 16;

const CANVAS_WIDTH = 1280;
const FRAME_PADDING = 20;
const MODAL_WIDTH = CANVAS_WIDTH - (FRAME_PADDING * 2);
const MODAL_PADDING_X = 14;
const MODAL_PADDING_TOP = 12;
const MODAL_PADDING_BOTTOM = 14;
const SECTION_GAP = 8;

const COLORS = {
  canvas: '#fff7f7',
  modal: '#fffdfd',
  border: 'rgba(185, 28, 28, 0.12)',
  borderAccent: 'rgba(220, 38, 38, 0.2)',
  borderSoft: 'rgba(220, 38, 38, 0.12)',
  primary: '#dc2626',
  primaryLight: '#ef4444',
  textPrimary: '#241313',
  textSecondary: '#7f5050',
  textMuted: '#ad7a7a',
  cardSurface: 'rgba(255, 253, 253, 0.96)',
  cardTint: 'rgba(255, 245, 245, 0.96)',
  metaTop: 'rgba(255, 253, 253, 0.96)',
  metaBottom: 'rgba(255, 245, 245, 0.98)',
  shadowModal: 'rgba(127, 29, 29, 0.1)',
  shadowCard: 'rgba(127, 29, 29, 0.06)'
};

const TYPE = {
  eyebrow: 0.78 * REM,
  title: 1.2 * REM,
  metaLine: 1.05 * REM,
  metaNote: 0.84 * REM,
  summaryLabel: 0.84 * REM,
  summaryValue: 1.08 * REM,
  groupFamily: 0.8 * REM,
  groupMeta: 0.68 * REM,
  groupTotal: 0.92 * REM,
  numbers: 0.92 * REM,
  noteLabel: 0.84 * REM,
  noteText: 0.92 * REM,
  empty: 0.92 * REM
};

const GROUP = {
  cardPaddingX: 8,
  cardPaddingY: 7,
  cardGap: 6,
  badgeWidth: 74,
  badgeMinHeight: 46,
  badgePaddingY: 5,
  numbersMinHeight: 34,
  numbersPaddingX: 9,
  numbersPaddingY: 7,
  numbersLineHeight: TYPE.numbers * 1.3,
  bodyGap: 4,
  badgeTextGap: 4
};

const NOTE = {
  paddingX: 9,
  paddingY: 7,
  lineHeight: TYPE.noteText * 1.35
};

const wrapText = (ctx, text, maxWidth) => {
  const content = String(text || '').trim();
  if (!content) return ['-'];

  const words = content.split(/\s+/);
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      return;
    }

    if (current) {
      lines.push(current);
      current = word;
      return;
    }

    let chunk = '';
    [...word].forEach((char) => {
      const candidate = chunk + char;
      if (ctx.measureText(candidate).width <= maxWidth) {
        chunk = candidate;
      } else {
        if (chunk) lines.push(chunk);
        chunk = char;
      }
    });
    current = chunk;
  });

  if (current) lines.push(current);
  return lines.length ? lines : ['-'];
};

const drawRoundedRect = (ctx, x, y, width, height, radius, fillStyle, strokeStyle = null) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
};

const drawShadowCard = (
  ctx,
  x,
  y,
  width,
  height,
  radius,
  fillStyle,
  strokeStyle,
  { shadowColor = COLORS.shadowCard, shadowBlur = 18, shadowOffsetY = 8 } = {}
) => {
  ctx.save();
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetY = shadowOffsetY;
  drawRoundedRect(ctx, x, y, width, height, radius, fillStyle, strokeStyle);
  ctx.restore();
};

const drawLinearCard = (ctx, x, y, width, height, radius, colorTop, colorBottom, strokeStyle = null) => {
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, colorTop);
  gradient.addColorStop(1, colorBottom);
  drawRoundedRect(ctx, x, y, width, height, radius, gradient, strokeStyle);
};

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const formatThaiDate = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '-';

  const isoMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  }

  const slashMatch = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (slashMatch) {
    const [, day, month, yearRaw] = slashMatch;
    const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const date = new Date(year, Number(month) - 1, Number(day));
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Bangkok'
    });
  }

  return raw.replace(/^งวด:\s*/i, '').replace(/^งวด\s*/i, '').trim();
};

const normalizeRoundLabel = (marketName, roundLabel) => {
  const market = String(marketName || '').trim();
  const round = String(roundLabel || '').trim();

  if (!round) return '-';
  if (!market) return round;

  const escapedMarket = market.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return round.replace(new RegExp(`^${escapedMarket}\\s*[•|]\\s*`), '').trim() || round;
};

const buildPreviewImagePayload = ({
  preview,
  selectedMember,
  selectedLottery,
  selectedRound
}) => ({
  eyebrow: 'สรุปโพยดิจิทัล',
  title: 'ตรวจสอบก่อนบันทึกโพย',
  memberName: preview?.member?.name || selectedMember?.name || '-',
  marketName: selectedLottery?.name || preview?.lottery?.name || '-',
  roundLabel: formatThaiDate(selectedRound?.title || preview?.round?.title || selectedRound?.code || preview?.round?.code || '-'),
  totalAmount: Number(preview?.summary?.totalAmount || 0),
  groups: buildSlipDisplayGroups(preview?.items || []),
  note: preview?.memo || '',
  showEmptyNote: false
});

const buildSavedSlipImagePayload = ({ slip }) => {
  const groups = slip?.displayGroups?.length ? slip.displayGroups : buildSlipDisplayGroups(slip?.items || []);
  const totalAmount =
    Number(slip?.totalAmount) ||
    Number(slip?.totalStake) ||
    groups.reduce((sum, group) => sum + Number(group.totalAmount || 0), 0);

  return {
    eyebrow: 'สรุปโพยดิจิทัล',
    title: 'ตรวจสอบก่อนบันทึกโพย',
    memberName: slip?.customer?.name || '-',
    marketName: slip?.marketName || '-',
    roundLabel: formatThaiDate(normalizeRoundLabel(slip?.marketName, slip?.roundLabel || slip?.roundDate || '-')),
    totalAmount,
    groups,
    note: slip?.memo || '',
    showEmptyNote: true
  };
};

const measureImageLayout = (ctx, payload) => {
  const contentWidth = MODAL_WIDTH - (MODAL_PADDING_X * 2);
  const groupBodyWidth =
    contentWidth -
    (GROUP.cardPaddingX * 2) -
    GROUP.badgeWidth -
    GROUP.cardGap;

  ctx.font = `700 ${TYPE.numbers}px sans-serif`;
  const groups = (payload.groups || []).map((group) => {
    const numberLines = wrapText(
      ctx,
      group.numbersText,
      groupBodyWidth - (GROUP.numbersPaddingX * 2)
    );
    const numbersHeight = Math.max(
      GROUP.numbersMinHeight,
      (GROUP.numbersPaddingY * 2) + (numberLines.length * GROUP.numbersLineHeight)
    );
    const bodyHeight = Math.ceil(TYPE.groupTotal * 1.2) + GROUP.bodyGap + numbersHeight;
    const contentHeight = Math.max(GROUP.badgeMinHeight, bodyHeight);
    const cardHeight = (GROUP.cardPaddingY * 2) + contentHeight;

    return {
      ...group,
      numberLines,
      cardHeight
    };
  });

  const showNote = payload.showEmptyNote || Boolean(String(payload.note || '').trim());
  let noteCardHeight = 0;
  let noteLines = [];

  if (showNote) {
    ctx.font = `700 ${TYPE.noteText}px sans-serif`;
    noteLines = wrapText(ctx, payload.note || 'ไม่มีบันทึกช่วยจำ', contentWidth - (NOTE.paddingX * 2));
    noteCardHeight = Math.max(
      56,
      34 + (NOTE.paddingY * 2) + (noteLines.length * NOTE.lineHeight)
    );
  }

  const headerHeight = 52;
  const metaCardHeight = 108;
  const summaryCardHeight = 68;
  const emptyCardHeight = 72;
  const groupsHeight = groups.length
    ? groups.reduce((sum, group) => sum + group.cardHeight, 0) + ((groups.length - 1) * 6)
    : emptyCardHeight;

  const modalHeight =
    MODAL_PADDING_TOP +
    headerHeight +
    14 +
    metaCardHeight +
    SECTION_GAP +
    groupsHeight +
    8 +
    summaryCardHeight +
    (showNote ? 8 + noteCardHeight : 0) +
    MODAL_PADDING_BOTTOM;

  return {
    contentWidth,
    groups,
    noteLines,
    noteCardHeight,
    showNote,
    headerHeight,
    metaCardHeight,
    summaryCardHeight,
    emptyCardHeight,
    modalHeight
  };
};

const renderGroupedSlipImage = (payload) => {
  const ratio = window.devicePixelRatio > 1 ? 2 : 1;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  const layout = measureImageLayout(measureCtx, payload);
  const canvasHeight = layout.modalHeight + (FRAME_PADDING * 2);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH * ratio;
  canvas.height = canvasHeight * ratio;
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${canvasHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = COLORS.canvas;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  const modalX = FRAME_PADDING;
  const modalY = FRAME_PADDING;
  drawShadowCard(
    ctx,
    modalX,
    modalY,
    MODAL_WIDTH,
    layout.modalHeight,
    20,
    COLORS.modal,
    COLORS.border,
    { shadowColor: COLORS.shadowModal, shadowBlur: 26, shadowOffsetY: 10 }
  );

  const contentX = modalX + MODAL_PADDING_X;
  let y = modalY + MODAL_PADDING_TOP;

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.primaryLight;
  ctx.font = `700 ${TYPE.eyebrow}px sans-serif`;
  ctx.fillText(payload.eyebrow, contentX, y + 13);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.title}px sans-serif`;
  ctx.fillText(payload.title, contentX, y + 38);

  y += layout.headerHeight + 14;

  drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.metaCardHeight, 16, COLORS.metaTop, COLORS.borderAccent);
  drawLinearCard(ctx, contentX, y, layout.contentWidth, layout.metaCardHeight, 16, COLORS.metaTop, COLORS.metaBottom, COLORS.borderAccent);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.metaLine}px sans-serif`;
  ctx.fillText(`สมาชิก: ${payload.memberName}`, contentX + 16, y + 28);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.metaLine}px sans-serif`;
  ctx.fillText(`ตลาด: ${payload.marketName}`, contentX + 16, y + 58);
  ctx.fillText(`งวด: ${payload.roundLabel}`, contentX + 16, y + 88);

  y += layout.metaCardHeight + SECTION_GAP;

  drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.summaryCardHeight, 16, COLORS.cardSurface, COLORS.border);
  const summaryColWidth = layout.contentWidth / 2;

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `600 ${TYPE.summaryLabel}px sans-serif`;
  ctx.fillText('สมาชิก', contentX + 18, y + 22);
  ctx.fillText('ยอดรวม', contentX + summaryColWidth + 18, y + 22);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.summaryValue}px sans-serif`;
  ctx.fillText(payload.memberName, contentX + 18, y + 48);
  ctx.fillText(`${money(payload.totalAmount)} บาท`, contentX + summaryColWidth + 18, y + 48);

  y += layout.summaryCardHeight + 10;

  if (!layout.groups.length) {
    drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.emptyCardHeight, 16, COLORS.cardSurface, COLORS.border);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `600 ${TYPE.empty}px sans-serif`;
    ctx.fillText('ยังไม่มีรายการในโพยนี้', contentX + 16, y + 42);
    y += layout.emptyCardHeight;
  } else {
    layout.groups.forEach((group, index) => {
      const cardY = y;
      drawShadowCard(ctx, contentX, cardY, layout.contentWidth, group.cardHeight, 16, COLORS.cardSurface, COLORS.border);

      const badgeX = contentX + GROUP.cardPaddingX;
      const maxBadgeHeight = group.cardHeight - (GROUP.cardPaddingY * 2);
      const badgeTextHeight =
        TYPE.groupFamily +
        GROUP.badgeTextGap +
        TYPE.groupMeta +
        GROUP.badgeTextGap +
        TYPE.groupMeta;
      const badgeHeight = Math.max(
        GROUP.badgeMinHeight,
        Math.min(maxBadgeHeight, badgeTextHeight + (GROUP.badgePaddingY * 2) + 10)
      );
      const badgeY = cardY + ((group.cardHeight - badgeHeight) / 2);
      drawRoundedRect(
        ctx,
        badgeX,
        badgeY,
        GROUP.badgeWidth,
        badgeHeight,
        10,
        COLORS.cardTint,
        COLORS.borderSoft
      );

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.primary;
      const badgeTextStartY = badgeY + ((badgeHeight - badgeTextHeight) / 2);
      ctx.font = `800 ${TYPE.groupFamily}px sans-serif`;
      ctx.fillText(group.familyLabel, badgeX + (GROUP.badgeWidth / 2), badgeTextStartY);
      ctx.font = `700 ${TYPE.groupMeta}px sans-serif`;
      ctx.fillText(
        group.comboLabel,
        badgeX + (GROUP.badgeWidth / 2),
        badgeTextStartY + TYPE.groupFamily + GROUP.badgeTextGap
      );
      ctx.fillText(
        group.amountLabel,
        badgeX + (GROUP.badgeWidth / 2),
        badgeTextStartY + TYPE.groupFamily + TYPE.groupMeta + (GROUP.badgeTextGap * 2)
      );
      ctx.restore();

      const bodyX = badgeX + GROUP.badgeWidth + GROUP.cardGap;
      const bodyWidth = layout.contentWidth - (GROUP.cardPaddingX * 2) - GROUP.badgeWidth - GROUP.cardGap;

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `700 ${TYPE.groupTotal}px sans-serif`;
      ctx.fillText(`${money(group.totalAmount)} บาท`, bodyX, badgeY + 18);

      const numbersBoxY = badgeY + 24;
      const numbersBoxHeight = group.cardHeight - (GROUP.cardPaddingY * 2) - 24;
      drawRoundedRect(
        ctx,
        bodyX,
        numbersBoxY,
        bodyWidth,
        numbersBoxHeight,
        12,
        COLORS.cardSurface,
        COLORS.borderSoft
      );

      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `700 ${TYPE.numbers}px sans-serif`;
      group.numberLines.forEach((line, lineIndex) => {
        ctx.fillText(
          line,
          bodyX + GROUP.numbersPaddingX,
          numbersBoxY + GROUP.numbersPaddingY + TYPE.numbers + (lineIndex * GROUP.numbersLineHeight)
        );
      });

      y += group.cardHeight + (index < layout.groups.length - 1 ? 6 : 0);
    });
  }

  if (layout.showNote) {
    y += 8;
    drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.noteCardHeight, 16, COLORS.cardSurface, COLORS.borderSoft);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `600 ${TYPE.noteLabel}px sans-serif`;
    ctx.fillText('บันทึกช่วยจำ', contentX + NOTE.paddingX, y + 22);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `700 ${TYPE.noteText}px sans-serif`;
    layout.noteLines.forEach((line, lineIndex) => {
      ctx.fillText(
        line,
        contentX + NOTE.paddingX,
        y + 22 + NOTE.paddingY + TYPE.noteText + (lineIndex * NOTE.lineHeight)
      );
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('ไม่สามารถสร้างรูปโพยได้'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

const renderGroupedSlipImageWithBottomSummary = (payload) => {
  const memberLabel = '\u0e2a\u0e21\u0e32\u0e0a\u0e34\u0e01';
  const totalLabel = '\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21';
  const marketLabel = '\u0e15\u0e25\u0e32\u0e14';
  const roundLabel = '\u0e07\u0e27\u0e14';
  const emptyItemsLabel = '\u0e22\u0e31\u0e07\u0e44\u0e21\u0e48\u0e21\u0e35\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e43\u0e19\u0e42\u0e1e\u0e22\u0e19\u0e35\u0e49';
  const noteTitle = '\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01\u0e0a\u0e48\u0e27\u0e22\u0e08\u0e33';
  const bahtLabel = '\u0e1a\u0e32\u0e17';
  const renderErrorLabel = '\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e2a\u0e23\u0e49\u0e32\u0e07\u0e23\u0e39\u0e1b\u0e42\u0e1e\u0e22\u0e44\u0e14\u0e49';

  const ratio = window.devicePixelRatio > 1 ? 2 : 1;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  const layout = measureImageLayout(measureCtx, payload);
  const canvasHeight = layout.modalHeight + (FRAME_PADDING * 2);

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH * ratio;
  canvas.height = canvasHeight * ratio;
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${canvasHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.imageSmoothingEnabled = true;

  ctx.fillStyle = COLORS.canvas;
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);

  const modalX = FRAME_PADDING;
  const modalY = FRAME_PADDING;
  drawShadowCard(
    ctx,
    modalX,
    modalY,
    MODAL_WIDTH,
    layout.modalHeight,
    20,
    COLORS.modal,
    COLORS.border,
    { shadowColor: COLORS.shadowModal, shadowBlur: 26, shadowOffsetY: 10 }
  );

  const contentX = modalX + MODAL_PADDING_X;
  let y = modalY + MODAL_PADDING_TOP;

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.primaryLight;
  ctx.font = `700 ${TYPE.eyebrow}px sans-serif`;
  ctx.fillText(payload.eyebrow, contentX, y + 13);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.title}px sans-serif`;
  ctx.fillText(payload.title, contentX, y + 38);

  y += layout.headerHeight + 14;

  drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.metaCardHeight, 16, COLORS.metaTop, COLORS.borderAccent);
  drawLinearCard(ctx, contentX, y, layout.contentWidth, layout.metaCardHeight, 16, COLORS.metaTop, COLORS.metaBottom, COLORS.borderAccent);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.metaLine}px sans-serif`;
  ctx.fillText(`${memberLabel}: ${payload.memberName}`, contentX + 16, y + 28);
  ctx.fillText(`${marketLabel}: ${payload.marketName}`, contentX + 16, y + 58);
  ctx.fillText(`${roundLabel}: ${payload.roundLabel}`, contentX + 16, y + 88);

  y += layout.metaCardHeight + SECTION_GAP;

  if (!layout.groups.length) {
    drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.emptyCardHeight, 16, COLORS.cardSurface, COLORS.border);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `600 ${TYPE.empty}px sans-serif`;
    ctx.fillText(emptyItemsLabel, contentX + 16, y + 42);
    y += layout.emptyCardHeight;
  } else {
    layout.groups.forEach((group, index) => {
      const cardY = y;
      drawShadowCard(ctx, contentX, cardY, layout.contentWidth, group.cardHeight, 16, COLORS.cardSurface, COLORS.border);

      const badgeX = contentX + GROUP.cardPaddingX;
      const maxBadgeHeight = group.cardHeight - (GROUP.cardPaddingY * 2);
      const badgeTextHeight =
        TYPE.groupFamily +
        GROUP.badgeTextGap +
        TYPE.groupMeta +
        GROUP.badgeTextGap +
        TYPE.groupMeta;
      const badgeHeight = Math.max(
        GROUP.badgeMinHeight,
        Math.min(maxBadgeHeight, badgeTextHeight + (GROUP.badgePaddingY * 2) + 10)
      );
      const badgeY = cardY + ((group.cardHeight - badgeHeight) / 2);
      drawRoundedRect(
        ctx,
        badgeX,
        badgeY,
        GROUP.badgeWidth,
        badgeHeight,
        10,
        COLORS.cardTint,
        COLORS.borderSoft
      );

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = COLORS.primary;
      const badgeTextStartY = badgeY + ((badgeHeight - badgeTextHeight) / 2);
      ctx.font = `800 ${TYPE.groupFamily}px sans-serif`;
      ctx.fillText(group.familyLabel, badgeX + (GROUP.badgeWidth / 2), badgeTextStartY);
      ctx.font = `700 ${TYPE.groupMeta}px sans-serif`;
      ctx.fillText(
        group.comboLabel,
        badgeX + (GROUP.badgeWidth / 2),
        badgeTextStartY + TYPE.groupFamily + GROUP.badgeTextGap
      );
      ctx.fillText(
        group.amountLabel,
        badgeX + (GROUP.badgeWidth / 2),
        badgeTextStartY + TYPE.groupFamily + TYPE.groupMeta + (GROUP.badgeTextGap * 2)
      );
      ctx.restore();

      const bodyX = badgeX + GROUP.badgeWidth + GROUP.cardGap;
      const bodyWidth = layout.contentWidth - (GROUP.cardPaddingX * 2) - GROUP.badgeWidth - GROUP.cardGap;

      ctx.textAlign = 'left';
      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `700 ${TYPE.groupTotal}px sans-serif`;
      ctx.fillText(`${money(group.totalAmount)} ${bahtLabel}`, bodyX, badgeY + 18);

      const numbersBoxY = badgeY + 24;
      const numbersBoxHeight = group.cardHeight - (GROUP.cardPaddingY * 2) - 24;
      drawRoundedRect(
        ctx,
        bodyX,
        numbersBoxY,
        bodyWidth,
        numbersBoxHeight,
        12,
        COLORS.cardSurface,
        COLORS.borderSoft
      );

      ctx.fillStyle = COLORS.textPrimary;
      ctx.font = `700 ${TYPE.numbers}px sans-serif`;
      group.numberLines.forEach((line, lineIndex) => {
        ctx.fillText(
          line,
          bodyX + GROUP.numbersPaddingX,
          numbersBoxY + GROUP.numbersPaddingY + TYPE.numbers + (lineIndex * GROUP.numbersLineHeight)
        );
      });

      y += group.cardHeight + (index < layout.groups.length - 1 ? 6 : 0);
    });
  }

  y += 8;

  drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.summaryCardHeight, 16, COLORS.cardSurface, COLORS.border);
  const summaryColWidth = layout.contentWidth / 2;

  ctx.fillStyle = COLORS.textMuted;
  ctx.font = `600 ${TYPE.summaryLabel}px sans-serif`;
  ctx.fillText(memberLabel, contentX + 18, y + 22);
  ctx.fillText(totalLabel, contentX + summaryColWidth + 18, y + 22);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = `700 ${TYPE.summaryValue}px sans-serif`;
  ctx.fillText(payload.memberName, contentX + 18, y + 48);
  ctx.fillText(`${money(payload.totalAmount)} ${bahtLabel}`, contentX + summaryColWidth + 18, y + 48);

  y += layout.summaryCardHeight;

  if (layout.showNote) {
    y += 8;
    drawShadowCard(ctx, contentX, y, layout.contentWidth, layout.noteCardHeight, 16, COLORS.cardSurface, COLORS.borderSoft);
    ctx.fillStyle = COLORS.textMuted;
    ctx.font = `600 ${TYPE.noteLabel}px sans-serif`;
    ctx.fillText(noteTitle, contentX + NOTE.paddingX, y + 22);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = `700 ${TYPE.noteText}px sans-serif`;
    layout.noteLines.forEach((line, lineIndex) => {
      ctx.fillText(
        line,
        contentX + NOTE.paddingX,
        y + 22 + NOTE.paddingY + TYPE.noteText + (lineIndex * NOTE.lineHeight)
      );
    });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error(renderErrorLabel));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

export const copySlipPreviewImage = async (options) => {
  const blob = await renderGroupedSlipImageWithBottomSummary(buildPreviewImagePayload(options));
  const memberSlug = options?.selectedMember?.username || options?.selectedMember?.name || 'member';
  const fileName = `slip-${String(memberSlug).replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        [blob.type]: blob
      })
    ]);
    return { mode: 'clipboard', fileName };
  }

  downloadBlob(blob, fileName);
  return { mode: 'download', fileName };
};

export const copySavedSlipImage = async (options) => {
  const blob = await renderGroupedSlipImageWithBottomSummary(buildSavedSlipImagePayload(options));
  const memberSlug = options?.slip?.customer?.username || options?.slip?.customer?.name || 'member';
  const fileName = `slip-${String(memberSlug).replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.png`;

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        [blob.type]: blob
      })
    ]);
    return { mode: 'clipboard', fileName };
  }

  downloadBlob(blob, fileName);
  return { mode: 'download', fileName };
};
