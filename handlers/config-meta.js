/**
 * config-meta
 * our Request handler.
 */

const ABBootstrap = require("../AppBuilder/ABBootstrap");
// {ABBootstrap}
// responsible for initializing and returning an {ABFactory} that will work
// with the current tenant for the incoming request.

// const cleanReturnData = require("../AppBuilder/utils/cleanReturnData");

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "appbuilder.config-meta",

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
    *    "required" : {bool},
    *    "optional" : {bool},
    *
    *    // custom:
    *        "validation" : {fn} a function(value, {allValues hash}) that
    *                       returns { error:{null || {new Error("Error Message")} }, value: {normalize(value)}}
    * }
    */
   inputValidation: {
      // uuid: { string: { uuid: true }, required: true },
      // email: { string: { email: true }, optional: true },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/appbuilder/config-meta.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      req.log("appbuilder.config-meta:");

      // get the AB for the current tenant
      ABBootstrap.init(req)
         .then((AB) => {
            var configMeta = {};
            var pRoles = req
               .retry(() => AB.objectRole().model().find({}, req))
               .then((roles) => {
                  configMeta.roles = roles || [];
               });

            var pScopes = req
               .retry(() => AB.objectScope().model().find({}, req))
               .then((scopes) => {
                  configMeta.scopes = scopes || [];
               });

            var SiteUser = AB.objectUser();
            var pUsers = req
               .retry(() => SiteUser.model().find({ isActive: 1 }, req))
               .then((users) => {
                  // return only a minimal set of user data
                  configMeta.users = (users || []).map((u) => {
                     return {
                        uuid: u.uuid,
                        isActive: u.isActive,
                        username: u.username,
                        languageCode: u.languageCode,
                     };
                  });

                  // // clear any .password / .salt from SiteUser objects
                  // return cleanReturnData(AB, SiteUser, users).then(() => {
                  //    configMeta.users = (users || []).map((u) => { isActive:u.isActive, username:u.username, languageCode:u.languageCode });
                  // });
               });

            Promise.all([pRoles, pScopes, pUsers])
               .then(() => {
                  cb(null, configMeta);
               })
               .catch((err) => {
                  req.notify.developer(err, {
                     context:
                        "Service:appbuilder.config-meta: Error gathering meta",
                  });
                  cb(err);
               });
         })
         .catch((err) => {
            req.notify.developer(err, {
               context:
                  "Service:appbuilder.config-meta: Error initializing ABFactory",
            });
            cb(err);
         });
   },
};
