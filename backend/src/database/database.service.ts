import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Db, ServerApiVersion } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private dbName = 'ParkingDB';  // Keep this as ParkingDB
  private collectionName = 'parkingLots';  // Keep this as parkingLots
  private cachedClient: MongoClient | null = null;

  constructor(
    private readonly configService: ConfigService
  ) {
    // Log database configuration on startup
    this.logger.log(`Database configuration: DB=${this.dbName}, Collection=${this.collectionName}`);
    
    // Check if MongoDB URI is configured
    const uri = this.configService.get<string>('MONGODB_URI');
    if (!uri) {
      this.logger.error('MongoDB URI is missing in environment variables!');
    } else {
      this.logger.log('MongoDB URI is configured');
    }
  }

  // In the connection method
  async connection() {
    // Return cached client if it exists and is connected
    if (this.cachedClient) {
      try {
        // Check if connection is still alive
        await this.cachedClient.db(this.dbName).command({ ping: 1 });
        this.logger.debug('Using existing MongoDB connection');
        return this.cachedClient;
      } catch (error) {
        this.logger.warn('Cached MongoDB connection is no longer valid, creating new connection');
        try {
          await this.cachedClient.close();
        } catch (closeError) {
          // Ignore close errors
        }
        this.cachedClient = null;
      }
    }

    const uri = this.configService.get<string>('MONGODB_URI');
    if (!uri) {
      throw new Error('MongoDB URI is missing!');
    }
    
    // Make sure your connection string includes the database name
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    try {
      await client.connect();
      this.logger.log(`🔌 MongoDB connection established to database: ${this.dbName}`);
      const db = client.db(this.dbName);
      
      // Add more detailed logging
      this.logger.log(`MongoDB connection string: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`); // Hide credentials
      
      await db.command({ ping: 1 });
      this.logger.log(`✅ MongoDB connection verified for database: ${this.dbName}`);
      
      // Check if collection exists and has documents
      const collectionExists = await db.listCollections({ name: this.collectionName }).hasNext();
      this.logger.log(`Collection ${this.collectionName} exists: ${collectionExists}`);
      
      if (collectionExists) {
        const count = await db.collection(this.collectionName).countDocuments();
        this.logger.log(`Collection ${this.collectionName} has ${count} documents`);
      }
      
      // Cache the client for future use
      this.cachedClient = client;
      return client;
    } catch (error) {
      this.logger.error(`❌ MongoDB connection error: ${error.message}`);
      throw new InternalServerErrorException('Database connection failed');
    }
  }

  async get_parkings(distances: any[])  {
    if (!distances || !Array.isArray(distances) || distances.length === 0) {
      this.logger.warn('No distances provided to get_parkings');
      return [];
    }

    this.logger.log(`Fetching parking data for ${distances.length} locations`);
    
    let client: MongoClient | null = null;
    try {
      client = await this.connection();
      const db = client.db(this.dbName);
      const collection = db.collection(this.collectionName);
      
      // Check if collection exists and has documents
      const collectionExists = await db.listCollections({ name: this.collectionName }).hasNext();
      if (!collectionExists) {
        this.logger.error(`Collection '${this.collectionName}' does not exist in database '${this.dbName}'`);
        return [];
      }
      
      const count = await collection.countDocuments();
      this.logger.log(`Found ${count} documents in collection '${this.collectionName}'`);
      
      const results: any[] = [];
      for (const distance of distances) {
        const parkingID = distance.parkingLotId;
        this.logger.debug(`Searching for parking lot with ID: ${parkingID}`);
        
        const found = await collection.find({ ParkingID: parkingID }).toArray();
        if (found.length > 0) {
          this.logger.debug(`Found ${found.length} matching documents for ID: ${parkingID}`);
          
          // Add distance information to each result
          const enhancedResults = found.map(item => ({
            ...item,
            Distance: {
              text: distance.distance?.text || 'Unknown',
              value: distance.distance?.value || 0
            }
          }));
          
          results.push(...enhancedResults);
        } else {
          this.logger.warn(`No parking lot found with ID: ${parkingID}`);
        }
      }

      this.logger.log(`Returning ${results.length} parking lots`);
      return results;
    } catch (error) {
      this.logger.error(`MongoDB error: ${error.message}`);
      // Return empty array instead of error object to maintain consistent return type
      return [];
    } finally {
      // Don't close the cached client
      if (client && client !== this.cachedClient) {
        try {
          await client.close();
        } catch (error) {
          this.logger.error(`Error closing MongoDB connection: ${error.message}`);
        }
      }
    }
  }
  
  // Add or update the initializeDatabase method in your database.service.ts
  
  async initializeDatabase() {
    let client: MongoClient | null = null;
    try {
      client = await this.connection();
      const db = client.db(this.dbName);
      
      // Check if collection exists
      const collectionExists = await db.listCollections({ name: this.collectionName }).hasNext();
      if (!collectionExists) {
        this.logger.log(`Creating collection '${this.collectionName}'`);
        await db.createCollection(this.collectionName);
      }
      
      // Check if collection is empty
      const collection = db.collection(this.collectionName);
      const count = await collection.countDocuments();
      
      if (count === 0) {
        this.logger.log('Collection is empty, initializing with sample data');
        
        // Load sample data from file
        try {
          // Try to load from both possible locations
          let sampleDataPath = path.join(process.cwd(), 'src', 'park_data.json');
          if (!fs.existsSync(sampleDataPath)) {
            sampleDataPath = path.join(process.cwd(), 'assets', 'parking-data.json');
          }
          
          if (fs.existsSync(sampleDataPath)) {
            const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
            if (Array.isArray(sampleData) && sampleData.length > 0) {
              // Add Available field if it doesn't exist
              const enhancedData = sampleData.map(item => ({
                ...item,
                Available: item.Available || item.TotalSpaces || 0,
                // Convert TotalSpaces to number if it's a string
                TotalSpaces: typeof item.TotalSpaces === 'string' ? 
                  parseInt(item.TotalSpaces, 10) : item.TotalSpaces
              }));
              
              const result = await collection.insertMany(enhancedData);
              this.logger.log(`Inserted ${result.insertedCount} sample parking lots`);
            }
          } else {
            this.logger.warn(`Sample data file not found at ${sampleDataPath}`);
          }
        } catch (error) {
          this.logger.error(`Error loading sample data: ${error.message}`);
        }
      } else {
        this.logger.log(`Collection already contains ${count} documents`);
      }
    } catch (error) {
      this.logger.error(`Error initializing database: ${error.message}`);
    } finally {
      // Don't close the cached client
      if (client && client !== this.cachedClient) {
        await client.close();
      }
    }
  }
}