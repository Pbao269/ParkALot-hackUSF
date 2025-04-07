import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService {
  constructor(
    private readonly configService: ConfigService
  ) {}
  private dbName = 'ParkingDB';  // Keep this as ParkingDB
  private collectionName = 'parkingLots';  // Keep this as parkingLots

  async connection() {
    const uri = this.configService.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error('MongoDB key is missing!');
    }
    // Make sure your connection string includes the database name
    const client = new MongoClient(uri + (uri.includes('?') ? '&' : '?') + `dbName=${this.dbName}`, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    try {
      await client.connect();
      console.log(`🔌 MongoDB connection established to database: ${this.dbName}`);
      const db = client.db(this.dbName);
      await db.command({ ping: 1 });
      console.log(`✅ MongoDB connection verified for database: ${this.dbName}`);
      return client;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error);
      throw new InternalServerErrorException('Database connection failed');
    }
  }

  async get_parkings(distances: any[])  {
    const client = await this.connection()
    try {
    const db = client.db(this.dbName)
    const collection = db.collection(this.collectionName)
    const results: any[] = []

    for (const distance of distances) {
      const parkingID = distance.parkingLotId
      const found = await collection.find({ ParkingID: parkingID }).toArray()
      results.push(...found)
    }

    return results // ✅ returning array
    } catch (error) {
      console.error('MongoDB error:', error);
      return {
        statusCode: 500,
        message: 'Error fetching parking availability',
      };
    } finally {
      await client.close();
    }
  }
}