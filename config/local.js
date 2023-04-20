/*
 * appbuilder
 */
module.exports = {
   appbuilder: {
      /*************************************************************************/
      /* enable: {bool} is this service active?                                */
      /*************************************************************************/
      enable:
         typeof process.env.APPBUILDER_ENABLE == "undefined"
            ? true
            : JSON.parse(process.env.APPBUILDER_ENABLE),
   },

   /**
    * datastores:
    * Sails style DB connection settings
    */
   datastores: {
      appbuilder: {
         adapter: "sails-mysql",
         host: process.env.MYSQL_HOST || "db",
         port: process.env.MYSQL_PORT || 3306,
         user: process.env.MYSQL_USER || "root",
         password: process.env.MYSQL_PASSWORD,
         database: process.env.MYSQL_DBPREFIX || "appbuilder",
      },
      site: {
         adapter: "sails-mysql",
         host: process.env.MYSQL_HOST || "db",
         port: process.env.MYSQL_PORT || 3306,
         user: process.env.MYSQL_USER || "root",
         password: process.env.MYSQL_PASSWORD,
         database: process.env.MYSQL_DBADMIN || "appbuilder-admin",
      },
   },
};
