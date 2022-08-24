// Logic for Endpoint to control files

const { ObjectId } = require('mongodb');

const mimes = require('mime-types');

const fs = require('fs');

const uuid = require('uuid').v4;

const dbClient = require('../utils/db');

const redisClient = require('../utils/redis');

const thumbnailJob = require('../worker');

class FilesController {
  async postUpload(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const userID = await redisClient.get(`auth_${token}`);
    const userData = await dbClient.get('users', { _id: ObjectId(userID) });
    if (userData.length > 0) {
      const user = userData[0];
      const filename = req.body.name;
      if (!filename) {
        res.status(400).send({ error: 'Missing name' });
        return;
      }
      const { type } = req.body;
      if (!type || (type !== 'file' && type !== 'image')) {
        res.status(400).send({ error: 'Missing type' });
        return;
      }
      const { data } = req.body;
      if (!data && type !== 'folder') {
        res.status(400).send({ error: 'Missing data' });
        return;
      }
      let { parentId } = req.body;
      if (parentId) {
        const parentData = dbClient.get('files', { parentId });
        if (parentData.length < 1) {
          res.status(400).send({ error: 'Parent not found' });
          return;
        }
        if (parentData.length > 0) {
          const parent = parentData[0];
          if (parent.type !== 'folder') {
            res.status(400).send({ error: 'Parent is not a folder' });
          }
        }
      } else {
        parentId = 0;
      }
      let { isPublic } = req.body;
      if (!isPublic) {
        isPublic = false;
      }
      const document = {
        userId: user._id,
        name: filename,
        type,
        isPublic,
        parentId,
      };
      if (type === 'folder') {
        const file = await dbClient.add('files', document);
        const ret = file.ops[0];
        res.status(201).send(ret);
      } else {
        const relativePath = process.env.FOLDER_PATH;
        let filePath = '';
        if (relativePath) {
          filePath = `/Users/roadsidedev/alx-files_manager/${relativePath}`;
        } else {
          filePath = '/tmp/files_manager';
        }
        try {
          if (!fs.existsSync(filePath)) {
            fs.mkdirSync(filePath);
          }
        } catch (err) {
          console.error(err);
        }
        const uuidFile = uuid();
        const fileContent = Buffer.from(data, 'base64').toString('utf-8');
        const savedPath = `${filePath}/${uuidFile}`;
        fs.appendFile(savedPath, fileContent, (err) => {
          if (err) {
            console.log(err);
          }
        });
        document.localPath = savedPath;
        const fileData = await dbClient.add('files', document);
        const file = fileData.ops[0];
        if (file.type === 'image') {
          const addJob = await thumbnailJob.add(file._id, file.userId);
          if (addJob) {
            res.status(400).send({ error: addJob });
            return;
          }
          console.log(file.localPath)
          const thumbnails = await thumbnailJob.process(file.localPath);
          console.log(thumbnails)
          fs.appendFile(`${file.localPath}_500`, thumbnails[0], (err) => {
            if (err) {
              console.log(err);
            }
          });
          fs.appendFile(`${file.localPath}_250`, thumbnails[1], (err) => {
            if (err) {
              console.log(err);
            }
          });
          fs.appendFile(`${file.localPath}_100`, thumbnails[2], (err) => {
            if (err) {
              console.log(err);
            }
          });
        }
        delete file.localPath;
        res.status(201).send(file);
      }
    }
    res.status(401).send({ error: 'Unauthorized' });
  }

  async getShow(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', { _id: ObjectId(userID) });
      if (userData.length > 0) {
        const user = userData[0];
        const fileData = await dbClient.get('files', { _id: ObjectId(fileID), userId: ObjectId(user._id) });
        if (fileData.length > 0) {
          const file = fileData[0];
          res.status(200).send(file);
        } else {
          res.status(404).send({ error: 'Not found' });
          return;
        }
      }
      res.status(401).send({ error: 'Unauthorized' });
    }
    res.status(401).send({ error: 'Unauthorized' });
  }

  async getIndex(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const userID = await redisClient.get(`auth_${token}`);
    let parentID = req.query.parentId;
    let { page } = req.query;
    if (!page) page = 0;
    if (!parentID) parentID = 0;
    if (userID) {
      const userData = await dbClient.get('users', { _id: ObjectId(userID) });
      if (userData.length > 0) {
        const user = userData[0];
        try {
          parentID = Number(parentID);
          page = Number(page);
          const filesData = await dbClient.paginate('files', page, { userId: ObjectId(user._id), parentId: parentID });
          res.status(200).send(filesData);
          return;
        } catch (err) {
          res.status(200).send([]);
        }
      } else {
        res.status(401).send({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  }

  async putPublish(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', { _id: ObjectId(userID) });
      if (userData.length > 0) {
        const user = userData[0];
        const updated = await dbClient.put('files', { _id: ObjectId(fileID), userId: ObjectId(user._id) }, { isPublic: true });
        if (updated) {
          const fileData = await dbClient.get('files', { _id: ObjectId(fileID), userId: ObjectId(user._id) });
          res.status(200).send(fileData[0]);
        } else {
          res.status(404).send({ error: 'Not found' });
          return;
        }
      }
      res.status(401).send({ error: 'Unauthorized' });
    } else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  }

  async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', { _id: ObjectId(userID) });
      if (userData.length > 0) {
        const user = userData[0];
        const updated = await dbClient.put('files', { _id: ObjectId(fileID), userId: ObjectId(user._id) }, { isPublic: false });
        if (updated) {
          const fileData = await dbClient.get('files', { _id: ObjectId(fileID), userId: ObjectId(user._id) });
          res.status(200).send(fileData[0]);
        } else {
          res.status(404).send({ error: 'Not found' });
        }
      } else {
        res.status(401).send({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  }

  async getFile(req, res) {
    const token = req.headers['x-token'];
    this.token = token;
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    const { size } = req.query;
    let data = '';
    if (userID) {
      const userData = await dbClient.get('users', { _id: ObjectId(userID) });
      if (userData.length > 0) {
        const user = userData[0];
        const fileData = await dbClient.get('files', { _id: ObjectId(fileID), userId: ObjectId(user._id) });
        if (fileData.length > 0) {
          const file = fileData[0];
          if (file.type === 'folder') {
            res.status(400).send({ error: 'A folder doesn\'t have content' });
            return;
          }
          if (!fs.existsSync(file.localPath)) {
            res.status(404).send({ error: 'Not found' });
            return;
          }
          if (!file.isPublic) {
            res.status(404).send({ error: 'Not found' });
            return;
          }
          const mimeType = mimes.lookup(file.name);
          res.setHeader('MIME-type', mimeType);
          if (size) {
            if (!fs.existsSync(`${file.localPath}_${size}`)) {
              res.status(404).send({ error: 'Not found' });
              return;
            }
            data = fs.readFileSync(`${file.localPath}_${size}`);
          } else {
            data = fs.readFileSync(file.localPath);
          }
          res.send(data);
        } else {
          res.status(404).send({ error: 'Not found' });
        }
      } else {
        res.status(401).send({ error: 'Unauthorized' });
      }
    } else {
      res.status(401).send({ error: 'Unauthorized' });
    }
  }
}

module.exports = new FilesController();
