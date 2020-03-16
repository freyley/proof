
const randomNormal = require("random-normal");

// I really hate doing my own math primitives, but if no package is
// readily available and I don't have time to publish one myself,
// then this'll have to do.

export const pcheck = (p) => {
  return (Math.random() < p);
};

// If the event happens once every meanTimeToEvent
// time units on average, then did the event happen in
// a timespan of t?
// These helped as a refresher on Poisson distributions:
// https://towardsdatascience.com/the-poisson-distribution-and-poisson-process-explained-4e2cb17d459
// https://math.stackexchange.com/questions/2707646/probability-of-two-or-more-events-given-find-rate-of-poisson-process
export const pcheckPoisson = (t, meanTimeToEvent) => {
  // If we see an average of 1 event every meanTimeToEvent time units,
  // then in t time units we'll see 1 * t/meanTimeToEvent events.
  // lambda = expected number of events in the interval.
  const lambda = t / meanTimeToEvent;

  // What's the probability of seeing 1 or more events? Well, it's the inverse
  // of seeing 0 events. So what's the probability of seeing exactly 0 events
  // in one lambda period?
  // Mathematically, it's (e^-lambda)*(lambda^0) / (0!)
  // This easily simplifies to just e^-lambda.
  // NOTE: We should probably compute this, cache it in the calling function,
  // and then refer to the probability with a pcheck. But it's okay
  // for now.
  const pAtLeastOneEvent = 1 - Math.exp(-lambda);
  return pcheck(pAtLeastOneEvent);
};

export const pick = (arr) => {
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
};

export const linearInterpolate = (x, x0,y0, x1,y1) => {
  x -= x0;
  x1 -= x0;
  const px = x / x1;
  y1 -= y0;
  const dy = px * y1;
  return dy + y0;
};

export const randomNormalWithCutoff = (mean, std, min, max, intfloor) => {
  let retval = randomNormal({ mean: mean, dev: std });
  if (typeof max === 'number') {
    retval = Math.min(retval, max);
  }
  if (typeof min === 'number') {
    retval = Math.max(retval, min);
  }
  if (intfloor) {
    retval = Math.floor(retval);
  }
  return retval;
};
