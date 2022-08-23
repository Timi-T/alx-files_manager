// Logic for Endpoint to control files

const dbClient = require('../utils/db');

const redisClient = require('../utils/redis');

const { ObjectId } = require('mongodb');

const fs = require('fs');

const uuid = require('uuid').v4;

const mimes = require('mime-types');

const thumbnailJob = require('../worker');

class FilesController {
  async postUpload(req, res) {
    const token = req.headers['x-token'];
    const userID = await redisClient.get(`auth_${token}`);
    const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
    if (userData.length > 0) {
      const user = userData[0];
      const filename = req.body.name;
      if (!filename) {
        res.status(400).send({'error': 'Missing name'});
        return;
      }
      const type = req.body.type;
      if (!type && type !== 'file' && type !== 'image') {
        res.status(400).send({'error': 'Missing type'});
        return;
      }
      const data = req.body.data;
      if (!data && type !== 'folder') {
        res.status(400).send({'error': 'Missing data'});
        return;
      }
      let parentId = req.body.parentId;
      if (parentId) {
        const parentData = dbClient.get({'parentId': parentId});
        if (!parentData) {
          res.status(400).send({'error': 'Parent not found'});
          return;
        }
        if (parentData.length > 0) {
          const parent = parentData[0];
          if (parent.type !== 'folder') {
            res.status(400).send({'error': 'Parent is not a folder'});
          }
        }
      } else {
        parentId = 0;
      }
      let isPublic = req.body.isPublic;
      if (!isPublic) {
        isPublic = false;
      }
      const document = {
        'userId': user._id,
        'name': filename,
        'type': type,
        'isPublic': isPublic,
        'parentId': parentId
      };
      if (type === 'folder') {
        const file = await dbClient.add('files', document);
        const ret = file.ops[0];
        res.status(201).send(ret);
        return;
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
        const fileContent = atob(data);
        const savedPath = `${filePath}/${uuidFile}`
        fs.appendFile(savedPath, fileContent, function (err) {
          if (err) console.log(err);
        });
        document.localPath = savedPath;
        const fileData = await dbClient.add('files', document);
        const file = fileData.ops[0];
        if (file.type === 'image') {
          const addJob = await thumbnailJob.add(file._id, file.userId);
          if (addJob) {
            res.status(400).send({'error': addJob});
            return;
          }
          thumbnailJob.process(file.localPath);
        }
        delete file.localPath;
        res.status(201).send(file);
        return;
      }
    } else {
      res.status(401).send({'error': 'Unauthorized'});
    }
  }

  async getShow(req, res) {
    const token = req.headers['x-token'];
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
      if (userData.length > 0) {
        const user = userData[0];
        const fileData = await dbClient.get('files', {'_id': ObjectId(fileID), 'userId': ObjectId(user._id)});
        if (fileData.length > 0) {
          const file = fileData[0];
          res.status(200).send(file);
          return;
        } else {
          res.status(404).send({'error': 'Not found'});
          return;
        }
      } else {
        res.status(401).send({'error': 'Unauthorized'});
        return;
      }
    } else {
      res.status(401).send({'error': 'Unauthorized'});
      return;
    }
  }

  async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userID = await redisClient.get(`auth_${token}`);
    let parentID = req.query.parentId;
    let page = req.query.page;
    if (!page) page = 0;
    if (!parentID) parentID = 0;
    if (userID) {
      const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
      if (userData.length > 0) {
        const user = userData[0];
        try {
          parentID = Number(parentID);
          page = Number(page);
          const filesData = await dbClient.paginate('files', page, {'userId': ObjectId(user._id), 'parentId': parentID});
          res.status(200).send(filesData);
          return
        } catch(err) {
          res.status(200).send([]);
          return;
        }
      } else {
        res.status(401).send({'error': 'Unauthorized'});
        return;
      }
    } else {
      res.status(401).send({'error': 'Unauthorized'});
      return;
    }
  }

  async putPublish(req, res) {
    const token = req.headers['x-token'];
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
      if (userData.length > 0) {
        const user = userData[0];
        const updated = await dbClient.put('files', {'_id': ObjectId(fileID), 'userId': ObjectId(user._id)}, {'isPublic': true});
        if (updated) {
          const fileData = await dbClient.get('files', {'_id': ObjectId(fileID), 'userId': ObjectId(user._id)});
          res.status(200).send(fileData[0]);
          return;
        } else {
          res.status(404).send({'error': 'Not found'});
          return;
        }
      } else {
        res.status(401).send({'error': 'Unauthorized'});
        return;
      }
    } else {
      res.status(401).send({'error': 'Unauthorized'});
      return;
    }
  }

  async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
      if (userData.length > 0) {
        const user = userData[0];
        const updated = await dbClient.put('files', {'_id': ObjectId(fileID), 'userId': ObjectId(user._id)}, {'isPublic': false});
        if (updated) {
          const fileData = await dbClient.get('files', {'_id': ObjectId(fileID), 'userId': ObjectId(user._id)});
          res.status(200).send(fileData[0]);
          return;
        } else {
          res.status(404).send({'error': 'Not found'});
          return;
        }
      } else {
        res.status(401).send({'error': 'Unauthorized'});
        return;
      }
    } else {
      res.status(401).send({'error': 'Unauthorized'});
      return;
    }
  }

  async getFile(req, res) {
    const token = req.headers['x-token'];
    const fileID = req.params.id;
    const userID = await redisClient.get(`auth_${token}`);
    if (userID) {
      const userData = await dbClient.get('users', {'_id': ObjectId(userID)});
      if (userData.length > 0) {
        const user = userData[0];
        const fileData = await dbClient.get('files', {'_id': ObjectId(fileID), 'userId': ObjectId(user._id)});
        if (fileData.length > 0) {
          const file = fileData[0];
          if (file.type === 'folder') {
            res.status(400).send('A folder doesn\'t have content');
            return;
          }
          if (!fs.existsSync(file.localPath)) {
            res.status(404).send('Not found');
            return;
          }
          const mimeType = mimes.lookup(file.name);
          res.setHeader('content-type', mimeType);
          const data = fs.readFileSync(file.localPath);
          res.send(data);
          return;
        } else {
          res.status(404).send({'error': 'Not found'});
          return;
        }
      } else {
        res.status(401).send({'error': 'Unauthorized'});
        return;
      }
    } else {
      res.status(401).send({'error': 'Unauthorized'});
      return;
    }
  }
}

module.exports = new FilesController();
