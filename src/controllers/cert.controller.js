const CertService = require('../services/cert.service');

const certController = {
  async createServer(req, res, next) {
    try {
      const cert = await CertService.createServerCert(req.body);
      res.status(201).json(cert);
    } catch (err) {
      next(err);
    }
  },

  async createClient(req, res, next) {
    try {
      const cert = await CertService.createClientCert(req.body);
      res.status(201).json(cert);
    } catch (err) {
      next(err);
    }
  },

  list(req, res, next) {
    try {
      const { caId, type, status } = req.query;
      const certs = CertService.list({ caId, type, status });
      res.json(certs);
    } catch (err) {
      next(err);
    }
  },

  getById(req, res, next) {
    try {
      const cert = CertService.getById(req.params.id);
      res.json(cert);
    } catch (err) {
      next(err);
    }
  },

  revoke(req, res, next) {
    try {
      const cert = CertService.revoke(req.params.id);
      res.json(cert);
    } catch (err) {
      next(err);
    }
  },

  delete(req, res, next) {
    try {
      CertService.delete(req.params.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
};

module.exports = certController;
