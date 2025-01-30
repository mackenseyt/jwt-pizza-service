const request = require('supertest');
const app = require('../service'); // Ensure this imports your app with routes
// const { DB, Role } = require('../database/database'); // Correct imports for DB and Role

jest.setTimeout(60 * 1000 * 5); // 5 minutes timeout for some of the tests

let testUser = { name: 'pizza diner', email: 'reg@test.com', password: 'a' };
let testUserAuthToken;


const expectValidJwt = (token) => {
    expect(token).toMatch(/^[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*\.[a-zA-Z0-9\-_]*$/);
};

// Utility function for creating a user
const createUser = async (user) => {
    const registerRes = await request(app).post('/api/auth').send(user);
    expect(registerRes.status).toBe(200);
    expectValidJwt(registerRes.body.token);
    return registerRes.body.token;
};

// Setup: Register a test user before all tests
beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    testUserAuthToken = await createUser(testUser);
});

describe('PUT /api/order/menu', () => {
    it('should fail if the user is not an admin', async () => {
      const res = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${testUserAuthToken}`) // Using testUserAuthToken
        .send({
          title: 'Student',
          description: 'No topping, no sauce, just carbs',
          image: 'pizza9.png',
          price: 0.0001,
        });
  
      expect(res.status).toBe(403); // Forbidden
      expect(res.body).toMatchObject({ message: 'unable to add menu item' });
    });});
