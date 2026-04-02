import { buildSlipDisplayGroups } from './slipGrouping';
import { operatorBettingCopy } from '../i18n/th/operatorBetting';

const money = (value) => Number(value || 0).toLocaleString('th-TH');

const fallbackWriteText = async (text) => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
};

export const buildPreviewSlipText = ({
  preview,
  selectedMember,
  selectedLottery,
  selectedRound,
  selectedRateProfile,
  actorLabel,
  operatorName,
  resolveRoundStatusLabel
}) => {
  const memberName = preview?.member?.name || selectedMember?.name || '-';
  const memberUsername = preview?.member?.username || selectedMember?.username || '-';
  const roundStatus = resolveRoundStatusLabel?.(preview?.roundStatus?.status) || preview?.roundStatus?.label || '-';
  const groups = buildSlipDisplayGroups(preview?.items || []);
  const copy = operatorBettingCopy.previewText;

  const lines = [
    copy.heading,
    `${copy.memberLabel}: ${memberName} (@${memberUsername})`,
    `${copy.actorLabel}: ${operatorName || '-'}${actorLabel ? ` • ${actorLabel}` : ''}`,
    `${copy.marketLabel}: ${selectedLottery?.name || preview?.lottery?.name || '-'}`,
    `${copy.roundLabel}: ${selectedRound?.title || preview?.round?.title || '-'}`,
    `${copy.rateLabel}: ${selectedRateProfile?.name || preview?.rateProfile?.name || copy.defaultRateName}`,
    `${copy.roundStatusLabel}: ${roundStatus}`,
    `${copy.itemCountLabel}: ${preview?.summary?.itemCount || 0}`,
    `${copy.totalAmountLabel}: ${money(preview?.summary?.totalAmount)} บาท`,
    `${copy.maxPayoutLabel}: ${money(preview?.summary?.potentialPayout)} บาท`,
    ''
  ];

  if (groups.length) {
    groups.forEach((group, index) => {
      lines.push(`${index + 1}. ${group.familyLabel} ${group.comboLabel} ${group.amountLabel}`);
      lines.push(`${copy.numbersLabel}: ${group.numbersText}`);
      lines.push(copy.groupSummary(group.itemCount, group.totalAmount, group.potentialPayout));
      lines.push('');
    });
  } else {
    lines.push(copy.emptyItems);
    lines.push('');
  }

  if (preview?.memo) {
    lines.push(`${copy.memoLabel}: ${preview.memo}`);
  }

  return lines.join('\n').trim();
};

export const copyPreviewSlipText = async (options) => {
  const text = buildPreviewSlipText(options);

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return { mode: 'clipboard', text };
  }

  await fallbackWriteText(text);
  return { mode: 'fallback', text };
};
