/**
 * model-post
 * our Request handler.
 */
const async = require("async");
const ABBootstrap = require("../AppBuilder/ABBootstrap");
const Errors = require("../utils/Errors");
const UpdateConnectedFields = require("../utils/broadcastUpdateConnectedFields.js");

/**
 * tryCreate()
 * we wrap our actual find actions in this tryCreate() routine.  Mostly so that
 * if we encounter an Error that would just be a simple: retry, we can do that
 * easily. (looking at you ECONNRESET errors).
 * @param {ABObject} object
 *       the ABObject that we are using to perform the create()s
 * @param {obj} values
 *       the key=>value hash of new values to create
 * @param {obj} condDefaults
 *       our findAll() requires some default info about the USER
 * @param {ABUtil.request} req
 *       the request instance that handles requests for the current tenant
 * @param {int} retry
 *       a count of how many retry attempts.
 * @param {Error} lastError
 *       the last Error reported in trying to make the findAll().
 *       this is what is passed on if we have too many retries.
 * @return {Promise}
 *       .resolve() with the {data} entries from the findAll();
 */
function tryCreate(
   object,
   values,
   condDefaults,
   req,
   retry = 0,
   lastError = null
) {
   // prevent too many retries
   if (retry >= 3) {
      req.log("Too Many Retries ... failing.");
      if (lastError) {
         throw lastError;
      } else {
         throw new Error("Too Many failed Retries.");
      }
      // return;
   }

   return object
      .model()
      .create(values, null, condDefaults, req)
      .catch((err) => {
         console.log("IN tryCreate().object.create().catch() handler:");
         console.error(err);

         if (Errors.isRetryError(err.code)) {
            req.log(`LOOKS LIKE WE GOT A ${err.code}! ... trying again:`);
            return tryCreate(object, values, condDefaults, req, retry + 1, err);
         }

         // if we get here, this isn't a RETRY instance, so propogate the error
         throw err;
      });
}

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "appbuilder.model-post",

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
      objectID: { string: { uuid: true }, required: true },
      values: { object: true, required: true },
      // uuid: {
      //    required: true,
      //    validation: { type: "uuid" }
      // }
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the api_sails/api/controllers/appbuilder/model-post.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      // get the AB for the current tenant
      ABBootstrap.init(req)
         .then((AB) => {
            var id = req.param("objectID");
            var object = AB.objectByID(id);
            if (!object) {
               // NOTE: this ends the service call
               return Errors.missingObject(id, req, cb);
            }

            var values = req.param("values");

            // prevent "NULL" placeholders:
            (Object.keys(values) || []).forEach((k) => {
               if (values[k] === "NULL") {
                  values[k] = null;
               }
            });

            var condDefaults = req.userDefaults();

            var newRow = null;
            async.series(
               {
                  // 1) Perform the Initial Create of the data
                  create: (done) => {
                     tryCreate(object, values, condDefaults, req)
                        .then((data) => {
                           newRow = data;

                           // So let's end the service call here, then proceed
                           // with the rest
                           cb(null, data);

                           // proceed with the process
                           done(null, data);
                        })
                        .catch((err) => {
                           if (err) {
                              err = Errors.repackageError(err);
                           }
                           req.log(err);
                           cb(err);
                           // make sure this process ends too
                           done(err);
                        });
                  },

                  // 2) perform the lifecycle handlers.
                  postHandlers: (done) => {
                     // These can be performed in parallel
                     async.parallel(
                        {
                           // broadcast our .create to all connected web clients
                           broadcast: (next) => {
                              req.performance.mark("broadcast");
                              req.broadcast(
                                 [
                                    {
                                       room: req.socketKey(object.id),
                                       event: "ab.datacollection.create",
                                       data: {
                                          objectId: object.id,
                                          data: newRow,
                                       },
                                    },
                                 ],
                                 (err) => {
                                    req.performance.measure("broadcast");
                                    next(err);
                                 }
                              );
                           },
                           // log the create for this new row of data
                           logger: (next) => {
                              req.serviceRequest(
                                 "log_manager.rowlog-create",
                                 {
                                    username: condDefaults.username,
                                    record: newRow,
                                    level: "insert",
                                    row: newRow.uuid,
                                    object: object.id,
                                 },
                                 (err) => {
                                    next(err);
                                 }
                              );
                           },
                           trigger: (next) => {
                              req.serviceRequest(
                                 "process_manager.trigger",
                                 {
                                    key: `${object.id}.added`,
                                    data: newRow,
                                 },
                                 (err) => {
                                    next(err);
                                 }
                              );
                           },

                           // Alert our Clients of changed data:
                           // A newly created entry, might update the connected data in other
                           // object values.  This will make sure those entries are pushed up
                           // to the web clients.
                           staleUpates: (next) => {
                              req.performance.mark("stale.update");
                              UpdateConnectedFields(
                                 AB,
                                 req,
                                 object,
                                 null,
                                 newRow,
                                 condDefaults
                              )
                                 .then(() => {
                                    req.performance.measure("stale.update");
                                    next();
                                 })
                                 .catch((err) => {
                                    next(err);
                                 });
                           },
                        },
                        (err) => {
                           ////
                           //// errors here need to be alerted to our Developers:
                           ////
                           if (err) {
                              req.notify.developer(err, {
                                 context: "model-post::postHandlers",
                                 objectID: id,
                                 condDefaults,
                                 newRow,
                              });
                           }
                           req.performance.log([
                              "broadcast",
                              "log_manager.rowlog-create",
                              "stale.update",
                           ]);
                           done(err);
                        }
                     );
                  },
               },
               (/* err, results */) => {
                  // errors at this point should have already been processed
                  // if (err) {
                  //    err = Errors.repackageError(err);
                  //    req.log(err);
                  //    cb(err);
                  //    return;
                  // }
               }
            );
         })
         .catch((err) => {
            req.log("ERROR:", err.toString());
            cb(Errors.repackageError(err));
         });
   },
};
