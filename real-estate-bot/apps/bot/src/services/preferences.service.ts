import { prisma, Preferences } from '@real-estate-bot/database';
import { PreferenceMode, PreferenceWeights, CommutePoint } from '@real-estate-bot/shared';

export interface CreatePreferencesData {
  userId: string;
  mode: PreferenceMode;
  weights: PreferenceWeights;
  budgetMin?: number;
  budgetMax?: number;
  locations: string[];
  commutePoints: CommutePoint[];
  transportMode?: 'car' | 'public' | 'walk';
  rooms?: number[];
  areaMin?: number;
  areaMax?: number;
  newBuilding?: boolean;
  parkingRequired?: boolean;
}

export class PreferencesService {
  static async create(data: CreatePreferencesData): Promise<Preferences> {
    return await prisma.preferences.create({
      data: {
        userId: data.userId,
        mode: data.mode,
        weights: data.weights,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        locations: data.locations,
        commutePoints: data.commutePoints,
        transportMode: data.transportMode,
        rooms: data.rooms || [],
        areaMin: data.areaMin,
        areaMax: data.areaMax,
        newBuilding: data.newBuilding,
        parkingRequired: data.parkingRequired,
      },
    });
  }

  static async update(id: string, data: Partial<CreatePreferencesData>): Promise<Preferences> {
    return await prisma.preferences.update({
      where: { id },
      data: {
        mode: data.mode,
        weights: data.weights,
        budgetMin: data.budgetMin,
        budgetMax: data.budgetMax,
        locations: data.locations,
        commutePoints: data.commutePoints,
        transportMode: data.transportMode,
        rooms: data.rooms,
        areaMin: data.areaMin,
        areaMax: data.areaMax,
        newBuilding: data.newBuilding,
        parkingRequired: data.parkingRequired,
      },
    });
  }

  static async getUserPreferences(userId: string): Promise<Preferences[]> {
    return await prisma.preferences.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getLatestPreferences(userId: string, mode?: PreferenceMode): Promise<Preferences | null> {
    return await prisma.preferences.findFirst({
      where: {
        userId,
        ...(mode && { mode }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async delete(id: string): Promise<void> {
    await prisma.preferences.delete({
      where: { id },
    });
  }
}