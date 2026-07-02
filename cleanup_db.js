const fs = require('fs');
require('dotenv').config();
const mongoose = require('mongoose');

console.log('Using MONGODB_URI:', process.env.MONGODB_URI);

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    // Drop sample_mflix database
    console.log('Dropping sample_mflix database...');
    try {
      const sampleDb = mongoose.connection.useDb('sample_mflix');
      await sampleDb.dropDatabase();
      console.log('Successfully dropped sample_mflix database.');
    } catch (dbErr) {
      console.log('Failed to drop sample_mflix database:', dbErr.message);
    }

    const db = mongoose.connection.db;

    // 1. Keep only these events
    const allowedEventIds = [
      new mongoose.Types.ObjectId('6a09304f7ef0c4f49f23a4b3'), // Tech Fest 2025
      new mongoose.Types.ObjectId('6a0930c51d190727d25628da')  // CodeFest 2025
    ];

    console.log('\n--- Starting Cleanup ---');

    // Update name 'Chiranjeev Kumar' to 'Chiranthan N S' for email 'chiranthanns24056@gmail.com'
    const renameRegResult = await db.collection('registrations').updateMany(
      { email: 'chiranthanns24056@gmail.com', name: 'Chiranjeev Kumar' },
      { $set: { name: 'Chiranthan N S' } }
    );
    console.log(`- Renamed registrations: ${renameRegResult.modifiedCount}`);

    const renameLogResult = await db.collection('emaillogs').updateMany(
      { recipientEmail: 'chiranthanns24056@gmail.com', recipientName: 'Chiranjeev Kumar' },
      { $set: { recipientName: 'Chiranthan N S' } }
    );
    console.log(`- Renamed email logs: ${renameLogResult.modifiedCount}`);

    // 2. Clean registrations
    // Delete registrations that do not belong to the allowed events
    const regResult = await db.collection('registrations').deleteMany({
      eventId: { $nin: allowedEventIds }
    });
    console.log(`- Deleted ${regResult.deletedCount} orphan/diagnostic registrations`);

    // 3. Clean colleges
    // Delete diagnostic/mock colleges (specifically [DIAG] College 103903 or any containing [DIAG])
    const collegeResult = await db.collection('colleges').deleteMany({
      $or: [
        { _id: new mongoose.Types.ObjectId('6a0bf070d0f1c9c81950d77f') },
        { name: { $regex: /\[DIAG\]/i } }
      ]
    });
    console.log(`- Deleted ${collegeResult.deletedCount} diagnostic colleges`);

    // 4. Clean email logs
    // Delete logs that:
    // a) reference an eventId not in allowedEventIds
    // b) have eventId: null (today's test logs)
    // c) have recipientName: "Admin" or type: "test"
    const logResult = await db.collection('emaillogs').deleteMany({
      $or: [
        { eventId: { $nin: allowedEventIds } },
        { eventId: null },
        { type: 'test' },
        { recipientName: 'Admin' }
      ]
    });
    console.log(`- Deleted ${logResult.deletedCount} unwanted/test/orphan email logs`);

    // 5. Clean promotion emails (if any)
    const promoResult = await db.collection('promotionemails').deleteMany({
      eventId: { $nin: allowedEventIds }
    });
    console.log(`- Deleted ${promoResult.deletedCount} promotion emails`);

    // 6. Verify final counts
    console.log('\n--- Verification: Final Counts ---');
    const collections = await db.listCollections().toArray();
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name}: ${count} documents`);
    }

  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

run();
