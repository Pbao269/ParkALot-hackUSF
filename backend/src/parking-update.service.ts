/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/parking-update.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { InferenceService } from './inference/inference.service';
import { ParkingLot, ParkingLotDocument } from './parking-lot.schema';
import { countAvailableSpaces } from './inference/inference.helper';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class ParkingUpdateService {
  private readonly logger = new Logger(ParkingUpdateService.name);
  private readonly useTestImages = process.env.USE_TEST_IMAGES === 'true';
  private readonly testImagesDir = path.join(process.cwd(), 'test-images');

  constructor(
    private readonly inferenceService: InferenceService,
    @InjectModel(ParkingLot.name)
    private readonly parkingLotModel: Model<ParkingLotDocument>,
  ) {
    // Don't try to create the directory in production/Vercel environment
    // Just log that we're using test images
    if (this.useTestImages) {
      try {
        console.log(`🔍 Using test images from: ${this.testImagesDir}`);
        // Check if directory exists but don't try to create it
        if (fs.existsSync(this.testImagesDir)) {
          console.log(`📁 Test images directory exists at ${this.testImagesDir}`);
        } else {
          console.log(`⚠️ Test images directory does not exist at ${this.testImagesDir}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not access test images directory: ${error.message}`);
      }
    }
  }

  @Cron('0 */30 * * * *') // Run every 30 minutes
  async updateParkingData() {
    this.logger.log('Updating parking data...');
    try {
      // Example implementation - this would be replaced with actual data fetching logic
      await this.parkingLotModel.updateMany(
        {},
        { $set: { lastUpdated: new Date() } }
      );
      this.logger.log('Parking data updated successfully');
    } catch (error) {
      this.logger.error(`Error updating parking data: ${error.message}`);
    }
  }

  @Cron('*/2 * * * *')
  async updateParkingAvailability() {
      console.log('\n🔄 === STARTING SCHEDULED PARKING UPDATES ===');
      const lots = await this.parkingLotModel.find().exec();
      console.log(`📊 Found ${lots.length} parking lots in database`);
  
      for (const lot of lots) {
        console.log(`\n🅿️ Processing Parking Lot:`);
        console.log(`ID: ${lot.ParkingID}`);
        console.log(`Location: ${lot.Location}`);
        console.log(`Current Available Spaces: ${lot.Available}`);
  
        try {
          let inferenceResult;
  
          if (this.useTestImages) {
              // Try both .jpg and .jpeg extensions with different naming patterns
              const testImageExtensions = ['.jpg', '.jpeg'];
              const testImagePatterns = [
                `lot-${lot.ParkingID}`, // Original pattern: lot-49
                `lot-${lot.ParkingID.toLowerCase()}`, // For lowercase: lot-1
                `lot-${lot.ParkingID}A`, // For pattern like: lot-2A
              ];
  
              let testImagePath = '';
              let testImageName = '';
              let imageFound = false;
  
              // Check all possible combinations
              for (const pattern of testImagePatterns) {
                for (const ext of testImageExtensions) {
                  testImageName = `${pattern}${ext}`;
                  testImagePath = path.join(this.testImagesDir, testImageName);
  
                  if (fs.existsSync(testImagePath)) {
                    imageFound = true;
                    console.log(`📸 Found test image: ${testImagePath}`);
                    break;
                  }
                }
                if (imageFound) break;
              }
  
              if (imageFound) {
                console.log(`🔍 Processing test image: ${testImageName}`);
                inferenceResult = await this.inferenceService.inferLocalImage(
                  '',
                  testImageName,
                );
              } else {
                console.log(`⚠️ No test image found for lot ${lot.ParkingID}`);
                continue;
              }
          } else {
              const fileName = this.buildFileName(lot.ParkingID);
              console.log(`🔍 Processing regular image: ${fileName}`);
              inferenceResult = await this.inferenceService.inferLocalImage(fileName);
              
              // Add detailed Roboflow prediction logging
              console.log('\n🤖 Roboflow Predictions:');
              console.log(JSON.stringify({
                raw_result: inferenceResult,
                predictions: inferenceResult?.predictions?.map(pred => ({
                  class: pred.class,
                  class_id: pred.class_id,
                  confidence: pred.confidence,
                  coordinates: {
                    x: pred.x,
                    y: pred.y,
                    width: pred.width,
                    height: pred.height
                  }
                }))
              }, null, 2));
          }
  
          const freeSpaces = countAvailableSpaces(inferenceResult);
          console.log('\n📊 Prediction Summary:');
          console.log(`Total predictions: ${inferenceResult?.predictions?.length || 0}`);
          console.log(`Free spaces detected: ${freeSpaces}`);
          console.log(`Confidence threshold used: ${process.env.CONFIDENCE_THRESHOLD || 'default'}`);
  
          console.log('\n📊 Parking Analysis:');
          console.log(`Previous available spaces: ${lot.Available}`);
          console.log(`Detected free spaces: ${freeSpaces}`);
          console.log(`Change: ${freeSpaces - lot.Available} spaces`);
  
          const previousAvailable = lot.Available;
          lot.Available = freeSpaces;
          await lot.save();
  
          console.log('\n💾 Database Update:');
          console.log(
            JSON.stringify(
              {
                parkingId: lot.ParkingID,
                location: lot.Location,
                previousCount: previousAvailable,
                newCount: freeSpaces,
                change: freeSpaces - previousAvailable,
                timestamp: new Date().toISOString(),
                status: 'success',
              },
              null,
              2,
            ),
          );
        } catch (err) {
          console.error(`❌ Error processing lot ${lot.ParkingID}:`, err.message);
          console.error('Full error details:', err);
        }
      }
      console.log('\n✅ === COMPLETED SCHEDULED PARKING UPDATES ===\n');
  }

  private buildFileName(parkingId: string): string {
    return `lot-${parkingId}.jpg`;
  }
}
