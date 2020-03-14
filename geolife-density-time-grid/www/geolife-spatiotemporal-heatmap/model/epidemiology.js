
/*
Infection state follows this state transition diagram:

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
   |      | Yes                                                 V
   |      |                                           (Complication probabillty
Yes|      V                                       No     computed by age)
  <BOOL_REINFECTION> <------------+---------------------- <Complications?>
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
*/

const infectionStages = {
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
    name: "Latent",
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
Object.entries(infectionStages).forEach( ([key, stage]) => {
  stage.key = key;
});


const epidemiologyModel = {
  paramsModel: null,

  reset() {
    this.simInfo = {};
  },


  get simInfoList() {
    const retval = [...Object.values(this.simInfo)];
    return retval;
  },


  generateSimInfo(simIds) {
    if (!this.paramsModel) {
      throw new Error('paramsModel must be set first.');
    }
    simIds.forEach(simId => {
      this.simInfo[simId] = {
        id: simId,
        infectionStage: infectionStages.HEALTHY
      };
    });
  },


  infect(simId) {
    this.simInfo[simId].infectionStage = infectionStages.LATENT;
  }
};

epidemiologyModel.reset();

export default epidemiologyModel;

