require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { ObjectID } = require('mongodb');

var { mongoose } = require('./db/mongoose');
var { User } = require('./models/user');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.post('/users', (req, res) => {
  var body = _.pick(req.body, ['email', 'password']);
  var user = new User(body);
  user
    .save()
    .then(() => {
      return user.generateAuthToken();
    })
    .then(token => {
      // res.header allows you to set a key-value pair, whereas req.header returns the value for your key.
      res.header('x-auth', token).send(user);
    })
    .catch(e => {
      res.status(400).send(e);
    });
});

app.post('/users/login', (req, res) => {
  var body = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(body.email, body.password)
    .then(user => {
      return user.generateAuthToken().then(token => {
        res.header('x-auth', token).send(user);
      });
    })
    .catch(e => {
      res.status(400).send();
    });
});

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = { app };
