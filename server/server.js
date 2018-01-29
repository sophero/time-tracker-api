require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
const { ObjectID } = require('mongodb');

var { mongoose } = require('./db/mongoose');
var { User } = require('./models/user');
var { Activity } = require('./models/activity');
var { TimeSegment } = require('./models/time_segment');
var { authenticate } = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-Requested-With,content-type, Authorization, x-auth'
  );
  res.setHeader('Access-Control-Expose-Headers', 'x-auth');
  next();
});

// User routes

app.post('/users', (req, res) => {
  var body = _.pick(req.body, ['email', 'password', 'name']);
  var user = new User(body);
  user
    .save()
    .then(() => {
      return user.generateAuthToken();
    })
    .then(token => {
      res.header('x-auth', token).send(_.pick(user, ['name', 'email']));
    })
    .catch(e => {
      res.status(400).send(e);
    });
});

app.get('/users/me', authenticate, (req, res) => {
  res.send(req.user);
});

app.post('/users/login', (req, res) => {
  var body = _.pick(req.body, ['email', 'password']);

  User.findByCredentials(body.email, body.password)
    .then(user => {
      return user.generateAuthToken().then(token => {
        res.header('x-auth', token).send(_.pick(user, ['name', 'email']));
      });
    })
    .catch(e => {
      res.status(400).send();
    });
});

app.delete('/users/me/token', authenticate, (req, res) => {
  req.user.removeToken(req.token).then(
    () => {
      res.status(200).send();
    },
    () => {
      res.status(400).send();
    }
  );
});

// Activity routes

app.post('/activities', authenticate, (req, res) => {
  var activity = new Activity({
    name: req.body.name,
    _user_id: req.user._id
  });
  activity.save().then(
    doc => {
      res.send(doc);
    },
    e => {
      res.status(400).send(e);
    }
  );
});

app.get('/activities', authenticate, (req, res) => {
  Activity.find({
    _user_id: req.user._id
  }).then(
    activities => {
      let toSend = activities.map(activity =>
        _.pick(activity, ['name', '_id'])
      );
      res.send({ activities: toSend });
    },
    e => res.status(400).send(e)
  );
});

app.get('/activities/:id', authenticate, (req, res) => {
  var id = req.params.id;
  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }
  Activity.findOne({
    _id: id,
    _user_id: req.user._id
  })
    .then(activity => {
      if (!activity) {
        return res.status(404).send();
      }
      // TimeSegment.find({ _activity_id: id }).then(docs => {
      // activity.timeSegments = docs;
      res.send({ activity: _.pick(activity, ['name', '_id']) });
      // });
    })
    .catch(e => res.status(400).send());
});

// Time segment routes

app.post('/time_segments', authenticate, (req, res) => {
  var timeSegment = new TimeSegment({
    _activity_id: req.body._activity_id,
    startTime: req.body.startTime
  });
  timeSegment.save().then(
    time_segment => {
      res.send({ time_segment });
    },
    e => res.status(400).send(e)
  );
});

app.patch('/time_segments/:id', authenticate, (req, res) => {
  var id = req.params.id;
  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }
  TimeSegment.findOneAndUpdate(
    { _id: id },
    { stopTime: req.body.stopTime },
    { new: true }
  )
    .then(time_segment => {
      if (!time_segment) {
        res.status(404).send();
      }
      res.send({ time_segment });
    })
    .catch(e => res.status(400).send(e));
});

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = { app };
