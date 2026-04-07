const getPermutations = (str) => {
  if (str.length <= 1) return [str];

  const permutations = [];
  for (let index = 0; index < str.length; index++) {
    const current = str[index];
    const remaining = str.slice(0, index) + str.slice(index + 1);

    for (const permutation of getPermutations(remaining)) {
      permutations.push(current + permutation);
    }
  }

  return [...new Set(permutations)];
};

const hasSameDigits = (left, right) => {
  const a = String(left || '').replace(/\D/g, '');
  const b = String(right || '').replace(/\D/g, '');

  if (!a || !b || a.length !== b.length) {
    return false;
  }

  return [...a].sort().join('') === [...b].sort().join('');
};

module.exports = {
  getPermutations,
  hasSameDigits
};
