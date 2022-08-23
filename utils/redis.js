// Redis class to control storage

const redis = require('redis');

const util = require('util');

class RedisClient {
  constructor() {
    const client = redis.createClient();
    client.on('error', (err) => console.log());
    this.client = client;
    client.on('connect', () => this.client = client);
    /*client.on('connect', (err) => {
      if (!err) {
        console.log(true)
        this.connected = true;
      } else {
        this.connected = false;
      }
    });*/
  }

  /*isAlive() {
    //const connect = util.promisify(this.client.on).bind(this.client);
    return (async (client) => {
        async function connect() {
          client.on('connect', (err) => {
            if (!err) {
                return true;
            } else {
                return false;
            } 
          });
        }
        await connect()
          .then((err) => {
            return true
          });
    })(this.client);
  }*/

  isAlive() {
    try {
      console.log(this.client.connected, "Working");
      return true;
    } catch(err) {
      console.log(err)
      return false;
    }
  }

  async get(key) {
    const getKey = util.promisify(this.client.get).bind(this.client);
    return await getKey(key);
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
