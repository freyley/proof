// Borrowed from:
// https://github.com/statnett/vue-plotly/issues/26

import Vue from "vue";
import VuePlotly from "@statnett/vue-plotly";

Vue.component("vue-plotly", VuePlotly);

/*
console.log('Plugin file here')
const VuePlotly = {
  install(Vue) {
    console.log('Install called')
    Vue.component("vue-plotly", vPlotly);
  }
};
Vue.use(VuePlotly);
export default VuePlotly;
*/
