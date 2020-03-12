
const epiModelParamList = require('~/assets/data/epi-model-params.json');

export const state = () => {
  const stateObj = {};

  stateObj.paramKeys = [];
  stateObj.params = {};

  // Constants can be organized into groups, for UI purposes.
  // This is a feature that comes later.
  stateObj.groups = {};

  for (paramObj of epiModelParamList) {
    stateObj.paramsKeys.push(paramObj.key);
    stateObj.params[paramObj.key] = paramObj;

    paramObj.value = paramObj.default;

    paramObj.range = {
      min: paramObj.range_min,
      max: paramObj.range_max,
      span: paramObj.range_max - paramObj.range_min
    };
    paramObj.range.increment = paramObj.valuetype === 'integer' ?
        1 : (paramObj.range.span / 100.0);
  }

  return stateObj;
};

export const getters = {
  list: (state) => epiModelParamList,
  keys: (state) => state.paramKeys,

  param: (state) => (key) => state.params[key],
  range: (state) => (key) => state.params[key].range,
  name: (state) => (key) => state.params[key].name,
  description: (state) => (key) => state.params[key].description,
  value: (state) => (key) => state.params[key].value
};

export const mutations = {
  set(state, {key, value}) {
    const paramObj = state.params[key];
    if (value > paramObj.range.max) {
      value = paramObj.range.max;
    }
    if (value < paramObj.range.min) {
      value = paramObj.range.min;
    }
    state.params[key].value = value;

    if (paramObj.probability_distribution_group) {
      console.log('Distribution group needs normalizing');
    }

    console.log(this);
  }
};

export const actions = {
};
