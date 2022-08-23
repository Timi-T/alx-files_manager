// Logic for users endpoints

const dbClient = require('../utils/db');

const redisClient = require('../utils/redis');

const crypto = require('crypto');

const { ObjectId } = require('mongodb');

function sha1(password) {
  return crypto.createHash("sha1").update(password, "binary").digest("hex");
}

class UsersController {
  async postNew(req, res) {
    const email = req.body.email;
    if (!email) {
      res.status(400).send({'error': 'Missing email'});
      return
    }
    const password = req.body.password;
    if (!password) {
      res.status(400).send({'error': 'Missing password'});
      return
    }
    const userExists = await dbClient.get('users', {'email': email});
    if (userExists.length > 0) {
      res.status(400).send({'error': 'Already exist'});
      return
    }
    const hashPwd = sha1(password);
    const document = {'email': email, 'password': hashPwd};
    const user = await dbClient.add('users', document);
    //console.log(user.insertedId);
    res.status(200).send({'id': user.insertedId, 'email': email});
  }

  async getMe(req, res) {
    const token = req.headers['x-token'];
    const userID = await redisClient.get(`auth_${token}`);
    if (!userID) {
        res.status(401).send({'error': 'Unauthorized'});
        return
    }
    const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
    if (userData.length > 0) {
      const user = userData[0];
      res.status(200).send({'id': user._id, 'email': user.email})
    } else {
      res.status(401).send({'error': 'Unauthorized'});
    }
  }
}

module.exports = new UsersController();
