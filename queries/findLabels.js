module.exports = function (req, keys) {
   return new Promise((resolve, reject) => {
      let tenantDB = req.tenantDB();
      if (tenantDB != "") {
         tenantDB += ".";
      } else {
         let errorNoTenant = new Error(
            `Unable to find tenant information for tenantID[${req.tenantID()}]`
         );
         reject(errorNoTenant);
         return;
      }

      let sql = `
SELECT * FROM ${tenantDB}\`site_multilingual_label\`
WHERE \`label_key\` IN ( ? )`;

      console.log("sql:", sql);
      console.log("keys:", keys);

      req.query(sql, [keys], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
};
