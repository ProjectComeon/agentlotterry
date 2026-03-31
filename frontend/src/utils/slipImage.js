const CANVAS_WIDTH = 1080;
const PADDING = 48;
const ROW_HEIGHT = 54;
const LINE_HEIGHT = 24;
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

  if (current) {
    lines.push(current);
  }

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

const buildRows = ({
  preview,
  selectedLottery,
  selectedRound,
  selectedRateProfile,
  actorLabel,
  operatorName,
  memberName,
  memberUsername,
  createdAtLabel,
  resolveBetTypeLabel,
  resolveSourceLabel
}) => {
  const summary = preview?.summary || {};
  const items = preview?.items || [];
  const memberLabel = memberUsername ? `${memberName || '-'} • @${memberUsername}` : `${memberName || '-'}`;

  const headerMeta = [
    ['สมาชิก', memberLabel],
    ['ผู้ทำรายการ', `${operatorName || '-'} • ${actorLabel || '-'}`],
    ['ตลาด', selectedLottery?.name || '-'],
    ['งวด', selectedRound?.title || selectedRound?.code || '-'],
    ['เรท', selectedRateProfile?.name || 'เรทมาตรฐาน'],
    ['สร้างภาพเมื่อ', createdAtLabel]
  ];

  const summaryCards = [
    ['จำนวนรายการ', `${summary.itemCount || 0}`],
    ['ยอดรวม', `${money(summary.totalAmount)} บาท`],
    ['จ่ายสูงสุด', `${money(summary.potentialPayout)} บาท`],
    ['สถานะงวด', preview?.roundStatus?.label || '-']
  ];

  const itemRows = items.map((item) => ({
    number: item.number,
    betType: resolveBetTypeLabel(item.betType),
    amount: `${money(item.amount)} บาท`,
    rate: `x${item.payRate}`,
    source: item.sourceFlags?.fromDoubleSet
      ? resolveSourceLabel('doubleSet')
      : item.sourceFlags?.fromReverse
        ? resolveSourceLabel('reverse')
        : resolveSourceLabel('manual')
  }));

  return { headerMeta, summaryCards, itemRows };
};

const renderSlipPreviewImage = ({
  preview,
  selectedMember,
  selectedLottery,
  selectedRound,
  selectedRateProfile,
  actorLabel,
  operatorName,
  resolveBetTypeLabel,
  resolveSourceLabel
}) => {
  const createdAtLabel = new Date().toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const { headerMeta, summaryCards, itemRows } = buildRows({
    preview,
    selectedLottery,
    selectedRound,
    selectedRateProfile,
    actorLabel,
    operatorName,
    memberName: preview?.member?.name || selectedMember?.name,
    memberUsername: preview?.member?.username || selectedMember?.username,
    createdAtLabel,
    resolveBetTypeLabel,
    resolveSourceLabel
  });

  const rowCount = itemRows.length || 1;
  const canvasHeight = 420 + headerMeta.length * 48 + 140 + rowCount * ROW_HEIGHT + 120;
  const canvas = document.createElement('canvas');
  const ratio = window.devicePixelRatio > 1 ? 2 : 1;
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
  ctx.fillText('สำเนาโพย', PADDING, 116);
  ctx.font = '500 18px sans-serif';
  ctx.fillText('คัดลอกจากหน้าตรวจสอบโพยก่อนส่งรายการซื้อ', PADDING, 152);

  let y = 220;
  drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 48 + (headerMeta.length * 38), 24, '#ffffff', BORDER);
  y += 34;

  headerMeta.forEach(([label, value]) => {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 14px sans-serif';
    ctx.fillText(label, PADDING + 20, y);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '600 18px sans-serif';
    ctx.fillText(value || '-', PADDING + 160, y);
    y += 38;
  });

  y += 12;
  const cardWidth = (CANVAS_WIDTH - (PADDING * 2) - 36) / 4;
  summaryCards.forEach(([label, value], index) => {
    const x = PADDING + (index * (cardWidth + 12));
    drawRoundedRect(ctx, x, y, cardWidth, 96, 22, PANEL, '#fecaca');
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 14px sans-serif';
    ctx.fillText(label, x + 18, y + 32);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '800 24px sans-serif';
    const wrapped = wrapText(ctx, value, cardWidth - 36);
    wrapped.slice(0, 2).forEach((line, lineIndex) => {
      ctx.fillText(line, x + 18, y + 62 + (lineIndex * 24));
    });
  });

  y += 126;
  drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 56, 18, '#fff5f5', '#fecaca');
  ctx.fillStyle = BRAND_DARK;
  ctx.font = '700 16px sans-serif';
  ctx.fillText('เลข', PADDING + 18, y + 34);
  ctx.fillText('ประเภท', PADDING + 170, y + 34);
  ctx.fillText('ยอด', PADDING + 460, y + 34);
  ctx.fillText('เรท', PADDING + 630, y + 34);
  ctx.fillText('ที่มา', PADDING + 760, y + 34);

  y += 68;
  if (!itemRows.length) {
    drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 72, 18, '#ffffff', BORDER);
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '600 18px sans-serif';
    ctx.fillText('ยังไม่มีรายการในโพยนี้', PADDING + 24, y + 42);
    y += 86;
  } else {
    itemRows.forEach((row, index) => {
      const fill = index % 2 === 0 ? '#ffffff' : '#fffafa';
      drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), ROW_HEIGHT, 16, fill, BORDER);
      ctx.fillStyle = TEXT_DARK;
      ctx.font = '700 20px sans-serif';
      ctx.fillText(row.number, PADDING + 18, y + 34);
      ctx.font = '600 16px sans-serif';
      ctx.fillText(row.betType, PADDING + 170, y + 34);
      ctx.fillText(row.amount, PADDING + 460, y + 34);
      ctx.fillText(row.rate, PADDING + 630, y + 34);
      ctx.fillStyle = TEXT_MUTED;
      const sourceLines = wrapText(ctx, row.source, 220);
      sourceLines.slice(0, 2).forEach((line, lineIndex) => {
        ctx.fillText(line, PADDING + 760, y + 26 + (lineIndex * LINE_HEIGHT));
      });
      y += ROW_HEIGHT + 8;
    });
  }

  drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 58, 18, '#fff7ed', '#fed7aa');
  ctx.fillStyle = TEXT_MUTED;
  ctx.font = '600 15px sans-serif';
  ctx.fillText('หมายเหตุ', PADDING + 18, y + 22);
  ctx.fillStyle = TEXT_DARK;
  ctx.font = '600 17px sans-serif';
  ctx.fillText(preview?.memo || 'ไม่มีบันทึกช่วยจำ', PADDING + 18, y + 44);

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
  const blob = await renderSlipPreviewImage(options);
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

const renderSavedSlipImage = ({
  slip,
  actorLabel,
  resolveBetTypeLabel
}) => {
  const createdAtLabel = new Date(
    slip?.createdAt || slip?.items?.[0]?.createdAt || Date.now()
  ).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const itemRows = (slip?.items || []).map((item) => ({
    number: item.number || '-',
    betType: resolveBetTypeLabel(item.betType),
    amount: `${money(item.amount)} บาท`,
    rate: `x${item.payRate || 0}`,
    payout: `${money(item.potentialPayout)} บาท`
  }));

  const headerMeta = [
    ['สมาชิก', slip?.customer?.name || '-'],
    ['ผู้ดูรายการ', actorLabel || '-'],
    ['ตลาด', slip?.marketName || '-'],
    ['งวด', slip?.roundLabel || '-'],
    ['เลขอ้างอิง', slip?.slipNumber || slip?.slipId || '-'],
    ['สร้างภาพเมื่อ', createdAtLabel]
  ];

  const summaryCards = [
    ['จำนวนรายการ', `${itemRows.length || 0}`],
    ['ยอดรวม', `${money(slip?.totalAmount)} บาท`],
    ['จ่ายสูงสุด', `${money(slip?.totalPotentialPayout)} บาท`],
    ['สถานะโพย', slip?.resultLabel || '-']
  ];

  const rowCount = itemRows.length || 1;
  const canvasHeight = 420 + headerMeta.length * 48 + 140 + rowCount * ROW_HEIGHT + 40;
  const canvas = document.createElement('canvas');
  const ratio = window.devicePixelRatio > 1 ? 2 : 1;
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
  ctx.fillText('สำเนาโพย', PADDING, 116);
  ctx.font = '500 18px sans-serif';
  ctx.fillText('คัดลอกจากรายการโพยล่าสุดในแดชบอร์ด', PADDING, 152);

  let y = 220;
  drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 48 + (headerMeta.length * 38), 24, '#ffffff', BORDER);
  y += 34;

  headerMeta.forEach(([label, value]) => {
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 14px sans-serif';
    ctx.fillText(label, PADDING + 20, y);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '600 18px sans-serif';
    ctx.fillText(value || '-', PADDING + 160, y);
    y += 38;
  });

  y += 12;
  const cardWidth = (CANVAS_WIDTH - (PADDING * 2) - 36) / 4;
  summaryCards.forEach(([label, value], index) => {
    const x = PADDING + (index * (cardWidth + 12));
    drawRoundedRect(ctx, x, y, cardWidth, 96, 22, PANEL, '#fecaca');
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '700 14px sans-serif';
    ctx.fillText(label, x + 18, y + 32);
    ctx.fillStyle = TEXT_DARK;
    ctx.font = '800 24px sans-serif';
    const wrapped = wrapText(ctx, value, cardWidth - 36);
    wrapped.slice(0, 2).forEach((line, lineIndex) => {
      ctx.fillText(line, x + 18, y + 62 + (lineIndex * 24));
    });
  });

  y += 126;
  drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 56, 18, '#fff5f5', '#fecaca');
  ctx.fillStyle = BRAND_DARK;
  ctx.font = '700 16px sans-serif';
  ctx.fillText('เลข', PADDING + 18, y + 34);
  ctx.fillText('ประเภท', PADDING + 170, y + 34);
  ctx.fillText('ยอด', PADDING + 440, y + 34);
  ctx.fillText('เรท', PADDING + 600, y + 34);
  ctx.fillText('จ่ายสูงสุด', PADDING + 720, y + 34);

  y += 68;
  if (!itemRows.length) {
    drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), 72, 18, '#ffffff', BORDER);
    ctx.fillStyle = TEXT_MUTED;
    ctx.font = '600 18px sans-serif';
    ctx.fillText('ยังไม่มีรายการในโพยนี้', PADDING + 24, y + 42);
    y += 86;
  } else {
    itemRows.forEach((row, index) => {
      const fill = index % 2 === 0 ? '#ffffff' : '#fffafa';
      drawRoundedRect(ctx, PADDING, y, CANVAS_WIDTH - (PADDING * 2), ROW_HEIGHT, 16, fill, BORDER);
      ctx.fillStyle = TEXT_DARK;
      ctx.font = '700 20px sans-serif';
      ctx.fillText(row.number, PADDING + 18, y + 34);
      ctx.font = '600 16px sans-serif';
      ctx.fillText(row.betType, PADDING + 170, y + 34);
      ctx.fillText(row.amount, PADDING + 440, y + 34);
      ctx.fillText(row.rate, PADDING + 600, y + 34);
      ctx.fillStyle = TEXT_MUTED;
      ctx.fillText(row.payout, PADDING + 720, y + 34);
      y += ROW_HEIGHT + 8;
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

export const copySavedSlipImage = async (options) => {
  const blob = await renderSavedSlipImage(options);
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
