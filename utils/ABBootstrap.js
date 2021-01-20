/*
 * ABBootstrap
 * This object manages preparing an ABFactory for a Specific Tenant.
 */
const path = require("path");
// prettier-ignore
const queryAllDefinitions = require(path.join(__dirname, "..", "queries", "allDefinitions"));
// {sql} queryAllDefinitions
// the sql query to load all the Definitions from a specific tenant.

// prettier-ignore
const Create = require(path.join(__dirname, "..", "queries", "definitionCreate"));
// prettier-ignore
const Destroy = require(path.join(__dirname, "..", "queries", "definitionDestroy"));
// prettier-ignore
const Find = require(path.join(__dirname, "..", "queries", "definitionFind"));
// prettier-ignore
const Update = require(path.join(__dirname, "..", "queries", "definitionUpdate"));

const ABFactory = require("../AppBuilder/ABFactory");

var Factories = {
   /* tenantID : { ABFactory }} */
};
// {hash}
// Sort out all known tenant aware factories by tenantID.

var DefinitionManager = {
   Create,
   Destroy,
   Find,
   Update,
};

module.exports = {
   init: (req) => {
      return new Promise((resolve, reject) => {
         var tenantID = req.tenantID();
         if (!tenantID) {
            var errorNoTenantID = new Error(
               "ABBootstrap.init(): could not resolve tenantID for request"
            );
            reject(errorNoTenantID);
            return;
         }

         Promise.resolve()
            .then(() => {
               // if we don't have any definitions for the given tenantID,
               // load them

               if (Factories[tenantID]) {
                  // Already there, so skip.
                  return;
               }

               return queryAllDefinitions(req).then((defs) => {
                  if (defs && Array.isArray(defs) && defs.length) {
                     var hashDefs = {};
                     defs.forEach((d) => {
                        hashDefs[d.id] = d;
                     });

                     var newFactory = new ABFactory(
                        hashDefs,
                        DefinitionManager,
                        req.toABFactoryReq()
                     );

                     // Reload our ABFactory whenever we detect any changes in
                     // our definitions.  This should result in correct operation
                     // even though changing definitions become an "expensive"
                     // operation. (but only for designers)
                     var resetOnEvents = [
                        "definition.created",
                        "definition.destroyed",
                        "definition.updated",
                     ];
                     resetOnEvents.forEach((event) => {
                        newFactory.on(event, () => {
                           delete Factories[tenantID];
                        });
                     });

                     Factories[tenantID] = newFactory;

                     return newFactory.init();
                  }
               });
            })
            .then(() => {
               // return the ABFactory for this tenantID
               resolve(Factories[tenantID]);
            })
            .catch(reject);
      });
   },
};
