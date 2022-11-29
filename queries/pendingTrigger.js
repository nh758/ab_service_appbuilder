function runQuery(req, sql) {
   return new Promise((resolve, reject) => {
      const tenantDB = req.tenantDB();
      if (tenantDB == "") {
         return reject(
            new Error(
               `Unable to find tenant information for tenantID[${req.tenantID()}]`
            )
         );
      }
      sql.replace("%tenantDB%", tenantDB);

      req.query(sql, [], (error, results /*, fields */) => {
         if (error) {
            req.log(sql);
            reject(error);
         } else {
            resolve(results);
         }
      });
   });
}

function create(req, { requestId, key, data }) {
   const sql = `INSERT INTO %tenantDB%.\`SITE_PENDING_TRIGGER\`(\`uuid\`, \`key\`, \`data\`) VALUES ('${requestId}', '${key}', '${data}')`;
   return runQuery(req, sql);
}

function remove(req, uuid) {
   const sql = `DELETE FROM %tenantDB%.\`SITE_PENDING_TRIGGER\` WHERE (\`uuid\` = ${uuid})`;
   return runQuery(req, sql);
}

function list(req) {
   const sql = `SELECT * FROM %tenantDB%.\`SITE_PENDING_TRIGGER\``;
   return runQuery(req, sql);
}

module.exports = { create, remove, list };
