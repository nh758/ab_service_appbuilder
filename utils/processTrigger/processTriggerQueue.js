/**
 * @class ProcessTriggerQueue
 * @desc manages the unconfirmed porcess triggers for an individul tenant
 */
const pendingTriggerTable = require("../../queries/pendingTrigger.js");
const AB = require("ab-utils");

module.exports = class ProcessTriggerQueue {
   /**
    * @constructor
    * @param {function} requestFn function that makes the process_manager.trigger request
    */
   constructor(tenant, requestFn) {
      this.Queue = {};
      this.tenant = tenant;
      this.request = requestFn;
   }

   /**
    * @method init
    * @desc loads the pending triggers from the database
    */
   async init() {
      const pendingTriggers = await pendingTriggerTable.list();
      pendingTriggers.forEach((row) => {
         this.Queue[row.uuid] = row;
      });
      this._retryInterval = setInterval(this.retryQueued, 10000);
   }

   /**
    * @method add
    * @desc add a process trigger request to the queue to be retried later
    * @param {ABReq} req
    * @param {object} jobData detatils about the trigger as expected by process_manager.trigger
    */
   async add(req, jobData) {
      const uuid = jobData.requestId;
      if (this.Queue[uuid]) return; //already queued
      this.Queue[uuid] = jobData;
      await pendingTriggerTable.create(req, jobData);
      return;
   }

   /**
    * @method remove
    * @desc remove a process trigger request from the queue
    * @param {ABReq} req
    * @param {string} uuid trigger uuid
    */
   async remove(req, uuid) {
      // If it not in the Queue it completed successfully the first time (no
      // action required)
      if (!this.Queue[uuid]) return;
      await pendingTriggerTable.remove(req, uuid);
      delete this.Queue[uuid];
      return;
   }

   retryQueued() {
      const req = AB.reqApi({}, {}); // Create a generic request for this tenant
      req.tenantID(this.tenant);
      for (let uuid in this.Queue) {
         this.request(req, this.Queue[uuid]).then(() => this.remove(req, uuid));
      }
   }
};
