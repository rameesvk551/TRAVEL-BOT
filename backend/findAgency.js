require('dotenv').config({ path: '/home/ec2-user/travel-bot-git/backend/.env' });
const mongoose = require('mongoose');
const Agency = require('/home/ec2-user/travel-bot-git/backend/src/models/agency');
const AgencyChannel = require('/home/ec2-user/travel-bot-git/backend/src/models/agencyChannel');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  console.log('Connected to DB. Searching...');
  
  const agencies = await Agency.find({
    $or: [
      { whatsappNumber: /9074823588/ },
      { phone: /9074823588/ }
    ]
  });
  console.log('Agencies found (Agency collection):', agencies.map(a => ({ name: a.name, id: a._id, email: a.email })));

  const channels = await AgencyChannel.find({
    $or: [
      { displayPhoneNumber: /9074823588/ },
      { phoneNumberId: /9074823588/ },
      { phoneNumberId: /2478492146002706/ } // Adding the ID from the screenshot too!
    ]
  });
  
  console.log('Channels found (AgencyChannel collection):', channels.map(c => ({ id: c._id, agencyId: c.agencyId, phone: c.displayPhoneNumber })));
  
  process.exit(0);
}).catch(console.error);
