import { prisma, User, numberToBigInt } from '@real-estate-bot/database';

export class UserService {
  static async findOrCreate(tgId: number): Promise<User> {
    const existingUser = await prisma.user.findUnique({
      where: { tgId: numberToBigInt(tgId)! },
    });

    if (existingUser) {
      return existingUser;
    }

    return await prisma.user.create({
      data: {
        tgId: numberToBigInt(tgId)!,
      },
    });
  }

  static async updateUser(userId: string, data: Partial<Omit<User, 'id' | 'tgId' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    return await prisma.user.update({
      where: { id: userId },
      data: data as any,
    });
  }

  static async getUser(userId: string): Promise<User | null> {
    return await prisma.user.findUnique({
      where: { id: userId },
    });
  }
}