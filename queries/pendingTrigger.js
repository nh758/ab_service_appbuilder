function runQuery(req, sql) {
   return new Promise((resolve, reject) => {
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

function create(req, { requestId, key, data, user }) {
   const db = req.queryTenantDB();
   const sql = `INSERT INTO ${db}.\`SITE_PENDING_TRIGGER\` (\`uuid\`, \`created_at\`, \`updated_at\`, \`key\`, \`data\`, \`user\`) VALUES ('${requestId}', NOW(), NOW(), '${key}', '${JSON.stringify(
      data
   )}', '${JSON.stringify(user)}')`;
   return runQuery(req, sql);
}

function remove(req, uuid) {
   const db = req.queryTenantDB();
   const sql = `DELETE FROM ${db}.\`SITE_PENDING_TRIGGER\` WHERE (\`uuid\` = '${uuid}')`;
   return runQuery(req, sql);
}

function list(req) {
   const db = req.queryTenantDB();
   const sql = `SELECT * FROM ${db}.\`SITE_PENDING_TRIGGER\``;
   return runQuery(req, sql);
}

module.exports = { create, remove, list };
