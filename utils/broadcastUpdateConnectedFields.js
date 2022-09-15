// broadcastUpdateConnectedFields.js
// var RetryFind = require("./RetryFind.js");
const { prepareBroadcast } = require("./broadcast.js");

function pullFieldsFromEntry(items, entry, relationName) {
   if (entry) {
      // Get all the values of the linked field from the oldItem
      var eItems = entry[relationName] || [];
      if (!Array.isArray(eItems)) {
         eItems = [eItems];
      }

      eItems.forEach((i) => {
         if (i) {
            items.push(i);
         }
      });
   }
}

module.exports = function updateConnectedFields(
   AB,
   req,
   object,
   oldItem,
   newItem,
   condDefaults
) {
   const lookups = [];
   // {array[Promise]}
   // all the object.finds() we are waiting to complete.

   const packets = [];
   // {array}
   // this will be a compilation of all the broadcast packets to send.

   // Check to see if the object has any connected fields that need to be updated
   const connectFields = object.connectFields();

   // Parse through the connected fields
   connectFields.forEach((f) => {
      // Get the field object that the field is linked to
      var field = f.fieldLink;
      if (!field) {
         // already notified.
         return;
      }

      // Get the relation name so we can separate the linked fields updates
      // from the rest
      var relationName = f.relationName();

      let items = [];

      pullFieldsFromEntry(items, oldItem, relationName);
      pullFieldsFromEntry(items, newItem, relationName);

      // If there was only one it is not returned as an array so lets put it in
      // an array to normalize
      if (!Array.isArray(items)) {
         items = [items];
      }

      // skip if no items
      if (items.length == 0) {
         return;
      }

      var IDs = [];
      var PK = field.object.PK();

      items.forEach((i) => {
         IDs.push(i[PK]);
      });

      // filter array to only show unique items
      IDs = AB.uniq(IDs);

      // Now Perform Our Lookup to get the updated information
      lookups.push(
         req
            .retry(() =>
               field.object.model().findAll(
                  {
                     where: {
                        glue: "and",
                        rules: [
                           {
                              key: PK,
                              rule: "in",
                              value: IDs,
                           },
                        ],
                     },
                     populate: true,
                  },
                  condDefaults,
                  req
               )
            )
            .then((data) => {
               (data || []).forEach((d) => {
                  const packet = prepareBroadcast({
                     req,
                     object: field.object,
                     data: d,
                     event: "ab.datacollection.update",
                  });
                  packets.push(packet);
               });
            })
            .catch((err) => {
               req.notify.developer(err, {
                  context: "::updateConnectedFields",
                  object: field.object.id,
                  ids: IDs,
                  condDefaults,
               });
            })
      );
   });

   return Promise.all(lookups).then(() => {
      req.log(`... socket broadcast ${packets.length} packets`);

      if (packets.length == 0) {
         return;
      }

      return new Promise((resolve, reject) => {
         // at this point, packets should be full of all the broadcast packets to send.
         req.broadcast(packets, (err) => {
            if (err) {
               reject(err);
               return;
            }
            resolve();
         });
      });
   });
};
