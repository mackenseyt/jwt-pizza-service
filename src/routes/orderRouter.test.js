const request = require('supertest');
const app = require('../service');
const { Role, DB } = require('../database/database.js');

let authToken, dinerUserAuthToken, storeId, franchiseId, dinerUser, adminUser;

const menuItems = [
  { title: 'Pizza Margherita', description: "It's a pizza.", image: "test.qng", price: 0.00099 },
  { title: 'Pizza Pepperoni', description: "It's a pizza.", image: "test.qng", price: 0.00099 }
];

const menuIds = [];

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

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

async function createDinerUser() {
  const user = {
    password: 'toomanysecrets',
    roles: [{ role: Role.Diner }],
    name: randomName(),
    email: randomName() + '@diner.com',
  };

  await DB.addUser(user);
  return { ...user, password: 'toomanysecrets' };
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

describe('Order Router Integration Tests', () => {
  beforeAll(async () => {
    // Create admin and diner users
    adminUser = await createAdminUser();
    dinerUser = await createDinerUser();

    // Login admin and diner to get tokens
    const loginResAdmin = await request(app)
      .put('/api/auth')
      .send({ email: adminUser.email, password: adminUser.password });
    expect(loginResAdmin.status).toBe(200);
    authToken = loginResAdmin.body.token;

    const loginResDiner = await request(app)
      .put('/api/auth')
      .send({ email: dinerUser.email, password: dinerUser.password });
    expect(loginResDiner.status).toBe(200);
    dinerUserAuthToken = loginResDiner.body.token;
  });

  beforeEach(async () => {
    // Create franchise and store for testing orders
    const franchise = await createFranchise();
    franchiseId = franchise.id;

    const store = { name: randomName() };
    const storeRes = await request(app)
      .post(`/api/franchise/${franchiseId}/store`)
      .set('Authorization', `Bearer ${authToken}`)
      .send(store);
    storeId = storeRes.body.id;
    // menue items
    for (const item of menuItems) {
      const menuRes = await request(app)
        .put('/api/order/menu')
        .set('Authorization', `Bearer ${authToken}`)
        .send(item);
      const newItem = menuRes.body[menuRes.body.length - 1];
      menuIds.push(newItem.id);
    }
  });

  afterEach(async () => {
    // Clean up stores and franchise after each test.
    await request(app)
      .delete(`/api/franchise/${franchiseId}/store/${storeId}`)
      .set('Authorization', `Bearer ${authToken}`);
    await request(app)
      .delete(`/api/franchise/${franchiseId}`)
      .set('Authorization', `Bearer ${authToken}`);
  });

  test('should get the menu', async () => {
    const res = await request(app).get('/api/order/menu');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(menuItems.length);
  });

  test('should add a menu item as admin', async () => {
    const item = {
      title: 'Pizza Cheese',
      description: "It's a pizza.",
      image: randomName() + '.qng',
      price: 0.00099
    };
    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${authToken}`)
      .send(item);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(menuItems.length + 1);
  });

  test('should not add a menu item as diner', async () => {
    const item = {
      title: 'Pizza Cheese',
      description: "It's a pizza.",
      image: randomName() + '.qng',
      price: 0.00099
    };
    const res = await request(app)
      .put('/api/order/menu')
      .set('Authorization', `Bearer ${dinerUserAuthToken}`)
      .send(item);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('unable to add menu item');
  });
  test('should create an order for the authenticated user', async () => {
    const order = {
      franchiseId,
      storeId,
      items: [{ menuId: menuIds[0], description: "Test Order", price: 0.00099 }]
    };
    const res = await request(app)
      .post('/api/order')
      .set('Authorization', `Bearer ${dinerUserAuthToken}`)
      .send(order);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('order');
    expect(res.body.order).toHaveProperty('id');
  });
});
