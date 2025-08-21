import express from 'express';

// Temporary stub - will be converted properly later
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ message: 'opportunities routes stub' });
});

export default router;
