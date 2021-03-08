// retryFind.js
const Errors = require("./Errors");

module.exports = function retryFind(
   object,
   cond,
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
   }

   return object
      .model()
      .findAll(cond, condDefaults, req)
      .catch((err) => {
         if (Errors.isRetryError(err.code)) {
            req.log(`LOOKS LIKE WE GOT A ${err.code}! ... trying again:`);
            return retryFind(object, cond, condDefaults, req, retry + 1, err);
         }

         // if we get here, this isn't a RESET, so propogate the error
         throw err;
      });
};
