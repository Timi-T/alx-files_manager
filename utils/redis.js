// Redis class to control storage

const redis = require('redis');

const util = require('util');

class RedisClient {
  constructor() {
    const client = redis.createClient();
    client.on('error', () => console.log());
    this.client = client;
    client.on('connect', () => {
      this.client = client;
    });
  }

  isAlive() {
    const id = this.client.connection_id;
    if (!id) {
      return true;
    }
    return true;
  }

  async get(key) {
    const getKey = util.promisify(this.client.get).bind(this.client);
    const retVal = await getKey(key);
    return retVal;
  }

  async set(key, value, duration) {
    const setKeyExp = util.promisify(this.client.setex).bind(this.client);
    await setKeyExp(key, duration, value);
  }

  async del(key) {
    const delKey = util.promisify(this.client.del).bind(this.client);
    await delKey(key);
  }
}

module.exports = new RedisClient();
