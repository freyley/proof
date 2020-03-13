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
              :center="mapInitCenter"
              :zoom="10"
              map-type-id="roadmap"
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

          <v-container class="column ml-2" v-if="isDataLoaded">
            <v-row class="font-weight-light font-italic"
                style="font-family: monospace"
            >{{currentTimeDateObj}}</v-row>

            <v-row>
              <v-slider
                v-model="currentTime"
                :min="timeRange.begin"
                :max="timeRange.end"
              ></v-slider>

              <v-btn fab small class="mx-1" color="primary"
                  v-if="!isPlaying"
                  @click="isPlaying=true; play()">
                <v-icon>mdi-play</v-icon>
              </v-btn>
              <v-btn fab small class="mx-1" color="primary"
                  v-if="!isPlaying"
                  @click="advanceTime()">
                <v-icon>mdi-play-pause</v-icon>
              </v-btn>
              <v-btn fab small class="mx-1" color="primary"
                  v-if="isPlaying"
                  @click="isPlaying=false">
                <v-icon>mdi-stop</v-icon>
              </v-btn>

            </v-row>

          </v-container>
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

      trajectoryData: null,

      currentTime: 0,
      timeIncrement: 5 * 60, // Advance by this many seconds at a time
      isPlaying: false,

      currentTrajRecordIndexByTrajId: {},

      mapMarkersByTrajId: {},
      heatmapPointsByCellKey: {},
      heatmapObj: null,

      mapInitCenter: {
        lat: 40,
        lng: -100
      }
    }
  },

  computed: {
    timeRange() {
      const retval = {
        begin: 0,
        end: 0,
        span: 0
      };
      if (this.trajectoryData) {
        retval.begin = this.trajectoryData.ranges['time-start'],
        retval.end = this.trajectoryData.ranges['time-end'],
        retval.span = retval.end - retval.begin;
      }
      return retval;
    },

    currentTimeDateObj() {
      return new Date(this.currentTime * 1000);
    },

    currentTimestepPoints() {
      return []
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

      this.$axios.get('data/trajectories_in_spatial_grid.json')
        .then(data => {
          this.isDataLoaded = true;
          this.dataLoadTimeEnd = new Date();

          this.trajectoryData = data.data;
          //this.currentTime = this.timeRange.begin + Math.floor(this.timeRange.span / 3);
          this.currentTime = this.trajectoryData.trajectories['000'][0][0];

          // TODO DEBUG: Neuter the data so we can work with it more easily.
          //this.trajectoryData.trajectories = {
          //  '000': this.trajectoryData.trajectories['000']
          //};

          // Convert the lat/long from fixed-point integer to floats.
          const pow10 = Math.pow(10, this.trajectoryData.gridparams['fixed-point-precision']);
          Object.entries(this.trajectoryData.trajectories).forEach( ([trajId, trajectory]) => {
            trajectory.forEach( (trajRecord, iRecord) => {
              trajRecord[2] /= pow10;
              trajRecord[3] /= pow10;
            });
          });

          // We have to do this silly timeout trick because we can't
          // grab a reference to the mapRef element because it doesn't
          // exist yet because the v-if hasn't processed yet.
          // And we can't make it exist before the v-if because there's
          // a bug in the component that throws an annoying DOM error.
          this.$nextTick(() => {
            this.$refs.mapRef.$mapPromise.then((map) => {
              this.googleMapObject = map;
              this.updateMap();

              this.mapInitCenter.lat = this.trajectoryData.trajectories['000'][0][2];
              this.mapInitCenter.lng = this.trajectoryData.trajectories['000'][0][3];
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

    updateCurrentTrajRecordForEachTrajId() {
      Object.entries(this.trajectoryData.trajectories).forEach( ([trajId, trajectory]) => {
        let iTrajRec = this.currentTrajRecordIndexByTrajId[trajId];
        if (!iTrajRec) {
          iTrajRec = 0;
        }

        while (this.currentTime < trajectory[iTrajRec][0] && iTrajRec > 0) {
          // Current time is before the start of this trajectory record.
          // Look in the previous trajectory record.
          iTrajRec--;
        }
        while (this.currentTime > trajectory[iTrajRec][1] && iTrajRec < trajectory.length-1) {
          // Current time is after the end of this trajectory record.
          // Look in the next trajectory record.
          iTrajRec++;
        }
        this.currentTrajRecordIndexByTrajId[trajId] = iTrajRec;
      });
    },

    getCurrentCoordinates(trajId) {
      let iTrajRec = this.currentTrajRecordIndexByTrajId[trajId];
      if (!iTrajRec) {
        iTrajRec = 0;
      }
      const trajRec = this.trajectoryData.trajectories[trajId][iTrajRec];

      if (this.currentTime < trajRec[0] ||
          this.currentTime > trajRec[1]) {
        // Current time is outside the current trajectory record!
        return null;
      }

      const coords = {
        lat: trajRec[2],
        lng: trajRec[3]
      }
      return coords;
    },

    getAllCoordinatesSinceLastTimeInterval(trajId) {
      let iTrajRec = this.currentTrajRecordIndexByTrajId[trajId];
      if (!iTrajRec && iTrajRec !== 0) {
        return [];
      }
      const lastTimeBegin = this.currentTime - this.timeIncrement;
      const coordses = [];
      while (true) {
        if (iTrajRec < 0) {
          break;
        }
        const trajRec = this.trajectoryData.trajectories[trajId][iTrajRec];
        if (trajRec[1] < lastTimeBegin) {
          // This record ended before our last time interval began.
          break;
        }
        if (this.currentTime > trajRec[0]) {
          // Only push coords from timeframes that don't start in the future.
          coordses.push({
            lat: trajRec[2],
            lng: trajRec[3],
          });
        }
        iTrajRec--;
      }
      return coordses;
    },

    getCurrentCoordinatesOfEachTrajectory() {
      const currentCoordsOfEachTrajId = {};
      Object.entries(this.trajectoryData.trajectories).forEach( ([trajId, trajectory]) => {
        currentCoordsOfEachTrajId[trajId] = this.getCurrentCoordinates(trajId);
      });
      return currentCoordsOfEachTrajId;
    },

    updateMarkers() {
      if (!this.googleMapObject) {
        return;
      }
      Object.keys(this.trajectoryData.trajectories).forEach(trajId => {
        const coords = this.getCurrentCoordinates(trajId);
        let mapMarker = this.mapMarkersByTrajId[trajId];

        if (!mapMarker) {
          mapMarker = new google.maps.Marker({
            position: coords,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 3
            },
            draggable: false,
            title: `User ${trajId}`,
            map: this.googleMapObject
          });
          this.mapMarkersByTrajId[trajId] = mapMarker;
        }
        mapMarker.setPosition(coords);
      });
    },

    updateHeatmap() {
      if (!this.googleMapObject) {
        return;
      }
      if (!this.heatmapObj) {
        this.heatmapObj = new google.maps.visualization.HeatmapLayer({
          data: [],
          dissipating: true,
          radius: 20,
          opacity: .9,
          maxIntensity: 20,
          gradient: [
          'rgba(255, 255, 0, 0)',
          'rgba(255, 255, 0, 1)',
          'rgba(255, 0, 0, 1)',
          'rgba(180, 0, 0, 1)'
        ]
        });
        this.heatmapObj.setMap(this.googleMapObject);
      }
      Object.keys(this.trajectoryData.trajectories).forEach(trajId => {
        const coordses = this.getAllCoordinatesSinceLastTimeInterval(trajId);
        coordses.forEach(coords => {
          const cellKey = `${coords.lat},${coords.lng}`;
          let heatmapPoint = this.heatmapPointsByCellKey[cellKey];
          if (!heatmapPoint) {
            heatmapPoint = {
              weight: 0,
              location: new google.maps.LatLng(coords.lat, coords.lng)
            };
            this.heatmapPointsByCellKey[cellKey] = heatmapPoint;
          }
          heatmapPoint.weight += 1;
          heatmapPoint.weight = Math.min(100, heatmapPoint.weight);

          const heatmapPointsData = [...Object.values(this.heatmapPointsByCellKey)];
          this.heatmapObj.setData(heatmapPointsData);
        });
      });
    },

    updateMap() {
      this.updateCurrentTrajRecordForEachTrajId();

      this.updateMarkers();
      this.updateHeatmap();
      /*
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
      if (this.currentHeatmapDataPoints) {
        // Clear the last pile of data points, if they exist.
        // https://stackoverflow.com/questions/25699643/delete-heat-map-for-refreshing
        this.currentHeatmapDataPoints.clear();
      }
      this.currentHeatmapDataPoints = new google.maps.MVCArray(heatMapData);

      const heatmap = new google.maps.visualization.HeatmapLayer({
        data: this.currentHeatmapDataPoints
      });
      heatmap.setMap(this.googleMapObject);
      */
    },

    advanceTime() {
      this.currentTime += this.timeIncrement;
      if (this.currentTime > this.timeRange.max) {
        this.currentTime = this.timeRange.max;
      }
    },

    play() {
      if (!this.isPlaying) {
        return;
      }

      this.advanceTime();

      setTimeout(() => {
        this.play();
      }, 25);
    }
  },

  mounted() {
  },

  watch: {
    currentTime(value) {
      this.updateMap();
    }
  }
}
</script>
