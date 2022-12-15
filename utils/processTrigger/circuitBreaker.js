/*
 * @module processTriggerCircuitBreaker
 * Used to send service requests to 'process_manager.trigger'. The CircuitBreaker
 * uses a fallback function, so we can hanlde failures. If the requests are
 * failing repeatedly the breaker flips and uses the fallback directly. This
 * gives process_manager time to recover, before the CircuitBreaker tries again.
 */
const CircuitBreaker = require("opossum");

const options = {
   timeout: 3000, // If our function takes longer than 3 seconds, trigger a failure
   errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
   resetTimeout: 30000, // After 30 seconds, try again.
};

let pmTriggerCircuitBreaker;

module.exports = (fallbackFn) => {
   if (pmTriggerCircuitBreaker) return pmTriggerCircuitBreaker;

   pmTriggerCircuitBreaker = new CircuitBreaker(
      (req, jobData) =>
         new Promise((resolve, reject) => {
            console.log("Sending Process Request");
            req.serviceRequest("process_manager.trigger", jobData, (err) => {
               if (err) reject(err);
               else resolve();
            });
         }),
      options
   );
   pmTriggerCircuitBreaker.fallback(fallbackFn);

   // Debug Code
   let route = "Process Manager";
   pmTriggerCircuitBreaker.on("success", (result) =>
      console.log(`SUCCESS: ${JSON.stringify(result)}`)
   );

   pmTriggerCircuitBreaker.on("timeout", () =>
      console.log(`TIMEOUT: ${route} is taking too long to respond.`)
   );

   pmTriggerCircuitBreaker.on("reject", () =>
      console.log(`REJECTED: The breaker for ${route} is open. Failing fast.`)
   );

   pmTriggerCircuitBreaker.on("open", () =>
      console.log(`OPEN: The breaker for ${route} just opened.`)
   );

   pmTriggerCircuitBreaker.on("halfOpen", () =>
      console.log(`HALF_OPEN: The breaker for ${route} is half open.`)
   );

   pmTriggerCircuitBreaker.on("close", () =>
      console.log(`CLOSE: The breaker for ${route} has closed. Service OK.`)
   );

   return pmTriggerCircuitBreaker;
};
