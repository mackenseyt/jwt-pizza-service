const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database');

if (process.env.VSCODE_INSPECTOR_OPTIONS) {
    jest.setTimeout(60 * 1000 * 5); // 5 minutes
}

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

// Ensures we can log in with the same user multiple times
const loginUser = async (user) => {
    const loginRes = await request(app).put('/api/auth').send(user);
    expect(loginRes.status).toBe(200);
    expectValidJwt(loginRes.body.token);
    return loginRes.body.token;
};

// Create an admin user in the database
const createAdminUser = async () => {
    let user = { 
        name: `Admin${Math.random().toString(36).substring(2, 12)}`, 
        email: `admin${Math.random().toString(36).substring(2, 12)}@test.com`, 
        password: 'securePassword123',
        roles: [{ role: Role.Admin }]
    };
    user = await DB.addUser(user);
    return { ...user, password: 'securePassword123' };
};

beforeAll(async () => {
    testUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    testUserAuthToken = await createUser(testUser);
});

test('register new user', async () => {
    const newUser = { name: 'new diner', email: 'new@test.com', password: 'testPass' };
    newUser.email = Math.random().toString(36).substring(2, 12) + '@test.com';
    await createUser(newUser);
});

test('successful login', async () => {
    const token = await loginUser(testUser);
    expect(token).toBeDefined();
});


test('create admin user', async () => {
    const adminUser = await createAdminUser();
    const token = await createUser(adminUser);
    expectValidJwt(token);
});

test('fail login with incorrect credentials', async () => {
    const invalidUser = { email: testUser.email, password: 'wrongpassword' };
    const loginRes = await request(app).put('/api/auth').send(invalidUser);
    expect(loginRes.status).toBe(404);
    expect(loginRes.body.token).toBeUndefined();
});

test('logout user', async () => {
    const logoutRes = await request(app)
        .delete('/api/auth')
        .set('Authorization', `Bearer ${testUserAuthToken}`);

    expect(logoutRes.status).toBe(200);
});