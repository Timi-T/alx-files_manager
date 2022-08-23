// App server

const express = require('express');

const app = express();

const router = require('./routes/index');

app.use(express.json());
app.use(router);
app.listen(process.env.PORT || 5000, () => console.log('Server running on port 5000'));

module.exports = app;
