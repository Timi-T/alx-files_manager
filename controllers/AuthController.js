// Authentication logic

const sha1 = require('sha1');

const uuid = require('uuid').v4;

const dbClient = require('../utils/db');

const redisClient = require('../utils/redis');

class AuthController {
  async getConnect(req, res) {
    const authCode = (req.headers.authorization).split(' ')[1];
    this.authCode = authCode;
    const data = Buffer.from(authCode, 'base64').toString('utf-8');
    const email = data.split(':')[0];
    const password = data.split(':')[1];
    const userData = await dbClient.get('users', { email });
    if (userData.length > 0) {
      const user = userData[0];
      const hashPwd = user.password;
      if (sha1(password) !== hashPwd) {
        res.status(401).send({ error: 'Unauthorized' });
      } else {
        const token = uuid();
        const key = `auth_${token}`;
        await redisClient.set(key, user._id, 60 * 60 * 24);
        res.status(200).send({ token });
      }
    } else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  }

  async getDisconnect(req, res) {
    const token = (req.headers['x-token']);
    this.token = token;
    const key = `auth_${token}`;
    const user = await redisClient.get(key);
    if (!user) {
      res.status(401).send({ error: 'Unauthorized' });
    } else {
      await redisClient.del(key);
      res.status(204).send();
    }
  }
}

module.exports = new AuthController();
