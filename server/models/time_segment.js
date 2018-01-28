var mongoose = require('mongoose');

var TimeSegment = mongoose.model('Activity', {
  _activity_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  startTime: {
    type: Number,
    required: true
  },
  stopTime: {
    type: Number,
    default: null
  }
});

module.exports = { TimeSegment };
