const searchDupEntries = /Duplicate entry '(.+)' for key '(.+)'/;
const searchInsertTableName = /insert into `*.*`*\.*`(.*)` \(/;

module.exports = {
   isRetryError: (code) => {
      /*
ab_appbuilder         :  Error: connect ETIMEDOUT
ab_appbuilder         :    errorno: 'ETIMEDOUT',
ab_appbuilder         :    code: 'ETIMEDOUT',
ab_appbuilder         :    syscall: 'connect',
ab_appbuilder         :    fatal: true
ab_appbuilder         :  }
*/

      /*
ab_appbuilder         :  Error: read ECONNRESET
ab_appbuilder         :    errno: -104,
ab_appbuilder         :    code: 'ECONNRESET',
ab_appbuilder         :    syscall: 'read',
ab_appbuilder         :    fatal: true
ab_appbuilder         :  }
*/

      return ["ECONNRESET", "ETIMEDOUT"].indexOf(code) != -1;
   },
   missingObject: (id, req, cb) => {
      req.log(`Error:unknown object [${id}].`);
      var err = new Error(`Unknown Object`);
      err.code = "ENOTFOUND";
      cb(err);
   },
   repackageError: (err) => {
      var newErr = {};
      // {obj} newErr
      // the formatted Error we will send back to the client

      var errorCode = null;
      // {string}
      // the provided err.code,  or an "Exxxxx" code we find in the message.

      var commonSQLErrorFields = [
         "code",
         "errno",
         "sqlMessage",
         "sqlState",
         "index",
         "sql",
      ];

      var expectedErrorCases = [
         "ER_DUP_ENTRY",
         // code: 'ER_DUP_ENTRY',
         // errno: 1062,
         // sqlMessage: "Duplicate entry 'skipper' for key 'site_user_username'",
         // sqlState: '23000',
         // index: 0,
         // sql: "insert into `appbuilder-admin`.`site_user` (`created_at`, `email`, `image_id`, `isActive`, `languageCode`, `password`, `salt`, `sendEmailNotifications`, `updated_at`, `username`, `uuid`) values ('2021-01-22 21:30:53', 'diff@email.com', '', true, 'ko', 'p2', NULL, false, '2021-01-22 21:30:53', 'skipper', '97c7d7ab-ffb3-4f87-883e-db5786e3a20b')"
      ];

      // if err has an embedded nativeError, then use that:
      err = err.nativeError || err;

      // attempt to pull forward expected fields:
      commonSQLErrorFields.forEach((f) => {
         if (err[f]) {
            newErr[f] = err[f];
         }
      });
      newErr.message = err.message;

      if (err.code) {
         errorCode = err.code;
      } else {
         var strErr = err.toString();
         expectedErrorCases.forEach((ecode) => {
            if (!errorCode && strErr.indexOf(ecode) > -1) {
               errorCode = ecode;
            }
         });
      }

      switch (errorCode) {
         case "ER_DUP_ENTRY":
            // our UI error handler is expecting a:
            // {
            //    invalidAttributes: {
            //       "field" : { message: "error message" }
            //    }
            // }
            var message = newErr.sqlMessage || newErr.message;
            var matchFields = message.match(searchDupEntries);
            // console.log(matchFields);
            var fieldKey = matchFields[2];
            // console.log("FieldKey:", fieldKey);

            var sql = newErr.sql || newErr.message;
            var matchTable = sql.match(searchInsertTableName);
            // console.log(matchTable);
            var table = matchTable[1];
            // console.log("Table:", table);
            fieldKey = fieldKey.replace(`${table}_`, "");
            newErr.invalidAttributes = newErr.invalidAttributes || {};
            newErr.invalidAttributes[fieldKey] = { message: "Duplicate Entry" };
            break;
      }

      return newErr;
   },
};
