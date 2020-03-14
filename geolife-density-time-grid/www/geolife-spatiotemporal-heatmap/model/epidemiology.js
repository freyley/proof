
import * as mathHelpers from './math-helpers';

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
    description: "Made full recovery, now immunocompetent, cannot be reinfected",
    infectable: false,
    infected: true,
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


const SEC_PER_DAY = 60*60*24;


const epidemiologyModel = {
  INFECTION_STAGES,

  paramsModel: null,

  reset() {
    this.totalSeconds = 0;
    this.simInfo = {};
  },


  createSim(simId) {
    const sim = {
      id: simId,
      infectionStage: INFECTION_STAGES.HEALTHY,
      infectedAtSimSeconds: null,
      outcomeAtSimSeconds: null,
      get daysUntilOutcome() {
        if (this.infectedAtSimSeconds === null ||
            this.outcomeAtSimSeconds === null) {
          return null;
        }
        return Math.floor((this.outcomeAtSimSeconds - this.infectedAtSimSeconds) / SEC_PER_DAY);
      },

      age: mathHelpers.randomNormalWithCutoff(
        this.paramsModel.value('MEAN_AGE_APP_INSTALLED'),
        this.paramsModel.value('STDEV_AGE_APP_INSTALLED'),
        18,
        85,
        true
      ),

      healthProblems: []
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
      throw new Error('paramsModel must be set first.');
    }
    simIds.forEach(simId => {
      this.simInfo[simId] = this.createSim(simId);
    });
  },


  infect(simId, forceStage) {
    if (!forceStage && (
          sim.infectionStage.key === "RECOVERED" ||
          sim.infectionStage.key === "DEAD")) {
      // Can't infect the recovered or the dead.
      return;
    }
    const sim = this.simInfo[simId];
    sim.infectionStage = forceStage || INFECTION_STAGES.LATENT;
    sim.infectedAtSimSeconds = this.totalSeconds;
  },


  computeComplicationsRisk(sim) {
    const riskAge50 = this.paramsModel.value("PROB_COMPLICATIONS_AGE_50");
    const riskAge90 = this.paramsModel.value("PROB_COMPLICATIONS_AGE_90");

    let baseRisk =
      sim.age < 50
        ? mathHelpers.linearInterpolate(sim.age, 0, 0, 50, riskAge50)
        : mathHelpers.linearInterpolate(sim.age, 50, riskAge50, 90, riskAge90);
    baseRisk = Math.min(baseRisk, 1);
    baseRisk = Math.max(baseRisk, 0);

    // Magnify their risk by their number of health issues.
    const riskMagnificationFactor =
        this.paramsModel.value("PROB_COMPLICATIONS_AGE_90") *
        sim.healthProblems.length;
    const risk = 1 - ((1 - baseRisk) / (1 + riskMagnificationFactor));
    return risk;
  },


  computeInfectionStageProgress(sim, seconds) {
    if (sim.infectionStage.key === "HEALTHY" ||
        sim.infectionStage.key === "RECOVERED" ||
        sim.infectionStage.key === "DEAD") {
      // Nothing to do here!
      return;
    } else if (sim.infectionStage.key === "LATENT") {
      const meanDays = this.paramsModel.value("MEAN_INFECTION_LATENCY_DURATION");
      if (mathHelpers.pcheckPoisson(seconds, meanDays*SEC_PER_DAY)) {
        // TODO: Roll for asymptomatic
        sim.infectionStage = INFECTION_STAGES.SICK;
      }
    } else if (sim.infectionStage.key === "ASYMPTOMATIC") {
      const meanDays = this.paramsModel.value("MEAN_INFECTION_ASYMPTOMATIC_DURATION");
      if (mathHelpers.pcheckPoisson(seconds, meanDays*SEC_PER_DAY)) {
        // TODO: Roll for recovery
        sim.infectionStage = INFECTION_STAGES.SICK;
      }
    } else if (sim.infectionStage.key === "SICK") {
      const meanDays = this.paramsModel.value("MEAN_INFECTION_SICKNESS_DURATION");
      if (mathHelpers.pcheckPoisson(seconds, meanDays*SEC_PER_DAY)) {
        // TODO: Roll for critical
        sim.infectionStage = INFECTION_STAGES.CRITICAL;
      }
    } else if (sim.infectionStage.key === "CRITICAL") {
      const meanDays = this.paramsModel.value("MEAN_INFECTION_CRITICAL_DURATION");
      if (mathHelpers.pcheckPoisson(seconds, meanDays*SEC_PER_DAY)) {
        // TODO: Roll for death
        sim.infectionStage = INFECTION_STAGES.DEAD;
      }
    }

    if (sim.infectionStage.key === "RECOVERED" &&
        !!this.paramsModel.value("BOOL_REINFECTION")) {
      // Recovery confers no benefit. Flip them back to Healthy,
      // from whence they might be infected again.
      sim.infectionStage = INFECTION_STAGES.HEALTHY;
    }

    if (sim.infectionStage.key === "HEALTHY" ||
        sim.infectionStage.key === "RECOVERED" ||
        sim.infectionStage.key === "DEAD") {
      sim.outcomeAtSimSeconds = this.totalSeconds;
    }
  },


  timePass(seconds) {
    this.totalSeconds += seconds;
    Object.values(this.simInfo).forEach(sim => {
      this.computeInfectionStageProgress(sim, seconds);
    });

  }
};

epidemiologyModel.reset();

export default epidemiologyModel;

