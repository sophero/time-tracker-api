const expect = require('expect');
const request = require('supertest');
const { ObjectID } = require('mongodb');

const { app } = require('./../server');
const { User } = require('./../models/user');
const { users, populateUsers } = require('./seed/seed');

beforeEach(populateUsers);

describe('GET /users/me', () => {
  it('should return user if authenticated', done => {
    request(app)
      .get('/users/me')
      .set('x-auth', users[0].tokens[0].token)
      .expect(200)
      .expect(res => {
        expect(res.body._id).toBe(users[0]._id.toHexString());
        expect(res.body.email).toBe(users[0].email);
      })
      .end(done);
  });

  it('should return a 401 if not authenticated', done => {
    request(app)
      .get('/users/me')
      .expect(401)
      .expect(res => {
        expect(res.body).toEqual({});
      })
      .end(done);
  });
});

describe('POST /users', () => {
  it('should create a new user', done => {
    var email = 'example@example.com';
    var password = '123mnb!';
    request(app)
      .post('/users')
      .send({ email, password })
      .expect(200)
      .expect(res => {
        expect(res.headers['x-auth']).toExist();
        expect(res.body._id).toExist();
        expect(res.body.email).toBe(email);
      })
      .end(err => {
        if (err) {
          return done(err);
        }
        User.findOne({ email })
          .then(user => {
            expect(user).toExist();
            expect(user.password).toNotBe(password); // check that password has been hashed
            done();
          })
          .catch(e => done(e));
      });
  });

  it('should return validation errors if request invalid', done => {
    request(app)
      .post('/users')
      .send({
        email: 'hey@1',
        password: '1234'
      })
      .expect(400)
      .end(done);
  });

  it('should not create user if email in use', done => {
    request(app)
      .post('/users')
      .send({
        email: users[0].email,
        password: 'abc123'
      })
      .expect(400)
      .end(done);
  });
});
