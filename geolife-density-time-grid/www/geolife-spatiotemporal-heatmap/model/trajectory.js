
// The trajectory model is responsible for loading, storing,
// and managing Geolife trajectories, via a JSON format that
// has been processed by the corresponding Jupyter Notebook.

// In theory this should be done through a Vuex store,
// so as to be available to all components. Unfortunately,
// CPU and memory are at a premium, and it appears that
// Vuex incurs enough of a slowdown to seriously
// interfere with the animation.

const trajectoryModel = {
  reset() {
    this.isDataLoaded = false;
    this.isDataLoading = false;
    this.errorMsg = null;

    this.dataLoadTimeStart = null;
    this.dataLoadTimeEnd = null;

    this.trajectoryData = null;

    this.currentTrajSeeks = {};
    this.locations = {};
    this.locationsVisited = {};

    this.seekUnixtime = 0;
  },


  get durationDataLoad() {
    if (!this.isDataLoaded) {
      return null;
    }
    return this.dataLoadTimeEnd - this.dataLoadTimeStart;
  },


  get trajectories() {
    if (!this.trajectoryData || !this.trajectoryData.trajectories) {
      return [];
    }
    return this.trajectoryData.trajectories;
  },


  get trajectoryIds() {
    return [...Object.keys(this.trajectories)];
  },


  get gridparams() {
    if (!this.trajectoryData || !this.trajectoryData.gridparams) {
      return {};
    }
    return this.trajectoryData.gridparams;
  },


  get timeRange() {
    const retval = {
      begin: 0,
      end: 0,
      span: 0
    };
    /*
    if (this.trajectoryData && this.trajectoryData.ranges) {
      retval.begin = this.trajectoryData.ranges['time-start'];
      retval.end = this.trajectoryData.ranges['time-end'];
      retval.span = retval.end - retval.begin;
    }
    */
    return retval;
  },


  // Returns a list of the locations the given trajId has
  // been in since timespanSeconds ago.
  locationsInLastTimeInterval(trajId, timespanSeconds) {
    return [];
  },


  markDataLoadStart() {
    this.dataLoadTimeStart = new Date();
    this.dataLoadTimeEnd = null;
    this.isDataLoading = true;
    this.isDataLoaded = false;
    this.errorMsg = null;
  },


  markDataLoadComplete(error) {
    this.isDataLoading = false;
    if (error) {
      this.dataLoadTimeEnd = null;
      this.isDataLoaded = false;
      this.errorMsg = error.message || JSON.stringify(error);
    } else {
      this.dataLoadTimeEnd = new Date();
      this.isDataLoaded = true;
      this.errorMsg = null;
    }
  },


  advanceTime(seconds) {
    // TODO: Make this incorporate seconds.
    Object.entries(this.trajectories).forEach(([trajId, trajectory]) => {
      this.currentTrajSeeks[trajId].index++;
      this.currentTrajSeeks[trajId].index %= trajectory.length;

      const currentRecord = trajectory[this.currentTrajSeeks[trajId].index];
      const currentLocation = {
        lat: currentRecord[0],
        lng: currentRecord[1]
      }
      this.locations[trajId] = currentLocation;
      this.locationsVisited[trajId] = [currentLocation];
    });
  },


  load($axios) {
    this.markDataLoadStart();

    const urlpath = 'data/trajectories_ghosts.json';
    const p = $axios.get(urlpath).then(data => {
      const trajectoryData = data.data;

      // Convert the lat/long from fixed-point integer to floats.
      const pow10 = Math.pow(10, trajectoryData.gridparams['fixed-point-precision']);
      Object.values(trajectoryData.trajectories).forEach(trajectory => {
        trajectory.forEach((trajRecord) => {
          trajRecord[0] /= pow10;
          trajRecord[1] /= pow10;
        });
      });


      this.currentTrajSeeks = {};
      this.locations = {};
      this.locationsVisited = {};
      Object.entries(trajectoryData.trajectories).forEach( ([trajId, trajectory]) => {
        this.currentTrajSeeks[trajId] = {
          index: 0,
          secondsRemaining: trajectory[2]
        };
        const currentLocation = {
          lat: trajectory[0][0],
          lng: trajectory[0][1]
        };
        this.locations[trajId] = currentLocation;
        this.locationsVisited[trajId] = [currentLocation];
      });

      this.trajectoryData = trajectoryData;
      this.markDataLoadComplete();
    })
    .catch(err => {
      this.this.markDataLoadComplete(err);
    });

    return p;
  }
};

trajectoryModel.reset();

export default trajectoryModel;




