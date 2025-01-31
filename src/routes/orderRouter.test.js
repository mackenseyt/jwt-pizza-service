
const request = require('supertest');
const express = require('express');
const { DB } = require('../database/database.js');
const orderRouter = require('./orderRouter.js');

// Create an express app to use with supertest
const app = express();
app.use(express.json());
app.use('/api/order', orderRouter);

// Mock database functions
jest.mock('../database/database.js', () => ({
  DB: {
    getMenu: jest.fn(),
    addMenuItem: jest.fn(),
    getOrders: jest.fn(),
    addDinerOrder: jest.fn(),
  },
}));

// Mock the authenticateToken middleware to simulate an authenticated user
jest.mock('./authRouter.js', () => ({
  authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = { id: 1, name: 'Test User', isRole: jest.fn(() => true) }; // Mock user role
      next();
    }),
  },
}));

describe('Order Router', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('GET /api/order/menu should return the pizza menu', async () => {
    const mockMenu = [{ id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' }];
    DB.getMenu.mockResolvedValue(mockMenu);

    const res = await request(app).get('/api/order/menu');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockMenu);
    expect(DB.getMenu).toHaveBeenCalled();
  });

  // test('PUT /api/order/menu should allow an admin to add a menu item', async () => {
  //   const newMenuItem = { title: 'Student', description: 'No topping, no sauce, just carbs', image: 'pizza9.png', price: 0.0001 };
  //   const updatedMenu = [{ id: 1, ...newMenuItem }];
  //   DB.addMenuItem.mockResolvedValue();
  //   DB.getMenu.mockResolvedValue(updatedMenu);

  //   const res = await request(app)
  //     .put('/api/order/menu')
  //     .set('Authorization', 'Bearer fakeToken')
  //     .send(newMenuItem);

  //   expect(res.status).toBe(200);
  //   expect(res.body).toEqual(updatedMenu);
  //   expect(DB.addMenuItem).toHaveBeenCalledWith(newMenuItem);
  // });

  test('GET /api/order should return the orders for the authenticated user', async () => {
    const mockOrders = { dinerId: 4, orders: [{ id: 1, franchiseId: 1, storeId: 1, date: '2024-06-05T05:14:40.000Z', items: [{ id: 1, menuId: 1, description: 'Veggie', price: 0.05 }] }], page: 1 };
    DB.getOrders.mockResolvedValue(mockOrders);

    const res = await request(app)
      .get('/api/order')
      .set('Authorization', 'Bearer fakeToken');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockOrders);
    expect(DB.getOrders).toHaveBeenCalledWith({ id: 1, name: 'Test User', isRole: expect.any(Function) }, undefined);
  });

  // test('POST /api/order should allow a user to create an order', async () => {
  //   const newOrder = { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }] };
  //   const createdOrder = { order: { franchiseId: 1, storeId: 1, items: [{ menuId: 1, description: 'Veggie', price: 0.05 }], id: 1 }, jwt: '1111111111' };
  //   DB.addDinerOrder.mockResolvedValue(createdOrder.order);

  //   const res = await request(app)
  //     .post('/api/order')
  //     .set('Authorization', 'Bearer fakeToken')
  //     .send(newOrder);

  //   expect(res.status).toBe(200);
  //   expect(res.body).toEqual(createdOrder);
  //   expect(DB.addDinerOrder).toHaveBeenCalledWith({ id: 1, name: 'Test User', isRole: expect.any(Function) }, newOrder);
  // });
});
