
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

    this.currentTrajRecordIndexByTrajId = {};
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
    if (this.trajectoryData && this.trajectoryData.ranges) {
      retval.begin = this.trajectoryData.ranges['time-start'];
      retval.end = this.trajectoryData.ranges['time-end'];
      retval.span = retval.end - retval.begin;
    }
    return retval;
  },


  initialRecord(trajId) {
    if (!this.trajectoryData ||
      !this.trajectoryData.trajectories) {
      return null;
    }
    const trajectory = this.trajectoryData.trajectories[trajId];
    if (!trajectory || !trajectory.length) {
      return null;
    }
    const trajRecord = trajectory[0];
    const record = {
      timeInCell: {
        begin: trajRecord[0],
        end: trajRecord[1]
      },
      location: {
        lat: trajRecord[2],
        lng: trajRecord[3]
      }
    };
    return record;
  },


  // Returns a collection of all trajectory locations at the current seek time position.
  get locations() {
    const trajLocations = {};
    Object.keys(this.trajectoryData.trajectories).forEach(trajId => {
      trajLocations[trajId] = null;

      const iTrajRec = this.currentTrajRecordIndexByTrajId[trajId];
      const trajRecord = this.trajectoryData.trajectories[trajId][iTrajRec];

      if (!trajRecord) {
        console.log('Something is wrong');
        debugger;
      }

      // Make sure that the record represents a valid present location.
      if (trajRecord[0] > this.seekUnixtime ||
        trajRecord[1] <= this.seekUnixtime) {
        // The current seek position is either before the start of the
        // trajectory record, or after the end of it.
        return;
      }

      trajLocations[trajId] = {
        lat: trajRecord[2],
        lng: trajRecord[3]
      };
    });
    return trajLocations;
  },


  // Returns a map of trajIds showing all of the locations each one has
  // been in since timespanSeconds ago.
  locationsInLastTimeInterval(timespanSeconds) {
    const tSince = this.seekUnixtime - timespanSeconds;
    const trajIds = [...Object.keys(this.trajectories)];

    const cellVisitsByTrajId = {};
    trajIds.forEach(trajId => {
      cellVisitsByTrajId[trajId] = [];
    });

    Object.entries(this.trajectories).forEach( ([trajId, trajectory]) => {
      let iTrajRec = this.currentTrajRecordIndexByTrajId[trajId];
      if (!iTrajRec && iTrajRec !== 0) {
        // iTrajRec is null or undefined. That means no cells. Skip this trajId
        return;
      }
      for (; iTrajRec>=0; iTrajRec--) {
        const trajRec = trajectory[iTrajRec];
        if (trajRec[1] < tSince) {
          // This record ended before our last time interval began.
          // We shouldn't bother backing up any more.
          break;
        }
        if (trajRec[0] > this.seekUnixtime) {
          // This record starts after our current seek time, so it's in the future.
          // Don't record this one, but continue backing up.
          continue;
        }
        // If we got here, then this record represents a cell that the trajectory
        // visited since the time interval.
        const location = {
          lat: trajRec[2],
          lng: trajRec[3],
        };
        cellVisitsByTrajId[trajId].push(location);
      }
    });
    return cellVisitsByTrajId;
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


  // Update the seek position.
  // Move the trajectory records' current frame to the time slot
  // specified by unixtime. If the unixtime is between the end
  // and start times of two adjacent records, the seek ends up
  // at the next record.
  seek(unixtime) {
    Object.entries(this.trajectories).forEach( ([trajId, trajectory]) => {
      let iTrajRec = this.currentTrajRecordIndexByTrajId[trajId];
      if (!iTrajRec) {
        iTrajRec = 0;
      }
      while (unixtime < trajectory[iTrajRec][0] && iTrajRec > 0) {
        // Seektime is before the start of this trajectory record.
        // Look in the previous trajectory record.
        iTrajRec--;
      }
      while (unixtime > trajectory[iTrajRec][1] && iTrajRec < trajectory.length - 1) {
        // Seektime is after the end of this trajectory record.
        // Look in the next trajectory record.
        iTrajRec++;
      }
      this.currentTrajRecordIndexByTrajId[trajId] = iTrajRec;
    });
    this.seekUnixtime = unixtime;
  },


  load($axios, options) {
    this.markDataLoadStart();

    const urlpath = 'data/trajectories_in_spatial_grid.json';
    const p = $axios.get(urlpath).then(data => {
      const trajectoryData = data.data;

      // Convert the lat/long from fixed-point integer to floats.
      const pow10 = Math.pow(10, trajectoryData.gridparams['fixed-point-precision']);
      Object.values(trajectoryData.trajectories).forEach(trajectory => {
        trajectory.forEach((trajRecord) => {
          trajRecord[2] /= pow10;
          trajRecord[3] /= pow10;
        });
      });

      if (options) {
        if (options.dbgOnlyKeepFirstNTrajectories) {
          const keysToKeep = [...Object.keys(trajectoryData.trajectories)]
            .slice(0, options.dbgOnlyKeepFirstNTrajectories);

          if (options.patientZero && !keysToKeep.includes(options.patientZero)) {
            keysToKeep[0] = options.patientZero;
          }

          const trajectoriesFiltered = {};
          keysToKeep.forEach(k => {
            trajectoriesFiltered[k] = trajectoryData.trajectories[k];
          });
          trajectoryData.trajectories = trajectoriesFiltered;
        }
      }

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




