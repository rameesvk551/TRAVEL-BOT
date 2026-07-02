const { MongoClient } = require('mongodb');

const uri = "mongodb://localhost:27018/marketing-os?directConnection=true";
const client = new MongoClient(uri);

async function run() {
  try {
    await client.connect();
    const db = client.db('marketing-os');
    
    // We want to find the number +917306068207 or 7306068207
    const numberStr = '7306068207';
    
    const collections = await db.listCollections().toArray();
    
    for (let collInfo of collections) {
      const coll = db.collection(collInfo.name);
      
      // Look for the number in any string field. We will do a generic update or at least find it first.
      // Easiest is to search for a regex.
      const query = {
        $or: [
          { whatsappNumber: { $regex: numberStr } },
          { phoneNumber: { $regex: numberStr } },
          { displayPhoneNumber: { $regex: numberStr } }
        ]
      };
      
      try {
        const doc = await coll.findOne(query);
        if (doc) {
          console.log(`Found in collection: ${collInfo.name}, ID: ${doc._id}`);
          
          // Try to clear it depending on the schema
          const updateResult = await coll.updateOne(
            { _id: doc._id },
            { $set: { whatsappNumber: null, phoneNumber: null, displayPhoneNumber: null, connectionStatus: 'NOT_CONNECTED' } }
          );
          console.log(`Updated ${updateResult.modifiedCount} documents in ${collInfo.name}`);
        }
      } catch (e) {
        // ignore errors on collections that don't support this
      }
    }
  } finally {
    await client.close();
  }
}

run().catch(console.error);
