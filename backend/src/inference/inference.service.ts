import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParkingLot, ParkingLotDocument } from '../parking-lot.schema';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class InferenceService {
  private readonly logger = new Logger(InferenceService.name);
  private readonly testImagesDir = path.join(process.cwd(), 'test-images');

  constructor(
    @InjectModel(ParkingLot.name) private parkingLotModel: Model<ParkingLotDocument>,
  ) {}

  async getParkingLots() {
    try {
      return await this.parkingLotModel.find().exec();
    } catch (error) {
      this.logger.error(`Error fetching parking lots: ${error.message}`);
      throw error;
    }
  }

  async getParkingLotById(id: string) {
    try {
      return await this.parkingLotModel.findById(id).exec();
    } catch (error) {
      this.logger.error(`Error fetching parking lot with id ${id}: ${error.message}`);
      throw error;
    }
  }

  async inferLocalImage(imagePath: string, testImageName?: string): Promise<any> {
    try {
      const imageToProcess = testImageName 
        ? path.join(this.testImagesDir, testImageName)
        : imagePath;
      
      console.log('\n🖼️ Image Processing Details:');
      console.log(`Image path: ${imageToProcess}`);
      
      // Log image reading process
      if (fs.existsSync(imageToProcess)) {
        const imageBuffer = fs.readFileSync(imageToProcess);
        console.log('📸 Image successfully read');
        console.log('📦 Image size:', imageBuffer.length, 'bytes');
        console.log('🔄 Image format:', path.extname(imageToProcess));
        
        // Check if image is being converted to base64
        const base64Image = imageBuffer.toString('base64');
        console.log('✅ Image converted to base64');
        console.log('📊 Base64 length:', base64Image.length);
      } else {
        console.log('❌ Image file not found');
      }
      
      // Mock implementation for now
      const mockInferenceResult = {
        spaces: {
          total: 20,
          available: Math.floor(Math.random() * 21)
        }
      };
  
      // Log database update attempt
      console.log('\n💾 Attempting database update with inference results:');
      console.log(JSON.stringify(mockInferenceResult, null, 2));
  
      // Extract parking lot ID from filename
      const parkingLotId = testImageName 
        ? testImageName.split('-')[1].split('.')[0] 
        : imagePath.split('-')[1].split('.')[0];
  
      // Update the database
      const updatedLot = await this.parkingLotModel.findOneAndUpdate(
        { ParkingID: parkingLotId },
        { 
          $set: { 
            Available: mockInferenceResult.spaces.available,
            lastUpdated: new Date()
          } 
        },
        { new: true }
      );
  
      console.log('\n📝 Database Update Result:');
      console.log(JSON.stringify({
        parkingLotId,
        previousAvailable: updatedLot?.Available,
        newAvailable: mockInferenceResult.spaces.available,
        updateTime: new Date().toISOString(),
        success: !!updatedLot
      }, null, 2));
      
      return mockInferenceResult;
    } catch (error) {
      this.logger.error(`Error inferring local image: ${error.message}`);
      throw error;
    }
  }
}