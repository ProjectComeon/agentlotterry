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

module.exports = {
  getPermutations
};
