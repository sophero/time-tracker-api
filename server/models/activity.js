var mongoose = require('mongoose');

var Activity = mongoose.model('Activity', {
  name: {
    type: String,
    required: true,
    minlength: 1,
    trim: true // removes leading and trailing white space
  },
  _user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  }
});

module.exports = { Activity };
