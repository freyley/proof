
const epiModelParamsInfo = require('./epi-model-params.json');

const paramObjsByKey = {};
const paramGroups = {};

epiModelParamsInfo.forEach(paramObj => {
  if (paramObj.disabled) {
    return;
  }

  paramObj.value = paramObj.default;

  paramObjsByKey[paramObj.key] = paramObj;

  const groupName = paramObj["param_group"] || "Miscellaneous";
  if (!(groupName in paramGroups)) {
    paramGroups[groupName] = [];
  }
  paramGroups[groupName].push(paramObj);
});

const groupsList = (() => {
  let groupKeys = [...Object.keys(paramGroups)];

  // If 'Miscellaneous' is a group, move it to the end.
  if (groupKeys.includes('Miscellaneous')) {
    groupKeys = groupKeys.filter(k => k !== 'Miscellaneous');
    groupKeys.push('Miscellaneous');
  }

  const groupsWithParams = groupKeys.map(groupKey => ({
    name: groupKey,
    params: paramGroups[groupKey]
  }));
  return groupsWithParams;
})();


const paramsModel = {
  groups: groupsList,
  get params() { return paramObjsByKey; },

  value(paramKey) {
    return paramObjsByKey[paramKey].value;
  }
};


export default paramsModel;

