// Logic for endpoints

const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AppController {
  getStatus(req, res) {
    this.dbStatus = dbClient.isAlive();
    this.redisStatus = redisClient.isAlive();
    res.status(200).send({ redis: this.redisStatus, db: this.dbStatus });
  }

  async getStats(req, res) {
    this.users = await dbClient.nbUsers();
    this.files = await dbClient.nbFiles();
    res.status(200).send({ users: this.users, files: this.files });
  }
}

module.exports = new AppController();
