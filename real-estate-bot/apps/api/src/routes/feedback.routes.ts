import { Router } from 'express';
import { prisma } from '@real-estate-bot/database';
import { authenticateTelegram } from '../middleware/auth';

const router = Router();

// Submit feedback
router.post('/', authenticateTelegram, async (req, res) => {
  try {
    const { recommendationId, action, reason, weightsDelta } = req.body;

    if (!recommendationId || !action) {
      res.status(400).json({ 
        error: 'recommendationId and action are required' 
      });
      return;
    }

    // Verify recommendation belongs to user
    const recommendation = await prisma.recommendation.findFirst({
      where: {
        id: recommendationId,
        userId: req.userId,
      },
    });

    if (!recommendation) {
      res.status(404).json({ error: 'Recommendation not found' });
      return;
    }

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        userId: req.userId!,
        recommendationId,
        action,
        reason,
        weightsDelta,
      },
    });

    // If user provided weight adjustments, could update their preferences here
    // This is a placeholder for future ML improvement

    res.json(feedback);
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;