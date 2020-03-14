
import * as mathHelpers from './math-helpers';
const shuffle = require("shuffle-array");

/*
Infection state follows this state transition diagram.



   +-------------->  Healthy
   |                    |
   |                    |
   |                    V
   |                  Latent
   |              (Not contagious)
   |  (Duration: MEAN_INFECTION_LATENCY_DURATION)
   |                    |
   |                    |
   |                    V                No
   |      <PROB_ASYMPTOMATIC_INFECTION>-----------+------>      Sick
   |          | Yes                               |         (Contagious)
   |          |                                   |  (Duration: MEAN_INFECTION_SICKNESS_DURATION)
   |          V                                   |             |
   |    Asymptomatic                              |             |
   |    (Contagious)                              |             |
   |  (Duration:                                  |             |
   |  MEAN_INFECTION_ASYMPTOMATIC_DURATION)       |             |
   |      |                                       |             |
   |      |                                       |             |
   |      V                        No             |             |
   |  <PROB_ASYMPTOMATIC_RECOVERY>----------------+             |
   |      | Yes                                                 |
   |      |                                                     |
Yes|      V                                       No            V
  <BOOL_REINFECTION> <------------+---------------------- <PROB_SICK_BECOMES_CRITICAL>
          | No                    |                              | Yes
          |                       |                              |
          V                       |                              V
      Recovered                   |                     Critical (Contagious)
   (Can't be reinfected)          |                  (Duration: MEAN_INFECTION_CRITICAL_DURATION)
                                  |                              |
                                  |                              |
                                  |            No                V
                                  +----------------<PROB_CRITICAL_MORTALITY>
                                                                |
                                                                |
                                                                V
                                                              Dead (Not contagious)


NOTE: Every probability roll is affected by age and underlying health conditions.
Probability constants are listed for otherwise healthy, non-elderly young adults.
Actual probabilities used in each roll are based on an individual's complication risk.
The complication risk (RISK) is represented as a value between 0 and 1, with higher
meaning more risk of a bad outcome at each check. RISK is used as follows in each
probability check:

    PROB_used = 1 - ((1 - PROB_baseline) * (1 - RISK))

Thus, for someone with RISK=0, PROB_used=PROB_baseline, and for someone with RISK=1,
PROB_used=1 (i.e. they are guaranteed to have a bad outcome).

RISK is computed based on age and number of health issues. For sims below age 50,
RISK is linearly interpolated from age 20 to age 50, from values of 0 to
PROB_COMPLICATIONS_AGE_50. For sims above age 50, RISK is linearly interpolated from
age 50 to age 90, from values of PROB_COMPLICATIONS_AGE_50 to PROB_COMPLICATIONS_AGE_90.
RISK is clipped below 0 and above 1. RISK is then magnified by the person's number
of health issues:

    RISK_with_age_and_health_issues =
        1 - ((1 - RISK_age) / (1 + (N_health_issues * HEALTH_ISSUE_VULNERABILITY_MULTIPLIER)))

Thus, for someone with 0 health issues, RISK remains unchanged. For someone with 1
health issue, their risk is magnified by a factor of HEALTH_ISSUE_VULNERABILITY_MULTIPLIER
-- that is, the distance between their risk and a value of 1 is cut down to
1 / HEALTH_ISSUE_VULNERABILITY_MULTIPLIER. For someone with multiple health issues,
their risk approaches 1 even faster.

*/

const INFECTION_STAGES = {
  HEALTHY: {
    name: "Healthy",
    description: "Has not been infected, but can be",
    infectable: true,
    infected: false,
    contagious: false,
    symptomatic: false,
    critical: false
  },
  LATENT: {
    name: "Latent",
    description: "Infected, but not contagious or sick yet",
    infectable: false,
    infected: true,
    contagious: false,
    symptomatic: false,
    critical: false
  },
  ASYMPTOMATIC: {
    name: "Asymptomatic",
    description: "Infected and spreading the virus, but showing no/weak symptoms",
    infectable: false,
    infected: true,
    contagious: true,
    symptomatic: false,
    critical: false
  },
  SICK: {
    name: "Sick",
    description: "Infected and spreading the virus, and showing symptoms",
    infectable: false,
    infected: true,
    contagious: true,
    symptomatic: true,
    critical: false
  },
  CRITICAL: {
    name: "Critical",
    description: "Requires medical intervention for survival",
    infectable: false,
    infected: true,
    contagious: true,
    symptomatic: true,
    critical: true
  },
  DEAD: {
    name: "Dead",
    description: "Patient has succumbed to the illness",
    infectable: false,
    infected: true,
    contagious: false,
    symptomatic: false,
    critical: true
  },
  RECOVERED: {
    name: "Recovered",
    description: "Made full recovery, became immunocompetent, cannot be reinfected",
    infectable: false,
    infected: false,
    contagious: false,
    symptomatic: false,
    critical: true
  }
};
Object.entries(INFECTION_STAGES).forEach( ([key, stage]) => {
  stage.key = key;
});


const UNDERLYING_HEALTH_CONDITIONS = [
  'Smoker',
  'Asthma',
  'Heart condition',
  'Diabetic',
  'Immunocompromised'
];


const SEC_PER_HOUR = 60 * 60;
const SEC_PER_DAY = SEC_PER_HOUR * 24;
const SEC_PROLONGED_CONTACT = 60 * 5;

const epidemiologyModel = {
  INFECTION_STAGES,

  paramsModel: null,
  trajectoryModel: null,


  reset() {
    this.totalSeconds = 0;
    this.simInfo = {};
    this.cellContamination = {};
  },


  createSim(simId) {
    const sim = {
      id: simId,
      infectionStage: INFECTION_STAGES.HEALTHY,

      infectedAtSimSeconds: null,
      outcomeAtSimSeconds: null,
      get daysUntilOutcome() {
        if (
          this.infectedAtSimSeconds === null ||
          this.outcomeAtSimSeconds === null
        ) {
          return null;
        }
        return (
          1 +
          Math.floor(
            (this.outcomeAtSimSeconds - this.infectedAtSimSeconds) / SEC_PER_DAY
          )
        );
      },
      get daysInfected() {
        if (this.infectedAtSimSeconds === null) {
          return null;
        }
        if (this.daysUntilOutcome !== null) {
          return this.daysUntilOutcome;
        }
        return (
          1 +
          Math.floor(
            (epidemiologyModel.totalSeconds - this.infectedAtSimSeconds) /
              SEC_PER_DAY
          )
        );
      },

      age: mathHelpers.randomNormalWithCutoff(
        this.paramsModel.value("MEAN_AGE_APP_INSTALLED"),
        this.paramsModel.value("STDEV_AGE_APP_INSTALLED"),
        18,
        85,
        true
      ),

      healthProblems: [],

      magnifyRisk(prob) {
        const probMagnified = 1 - (1 - prob) * (1 - this.complicationRisk);
        return probMagnified;
      },

      isQuarantined: false
    };

    // Add health problems.
    while (true) {
      const hasProblem = mathHelpers.pcheck(
        this.paramsModel.value("PROB_HEALTH_ISSUES")
      );
      if (!hasProblem) {
        break;
      }
      const healthProblem = mathHelpers.pick(UNDERLYING_HEALTH_CONDITIONS);
      if (sim.healthProblems.includes(healthProblem)) {
        // We're just repeating ourselves now.
        break;
      }
      sim.healthProblems.push(healthProblem);
    }
    sim.healthProblems.sort();

    sim.complicationRisk = this.computeComplicationsRisk(sim);

    return sim;
  },


  get simInfoList() {
    const keys = [...Object.keys(this.simInfo)];
    keys.sort();
    const retval = keys.map(k => this.simInfo[k]);
    return retval;
  },


  generateSimInfo(simIds) {
    if (!this.paramsModel) {
      throw new Error("paramsModel must be set first.");
    }
    simIds.forEach(simId => {
      this.simInfo[simId] = this.createSim(simId);
    });
  },


  infect(sim, forceStage) {
    if (typeof sim === "string") {
      sim = this.simInfo[sim];
    }
    if (
      !forceStage &&
      (sim.infectionStage.key === "RECOVERED" ||
        sim.infectionStage.key === "DEAD")
    ) {
      // Can't infect the recovered or the dead.
      return;
    }
    sim.infectionStage = forceStage || INFECTION_STAGES.LATENT;
    sim.infectedAtSimSeconds = this.totalSeconds;
  },


  infectPatientZeroes() {
    const numPatientZeros = this.paramsModel.value("NUM_PATIENT_ZEROES");
    let simsToInfect = shuffle([...Object.values(this.simInfo)]).slice(
      0,
      numPatientZeros
    );
    simsToInfect.forEach(sim => {
      this.infect(sim, INFECTION_STAGES.ASYMPTOMATIC);
    });
    return simsToInfect;
  },


  computeComplicationsRisk(sim) {
    const riskAge50 = this.paramsModel.value("PROB_COMPLICATIONS_AGE_50");
    const riskAge90 = this.paramsModel.value("PROB_COMPLICATIONS_AGE_90");

    let baseRisk =
      sim.age < 50
        ? mathHelpers.linearInterpolate(sim.age, 20, 0, 50, riskAge50)
        : mathHelpers.linearInterpolate(sim.age, 50, riskAge50, 90, riskAge90);
    baseRisk = Math.min(baseRisk, 1);
    baseRisk = Math.max(baseRisk, 0);

    // Magnify their risk by their number of health issues.
    const riskMagnificationFactor =
      this.paramsModel.value("PROB_COMPLICATIONS_AGE_90") *
      sim.healthProblems.length;
    const risk = 1 - (1 - baseRisk) / (1 + riskMagnificationFactor);
    return risk;
  },


  computeInfectionStageProgress(sim, seconds) {
    if (
      sim.infectionStage.key === "HEALTHY" ||
      sim.infectionStage.key === "RECOVERED" ||
      sim.infectionStage.key === "DEAD"
    ) {
      // Nothing to do here!
      return;
    } else if (sim.infectionStage.key === "LATENT") {
      const meanDays = this.paramsModel.value(
        "MEAN_INFECTION_LATENCY_DURATION"
      );
      if (mathHelpers.pcheckPoisson(seconds, meanDays * SEC_PER_DAY)) {
        let pWorse =
          1.0 - this.paramsModel.value("PROB_ASYMPTOMATIC_INFECTION");
        pWorse = sim.magnifyRisk(pWorse);
        sim.infectionStage = mathHelpers.pcheck(pWorse)
          ? INFECTION_STAGES.SICK
          : INFECTION_STAGES.ASYMPTOMATIC;
      }
    } else if (sim.infectionStage.key === "ASYMPTOMATIC") {
      const meanDays = this.paramsModel.value(
        "MEAN_INFECTION_ASYMPTOMATIC_DURATION"
      );
      if (mathHelpers.pcheckPoisson(seconds, meanDays * SEC_PER_DAY)) {
        let pWorse = 1 - this.paramsModel.value("PROB_ASYMPTOMATIC_RECOVERY");
        pWorse = sim.magnifyRisk(pWorse);
        sim.infectionStage = mathHelpers.pcheck(pWorse)
          ? INFECTION_STAGES.SICK
          : INFECTION_STAGES.RECOVERED;
      }
    } else if (sim.infectionStage.key === "SICK") {
      const meanDays = this.paramsModel.value(
        "MEAN_INFECTION_SICKNESS_DURATION"
      );
      if (mathHelpers.pcheckPoisson(seconds, meanDays * SEC_PER_DAY)) {
        let pWorse = this.paramsModel.value("PROB_SICK_BECOMES_CRITICAL");
        pWorse = sim.magnifyRisk(pWorse);
        sim.infectionStage = mathHelpers.pcheck(pWorse)
          ? INFECTION_STAGES.CRITICAL
          : INFECTION_STAGES.RECOVERED;
      }
    } else if (sim.infectionStage.key === "CRITICAL") {
      const meanDays = this.paramsModel.value(
        "MEAN_INFECTION_CRITICAL_DURATION"
      );
      if (mathHelpers.pcheckPoisson(seconds, meanDays * SEC_PER_DAY)) {
        let pWorse = this.paramsModel.value("PROB_CRITICAL_MORTALITY");
        pWorse = sim.magnifyRisk(pWorse);
        sim.infectionStage = mathHelpers.pcheck(pWorse)
          ? INFECTION_STAGES.DEAD
          : INFECTION_STAGES.RECOVERED;
      }
    }

    if (
      sim.infectionStage.key === "RECOVERED" &&
      !!this.paramsModel.value("BOOL_REINFECTION")
    ) {
      // Recovery confers no benefit. Flip them back to Healthy,
      // from whence they might be infected again.
      sim.infectionStage = INFECTION_STAGES.HEALTHY;
    }

    if (
      sim.infectionStage.key === "HEALTHY" ||
      sim.infectionStage.key === "RECOVERED" ||
      sim.infectionStage.key === "DEAD"
    ) {
      sim.outcomeAtSimSeconds = this.totalSeconds;
    }
  },


  getCellKey(location) {
    const cellkey = `${location.lat},${location.lng}`;
    return cellkey;
  },


  getOrCreateContaminationCell(location) {
    const cellkey = this.getCellKey(location);
    let cellRecord = this.cellContamination[cellkey];
    if (!cellRecord) {
      cellRecord = {
        key: cellkey,
        location: location,
        contaminationLevel: 0
      };
      this.cellContamination[cellkey] = cellRecord;
    }
    return cellRecord;
  },


  computeCellContamination(sim, seconds) {
    // If the sim isn't contagious or if they are self-quarantining,
    // then they aren't contaminating anything.
    if (!sim.infectionStage.contagious || sim.isQuarantined) {
      return;
    }

    // If we don't have a trajectory model, then we can't know which cells
    // the sim has passed through.
    if (!this.trajectoryModel) {
      return;
    }
    // Get which cells the sim has passed through in the last time period.
    const locationsVisited = this.trajectoryModel.locationsInLastTimeInterval(
      sim.id,
      seconds
    );

    // The user's specification of probability of contamination is for a "prolonged"
    // encounter. Let's call it 5 minutes.
    // Also, to be fair, we should actually compute how much time they spent in each
    // each cell. But honestly there's so much variance in the real world that this
    // simplifying assumption hardly makes a real difference; after all, we're not
    // modeling the composition of the materials and surfaces in each location,
    // nor the temperature and humidity at the time at which the patient traveled
    // there, so there's no sense harping on moot points.
    const probContam =
      (this.paramsModel.value("PROB_CONTAMINATE") * seconds) /
      (SEC_PROLONGED_CONTACT * locationsVisited.length);
    locationsVisited.forEach(location => {
      if (!mathHelpers.pcheck(probContam)) {
        return;
      }
      let cell = this.getOrCreateContaminationCell(location);
      cell.contaminationLevel++;
    });
  },


  catchInfectionsFromLocations(sim, seconds) {
    // If the sim isn't infectable or is quarantined, then
    // we have nothing to do.
    if (!sim.infectionStage.infectable || sim.isQuarantined) {
      return;
    }

    // If we don't have a trajectory model, then we can't know which cells
    // the sim has passed through.
    if (!this.trajectoryModel) {
      return;
    }
    // Get which cells the sim has passed through in the last time period.
    const locationsVisited = this.trajectoryModel.locationsInLastTimeInterval(
      sim.id,
      seconds
    );

    // Determine whether or not the sim has passed through any contaminated cells.
    const probCatch =
      (this.paramsModel.value("PROB_CATCH_FROM_LOCATION") * seconds) /
      (SEC_PROLONGED_CONTACT * locationsVisited.length);
    locationsVisited.forEach(location => {
      const cellkey = `${location.lat},${location.lng}`;
      const cellRecord = this.cellContamination[cellkey];
      if (!cellRecord || !cellRecord.contaminationLevel) {
        return;
      }
      // Magnify the catch probability by the contamination level
      const probCatchThisCell = 1 - ((1 - probCatch) / cellRecord.contaminationLevel)
      if (!mathHelpers.pcheck(probCatchThisCell)) {
        return;
      }
      this.infect(sim);
    });
  },


  get heatmapPoints() {
    const arr = [...Object.values(this.cellContamination)].map(cell => ({
      location: new google.maps.LatLng(cell.location.lat, cell.location.lng),
      weight: cell.contaminationLevel
    }));
    return arr;
  },


  timePass(seconds) {
    this.totalSeconds += seconds;
    Object.values(this.simInfo).forEach(sim => {
      this.computeInfectionStageProgress(sim, seconds);
      this.computeCellContamination(sim, seconds);

      this.catchInfectionsFromLocations(sim, seconds);
    });
  }
};

epidemiologyModel.reset();

export default epidemiologyModel;

