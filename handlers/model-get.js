/**
 * model-get
 * our Request handler.
 */

const ABBootstrap = require("../utils/ABBootstrap");

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
      //

      // access your config settings if you need them:
      /*
      var config = req.config();
       */

      // Get the passed in parameters
      /*
      var email = req.param("email");
       */

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

      ABBootstrap.init(req)
         .then((AB) => {
            var id = req.param("objectID");
            var object = AB.objectByID(id);
            if (!object) {
               // NOT FOUND error:
               req.log(`Error:unknown object [${objectID}].`);
               err = new Error(`Unknown Object`);
               err.code = "ENOTFOUND";
               cb(err);
               return;
            }

            var cond = {};
            var fields = ["where", "sort", "offset", "limit"];
            fields.forEach((f) => {
               var val = req.param(f);
               if (val) {
                  cond[f] = val;
               }
            });

            var condDefaults = {
               languageCode: req.languageCode(),
               username: req.username(),
            };

            // IMPROVEMENTS:
            // query User's Scope's for this Object & return an ID IN [...] condition
            //    that is added to the incoming condition.
            //
            // pre adjust cond before making these two queries
            //
            // figure out if pCount needs a specific query to find All matches
            //     or if the .length of the pFindAll can be used.
            //
            // object.model().findCount(cond, condDefaults, req);
            //
            var pFindAll = object.model().findAll(cond, condDefaults, req);

            var pCount = Promise.resolve().then(() => {
               // return the length of pFindAll
               return pFindAll.then((results) => results.length);
            });

            Promise.all([pFindAll, pCount])
               .then((results) => {
                  // {array} results
                  // results[0] : {array} the results of the .findAll()
                  // results[1] : {int} the results of the .count()

                  var result = {};
                  result.data = results[0];

                  // webix pagination format:
                  result.total_count = results[1];
                  result.pos = cond.offset || 0;

                  result.offset = cond.offset || 0;
                  result.limit = cond.limit || 0;

                  if (result.offset + result.data.length < result.total_count) {
                     result.offset_next = result.offset + result.limit;
                  }
                  cb(null, result);
               })
               .catch((err) => {
                  console.log("IN Promise.all().catch() handler:");
                  // TODO: if ECONNRESET error: just try again:
                  console.error(err);
               });
         })
         .catch((err) => {
            req.log("ERROR:", err);
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
