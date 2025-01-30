const request = require('supertest');
const express = require('express');
const { DB} = require('../database/database.js');
// const { authRouter } = require('../routes/authRouter.js');
const franchiseRouter = require('../routes/franchiseRouter.js');

// Mock DB and authentication
jest.mock('../database/database.js', () => ({
  DB: {
    getFranchises: jest.fn(),
    getUserFranchises: jest.fn(),
    createFranchise: jest.fn(),
    deleteFranchise: jest.fn(),
  },
  Role: {
    Admin: 'Admin',
  },
}));

jest.mock('../routes/authRouter.js', () => ({
  authRouter: {
    authenticateToken: jest.fn((req, res, next) => {
      req.user = { id: 1, isRole: (role) => role === 'Admin' };
      next();
    }),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/franchise', franchiseRouter);

describe('Franchise Router', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test GET /api/franchise to return all franchises
  test('GET /api/franchise should return a list of franchises', async () => {
    const mockFranchises = [{ id: 1, name: 'PizzaPocket' }];
    DB.getFranchises.mockResolvedValue(mockFranchises);

    const res = await request(app).get('/api/franchise');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockFranchises);
    expect(DB.getFranchises).toHaveBeenCalled();
  });

  // Test GET /api/franchise/:userId to return franchises associated with a user
  test('GET /api/franchise/:userId should return user franchises', async () => {
    const mockUserFranchises = [{ id: 2, name: 'PizzaPocket' }];
    DB.getUserFranchises.mockResolvedValue(mockUserFranchises);

    const res = await request(app)
      .get('/api/franchise/1')
      .set('Authorization', 'Bearer fakeToken');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(mockUserFranchises);
    expect(DB.getUserFranchises).toHaveBeenCalledWith(1);
  });

  // Test POST /api/franchise to create a new franchise
  test('POST /api/franchise should create a new franchise', async () => {
    const newFranchise = { name: 'PizzaPocket', admins: [{ email: 'f@jwt.com' }] };
    const createdFranchise = { ...newFranchise, id: 1 };

    DB.createFranchise.mockResolvedValue(createdFranchise);

    const res = await request(app)
      .post('/api/franchise')
      .set('Authorization', 'Bearer fakeToken')
      .send(newFranchise);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(createdFranchise);
    expect(DB.createFranchise).toHaveBeenCalledWith(newFranchise);
  });
});
