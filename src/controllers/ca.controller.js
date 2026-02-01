const CAService = require('../services/ca.service');

const caController = {
  async createRoot(req, res, next) {
    try {
      const ca = await CAService.createRootCA(req.body);
      res.status(201).json(ca);
    } catch (err) {
      next(err);
    }
  },

  async createIntermediate(req, res, next) {
    try {
      const ca = await CAService.createIntermediateCA(req.body);
      res.status(201).json(ca);
    } catch (err) {
      next(err);
    }
  },

  list(req, res, next) {
    try {
      const { type, status } = req.query;
      const cas = CAService.list({ type, status });
      res.json(cas);
    } catch (err) {
      next(err);
    }
  },

  getById(req, res, next) {
    try {
      const ca = CAService.getById(req.params.id);
      res.json(ca);
    } catch (err) {
      next(err);
    }
  },

  getChain(req, res, next) {
    try {
      const chain = CAService.getChain(req.params.id);
      res.json(chain);
    } catch (err) {
      next(err);
    }
  },

  delete(req, res, next) {
    try {
      CAService.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};

module.exports = caController;
