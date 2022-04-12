/**
 * csv-export
 * our Request handler.
 */

const ABBootstrap = require("../AppBuilder/ABBootstrap");
// {ABBootstrap}
// responsible for initializing and returning an {ABFactory} that will work
// with the current tenant for the incoming request.

module.exports = {
   /**
    * Key: the cote message key we respond to.
    */
   key: "appbuilder.csv-export",

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
      viewID: { string: true, required: true },
      where: { object: true, optional: true },
   },

   /**
    * fn
    * our Request handler.
    * @param {obj} req
    *        the request object sent by the
    *        api_sails/api/controllers/appbuilder/csv-export.
    * @param {fn} cb
    *        a node style callback(err, results) to send data when job is finished
    */
   fn: function handler(req, cb) {
      req.log("appbuilder.csv-export:");

      // get the AB for the current tenant
      ABBootstrap.init(req)
         .then((AB) => {
            // get the definitionForID
            let viewID = req.param("viewID");
            let defCSV = AB.definitionByID(viewID);
            if (!defCSV) {
               let err = new Error(`Unknown view id [${viewID}]`);
               cb(err);
               return;
            }

            var userData = {
               languageCode: req.languageCode(),
               username: req.username(),
            };

            let where = req.param("where") ?? {};

            let dc = AB.definitionByID(defCSV.settings.dataviewID);
            if (!dc) {
               let err = new Error(
                  `Unknown dc id [${defCSV.settings.dataviewID}]`
               );
               cb(err);
               return;
            }

            let obj = AB.objectByID(dc.settings.datasourceID);
            if (!obj) {
               let err = new Error(
                  `Unknown dc id [${dc.settings.datasourceID}]`
               );
               cb(err);
               return;
            }

            getSQL(
               AB,
               {
                  hasHeader: defCSV.settings.hasHeader,
                  dc,
                  obj,
                  userData,
                  extraWhere: where,
               },
               req
            ).then((SQL) => {
               cb(null, {
                  SQL,
                  obj: obj.toObj(),
                  def: dc,
                  userData: userData,
                  where,
               });
            });

            //
         })
         .catch((err) => {
            req.notify.developer(err, {
               context:
                  "Service:appbuilder.csv-export: Error initializing ABFactory",
            });
            cb(err);
         });
   },
};

let getSQL = (AB, { hasHeader, dc, obj, userData, extraWhere }, req) => {
   let where = {
      glue: "and",
      rules: [],
   };
   let sort;

   if (
      obj instanceof AB.Class.ABObjectQuery &&
      obj.where &&
      obj.where.rules &&
      obj.where.rules.length
   ) {
      where.rules.push(obj.where);
   }

   if (dc.settings) {
      if (
         dc.settings.objectWorkspace &&
         dc.settings.objectWorkspace.filterConditions
      )
         where.rules.push(dc.settings.objectWorkspace.filterConditions);

      if (dc.settings.objectWorkspace && dc.settings.objectWorkspace.sortFields)
         sort = dc.settings.objectWorkspace.sortFields;
   }

   if (extraWhere) {
      where.rules.push(extraWhere);
   }

   // TODO: Filter cursor of parent DC
   // {
   //    alias: fieldLink.alias, // ABObjectQuery
   //    key: Object.keys(params)[0],
   //    rule: fieldLink.alias ? "contains" : "equals", // NOTE: If object is query, then use "contains" because ABOBjectQuery return JSON
   //    value: fieldLink.getRelationValue(
   //       dataCollectionLink.__dataCollection.getItem(
   //          value
   //       )
   //    )
   // }

   let knex = obj.model().modelKnex();
   let options = {
      where: where,
      sort: sort,
      populate: true,
   };

   let query;
   if (obj instanceof AB.Class.ABObjectQuery) {
      query = knex.queryBuilder();
      query.from(obj.dbViewName());
   } else {
      query = knex.query();
   }

   return (
      Promise.resolve()
         // update the .where condition to be ready for the SQL
         .then(() => obj.reduceConditions(options.where, userData, req))
         // Write SQL command
         .then(() => {
            let SQL;

            // Clear SELECT fields
            if (query.eager) query = query.eager("");
            if (query.clearEager) query = query.clearEager();
            query = query.clearSelect();

            // Convert display data to CSV file
            obj.fields().forEach((f) => {
               let select;
               let columnName = f.columnName;
               if (f.alias) columnName = `${f.alias}.${columnName}`;

               switch (f.key) {
                  case "user":
                  case "connectObject":
                     // 1:M, 1:1 (isSource = true)
                     if (
                        f.settings.linkType == "one" &&
                        f.settings.linkViaType == "many"
                     ) {
                        select = `\`${columnName}\``;
                     }
                     // M:1, 1:1 (isSource = false)
                     else if (
                        f.settings.linkType == "many" &&
                        f.settings.linkViaType == "one"
                     ) {
                        let objLink = f.datasourceLink;
                        let fieldLink = f.fieldLink;
                        if (objLink && fieldLink) {
                           let sourceColumnName = f.indexField
                              ? f.indexField.columnName
                              : "uuid";
                           select = `(SELECT GROUP_CONCAT(\`uuid\` SEPARATOR ' & ') FROM \`${objLink.tableName}\` WHERE \`${fieldLink.columnName}\` = \`${obj.tableName}\`.\`${sourceColumnName}\`)`;
                        }
                     }
                     // M:N
                     else if (
                        f.settings.linkType == "many" &&
                        f.settings.linkViaType == "many"
                     ) {
                        let joinTablename = f.joinTableName();
                        let joinColumnNames = f.joinColumnNames();
                        select = `(SELECT GROUP_CONCAT(\`${joinColumnNames.targetColumnName}\` SEPARATOR ' & ') FROM \`${joinTablename}\` WHERE \`${joinColumnNames.sourceColumnName}\` = \`uuid\`)`;
                     }

                     break;
                  case "formula":
                     select = obj.convertFormulaField(f);
                     break;
                  case "calculate":
                  case "TextFormula":
                     // TODO
                     select = null;
                     break;
                  case "list":
                     select = `
                        CASE
                           ${(f.settings.options || [])
                              .map((opt) => {
                                 return `WHEN \`${columnName}\` = "${opt.id}" THEN "${opt.text}"`;
                              })
                              .join(" ")}
                           ELSE ""
                        END
                     `;
                     break;
                  case "string":
                  case "LongText":
                     if (f.isMultilingual) {
                        let transCol = (obj instanceof AB.Class.ABObjectQuery
                           ? "`{prefix}.translations`"
                           : "{prefix}.translations"
                        ).replace("{prefix}", f.dbPrefix().replace(/`/g, ""));

                        let languageCode =
                           (userData || {}).languageCode || "en";

                        select = knex.raw(
                           'JSON_UNQUOTE(JSON_EXTRACT(JSON_EXTRACT({transCol}, SUBSTRING(JSON_UNQUOTE(JSON_SEARCH({transCol}, "one", "{languageCode}")), 1, 4)), \'$."{columnName}"\'))'
                              .replace(/{transCol}/g, transCol)
                              .replace(/{languageCode}/g, languageCode)
                              .replace(/{columnName}/g, f.columnName)
                        );
                     } else {
                        select = `IFNULL(\`${columnName}\`, '')`;
                     }
                     break;
                  // case "user":
                  //    if (f.settings.isMultiple) {
                  //       select = `JSON_EXTRACT(\`${columnName}\`, "$[*].text")`;
                  //       select = `REPLACE(${select}, '"', "'")`;
                  //       select = `REPLACE(${select}, '[', "")`;
                  //       select = `REPLACE(${select}, ']', "")`;
                  //       select = `IFNULL(${select}, '')`;
                  //       select = knex.raw(select);
                  //    } else {
                  //       select = `IFNULL(\`${columnName}\`, '')`;
                  //    }
                  //    break;
                  default:
                     select = `IFNULL(\`${columnName}\`, '')`;
                     break;
               }

               if (select) query.select(knex.raw(select));
            });

            // Header at the first line
            let SQLHeader = "";
            if (hasHeader == true) {
               // SELECT "One", "Two", "Three", "Four", "Five", "Six" UNION ALL
               SQLHeader = `SELECT ${obj
                  // TODO: fix .calculate and .TextFormula fields
                  .fields((f) => f.key != "calculate" && f.key != "TextFormula")
                  .map((f) => `"${f.label}"`)
                  .join(",")} UNION ALL`;
            }

            try {
               // SQL = `${SQLHeader} ${query.toString()}
               SQL = `${SQLHeader} ${query.toString()}`;
            } catch (e) {}

            return Promise.resolve(SQL);
         })
      // Execute Mysql to Generate CSV file
      // .then((SQL) => Promise.resolve(() => knex.raw(SQL)))
   );
};
