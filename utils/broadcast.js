const getRightRoles = require("./getRightRoles.js");

async function prepareBroadcast({ AB, req, object, data, dataId, event }) {
   const rooms = [];
   const roles = await getRightRoles(AB, object, data);
   // const roles = [];
   // const checkScope = (/*role, record*/) => true;
   roles.forEach((role) => {
      // does the role have access?
      // const hasAccess = checkScope(role, data);
      // if (!hasAccess) return;
      const roomKey = `${object.id}-${role.uuid}`;
      rooms.push(req.socketKey(roomKey));
   });
   return {
      room: rooms,
      event,
      data: {
         objectId: object.id,
         data: data ?? dataId,
      },
   };
}
module.exports = { prepareBroadcast };
