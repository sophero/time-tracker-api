var mongoose = require('mongoose');

var Activity = mongoose.model('Activity', {
  name: {
    type: String,
    required: true,
    unique: true,
    minlength: 1,
    trim: true
  },
  _user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
});

module.exports = { Activity };
