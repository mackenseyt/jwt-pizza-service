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
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';
  
    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
  }

async function createDinerUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Diner }] };
    user.name = randomName();
    user.email = user.name + '@diner.com';
    await DB.addUser(user);
    user.password = 'toomanysecrets';
    return user;
}

async function createFranchise() {
  const franchise = {
    name: randomName(),
    admins: [{ email: adminUser.email }]
  };
    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', `Bearer ${authToken}`)
      .send(franchise);
    return res.body;
}

describe('Franchise Router', () => {
    beforeAll(async () => {
        adminUser = await createAdminUser();
        const loginResAdmin = await request(app).put('/api/auth').send({ email: adminUser.email, password: adminUser.password });
        authToken = loginResAdmin.body.token;
        dinerUser = await createDinerUser();
        const loginResDiner = await request(app).put('/api/auth').send({ email: dinerUser.email, password: dinerUser.password });
        dinerUserAuthToken = loginResDiner.body.token;
        userId = adminUser.id;
        
    });

    beforeEach(async () => {
        const franchise = await createFranchise();
        franchiseId = franchise.id;
    });

    afterEach(async () => {
        await request(app)
            .delete(`/api/franchise/${franchiseId}`)
            .set('Authorization', `Bearer ${authToken}`);
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
});
