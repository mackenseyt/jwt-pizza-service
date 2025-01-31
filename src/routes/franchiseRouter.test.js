const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let authToken = undefined;
let dinerUserAuthToken = undefined;
let userId = undefined;
let franchiseId = undefined;
let dinerUser = undefined;
let adminUser = undefined;

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = {
    name: `Admin${Math.random().toString(36).substring(2, 12)}`,
    email: `admin${Math.random().toString(36).substring(2, 12)}@test.com`,
    password: 'securePassword123',
    roles: [{ role: Role.Admin }]
  };
  try {
    user = await DB.addUser(user);
    console.log('Admin user created successfully:', user);
    return { ...user, password: 'securePassword123' };
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
}


async function createDinerUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Diner }] };
    user.name = randomName();
    user.email = user.name + '@diner.com';

    try {
        await DB.addUser(user);
    } catch (error) {
        console.error('Error creating diner user:', error);
    }

    user.password = 'toomanysecrets';
    return user;
}

async function createFranchise() {
  const franchise = {
    name: randomName(),
    admins: [{ email: adminUser.email }]
  };
  try {
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${authToken}`)
      .send(franchise);
    if (res.status !== 200) {
      throw new Error(`Failed to create franchise: ${res.status} - ${res.body.message}`);
    }
    return res.body;
  } catch (error) {
    console.error('Error creating franchise:', error);
    throw error;
  }
}


describe('Franchise Router', () => {
    beforeAll(async () => {
        try {
          adminUser = await createAdminUser();
          const loginResAdmin = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
          if (loginResAdmin.status !== 200 || !loginResAdmin.body.token) {
            throw new Error(`Failed to log in admin user: ${loginResAdmin.status} - ${loginResAdmin.body.message}`);
          }
          authToken = loginResAdmin.body.token;
          dinerUser = await createDinerUser();
            const loginResDiner = await request(app).put('/api/auth').send({ email: dinerUser.email, password: dinerUser.password });
            if (loginResDiner.status !== 200 || !loginResDiner.body.token) {
                throw new Error(`Failed to log in diner user: ${loginResDiner.status} - ${loginResDiner.body.message}`);
            }
            dinerUserAuthToken = loginResDiner.body.token;
            userId = adminUser.id;
        } catch (error) {
          console.error('Error in beforeAll setup:', error);
          throw error;
        }
    });

    beforeEach(async () => {
        try {
            const franchise = await createFranchise();
            if (!franchise || !franchise.id) {
                throw new Error('Failed to create franchise');
            }
            franchiseId = franchise.id;
        } catch (error) {
            console.error('Error in beforeEach setup:', error);
        }
    });

    afterEach(async () => {
        try {
            const res = await request(app)
                .delete(`/api/franchise/${franchiseId}`)
                .set('Authorization', `Bearer ${authToken}`);
            if (res.status !== 200) {
                throw new Error(`Failed to delete franchise: ${res.status} - ${res.body.message}`);
            }
        } catch (error) {
            console.error('Error in afterEach cleanup:', error);
        }
    });

    test('should get all franchises', async () => {
        const res = await request(app)
            .get('/api/franchise');
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    test('should get all franchises for the authenticated user', async () => {
        const res = await request(app)
            .get(`/api/franchise/${adminUser.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    test('should not get all franchises for an unauthenticated user', async () => {
        const res = await request(app)
            .get(`/api/franchise/${userId}`);
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('unauthorized');
    });

    test('should create a franchise if the authenticated user is an admin', async () => {
      try {
        const franchise = {
          name: randomName(),
          admins: [{ email: adminUser.email }]
        };
        const res = await request(app)
          .post('/api/franchise')
          .set('Authorization', `Bearer ${authToken}`)
          .send(franchise);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        // ... rest of the test
      } catch (error) {
        console.error('Test failed:', error);
        throw error;
      }
    });
    

    test('should not create a franchise if the authenticated user is not an admin', async () => {
        const franchise = {
            name: randomName() + "NOT ALLOWED",
            admins: [{ email: dinerUser.email }]
        };
        const res = await request(app)
            .post('/api/franchise')
            .set('Authorization', `Bearer ${dinerUserAuthToken}`)
            .send(franchise);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('unable to create a franchise');
    });

    test('should delete a franchise if the authenticated user is an admin', async () => {
        const res = await request(app)
            .delete(`/api/franchise/${franchiseId}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('franchise deleted');
    });

    test('should not delete a franchise if the authenticated user is not an admin', async () => {
        const res = await request(app)
            .delete(`/api/franchise/${franchiseId}`)
            .set('Authorization', `Bearer ${dinerUserAuthToken}`);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('unable to delete a franchise');
    });

    test('should create a store for a franchise if the authenticated user is an admin', async () => {
        const store = {
            franchiseId: franchiseId,
            name: randomName()
        };
        const res = await request(app)
            .post(`/api/franchise/${franchiseId}/store`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(store);
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');

        // Clean up
        const deleteRes = await request(app)
            .delete(`/api/franchise/${franchiseId}/store/${res.body.id}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(deleteRes.status).toBe(200);
        expect(deleteRes.body.message).toBe('store deleted');
    });

    test('should not create a store for a franchise if the authenticated user is not an admin', async () => {
        const store = {
            franchiseId: franchiseId,
            name: randomName()
        };
        const res = await request(app)
            .post(`/api/franchise/${franchiseId}/store`)
            .set('Authorization', `Bearer ${dinerUserAuthToken}`)
            .send(store);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('unable to create a store');
    });

    test('should delete a store for a franchise if the authenticated user is an admin', async () => {
        const store = {
            franchiseId: franchiseId,
            name: randomName()
        };
        const storeRes = await request(app)
            .post(`/api/franchise/${franchiseId}/store`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(store);
        const storeId = storeRes.body.id;

        const res = await request(app)
            .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
            .set('Authorization', `Bearer ${authToken}`);
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('store deleted');
    });

    test('should not delete a store for a franchise if the authenticated user is not an admin', async () => {
        const store = {
            franchiseId: franchiseId,
            name: randomName()
        };
        const storeRes = await request(app)
            .post(`/api/franchise/${franchiseId}/store`)
            .set('Authorization', `Bearer ${authToken}`)
            .send(store);
        const storeId = storeRes.body.id;

        const res = await request(app)
            .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
            .set('Authorization', `Bearer ${dinerUserAuthToken}`);
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('unable to delete a store');
    });
});
