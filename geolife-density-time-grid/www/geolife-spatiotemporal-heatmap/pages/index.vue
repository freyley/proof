<template>
  <v-layout>
    <v-flex>

      <v-card>
        <v-card-title>
          Geolife Animated Heatmap
        </v-card-title>

        <v-card-text>
          <v-alert type="info" v-if="!isDataLoading && !isDataLoaded">
            The heatmap data has not yet been loaded.
            The data file is approximately 1 MB JSON.
            This demo permits you to actively decide to
            load the data file so that you can get a feel
            for the speed of the loading process. In
            practice, the data would begin loading
            automatically upon the visitor's arrival
            to the site.
          </v-alert>

          <div class="map-container">


            <GmapMap
              ref="mapRef"
              v-if="isDataLoaded"
              :center="{lat:10, lng:10}"
              :zoom="7"
              map-type-id="terrain"
              style="width: 100%; height: 100%"
            >
            </GmapMap>
          </div>
        </v-card-text>

        <v-card-actions>
          <v-btn color="primary" v-if="!isDataLoaded" :loading="isDataLoading"
              @click="loadData()">
            Load Data
          </v-btn>

          <v-alert type="info" v-if="dataLoadTimeStart && dataLoadTimeEnd">
            Data loaded in
            {{dataLoadTimeEnd.getTime() - dataLoadTimeStart.getTime()}} ms
          </v-alert>

          <v-btn @click="panToSingapore">
            Pan to Singapore
          </v-btn>
        </v-card-actions>
      </v-card>

    </v-flex>
  </v-layout>
</template>

<style scoped lang="scss">
#covid19riskapp {
  .map-container {
    background: yellow;
    width: 100%;
    height: 50vh;
  }
}
</style>

<script>
export default {
  components: {
  },

  data() {
    return {
      isDataLoaded: false,
      isDataLoading: false,
      errorMsg: null,

      dataLoadTimeStart: null,
      dataLoadTimeEnd: null,

      googleMapObject: null
    }
  },


  methods: {
    loadData() {
      this.dataLoadTimeStart = new Date();
      this.dataLoadTimeEnd = null;
      this.isDataLoading = true;
      this.isDataLoaded = false;
      this.errorMsg = null;

      // We have to do this silly timeout trick because we can't
      // grab a reference to the mapRef element because it doesn't
      // exist yet because the v-if hasn't processed yet.
      // And we can't make it exist before the v-if because there's
      // a bug in the component that throws an annoying DOM error.
      setTimeout(() => {
        this.isDataLoaded = true;
        this.isDataLoading = false;
        this.dataLoadTimeEnd = new Date();

        setTimeout(() => {
          this.$refs.mapRef.$mapPromise.then((map) => {
            this.googleMapObject = map;
          })
        }, 0);
      }, 500);
    },

    panToSingapore() {
      if (!this.googleMapObject) {
        return;
      }
      this.googleMapObject.panTo({lat: 1.38, lng: 103.80})
    }
  }
}
</script>
