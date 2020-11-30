//
// appbuilder
// (AppBuilder) A multi-tenant award service to process our AppBuilder requests.
//
const AB = require("ab-utils");

var controller = AB.controller("appbuilder");
// controller.afterStartup((cb)=>{ return cb(/* err */) });
// controller.beforeShutdown((cb)=>{ return cb(/* err */) });
controller.init();
