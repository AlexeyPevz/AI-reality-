import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { authenticateTelegram } from '../middleware/auth';

const router = Router();

// Get user preferences
router.get('/', authenticateTelegram, async (req, res) => {
  try {
    const preferences = await prisma.preferences.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(preferences);
  } catch (error) {
    console.error('Error fetching preferences:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single preference
router.get('/:id', authenticateTelegram, async (req, res) => {
  try {
    const preference = await prisma.preferences.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!preference) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    res.json(preference);
  } catch (error) {
    console.error('Error fetching preference:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update preference
router.patch('/:id', authenticateTelegram, async (req, res) => {
  try {
    // Check ownership
    const existing = await prisma.preferences.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    const updated = await prisma.preferences.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating preference:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete preference
router.delete('/:id', authenticateTelegram, async (req, res) => {
  try {
    // Check ownership
    const existing = await prisma.preferences.findFirst({
      where: {
        id: req.params.id,
        userId: req.userId,
      },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Preference not found' });
    }

    await prisma.preferences.delete({
      where: { id: req.params.id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting preference:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;