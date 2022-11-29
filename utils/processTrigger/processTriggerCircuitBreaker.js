/*
 * @module processTriggerCircuitBreaker
 * Used to send service requests to 'process_manager.trigger'. The CircuitBreaker
 * uses the saveToQueue function as a fallback, so we won't lose requests if
 * something goes wrong. Also if the service request fails repeatedly the breaker
 * flips and uses the fallback. This will give process_manager time to recover,
 * before the CircuitBreaker opens again. The processQueue will continue to rety
 * until it's successful.
 */
const CircuitBreaker = require("opossum");
const { saveToQueue } = require("../processTrigger.js");

const options = {
   timeout: 3000, // If our function takes longer than 3 seconds, trigger a failure
   errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
   resetTimeout: 30000, // After 30 seconds, try again.
};

let pmTriggerCircuitBreaker;

module.exports = () => {
   if (!pmTriggerCircuitBreaker) {
      pmTriggerCircuitBreaker = new CircuitBreaker(
         (req, jobData) =>
            new Promise((resolve, reject) =>
               req.serviceRequest("process_manager.trigger", jobData, (err) => {
                  if (err) reject(err);
                  else resolve();
               })
            ),
         options
      );
      pmTriggerCircuitBreaker.fallback(saveToQueue);
   }
   return pmTriggerCircuitBreaker;
};
