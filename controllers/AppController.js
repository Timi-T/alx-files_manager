// Logic for endpoints

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  getStatus(req, res) {
    const dbStatus = dbClient.isAlive();
    const redisStatus = redisClient.isAlive();
    res.status(200).send({ "redis": redisStatus, "db": dbStatus });
  }

  async getStats(req, res) {
    const users = await dbClient.nbUsers();
    const files = await dbClient.nbFiles();
    console.log(users, files)
    res.status(200).send({ "users": users, "files": files });
  }
}

module.exports = new AppController();
