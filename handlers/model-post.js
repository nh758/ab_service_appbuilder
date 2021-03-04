/**
 * model-post
 * our Request handler.
 */

const ABBootstrap = require("../utils/ABBootstrap");
const Errors = require("../utils/Errors");

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
      return;
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
    *    "required" : {bool},  // default = false
    *    "validation" : {fn|obj},
    *                   {fn} a function(value) that returns true/false if
    *                        the value is valid.
    *                   {obj}: .type: {string} the data type
    *                                 [ "string", "uuid", "email", "number", ... ]
    * }
    */
   inputValidation: {
      objectID: { string: { uuid: true }, required: true },
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
               return Errors.missingObject(id, req, cb);
            }

            var values = req.param("values");

            // prevent "NULL" placeholders:
            (Object.keys(values) || []).forEach((k) => {
               if (values[k] === "NULL") {
                  values[k] = null;
               }
            });

            var condDefaults = {
               languageCode: req.languageCode(),
               username: req.username(),
            };

            tryCreate(object, values, condDefaults, req)
               .then((data) => {
                  console.log(data);
                  cb(null, data);
               })
               .catch((err) => {
                  err = Errors.repackageError(err);
                  req.log(err);
                  cb(err);
               });
         })
         .catch((err) => {
            req.log("ERROR:", err.toString());
            console.log(err);
            cb(Errors.repackageError(err));
         });
   },
};
