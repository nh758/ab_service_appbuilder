const FilterComplex = require("../AppBuilder/platform/FilterComplex");

function isDataValid(AB, scope, currentObject, data) {
   const filter_helper = new FilterComplex(null, AB);
   filter_helper.fieldsLoad(currentObject.fields(), currentObject);
   filter_helper.setValue(scope?.Filters);

   return (
      (scope.objectIds ?? []).filter((objId) => objId == currentObject.id)
         .length &&
      scope.Filters?.rules?.length &&
      filter_helper.isValid(data)
   );
}

/**
 * @function getRightRoles()
 * @param {ABFactory} AB
 *			 the current ABFactory for the data in this tenant's request.
 * @param {ABObject} currentObject
 *			 the base ABObject this data is representing.
 * @param {Object} data
 * @return {Promise}
 */
module.exports = async function (AB, currentObject, data) {
   let roles = [];
   const scopes = await AB.objectScope()
      .model()
      .find({
         where: {},
         populate: ["roles"],
      });

   scopes.forEach((s) => {
      if (s.allowAll || isDataValid(AB, s, currentObject, data)) {
         const scopeRoles = s.roles__relation ?? s.roles ?? [];

         // add the role info to the result list
         scopeRoles.forEach((role) => {
            if (roles.filter((r) => r.id == role.id).length < 1)
               roles.push(role);
         });
      }
   });

   return roles;
};
