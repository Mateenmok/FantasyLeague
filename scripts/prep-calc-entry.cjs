// Bundled by build-prep-calc.cjs; upstream mechanics remain unchanged.
module.exports = {
  ...require('@smogon/calc'),
  prep: {
    getFinalSpeed: require('@smogon/calc/dist/mechanics/util').getFinalSpeed,
    checkItem: require('@smogon/calc/dist/mechanics/util').checkItem,
    getEndOfTurn: require('@smogon/calc/dist/desc').getEndOfTurn,
  },
};
