// Logic for users endpoints

const sha1 = require('sha1');

const { ObjectId } = require('mongodb');

const dbClient = require('../utils/db');

const redisClient = require('../utils/redis');

class UsersController {
  async postNew(req, res) {
    const { email } = req.body;
    this.email = email;
    if (!email) {
      res.status(400).send({ error: 'Missing email' });
      return;
    }
    const { password } = req.body;
    if (!password) {
      res.status(400).send({ error: 'Missing password' });
      return;
    }
    const userExists = await dbClient.get('users', { email });
    if (userExists.length > 0) {
      res.status(400).send({ error: 'Already exist' });
      return;
    }
    const hashPwd = sha1(password);
    const document = { email, password: hashPwd };
    const user = await dbClient.add('users', document);
    res.status(201).send({ id: user.insertedId, email });
  }

  async getMe(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const userID = await redisClient.get(`auth_${token}`);
    if (!userID) {
      res.status(401).send({ error: 'Unauthorized' });
      return;
    }
    const userData = await dbClient.get('users', { _id: ObjectId(userID) });
    if (userData.length > 0) {
      const user = userData[0];
      res.send({ id: user._id, email: user.email });
    } else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  }
}

module.exports = new UsersController();
