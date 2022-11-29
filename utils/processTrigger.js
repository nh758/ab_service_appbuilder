// Ensures all processes get triggered exactly once. Will handle when process
// manager is offline, or overwhelmed.
const { v4: uuid } = require("uuid");
const pmTriggerRequester = require("./processTrigger/processTriggerCircuitBreaker.js");
const ProcessTriggerQueue = require("./processTrigger/processTriggerQueue.js");
const getTenants = require("../queries/getTenants.js");
const AB = require("ab-utils");

const processTriggerQueueCache = {};
/**
 * @const {object} processTriggerQueueCache - We only want one ProcessTriggerQueue instance per tenant
 */

/**
 * @function getProcessTriggerQueue
 * @desc get the ProcessTriggerQueue instance for a given tenant
 * @param {string} tenant tenant uuid
 * @return {ProcessTriggerQueue}
 */
async function getProcessTriggerQueue(tenant) {
   if (!processTriggerQueueCache[tenant]) {
      processTriggerQueueCache[tenant] = new ProcessTriggerQueue(
         tenant,
         pmTriggerRequester.fire
      );
      await processTriggerQueueCache[tenant].init();
   }
   return processTriggerQueueCache[tenant];
}

/**
 * @function initProcessTriggerQueues
 * @description reads our tentant list from DB then make sure each gets a
 * ProcessTriggerQueue instance.
 */
async function initProcessTriggerQueues() {
   const req = AB.reqApi({}, {}); // generic req for getTenants query
   const tenants = getTenants(req);
   const promises = [];
   tenants.forEach((tenant) => {
      promises.push(getProcessTriggerQueue(tenant.uuid));
   });
   await Promise.all(promises);
}

/**
 * @function saveToQueue
 * @desc will save the jobData to the relevant tenant's ProcessTriggerQueue
 * @param {ABReq}
 * @param {object} jobData for process_manager.trigger
 */
async function saveToQueue(req, jobData) {
   try {
      const queue = await getProcessTriggerQueue(req.tenant);
      await queue.add(req, jobData);
   } catch (err) {
      // Adding to the Queue failed too? then notify developers
      // handle this
   }
}

/**
 * @function registerProcessTrigger
 * @desc preforms a service request to process_manager.trigger, if that fails
 * add to their tenant's ProcessTriggerQueue to retry later.
 * @param {ABReq} req
 * @param {sring} key triggerKey normally <objectid>.add or .update/.delete
 * @param {object} data data to send to the process trigger
 */
async function registerProcessTrigger(req, key, data) {
   const jobData = {
      key,
      data,
      requestId: uuid(),
   };
   await pmTriggerRequester.fire(req, jobData);
}

// Exports are helpers that use the triggerQueue of the correct tenant
module.exports = {
   registerProcessTrigger,
   saveToQueue,
   initProcessTriggerQueues,
};
