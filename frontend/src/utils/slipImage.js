import { buildSlipDisplayGroups } from './slipGrouping';

const CANVAS_WIDTH = 1280;
const PADDING = 48;
const BRAND_RED = '#dc2626';
const BRAND_DARK = '#7f1d1d';
const TEXT_DARK = '#0f172a';
const TEXT_MUTED = '#64748b';
const BORDER = '#e2e8f0';
const PANEL = '#fff7f7';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

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

const measureGroupedLayout = (ctx, groups = [], note = '') => {
  const contentWidth = CANVAS_WIDTH - (PADDING * 2);
  const sideWidth = 190;
  const sideGap = 22;
  const bodyWidth = contentWidth - sideWidth - sideGap - 18;

  const normalizedGroups = groups.map((group) => {
    const numberLines = wrapText(ctx, group.numbersText, bodyWidth - 42);
    const numbersHeight = Math.max(68, 24 + (numberLines.length * 28));
    const groupHeight = Math.max(138, 68 + numbersHeight);

    return {
      ...group,
      numberLines,
      numbersHeight,
      groupHeight
    };
  });

  const noteLines = note ? wrapText(ctx, note, contentWidth - 36) : [];
  const noteHeight = note ? Math.max(90, 42 + (noteLines.length * 24)) : 0;

  return {
    contentWidth,
    sideWidth,
    sideGap,
    bodyWidth,
    normalizedGroups,
    noteLines,
    noteHeight
  };
};

const buildPreviewImagePayload = ({
  preview,
  selectedMember,
  selectedLottery,
  selectedRound,
  selectedRateProfile,
  actorLabel,
  operatorName
}) => {
  const createdAtLabel = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const memberName = preview?.member?.name || selectedMember?.name || '-';
  const memberUsername = preview?.member?.username || selectedMember?.username;
  const memberLabel = memberUsername ? `${memberName} • @${memberUsername}` : memberName;

  return {
    title: 'สำเนาโพย',
    subtitle: 'คัดลอกจากหน้าตรวจสอบโพยก่อนส่งรายการซื้อ',
    headerMeta: [
      ['สมาชิก', memberLabel],
      ['ผู้ทำรายการ', `${operatorName || '-'} • ${actorLabel || '-'}`],
      ['ตลาด', selectedLottery?.name || '-'],
      ['งวด', selectedRound?.title || selectedRound?.code || '-'],
      ['เรท', selectedRateProfile?.name || 'เรทมาตรฐาน'],
      ['สร้างภาพเมื่อ', createdAtLabel]
    ],
    summaryCards: [
      ['จำนวนรายการ', `${preview?.summary?.itemCount || 0}`],
      ['ยอดรวม', `${money(preview?.summary?.totalAmount)} บาท`],
      ['จ่ายสูงสุด', `${money(preview?.summary?.potentialPayout)} บาท`],
      ['สถานะงวด', preview?.roundStatus?.label || '-']
    ],
    groups: buildSlipDisplayGroups(preview?.items || []),
    note: preview?.memo || 'ไม่มีบันทึกช่วยจำ'
  };
};

const buildSavedSlipImagePayload = ({ slip, actorLabel }) => {
  const createdAtLabel = new Date(
    slip?.createdAt || slip?.items?.[0]?.createdAt || Date.now()
  ).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  const groups = slip?.displayGroups?.length ? slip.displayGroups : buildSlipDisplayGroups(slip?.items || []);
  const itemCount =
    Number(slip?.itemCount) ||
    Number(slip?.items?.length) ||
    groups.reduce((sum, group) => sum + Number(group.itemCount || 0), 0);
  const totalAmount =
    Number(slip?.totalAmount) ||
    Number(slip?.totalStake) ||
    groups.reduce((sum, group) => sum + Number(group.totalAmount || 0), 0);
  const totalPotentialPayout =
    Number(slip?.totalPotentialPayout) ||
    Number(slip?.potentialPayout) ||
    groups.reduce((sum, group) => sum + Number(group.potentialPayout || 0), 0);

  return {
    title: 'สำเนาโพย',
    subtitle: 'คัดลอกจากรายการโพยที่ถูกส่งแล้ว',
    headerMeta: [
      ['สมาชิก', slip?.customer?.username ? `${slip?.customer?.name || '-'} • @${slip.customer.username}` : slip?.customer?.name || '-'],
      ['ผู้ทำรายการ', actorLabel || '-'],
      ['ตลาด', slip?.marketName || '-'],
      ['งวด', slip?.roundLabel || '-'],
      ['เลขอ้างอิง', slip?.slipNumber || slip?.slipId || '-'],
      ['สร้างภาพเมื่อ', createdAtLabel]
    ],
    summaryCards: [
      ['จำนวนรายการ', `${itemCount}`],
      ['ยอดรวม', `${money(totalAmount)} บาท`],
      ['จ่ายสูงสุด', `${money(totalPotentialPayout)} บาท`],
      ['สถานะโพย', slip?.resultLabel || '-']
    ],
    groups,
    note: slip?.memo || 'ไม่มีบันทึกช่วยจำ'
  };
};

const renderGroupedSlipImage = ({ title, subtitle, headerMeta, summaryCards, groups, note }) => {
  const safeGroups = groups?.length ? groups : [];
  const ratio = window.devicePixelRatio > 1 ? 2 : 1;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = '700 20px sans-serif';
  const layout = measureGroupedLayout(measureCtx, safeGroups, note);
  const groupsHeight = layout.normalizedGroups.length
    ? layout.normalizedGroups.reduce((sum, group) => sum + group.groupHeight + 18, 0) - 18
    : 82;
  const canvasHeight = 430 + (headerMeta.length * 38) + 138 + groupsHeight + layout.noteHeight;

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH * ratio;
  canvas.height = canvasHeight * ratio;
  canvas.style.width = `${CANVAS_WIDTH}px`;
  canvas.style.height = `${canvasHeight}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.imageSmoothingEnabled = true;

  const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 260);
  gradient.addColorStop(0, BRAND_RED);
  gradient.addColorStop(1, BRAND_DARK);

  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, CANVAS_WIDTH, canvasHeight);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, 190);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px sans-serif';
  ctx.fillText('Agent Lottery', PADDING, 62);
  ctx.font = '800 42px sans-serif';
  ctx.fillText(title, PADDING, 116);
  ctx.font = '500 18px sans-serif';
  ctx.fillText(subtitle, PADDING, 152);

  let y = 220;
  drawRoundedRect(ctx, PADDING, y, layout.contentWidth, 48 + (headerMeta.length * 38), 24, '#ffffff', BORDER);
  y += 34;

  headerMeta.forEach(([label, value]) => {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 14px sans-serif';
    ctx.fillText(label, PADDING + 20, y);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '600 18px sans-serif';
    ctx.fillText(value || '-', PADDING + 220, y);
    y += 38;
  });

  y += 12;
  const cardWidth = (layout.contentWidth - 36) / 4;
  summaryCards.forEach(([label, value], index) => {
    const x = PADDING + (index * (cardWidth + 12));
    drawRoundedRect(ctx, x, y, cardWidth, 96, 22, PANEL, '#fecaca');
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 14px sans-serif';
    ctx.fillText(label, x + 18, y + 32);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '800 24px sans-serif';
    wrapText(ctx, value, cardWidth - 36)
      .slice(0, 2)
      .forEach((line, lineIndex) => {
        ctx.fillText(line, x + 18, y + 62 + (lineIndex * 24));
      });
  });

  y += 126;

  if (!layout.normalizedGroups.length) {
    drawRoundedRect(ctx, PADDING, y, layout.contentWidth, 72, 18, '#ffffff', BORDER);
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '600 18px sans-serif';
    ctx.fillText('ยังไม่มีรายการในโพยนี้', PADDING + 24, y + 42);
    y += 90;
  } else {
    layout.normalizedGroups.forEach((group) => {
      drawRoundedRect(ctx, PADDING, y, layout.contentWidth, group.groupHeight, 22, '#ffffff', BORDER);
      drawRoundedRect(ctx, PADDING + 18, y + 18, layout.sideWidth, group.groupHeight - 36, 18, '#fff5f5', '#fecaca');

      ctx.fillStyle = BRAND_RED;
      ctx.font = '800 28px sans-serif';
      ctx.fillText(group.familyLabel, PADDING + 44, y + 56);
      ctx.font = '700 18px sans-serif';
      ctx.fillText(group.comboLabel, PADDING + 44, y + 84);
      ctx.fillText(group.amountLabel, PADDING + 44, y + 112);

      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '700 14px sans-serif';
      ctx.fillText(`${group.itemCount} รายการ`, PADDING + layout.sideWidth + 58, y + 36);

      ctx.fillStyle = TEXT_DARK;
      ctx.font = '800 22px sans-serif';
      ctx.fillText(`${money(group.totalAmount)} บาท`, CANVAS_WIDTH - PADDING - 160, y + 36);

      drawRoundedRect(ctx, PADDING + layout.sideWidth + 40, y + 50, layout.bodyWidth, group.numbersHeight, 18, '#fffdfd', '#fecaca');
      ctx.fillStyle = TEXT_DARK;
      ctx.font = '700 20px sans-serif';
      group.numberLines.forEach((line, lineIndex) => {
        ctx.fillText(line, PADDING + layout.sideWidth + 62, y + 82 + (lineIndex * 28));
      });

      ctx.fillStyle = TEXT_MUTED;
      ctx.font = '700 15px sans-serif';
      ctx.fillText(`จ่ายสูงสุด ${money(group.potentialPayout)} บาท`, CANVAS_WIDTH - PADDING - 290, y + group.groupHeight - 18);

      y += group.groupHeight + 18;
    });
  }

  if (layout.noteHeight) {
    drawRoundedRect(ctx, PADDING, y, layout.contentWidth, layout.noteHeight, 18, '#fff7ed', '#fed7aa');
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '600 15px sans-serif';
    ctx.fillText('หมายเหตุ', PADDING + 18, y + 24);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '600 18px sans-serif';
    layout.noteLines.forEach((line, lineIndex) => {
      ctx.fillText(line, PADDING + 18, y + 54 + (lineIndex * 24));
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

export const copySlipPreviewImage = async (options) => {
  const blob = await renderGroupedSlipImage(buildPreviewImagePayload(options));
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
  const blob = await renderGroupedSlipImage(buildSavedSlipImagePayload(options));
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
