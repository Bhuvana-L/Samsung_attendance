/**
 * Migration script: copies all data from local MongoDB to Atlas
 * Run: node migrate.js
 */
const { MongoClient } = require('mongodb');

const LOCAL_URI = 'mongodb://127.0.0.1:27017';
const ATLAS_URI = 'mongodb+srv://samsung_lab_attendance:samsung%40123@cluster0.0e26cxi.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'samsung_lab_attendance';

const COLLECTIONS = ['admins', 'students', 'sessions', 'attendancelogs'];

async function migrate() {
  console.log('Connecting to local MongoDB...');
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db(DB_NAME);
  console.log('Connected to local.');

  console.log('Connecting to Atlas...');
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db(DB_NAME);
  console.log('Connected to Atlas.\n');

  for (const colName of COLLECTIONS) {
    try {
      const docs = await localDb.collection(colName).find({}).toArray();
      if (docs.length === 0) {
        console.log(`  ${colName}: 0 documents (skipped)`);
        continue;
      }

      // Clear existing in Atlas to avoid duplicates
      await atlasDb.collection(colName).deleteMany({});

      // Insert all
      const result = await atlasDb.collection(colName).insertMany(docs);
      console.log(`  ${colName}: ${result.insertedCount} documents migrated`);
    } catch (err) {
      console.error(`  ${colName}: ERROR - ${err.message}`);
    }
  }

  console.log('\nMigration complete!');
  await localClient.close();
  await atlasClient.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
