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
              :center="{lat:40, lng:116.3}"
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

          <div>
            <div class="font-weight-light font-italic">{{currentTimestepDateObj}}</div>
          </div>
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

      googleMapObject: null,

      timeSeriesHeatMapData: null,
      heatmapRange: 0,
      currentTimestepIndex: 0
    }
  },

  computed: {
    currentTimestepObj() {
      if (!this.timeSeriesHeatMapData ||
          !this.timeSeriesHeatMapData[this.currentTimestepIndex]) {
        return null;
      }
      return this.timeSeriesHeatMapData[this.currentTimestepIndex];
    },

    currentTimestepDateObj() {
      if (!this.currentTimestepObj) {
        return null;
      }
      return new Date(this.currentTimestepObj[0]);
    },

    currentTimestepPoints() {
      if (!this.currentTimestepObj) {
        return [];
      }
      const pointsByWeight = this.currentTimestepObj[1];
      const pointsUnpacked = pointsByWeight.reduce( (accumulator, arrWeight) => {
        const weight = arrWeight[0];
        const arrPointsWithWeight = arrWeight[1];
        const arrPtObjs = arrPointsWithWeight.map(arrPt => {
          return {
            lat: arrPt[0],
            lng: arrPt[1],
            weight
          };
        });
        return accumulator.concat(arrPtObjs);
      }, []);
      return pointsUnpacked;
    }

  },

  methods: {
    loadData() {
      this.dataLoadTimeStart = new Date();
      this.dataLoadTimeEnd = null;
      this.isDataLoading = true;
      this.isDataLoaded = false;
      this.errorMsg = null;

      this.timeSeriesHeatMapData = null;
      this.heatmapRange = 0;
      this.currentTimestepIndex = 0;

      this.$axios.get('./data/time_series_sparse_geospatial_tallies.json')
        .then(data => {
          this.isDataLoaded = true;
          this.dataLoadTimeEnd = new Date();

          this.heatmapRange = data.data.ranges.tally;
          this.timeSeriesHeatMapData = data.data.timeseries;

          // We have to do this silly timeout trick because we can't
          // grab a reference to the mapRef element because it doesn't
          // exist yet because the v-if hasn't processed yet.
          // And we can't make it exist before the v-if because there's
          // a bug in the component that throws an annoying DOM error.
          setTimeout(() => {
            this.$refs.mapRef.$mapPromise.then((map) => {
              this.googleMapObject = map;
              this.updateCurrentIndexHeatmap();
            })
          }, 0);
        })
        .catch(err => {
          this.errorMsg = err.message || JSON.stringify(err);
        })
        .finally( () => {
          this.isDataLoading = false;
        });
    },

    updateCurrentIndexHeatmap() {
      if (!this.googleMapObject || !this.currentTimestepObj) {
        return;
      }

      const srcPts = this.currentTimestepPoints;
      const heatMapData = srcPts.map(srcPt => {
        return {
          location: new google.maps.LatLng(srcPt.lat, srcPt.lng),
          weight: srcPt.weight
        };
      });

      const heatmap = new google.maps.visualization.HeatmapLayer({
        data: heatMapData
      });
      heatmap.setMap(this.googleMapObject);
    }
  }
}
</script>
