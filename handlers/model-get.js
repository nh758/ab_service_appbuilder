/**
 * model-get
 * Handle any operations where an Object is trying to retrive a value[s] it is
 * responsible for.
 */

const ABBootstrap = require("../utils/ABBootstrap");
const Errors = require("../utils/Errors");

/**
 * tryFind()
 * we wrap our actual find actions in this tryFind() routine.  Mostly so that
 * if we encounter an Error that would just be a simple: retry, we can do that
 * easily. (looking at you ECONNRESET errors).
 * @param {ABObject} object
 *       the ABObject that we are using to perform the findAll()s
 * @param {obj} cond
 *       the condition object for the findAll() where conditions.
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
 *       .resolve() with the [{data}] entries from the findAll();
 */
function tryFind(object, cond, condDefaults, req, retry = 0, lastError = null) {
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

   var pFindAll = object.model().findAll(cond, condDefaults, req);

   var pCount = Promise.resolve().then(() => {
      // if no cond.limit was set, then return the length pFindAll
      if (!cond.limit) {
         // return the length of pFindAll
         return pFindAll.then((results) => results.length);
      } else {
         return object.model().findCount(cond, condDefaults, req);
      }
   });

   return Promise.all([pFindAll, pCount]).catch((err) => {
      if (Errors.isRetryError(err.code)) {
         req.log(`LOOKS LIKE WE GOT A ${err.code}! ... trying again:`);
         return tryFind(object, cond, condDefaults, req, retry + 1, err);
      }

      // if we get here, this isn't a RESET, so propogate the error
      throw err;
   });
}

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "appbuilder.model-get",

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
      objectID: { string: true, required: true },
      /*    "email": { string:{ email: { allowUnicode: true }}, required:true }   */
      /*                -> NOTE: put .string  before .required                    */
      /*    "param": { required: true } // NOTE: param Joi.any().required();      */
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the api_sails/api/controllers/appbuilder/model-get.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      req.log("appbuilder.model-get:");

      // get the AB for the current tenant
      ABBootstrap.init(req)
         .then((AB) => {
            var id = req.param("objectID");
            var object = AB.objectByID(id);
            if (!object) {
               object = AB.queryByID(id);
            }
            if (!object) {
               return Errors.missingObject(id, req, cb);
            }

            var cond = req.param("cond");
            // var fields = ["where", "sort", "offset", "limit", "populate"];
            // fields.forEach((f) => {
            //    var val = req.param(f);
            //    if (val) {
            //       cond[f] = val;
            //    }
            // });

            var condDefaults = {
               languageCode: req.languageCode(),
               username: req.username(),
            };

            req.log(JSON.stringify(cond));
            req.log(JSON.stringify(condDefaults));

            // 1) make sure any incoming cond.where values are in our QB
            // format.  Like sails conditions, old filterConditions, etc...
            object.convertToQueryBuilderConditions(cond);

            // 2) make sure any given conditions also include the User's
            // scopes.
            // TODO:
            // object.includeScopes(cond, condDefaults) .then()

            // 3) now Take all the conditions and reduce them to their final
            // useable form: no complex in_query, contains_user, etc...
            object
               .reduceConditions(cond.where, condDefaults)
               .then(() => {
                  req.log(`reduced where: ${JSON.stringify(cond.where)}`);
                  // 4) Perform the Find Operations
                  tryFind(object, cond, condDefaults, req)
                     .then((results) => {
                        // {array} results
                        // results[0] : {array} the results of the .findAll()
                        // results[1] : {int} the results of the .findCount()

                        var result = {};
                        result.data = results[0];

                        // webix pagination format:
                        result.total_count = results[1];
                        result.pos = cond.offset || 0;

                        result.offset = cond.offset || 0;
                        result.limit = cond.limit || 0;

                        if (
                           result.offset + result.data.length <
                           result.total_count
                        ) {
                           result.offset_next = result.offset + result.limit;
                        }
                        cb(null, result);
                     })
                     .catch((err) => {
                        req.logError("IN tryFind().catch() handler:", err);
                        cb(err);
                     });
               })
               .catch((err) => {
                  req.logError("ERROR reducing conditions:", err);
                  cb(err);
               });
         })
         .catch((err) => {
            req.logError("ERROR:", err);
            cb(err);
         });

      /*

newPendingTransaction();
      AppBuilder.routes
         .verifyAndReturnObject(req, res)
         .then(function(object) {
            // verify that the request is from a socket not a normal HTTP
            if (req.isSocket) {
               // Subscribe socket to a room with the name of the object's ID
               sails.sockets.join(req, object.id);
            }

            var where = req.options._where;
            var whereCount = _.cloneDeep(req.options._where); // ABObject.populateFindConditions changes values of this object
            var sort = req.options._sort;
            var offset = req.options._offset;
            var limit = req.options._limit;

            var populate = req.options._populate;
            if (populate == null) populate = true;

            // promise for the total count. this was moved below the filters because webix will get caught in an infinte loop of queries if you don't pass the right count
            var pCount = object.queryCount(
               { where: whereCount, populate: false },
               req.user.data
            );

            var query = object.queryFind(
               {
                  where: where,
                  sort: sort,
                  offset: offset,
                  limit: limit,
                  populate: populate
               },
               req.user.data
            );

            // TODO:: we need to refactor to remove Promise.all so we no longer have Promise within Promises.
            Promise.all([pCount, query])
               .then(function(queries) {
                  Promise.all([queries[0], queries[1]])
                     .then(function(values) {
                        var result = {};
                        var count = values[0].count;
                        var rows = values[1];

                        result.data = rows;

                        // webix pagination format:
                        result.total_count = count;
                        result.pos = offset;

                        result.offset = offset;
                        result.limit = limit;

                        if (offset + rows.length < count) {
                           result.offset_next = offset + limit;
                        }

                        //// TODO: evaluate if we really need to do this:
                        //// ?) do we have a data field that actually needs to post process it's data
                        ////    before returning it to the client?

                        // object.postGet(result.data)
                        // .then(()=>{

                        resolvePendingTransaction();
                        if (res.header)
                           res.header("Content-type", "application/json");

                        res.send(result, 200);

                        // })
                     })
                     .catch((err) => {
                        resolvePendingTransaction();
                        console.log(err);
                        res.AD.error(err);
                     });
               })
               .catch((err) => {
                  resolvePendingTransaction();
                  console.log(err);
                  res.AD.error(err);
               });
         })
         .catch((err) => {
            resolvePendingTransaction();
            ADCore.error.log(
               "AppBuilder:ABModelController:find(): find() did not complete",
               { error: err }
            );
            if (!err) {
               err = new Error(
                  "AppBuilder:ABModelController:find(): find() did not complete. No Error Provided."
               );
            }
            res.AD.error(err, err.HTTPCode || 400);
         });

      */
   },
};
