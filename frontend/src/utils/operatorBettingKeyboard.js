const toAmountText = (value) => String(value ?? '').trim();

export const getEnabledFieldOrder = (order = [], enabledMap = {}) =>
  (order || []).filter((field) => Boolean(enabledMap?.[field]));

export const hasAnyAmount = (amounts = {}, order = []) =>
  (order || []).some((field) => toAmountText(amounts?.[field]) !== '');

export const getFastKeyboardAction = ({ field = '', order = [], amounts = {} } = {}) => {
  if (!order.length) {
    return { type: 'none' };
  }

  if (field === 'order') {
    return { type: 'focus', field: order[0] };
  }

  const fieldIndex = order.indexOf(field);
  if (fieldIndex < 0) {
    return { type: 'none' };
  }

  const nextField = order[fieldIndex + 1];
  if (nextField) {
    return { type: 'focus', field: nextField };
  }

  return hasAnyAmount(amounts, order)
    ? { type: 'saveDraftEntry' }
    : { type: 'none' };
};
