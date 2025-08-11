import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { authenticateTelegram } from '../middleware/auth';

const router = Router();

// Get user profile
router.get('/profile', authenticateTelegram, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.patch('/profile', authenticateTelegram, async (req, res) => {
  try {
    const { phone, email } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(phone && { phone }),
        ...(email && { email }),
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;