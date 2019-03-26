const express = require('express')
const app = express()
const bodyParser = require('body-parser')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )

const Schema = mongoose.Schema;
const exerciseSchema = new Schema({
  userId: { type: String, required: true },
  description: { type: String, required: true },
  duration: { type: Number, required: true },
  date: { type: Date, default: Date.now }
})
const Exercise = mongoose.model('Exercise', exerciseSchema);

const userSchema = new Schema({
  username: {type: String, required: true, maxlength: 50, unique: true}
}); 
const User = mongoose.model('User', userSchema);

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', (req, res, next) => {
  let user = new User({
    username: req.body.username
  })
  user.save((err, data) => {
    if (err) return next(err);
    res.json({
      username: data.username,
      _id: data._id
    });
  });
});

app.get('/api/exercise/users', (req, res, next) => {
  User.find({}, (err, data) => {
    if (err) return next(err);
    res.json(data);
  });
});


app.post('/api/exercise/add', (req, res, next) => { 
  console.log(req.body);
  
  User.findById(req.body.userId, (err, user) => {
    if (err) return next(err);
    
    const exerciseData = {
      userId: req.body.userId,
      description: req.body.description,
      duration: req.body.duration
    };
    if (req.body.date) exerciseData.date = req.body.date;
    
    const exercise = new Exercise(exerciseData);
    
    exercise.save(function (err, data) {

      if (err) return next(err);

      res.json({
        username: user.username,
        _id: user._id,
        description: data.description,
        duration: data.duration,
        date: data.date.toDateString()
      });
    });
  })
});


app.get('/api/exercise/log', function (req, res, next) {
  User.findById(req.query.userId, (err, user) => {
    if (err) return next(err);
    
    const obj = {
      _id: user._id,
      username: user.username
    };

    const filter = {userId: req.query.userId};

    if (req.query.from) {
      const from = new Date(req.query.from);
      if (!isNaN(from.valueOf())) {
        filter.date = {'$gt': from};
        obj.from = from.toDateString();
      }
    }

    if (req.query.to) {
      const to = new Date(req.query.to);
      if (!isNaN(to.valueOf())) {
        filter.date = filter.date || {};
        filter.date['$lt'] = to;
        obj.to = to.toDateString();
      }
    }

    const query = Exercise.find(filter,
                                'description duration date',
                                {sort: {date: -1}}).lean();
    
    if (req.query.limit) {
      const limit = parseInt(req.query.limit);
      if (limit) query.limit(limit);
    }

    query.exec(function(err, items) {

      if (err) return next(err);

      for (let item of items) {
        delete item._id;
        item.date = item.date.toDateString();
      }

      obj.count = items.length;
      obj.log = items;
      res.json(obj);
    });
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
