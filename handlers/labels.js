/**
 * labels
 * our Request handler.
 */

var Labels = require("../AppBuilder/core/labels/labels");
// {obj}
// the key:label hash of the standard UI labels for our AppBuilder
// labels.
// The base hash divides the labels into their {language_code} parts,
// and returns those when requested.

function getLabels(langCode) {
   return new Promise((resolve, reject) => {
      if (!Labels[langCode]) {
         var error = new Error(
            `No label definitions for language_code=[${langCode}]`
         );
         reject(error);
         return;
      }
      resolve(Labels[langCode] || {});
   });
}

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "appbuilder.labels",

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
      languageCode: {
         required: true,
         validation: { type: "string" },
      },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the api_sails/api/controllers/appbuilder/labels.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      //
      req.log("appbuilder.labels");

      var langCode = req.param("languageCode");

      getLabels(langCode)
         .then((labels) => {
            cb(null, labels);
         })
         .catch((error) => {
            req.log(
               `Error retrieving Labels for languageCode[${langCode}] : ${error.toString()}.`
            );
            cb(error);
         });
   },
};
