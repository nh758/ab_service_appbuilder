/**
 * definitionsForRoles
 * our Request handler.
 */

const ABBootstrap = require("../AppBuilder/ABBootstrap");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "appbuilder.definitionsForRoles",

   /**
    * inputValidation
    * define the expected inputs to this service handler:
    * Format:
    * "parameterName" : {
    *    {joi.fn}   : {bool},  // performs: joi.{fn}();
    *    {joi.fn}   : {
    *       {joi.fn1} : true,   // performs: joi.{fn}().{fn1}();
    *       {joi.fn2} : { options } // performs: joi.{fn}().{fn2}({options})
    *    }
    *    // examples:
    *    "required" : {bool},  // default = false
    *
    *    // custom:
    *        "validation" : {fn} a function(value, {allValues hash}) that
    *                       returns { error:{null || {new Error("Error Message")} }, value: {normalize(value)}}
    * }
    */
   inputValidation: {
      roles: { array: true, required: true },
      // uuid: {
      //    required: true,
      //    string: {uuid:true},  // joi.string().uuid()
      //    validation: (val, allValues) => { return {err:{bool}, value:{val}} }
      // },
      // address: {
      //    string: { ip: { version: ["ipv4", "ipv6"], cidr: "required" } },
      //    // joi.string().ip({ version:... })
      // },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the api_sails/api/controllers/appbuilder/definitionsForRoles.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      //
      req.log("appbuilder.definitionsForRoles");
      // access your config settings if you need them:
      /*
      var config = req.config();
       */

      // Get the passed in parameters
      var roles = req.param("roles");

      req.log("-- roles: --", roles);

      ABBootstrap.init(req)
         .then((AB) => {
            var applications = AB.applications((a) =>
               a.isAccessibleForRoles(roles)
            );

            req.log(
               `appbuilder.definitionsForRoles: found ${applications.length} applications to export`
            );

            var ids = [];
            applications.forEach((a) => {
               a.exportIDs(ids);
            });

            req.log(
               `appbuilder.definitionsForRoles: found ${ids.length} ids to export.`
            );
            var definitions = [];
            ids.forEach((id) => {
               let def = AB.definitionByID(id, true);
               if (def) {
                  definitions.push(def);
               }
            });

            cb(null, definitions);
         })
         .catch((err) => {
            req.notify.developer(err, {
               context:
                  "Service:appbuilder.definitionsForRoles: Error initializing ABFactory",
               req,
            });
            cb(err);
         });
   },
};
