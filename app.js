//
// appbuilder
// (AppBuilder) A multi-tenant award service to process our AppBuilder requests.
//
const AB = require("ab-utils");
const { initProcessTriggerQueues } = require("./utils/processTrigger.js");

var controller = AB.controller("appbuilder");
controller.afterStartup(async (cb) => {
   try {
      await initProcessTriggerQueues();
      return cb();
   } catch (err) {
      cb(err);
   }
});
// controller.beforeShutdown((cb)=>{ return cb(/* err */) });
controller.init();
