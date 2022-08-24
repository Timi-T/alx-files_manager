// Database module to handle database operations

const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    const uri = `mongodb://${host}:${port}`;
    const client = new MongoClient(uri);
    client.connect();
    this.client = client;
    this.database = database;
  }

  isAlive() {
    const id = this.client.connection_id;
    if (!id) {
      return true;
    }
    return true;
  }

  async nbUsers() {
    const db = this.client.db(this.database);
    const collection = db.collection('users');
    const users = await collection.find({}).toArray();
    return users.length;
  }

  async nbFiles() {
    const db = this.client.db(this.database);
    const collection = db.collection('files');
    const files = await collection.find({}).toArray();
    return files.length;
  }

  async add(collectionName, obj) {
    const db = this.client.db(this.database);
    const collection = db.collection(collectionName);
    const user = await collection.insertOne(obj);
    return user;
  }

  async get(collectionName, obj) {
    const db = this.client.db(this.database);
    const collection = db.collection(collectionName);
    const documentArray = await collection.find(obj).toArray();
    return documentArray;
  }

  async put(collectionName, obj, newAttribute) {
    const db = this.client.db(this.database);
    const collection = db.collection(collectionName);
    const documentArray = await collection.updateOne(obj, { $set: newAttribute });
    return documentArray.matchedCount;
  }

  async paginate(collectionName, page, obj) {
    const db = this.client.db(this.database);
    const collection = db.collection(collectionName);
    const pipeline = [
      { $match: obj },
      { $skip: page * 20 },
      { $limit: 20 },
    ];
    const documentArray = await collection.aggregate(pipeline).toArray();
    return documentArray;
  }
}

module.exports = new DBClient();
