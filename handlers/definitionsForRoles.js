/**
 * definitionsForRoles
 * our Request handler.
 */

const ABBootstrap = require("../utils/ABBootstrap");

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
    *    "required" : {bool},  // default = false
    *    "validation" : {fn|obj},
    *                   {fn} a function(value) that returns true/false if
    *                        the value is valid.
    *                   {obj}: .type: {string} the data type
    *                                 [ "string", "uuid", "email", "number", ... ]
    * }
    */
   inputValidation: {
      // uuid: {
      //    required: true,
      //    validation: { type: "uuid" }
      // }
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
               let def = AB.definitionForID(id, true);
               if (def) {
                  definitions.push(def);
               }
            });

            cb(null, definitions);
         })
         .catch((err) => {
            req.log("ERROR:", err);
            cb(err);
         });

      // access any Models you need
      /*
      var Model = req.model("Name");
       */

      /*
       * perform action here.
       *
       * when job is finished then:
      cb(null, { param: "value" });

       * or if error then:
      cb(err);

       * example:
      Model.find({ email })
         .then((list) => {
            cb(null, list);
         })
         .catch((err) => {
            cb(err);
         });

       */
   },
};
