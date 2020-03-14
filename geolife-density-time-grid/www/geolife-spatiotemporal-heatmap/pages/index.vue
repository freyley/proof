<template>
  <v-layout>
    <v-row>
      <v-col cols="12" md="8" xl="6">
        <div class="map-container">
          <v-alert type="info"
              :dismissible="true"
              v-if="!trajectoryModel.isDataLoading &&
                    !trajectoryModel.isDataLoaded">
            The heatmap data has not yet been loaded.
            The data comes as a JSON file approximately
            25 MB unpacked, 5 MB on the wire.
            This demo permits you to actively decide to
            load the data file so that you can get a feel
            for the speed of the loading process. In
            practice, the data would begin loading
            automatically upon the visitor's arrival
            to the site. We'll use an efficient CDN
            for production; right now, we're hosted on
            a single GoDaddy server, which isn't the
            most efficient way to deliver large files
            to large numbers of users.
          </v-alert>

          <v-alert type="error"
              v-if="trajectoryModel.errorMsg">
            {{trajectoryModel.errorMsg}}
          </v-alert>

          <v-alert type="success"
              :dismissible="true"
              v-if="trajectoryModel.isDataLoaded">
            Data loaded in
            {{trajectoryModel.durationDataLoad}} ms
          </v-alert>


          <GmapMap
            ref="mapRef"
            v-if="trajectoryModel.isDataLoaded"
            :center="mapInitCenter"
            :zoom="10"
            map-type-id="roadmap"
            style="width: 100%; height: 100%"
          >
          </GmapMap>

          <div class="seektime" v-if="trajectoryModel.isDataLoaded">
            {{currentTimeDateObj}}
          </div>
        </div>
      </v-col>

      <v-col>
        <v-row v-if="!trajectoryModel.isDataLoaded">
          <v-btn color="primary"
              :loading="trajectoryModel.isDataLoading"
              @click="loadData()">
            Load Data
          </v-btn>
        </v-row>

        <v-container class="column ml-2"
            v-if="trajectoryModel.isDataLoaded">

          <v-row>
            <v-col>
              <v-slider
                label="Seek position"
                v-model="currentTime"
                :min="trajectoryModel.timeRange.begin"
                :max="trajectoryModel.timeRange.end"
              ></v-slider>
              <v-slider
                label="Playback speed"
                v-model="timeIncrement"
                :min="1 * 60"
                :max="30 * 60"
              ></v-slider>
            </v-col>
          </v-row>

          <v-row>
            <v-btn fab small class="mx-1" color="primary"
                v-if="!isPlaying"
                @click="resetWithData()">
              <v-icon>mdi-cached</v-icon>
            </v-btn>

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

      </v-col>
    </v-row>
  </v-layout>
</template>

<style scoped lang="scss">
#covid19riskapp {
  .map-container {
    background: #ccc;
    border: 1px solid #444;
    border-radius: 1em;
    overflow: hidden;
    width: 100%;
    height: calc(100vh - 10em);
    position: relative;

    .v-alert {
      position: absolute;
      top: 4em;
      left: 1em;
      width: calc(100% - 2em);
      opacity: .9;
      z-index: 1;
    }

    .seektime {
      position: absolute;
      bottom: 1em;
      left: 1em;
      width: calc(65% - 2em);
      background: white;
      color: black;
      font-family: monospace;
      font-size: 80%;
      padding: 1ex 1em;
      opacity: .9;
      border-radius: 1ex;
    }
  }
}
</style>

<script>
import trajectoryModel from '~/model/trajectory';


export default {
  components: {
  },

  data() {
    return {
      trajectoryModel,

      patientZero: '000',
      googleMapObject: null,

      currentTime: 0,
      timeIncrement: 15 * 60, // Advance by this many seconds at a time
      isPlaying: false,

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
    currentTimeDateObj() {
      return new Date(this.currentTime * 1000);
    }
  },

  methods: {
    reset() {
      this.currentTime = 0;
      this.isPlaying = false;

      this.mapMarkersByTrajId = {};
      this.heatmapPointsByCellKey = {};
      this.heatmapObj = null;

      trajectoryModel.reset();
    },

    resetWithData() {
      const patientZeroInitialRecord = trajectoryModel.initialRecord(this.patientZero);
      this.currentTime = patientZeroInitialRecord.timeInCell.begin;
      this.mapInitCenter = patientZeroInitialRecord.location;

      this.heatmapPointsByCellKey = {};
      if (this.heatmapObj) {
        this.heatmapObj.setData([]);
      }
    },

    loadData() {
      this.reset();
      trajectoryModel.load(this.$axios, {
        dbgOnlyKeepFirstNTrajectories: false,
        patientZero: this.patientZero
      }).then(() => {
        this.resetWithData();

        // We have to do this silly timeout trick because we can't
        // grab a reference to the mapRef element because it doesn't
        // exist yet because the v-if hasn't processed yet.
        // And we can't make it exist before the v-if because there's
        // a bug in the component that throws an annoying DOM error.
        this.$nextTick(() => {
          this.$refs.mapRef.$mapPromise.then((map) => {
            this.googleMapObject = map;
            this.createHeatmap();

            this.updateMap();
          })
        }, 0);
      });
    },

    createHeatmap() {
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
    },

    getOrCreateMapMarker(trajId) {
      let mapMarker = this.mapMarkersByTrajId[trajId];
      if (!mapMarker) {
        mapMarker = new google.maps.Marker({
          position: null,
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
      return mapMarker;
    },

    getOrCreateHeatmapPoint(lat, lng) {
      if (typeof lat === 'object') {
        lng = lat.lng;
        lat = lat.lat;
      }

      const cellKey = `${lat},${lng}`;
      let heatmapPoint = this.heatmapPointsByCellKey[cellKey];
      if (!heatmapPoint) {
        heatmapPoint = {
          weight: 1,
          location: new google.maps.LatLng(lat, lng)
        };
        this.heatmapPointsByCellKey[cellKey] = heatmapPoint;
      }
      return heatmapPoint;
    },

    updateMarkers() {
      if (!this.googleMapObject) {
        return;
      }
      Object.entries(trajectoryModel.locations).forEach(([trajId, location]) => {
        const mapMarker = this.getOrCreateMapMarker(trajId);
        mapMarker.setPosition(location);
      });
    },

    updateHeatmap() {
      if (!this.googleMapObject || !this.heatmapObj) {
        return;
      }
      const cellVisits = trajectoryModel.locationsInLastTimeInterval(this.timeIncrement);
      Object.entries(cellVisits).forEach( ([trajId, coordses]) => {
        coordses.forEach(coords => {
          let heatmapPoint = this.getOrCreateHeatmapPoint(coords);
          heatmapPoint.weight += 1;
          heatmapPoint.weight = Math.min(100, heatmapPoint.weight);

          const heatmapPointsData = [...Object.values(this.heatmapPointsByCellKey)];
          this.heatmapObj.setData(heatmapPointsData);
        });
      });
    },

    updateMap() {
      this.updateMarkers();
      this.updateHeatmap();
    },

    advanceTime() {
      const timeMax = trajectoryModel.timeRange.end;
      this.currentTime += this.timeIncrement;
      if (this.currentTime > timeMax) {
        this.currentTime = timeMax;
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
      trajectoryModel.seek(this.currentTime);
      this.updateMap();
    }
  }
}
</script>
