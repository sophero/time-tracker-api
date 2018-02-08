require('./config/config');

const _ = require('lodash');
const express = require('express');
const bodyParser = require('body-parser');
// const cors = require('cors');
const { ObjectID } = require('mongodb');

const { mongoose } = require('./db/mongoose');
const config = require('./config/config.json');
const { User } = require('./models/user');
const { Activity } = require('./models/activity');
const { TimeSegment } = require('./models/time_segment');
const { authenticate } = require('./middleware/authenticate');

var app = express();
const port = process.env.PORT;

app.use(bodyParser.json());
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', config.allowedDomains);
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-auth'
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
      var toSend = activities.map(activity =>
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
      TimeSegment.find({ _activity_id: id }).then(docs => {
        activity.timeSegments = docs;
        res.send({
          activity: _.pick(activity, ['name', '_id', 'timeSegments'])
        });
      });
    })
    .catch(e => res.status(400).send());
});

app.patch('/activities/:id', authenticate, (req, res) => {
  // if name changes (which is the only thing you can edit on an activity) then ensure change propogates through to time_segment.activity_id for each TimeSegment with activity_id === req.params.id
  // Activity.findOneAndUpdate({
  //   _id: id,
  //   _user_id: req.user._id
  // })
});

app.delete('/activities/:id', authenticate, (req, res) => {
  // Delete all time segments associated with this activity? I think best not to, so you can still view your records. Perhaps default do not delete associated time_segments but give user option for them to be deleted.
});

// Time segment routes

app.post('/time_segments', authenticate, (req, res) => {
  Activity.findOne({ _id: req.body._activity_id })
    .then(activity => {
      var timeSegment = new TimeSegment({
        _activity_id: req.body._activity_id,
        _user_id: req.user._id,
        activity_name: activity.name,
        startTime: req.body.startTime
      });
      timeSegment.save().then(
        time_segment => {
          res.send({
            time_segment: _.pick(time_segment, [
              '_id',
              '_activity_id',
              'activity_name',
              'startTime'
            ])
          });
        },
        e => res.status(400).send(e)
      );
    })
    .catch(e => res.status(400).send(e));
});

// app.options('time_segments/:id', cors()); // enable pre-flight request for
app.patch('/time_segments/:id', authenticate, (req, res) => {
  var id = req.params.id;
  console.log('time segment id:', id);
  console.log('authenticated user id:', req.user._id);
  if (!ObjectID.isValid(id)) {
    return res.status(404).send();
  }
  TimeSegment.findOneAndUpdate(
    { _id: id, _user_id: req.user._id },
    { stopTime: req.body.stopTime },
    { new: true }
  )
    .then(time_segment => {
      if (!time_segment) {
        res.status(404).send();
      }
      res.send({
        time_segment: _.pick(time_segment, [
          '_activity_id',
          'activity_name',
          'startTime',
          'stopTime'
        ])
      });
    })
    .catch(e => res.status(400).send(e));
});

app.get(
  '/time_segments/:interval_start/:interval_stop',
  authenticate,
  (req, res) => {
    // return all time_segments with a startTime later than :interval_stop and/or a stopTime earlier than :interval_start

    var interval_start = Number(req.params.interval_start);
    var interval_stop = Number(req.params.interval_stop);

    TimeSegment.find({
      _user_id: req.user._id,
      $or: [
        // startTime falls in interval
        {
          $and: [
            { startTime: { $gte: interval_start } },
            { startTime: { $lt: interval_stop } }
          ]
        },
        // stopTime falls in interval
        {
          $and: [
            { stopTime: { $gt: interval_start } },
            { stopTime: { $lte: interval_stop } }
          ]
        },
        // interval contained within time segment
        {
          $and: [
            { startTime: { $lt: interval_start } },
            { stopTime: { $gt: interval_stop } }
          ]
        }
      ]
    })
      .then(docs => {
        var toSend = docs.map(time_segment => {
          return _.pick(time_segment, [
            '_activity_id',
            'activity_name',
            'startTime',
            'stopTime'
          ]);
        });
        res.send({ timeSegments: toSend });
      })
      .catch(e => res.status(400).send(e));
  }
);

// app.delete('/time_segments/:id', authenticate, (req, res) => {
//   var id = req.params.id;
//   if (!ObjectID.isValid(id)) {
//     return res.status(404).send();
//   }
//   TimeSegment.findOneAndRemove({ _id: id, _user_id: req.user._id })
//     .then(doc => {
//       if (!doc) {
//         res.status(404).send();
//       }
//       res.send({
//         time_segment: _.pick(doc, [
//           '_activity_id',
//           'activity_name',
//           'startTime',
//           'stopTime'
//         ])
//       });
//     })
//     .catch(e => res.status(400).send());
// });

app.listen(port, () => {
  console.log(`Started up at port ${port}`);
});

module.exports = { app };
