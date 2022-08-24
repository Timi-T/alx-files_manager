// Worker to schedule a job to create thumbnails for images

const Queue = require('bull');

const queue = Queue('thumbnail');

const dbClient = require('./utils/db');

const imageThumbnail = require('image-thumbnail');

class thumbnailJob {
  async add(fileId, userId) {
    if (!fileId) {
      return 'Missing fileId';
    }
    if (!userId) {
      return 'Missing userId';
    }
    const fileData = await dbClient.get('files', {'_id': fileId, 'userId': userId});
    if (fileData.length > 0) {
      const file = fileData[0];
    } else {
      return 'File not found';
    }
    await queue.add({'fileId': fileId, 'userId': userId});
  }

  async process(imagePath) {
    await queue.process(async (job, done) => {
      const thumbnail500 = await imageThumbnail(imagePath, {'width': 500});
      const thumbnail250 = await imageThumbnail(imagePath, {'width': 250});
      const thumbnail100 = await imageThumbnail(imagePath, {'width': 100});
      return [thumbnail500, thumbnail250, thumbnail100];
    })
  }
}

module.exports = new thumbnailJob();
